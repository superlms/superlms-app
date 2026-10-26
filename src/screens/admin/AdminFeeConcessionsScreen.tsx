import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useFocusLoad } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { FeeStudent, getFeeStudents } from '../../api/adminFeeApi';
import { ConcessionRow, concessionValue, getConcessions } from '../../api/adminFeeSetupApi';
import { DocHeader, DocNoData } from '../more/docUi';
import { ErrorBox, ListRow, ListSkeleton } from './adminTransportUi';
import { DateSheet } from './adminFormUi';
import { DropPill } from './adminTransportUi';
import { ClassPills, useFeeClasses } from './adminFeeUi';
import { ListCount } from './adminStudentsUi';
import { Band, ClearPill, HeadActions, HeadBtn, PickPill, dmy, plural } from './feeSetupUi';

/**
 * Concession — the panel's tab: every fee discount granted, A to Z by student
 * (a student's newest first), narrowed by class, section, student or the day
 * it was granted. Each row says who, their class, what it applies to (Academic,
 * Transport, Last Year Dues), how much, why and when; a row opens it to edit.
 * + grants a new one. (Penalty waivers live under Penalties.)
 */

const AdminFeeConcessionsScreen = ({ navigation }: any) => {
  const classes = useFeeClasses();
  const [classId, setClassId] = useState<number | null>(null);
  const [sectionId, setSectionId] = useState<number | null>(null);
  const [studentId, setStudentId] = useState<number | null>(null);
  const [date, setDate] = useState('');
  const [dateOpen, setDateOpen] = useState(false);
  const [students, setStudents] = useState<FeeStudent[]>([]);

  const [rows, setRows] = useState<ConcessionRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState({ current: 1, last: 1 });
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [more, setMore] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    let live = true;
    setStudents([]);
    if (!classId) return;
    getFeeStudents({ standard_id: classId, section_id: sectionId ?? undefined })
      .then(d => live && setStudents(d))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [classId, sectionId]);

  const filters = useCallback(
    () => ({
      standard_id: classId ?? undefined,
      section_id: sectionId ?? undefined,
      student_id: studentId ?? undefined,
      date: date || undefined,
    }),
    [classId, sectionId, studentId, date],
  );

  const load = useCallback(async () => {
    const mine = ++seq.current;
    setError(null);
    try {
      const d = await getConcessions(filters(), 1);
      if (mine !== seq.current) return;
      setRows(d.concessions);
      setTotal(d.pagination.total);
      setPage({ current: d.pagination.current_page, last: d.pagination.last_page });
    } catch (e) {
      if (mine === seq.current) setError(apiErr(e, 'Could not load concessions.'));
    } finally {
      if (mine === seq.current) setRefreshing(false);
    }
  }, [filters]);

  useEffect(() => {
    setRows(null);
    load();
  }, [load]);

  const first = useRef(true);
  useFocusLoad(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    load();
  });

  const loadMore = async () => {
    if (more || !rows || page.current >= page.last) return;
    const mine = seq.current;
    setMore(true);
    try {
      const d = await getConcessions(filters(), page.current + 1);
      if (mine !== seq.current) return;
      setRows(prev => [...(prev ?? []), ...d.concessions.filter(c => !(prev ?? []).some(p => p.id === c.id))]);
      setPage({ current: d.pagination.current_page, last: d.pagination.last_page });
    } catch {
      // The next scroll asks again.
    } finally {
      setMore(false);
    }
  };

  const student = students.find(x => x.id === studentId) ?? null;
  const filtered = !!classId || !!sectionId || !!studentId || !!date;

  return (
    <View style={s.root}>
      <DocHeader
        title="Concession"
        onBackPress={() => navigation.goBack()}
        rightSlot={
          <HeadActions>
            <HeadBtn icon="add" onPress={() => navigation.navigate('AdminFeeConcessionForm', { classId, sectionId, studentId })} />
          </HeadActions>
        }
      />
      <Band>
        <ClassPills
          classes={classes}
          classId={classId}
          sectionId={sectionId}
          allLabel="All Classes"
          onChange={(c, sec) => {
            setClassId(c);
            setSectionId(sec);
            setStudentId(null);
          }}
        />
        {!!classId && (
          <PickPill
            title="Student"
            label={student ? student.name : 'All Students'}
            active={!!student}
            options={[{ key: '', label: 'All Students' }, ...students.map(x => ({ key: String(x.id), label: x.name, sub: x.father_name ? `Father: ${x.father_name}` : undefined }))]}
            value={studentId ? String(studentId) : ''}
            onPick={k => setStudentId(k ? Number(k) : null)}
          />
        )}
        <DropPill label={date ? `Granted ${dmy(date)}` : 'Granted on'} active={!!date} onPress={() => setDateOpen(true)} />
        {filtered && (
          <ClearPill
            onPress={() => {
              setClassId(null);
              setSectionId(null);
              setStudentId(null);
              setDate('');
            }}
          />
        )}
      </Band>

      {error && !rows ? (
        <ErrorBox message={error} onRetry={load} />
      ) : !rows ? (
        <View style={s.pad}>
          <ListSkeleton rows={7} />
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={r => String(r.id)}
          contentContainerStyle={[s.list, rows.length === 0 && s.listEmpty]}
          showsVerticalScrollIndicator={false}
          refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          ListHeaderComponent={rows.length > 0 ? <ListCount text={plural(total, 'concession')} /> : null}
          ListFooterComponent={more ? <ActivityIndicator style={s.more} size="small" color={theme.colors.primary} /> : null}
          ListEmptyComponent={
            <DocNoData
              icon="pricetag-outline"
              title={`No concessions ${filtered ? 'for this filter' : 'yet'}`}
              subtitle="Tap + (Add Concession) to grant a student a fee discount."
            />
          }
          renderItem={({ item, index }) => (
            <ListRow
              icon="pricetag-outline"
              title={item.student?.name ?? '—'}
              sub={[
                [item.class, item.section].filter(Boolean).join(' / ') || null,
                item.applies_to,
                item.reason || null,
              ]
                .filter(Boolean)
                .join(' · ')}
              meta={`Granted ${dmy(item.granted)}${item.year ? ` · ${item.year}` : ''}${item.student?.father_name ? ` · Father: ${item.student.father_name}` : ''}`}
              right={concessionValue(item)}
              tone="paid"
              onPress={() => navigation.navigate('AdminFeeConcessionForm', { concession: item })}
              isLast={index === rows.length - 1}
            />
          )}
        />
      )}

      <DateSheet visible={dateOpen} value={date || null} onPick={setDate} onClose={() => setDateOpen(false)} title="Granted on" />
    </View>
  );
};

export default AdminFeeConcessionsScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  pad: { paddingHorizontal: 20 },
  list: { paddingHorizontal: 20, paddingBottom: 40 },
  listEmpty: { flexGrow: 1 },
  more: { paddingVertical: 16 },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
