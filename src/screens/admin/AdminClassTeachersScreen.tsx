import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useFocusLoad } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import {
  AttClass,
  AttTeacher,
  ClassTeacherAssignment,
  getAttendanceLookups,
  getClassTeachers,
} from '../../api/adminAttendanceApi';
import { DocHeader, DocNoData } from '../more/docUi';
import { Tabs } from '../analytics/analyticsUi';
import { OptionSheet } from './adminFormUi';
import { Avatar, DropPill, ErrorBox, ListSkeleton } from './adminTransportUi';

/**
 * Class Teachers — the panel's tab of the same name: who is class teacher of
 * which class and section, in class order. By Class narrows to a class (and a
 * section of it), By Teacher to one teacher; switching method clears the
 * filters, so one never narrows the other. + assigns one; a row opens it to
 * change or remove.
 */

type Mode = 'by_class' | 'by_teacher';

const MODES: { key: Mode; label: string }[] = [
  { key: 'by_class', label: 'By Class' },
  { key: 'by_teacher', label: 'By Teacher' },
];

const AdminClassTeachersScreen = ({ navigation }: any) => {
  const [mode, setMode] = useState<Mode>('by_class');
  const [classes, setClasses] = useState<AttClass[]>([]);
  const [teachers, setTeachers] = useState<AttTeacher[]>([]);
  const [classId, setClassId] = useState<number | null>(null);
  const [sectionId, setSectionId] = useState<number | null>(null);
  const [teacherId, setTeacherId] = useState<number | null>(null);

  const [list, setList] = useState<ClassTeacherAssignment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [sheet, setSheet] = useState<null | 'class' | 'section' | 'teacher'>(null);

  useEffect(() => {
    getAttendanceLookups()
      .then(r => {
        setClasses(r.classes ?? []);
        setTeachers(r.teachers ?? []);
      })
      .catch(() => {});
  }, []);

  const seq = useRef(0);
  const load = useCallback(async () => {
    const mine = ++seq.current;
    setError(null);
    try {
      const r = await getClassTeachers({
        mode,
        standard_id: mode === 'by_class' ? classId : null,
        section_id: mode === 'by_class' ? sectionId : null,
        teacher_id: mode === 'by_teacher' ? teacherId : null,
      });
      if (mine === seq.current) setList(r.assignments);
    } catch (e) {
      if (mine === seq.current) setError(apiErr(e, 'Could not load class teachers.'));
    } finally {
      if (mine === seq.current) setRefreshing(false);
    }
  }, [mode, classId, sectionId, teacherId]);

  useEffect(() => {
    load();
  }, [load]);

  // Back from assigning or removing, the list is fresh.
  const loaded = useRef(false);
  useFocusLoad(() => {
    if (!loaded.current) {
      loaded.current = true;
      return;
    }
    load();
  });

  const clear = () => {
    setClassId(null);
    setSectionId(null);
    setTeacherId(null);
    setList(null);
  };

  const switchMode = (m: Mode) => {
    setMode(m);
    clear();
  };

  const cls = classes.find(c => c.id === classId) ?? null;
  const sec = cls?.sections.find(x => x.id === sectionId) ?? null;
  const teacher = teachers.find(t => t.id === teacherId) ?? null;
  const filtered = !!classId || !!sectionId || !!teacherId;

  // The panel's line saying what the list is showing.
  const context =
    mode === 'by_class'
      ? cls
        ? `Class teachers of ${cls.name}${sec ? ` · ${sec.name}` : ' (all sections)'}.`
        : 'Pick a class to see its class teachers; add a section to narrow it to one.'
      : teacher
      ? `The class and section ${teacher.name} is class teacher of.`
      : 'Pick a teacher to see which class and section they are class teacher of.';

  const renderRow = ({ item: a, index }: { item: ClassTeacherAssignment; index: number }) => (
    <TouchableOpacity
      style={[s.row, index < (list?.length ?? 0) - 1 && s.divider]}
      activeOpacity={0.6}
      onPress={() => navigation.navigate('AdminClassTeacherForm', { item: a })}
    >
      <Avatar uri={a.teacher_image} name={a.teacher_name} />
      <View style={s.body}>
        <Text style={s.name} numberOfLines={1}>{a.teacher_name}</Text>
        {!!a.teacher_email && <Text style={s.sub} numberOfLines={1}>{a.teacher_email}</Text>}
      </View>
      <View style={s.classTag}>
        <Text style={s.classTagText} numberOfLines={1}>
          {a.section ? `${a.standard} · ${a.section}` : a.standard}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={s.root}>
      <DocHeader
        title="Class Teachers"
        onBackPress={() => navigation.goBack()}
        rightIcon="add"
        onRightPress={() => navigation.navigate('AdminClassTeacherForm')}
      />
      <Tabs tabs={MODES} active={mode} onChange={switchMode} />

      <View style={s.filters}>
        {mode === 'by_class' ? (
          <>
            <DropPill label={cls?.name ?? 'Select class'} active={!!cls} onPress={() => setSheet('class')} />
            {!!cls && (
              <DropPill label={sec ? `Section ${sec.name}` : 'All sections'} active={!!sec} onPress={() => setSheet('section')} />
            )}
          </>
        ) : (
          <DropPill label={teacher?.name ?? 'Select teacher'} active={!!teacher} onPress={() => setSheet('teacher')} />
        )}
        {filtered && <DropPill label="Clear" onPress={clear} />}
      </View>
      <Text style={s.context}>{context}</Text>

      {error && !list ? (
        <ErrorBox message={error} onRetry={load} />
      ) : !list ? (
        <ListSkeleton photo />
      ) : (
        <FlatList
          data={list}
          keyExtractor={a => String(a.id)}
          renderItem={renderRow}
          ListEmptyComponent={
            <View>
              <DocNoData
                icon="school-outline"
                title="No class teachers assigned"
                subtitle={filtered ? 'Nobody is assigned for this filter.' : 'Assign one with +.'}
              />
              <TouchableOpacity onPress={() => navigation.navigate('AdminClassTeacherForm')} hitSlop={10} style={s.assignLink}>
                <Text style={s.assignText}>Assign a class teacher</Text>
              </TouchableOpacity>
            </View>
          }
          refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
        />
      )}

      <OptionSheet
        visible={sheet === 'class'}
        title="Class"
        options={classes.map(c => ({ key: String(c.id), label: c.name }))}
        selected={cls ? [String(cls.id)] : []}
        onPick={k => { setSheet(null); setClassId(Number(k)); setSectionId(null); setList(null); }}
        onClose={() => setSheet(null)}
        emptyText="No classes yet."
      />
      <OptionSheet
        visible={sheet === 'section'}
        title="Section"
        options={[{ key: '', label: 'All sections' }, ...(cls?.sections ?? []).map(x => ({ key: String(x.id), label: `Section ${x.name}` }))]}
        selected={[sec ? String(sec.id) : '']}
        onPick={k => { setSheet(null); setSectionId(k ? Number(k) : null); setList(null); }}
        onClose={() => setSheet(null)}
      />
      <OptionSheet
        visible={sheet === 'teacher'}
        title="Teacher"
        options={teachers.map(t => ({ key: String(t.id), label: t.name, sub: t.email }))}
        selected={teacher ? [String(teacher.id)] : []}
        onPick={k => { setSheet(null); setTeacherId(Number(k)); setList(null); }}
        onClose={() => setSheet(null)}
        emptyText="No teachers yet."
      />
    </View>
  );
};

export default AdminClassTeachersScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4 },
  context: { fontSize: 12, color: theme.colors.textMuted, paddingHorizontal: 20, paddingTop: 4, paddingBottom: 4, lineHeight: 17 },
  list: { paddingBottom: 40 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 20, paddingVertical: 12 },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },
  body: { flex: 1, gap: 2 },
  name: { fontSize: 15, fontWeight: '500', color: theme.colors.textPrimary },
  sub: { fontSize: 12, color: theme.colors.textMuted },
  classTag: { maxWidth: 140, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: theme.colors.primaryLight },
  classTagText: { fontSize: 12, fontWeight: '600', color: theme.colors.primary },
  assignLink: { alignSelf: 'center', marginTop: -8 },
  assignText: { fontSize: 14, fontWeight: '600', color: theme.colors.primary },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
