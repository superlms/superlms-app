import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useFocusLoad } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { FinderMode, SeatingRoomOption, SeatingSession, getSeatingFinder } from '../../api/adminSeatingApi';
import { DocHeader, DocNoData } from '../more/docUi';
import { ErrorState, FilterBar, FilterChip, PlainRow, RowsSkeleton, adminExamStyles as ui } from './adminExamUi';
import { OptionSheet, Segment } from './adminFormUi';
import { longDay, plural, statusLabel, useSeatingLookups } from './adminSeatingUi';

/**
 * Seating Plans — the panel's seat finder. Two ways in: by room (an exam, then
 * a room that holds a seat in it) or by class (an exam, a class and a
 * section); either ends in the same list, one row per generated session (a
 * date and shift) — by room its date, time and shift, by class the class's own
 * paper and the rooms it sits in — with its candidates and whether it is
 * published. A row opens the session: its seating list, each room's chart,
 * Publish and Delete. + in the header generates plans from the datesheet.
 *
 * Route params: examId – the exam to show (after Generate).
 */

type SheetKey = 'exam' | 'room' | 'class' | 'section' | null;

const MODES: { key: FinderMode; label: string }[] = [
  { key: 'room', label: 'By Room' },
  { key: 'class', label: 'By Class' },
];

const AdminSeatingPlansScreen = ({ navigation, route }: any) => {
  const lookups = useSeatingLookups();

  const [mode, setMode] = useState<FinderMode>('room');
  const [examId, setExamId] = useState<number | null>(route?.params?.examId ?? null);
  const [roomId, setRoomId] = useState<number | null>(null);
  const [standardId, setStandardId] = useState<number | null>(null);
  const [sectionId, setSectionId] = useState<number | null>(null);
  const [sheet, setSheet] = useState<SheetKey>(null);

  const [ready, setReady] = useState(false);
  const [roomOptions, setRoomOptions] = useState<SeatingRoomOption[]>([]);
  const [sessions, setSessions] = useState<SeatingSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // After Generate, the list opens on the exam just seated.
  const passedExam = route?.params?.examId;
  const passedAt = route?.params?.at;
  useEffect(() => {
    if (passedExam) {
      setExamId(passedExam);
      setRoomId(null);
      setStandardId(null);
      setSectionId(null);
    }
  }, [passedExam, passedAt]);

  const load = useCallback(
    async (showSkeleton = true) => {
      if (!examId) {
        setReady(false);
        setSessions([]);
        setRoomOptions([]);
        return;
      }
      if (showSkeleton) setLoading(true);
      setError(null);
      try {
        const res = await getSeatingFinder({ mode, exam_id: examId, room_id: roomId, standard_id: standardId, section_id: sectionId });
        setReady(res.ready);
        setSessions(res.sessions);
        setRoomOptions(res.room_options);
      } catch (e) {
        setError(apiErr(e, 'Could not load the seating plans.'));
      } finally {
        setLoading(false);
      }
    },
    [mode, examId, roomId, standardId, sectionId],
  );

  useEffect(() => {
    load(true);
  }, [load]);
  // Back from a session (published or deleted) or Generate: the list as it now is.
  const firstFocus = useRef(true);
  useFocusLoad(() => {
    if (firstFocus.current) {
      firstFocus.current = false;
      return;
    }
    load(false);
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await load(false);
    setRefreshing(false);
  };

  // Each mode keeps the exam and drops what the other one asked for.
  const pickMode = (m: FinderMode) => {
    if (m === mode) return;
    setMode(m);
    if (m === 'room') {
      setStandardId(null);
      setSectionId(null);
    } else {
      setRoomId(null);
    }
  };

  const clear = () => {
    setExamId(null);
    setRoomId(null);
    setStandardId(null);
    setSectionId(null);
  };

  const exams = lookups?.exams ?? [];
  const standards = lookups?.standards ?? [];
  const sections = (lookups?.sections ?? []).filter(x => x.standard_id === standardId);
  const exam = exams.find(e => e.id === examId);
  const room = roomOptions.find(r => r.id === roomId);
  const standard = standards.find(c => c.id === standardId);
  const section = sections.find(x => x.id === sectionId);

  const openSession = (row: SeatingSession) =>
    navigation.navigate('AdminSeatingSession', {
      row,
      mode,
      roomId: mode === 'room' ? roomId : null,
      standardId: mode === 'class' ? standardId : null,
      sectionId: mode === 'class' ? sectionId : null,
    });

  const empty = !ready ? (
    <DocNoData
      icon="grid-outline"
      title={mode === 'room' ? 'Choose an exam and a room' : 'Choose an exam, a class and a section'}
      subtitle="The papers appear here once the last one is picked."
    />
  ) : (
    <DocNoData
      icon="grid-outline"
      title="Nothing seated yet"
      subtitle={`No generated plan for this exam puts anyone ${mode === 'room' ? 'in that room' : 'on a seat'}.`}
    />
  );

  return (
    <View style={s.root}>
      <DocHeader
        title="Seating Plans"
        onBackPress={() => navigation.goBack()}
        rightIcon="add"
        onRightPress={() => navigation.navigate('AdminSeatingGenerate', { examId })}
      />

      <View style={s.modes}>
        <Segment options={MODES} value={mode} onChange={pickMode} />
      </View>

      <FilterBar onClear={examId || roomId || standardId || sectionId ? clear : undefined}>
        <FilterChip label={exam?.exam_name ?? 'Exam'} active={!!examId} onPress={() => setSheet('exam')} />
        {mode === 'room' ? (
          <FilterChip
            label={room ? room.room_name : 'Room'}
            active={!!roomId}
            disabled={!examId}
            onPress={() => setSheet('room')}
          />
        ) : (
          <>
            <FilterChip
              label={standard?.name ?? 'Class'}
              active={!!standardId}
              disabled={!examId}
              onPress={() => setSheet('class')}
            />
            <FilterChip
              label={section ? `Section ${section.name}` : 'Section'}
              active={!!sectionId}
              disabled={!standardId}
              onPress={() => setSheet('section')}
            />
          </>
        )}
      </FilterBar>

      {loading ? (
        <RowsSkeleton lead="icon" />
      ) : error ? (
        <ErrorState message={error} onRetry={() => load(true)} />
      ) : (
        <FlatList
          data={ready ? sessions : []}
          keyExtractor={r => String(r.plan_id)}
          contentContainerStyle={[ui.list, (!ready || sessions.length === 0) && s.grow]}
          showsVerticalScrollIndicator={false}
          refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={empty}
          ListHeaderComponent={
            ready && sessions.length > 0 ? <Text style={s.count}>{plural(sessions.length, 'session')}</Text> : null
          }
          renderItem={({ item, index }) => (
            <PlainRow
              icon="grid-outline"
              title={mode === 'room' ? longDay(item.date) : item.subject}
              lines={
                mode === 'room'
                  ? [`${item.time} · ${item.session}`, `${plural(item.students, 'candidate')} · ${statusLabel(item.status)}`]
                  : [
                      `${longDay(item.date)} · ${item.session}`,
                      `${item.rooms.join(', ')} · ${plural(item.students, 'candidate')} · ${statusLabel(item.status)}`,
                    ]
              }
              isLast={index === sessions.length - 1}
              onPress={() => openSession(item)}
            />
          )}
        />
      )}

      <OptionSheet
        visible={sheet === 'exam'}
        title="Exam"
        options={exams.map(e => ({ key: String(e.id), label: e.exam_name, sub: e.academic_year ?? undefined }))}
        selected={examId ? [String(examId)] : []}
        onPick={k => {
          // Picking an exam drops everything downstream.
          setExamId(Number(k));
          setRoomId(null);
          setStandardId(null);
          setSectionId(null);
          setSheet(null);
        }}
        onClose={() => setSheet(null)}
        emptyText="No exams yet."
      />
      <OptionSheet
        visible={sheet === 'room'}
        title="Room"
        options={roomOptions.map(r => ({ key: String(r.id), label: r.room_name, sub: r.building ?? undefined }))}
        selected={roomId ? [String(roomId)] : []}
        onPick={k => {
          setRoomId(Number(k));
          setSheet(null);
        }}
        onClose={() => setSheet(null)}
        emptyText="No room holds a seat in this exam yet."
      />
      <OptionSheet
        visible={sheet === 'class'}
        title="Class"
        options={standards.map(c => ({ key: String(c.id), label: c.name }))}
        selected={standardId ? [String(standardId)] : []}
        onPick={k => {
          setStandardId(Number(k));
          setSectionId(null);
          setSheet(null);
        }}
        onClose={() => setSheet(null)}
        emptyText="No classes yet."
      />
      <OptionSheet
        visible={sheet === 'section'}
        title="Section"
        options={sections.map(x => ({ key: String(x.id), label: `Section ${x.name}` }))}
        selected={sectionId ? [String(sectionId)] : []}
        onPick={k => {
          setSectionId(Number(k));
          setSheet(null);
        }}
        onClose={() => setSheet(null)}
        emptyText="This class has no sections."
      />
    </View>
  );
};

export default AdminSeatingPlansScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  modes: { paddingHorizontal: 20, paddingTop: 12 },
  count: { fontSize: 12, color: theme.colors.textMuted, marginTop: 14, marginBottom: 2 },
  grow: { flexGrow: 1 },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
