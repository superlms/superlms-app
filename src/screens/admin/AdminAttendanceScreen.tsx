import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import VectorIcon from '../../components/VectorIcon';
import Header from '../../components/Header';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useRefresh } from '../../hooks/useRefresh';
import { theme } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { FormModal } from './AdminStandardScreen';
import {
  AttStatus,
  AttendanceLookups,
  ByDateRow,
  ClassTeacherAssignment,
  MarkStudentRow,
  MarkTeacherRow,
  MonthCalendar,
  RecordStatus,
  Tally,
  YearlySummary,
  deleteClassTeacher,
  getAttendanceLookups,
  getClassTeachers,
  getStudentByDate,
  getStudentCalendar,
  getStudentMarkList,
  getTeacherByDate,
  getTeacherCalendar,
  getTeacherMarkList,
  saveClassTeacher,
  submitStudentAttendance,
  submitTeacherAttendance,
} from '../../api/adminAttendanceApi';

type MainTab = 'teacher' | 'student' | 'class_teachers';
type ViewMode = 'by_date' | 'calendar';

const STATUS_META: Record<RecordStatus, { label: string; color: string; short: string }> = {
  present:    { label: 'Present', color: '#22C55E', short: 'P' },
  absent:     { label: 'Absent',  color: '#EF4444', short: 'A' },
  half_day:   { label: 'Half',    color: '#F59E0B', short: 'H' },
  holiday:    { label: 'Holiday', color: '#6366F1', short: 'Ho' },
  not_marked: { label: 'Not Marked', color: '#94A3B8', short: '—' },
  off:        { label: '', color: 'transparent', short: '' },
};
const MARK_OPTIONS: AttStatus[] = ['present', 'absent', 'half_day', 'holiday'];
const DOW = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const todayStr = () => new Date().toISOString().slice(0, 10);
const monthStr = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const addDays = (s: string, n: number) => { const d = new Date(s + 'T00:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const addMonths = (s: string, n: number) => { const [y, m] = s.split('-').map(Number); const d = new Date(y, m - 1 + n, 1); return monthStr(d); };
const fmtDate = (s: string) => new Date(s + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
const fmtMonth = (s: string) => { const [y, m] = s.split('-').map(Number); return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }); };

const initials = (name: string) => name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

const AdminAttendanceScreen = ({ navigation }: any) => {
  const [tab, setTab] = useState<MainTab>('teacher');
  const [lookups, setLookups] = useState<AttendanceLookups | null>(null);
  useEffect(() => { getAttendanceLookups().then(setLookups).catch(() => {}); }, []);
  const sectionsFor = (cid: number | null) => lookups?.classes.find(c => c.id === cid)?.sections ?? [];

  // shared class/section for student views
  const [cls, setCls] = useState<number | null>(null);
  const [sec, setSec] = useState<number | null>(null);

  // ── Teacher state ──
  const [tView, setTView] = useState<ViewMode>('by_date');
  const [tDate, setTDate] = useState(todayStr());
  const [tRows, setTRows] = useState<ByDateRow[]>([]);
  const [tStats, setTStats] = useState<Tally | null>(null);
  const [tFilter, setTFilter] = useState<RecordStatus | ''>('');
  const [tTeacher, setTTeacher] = useState<number | null>(null);
  const [tRange, setTRange] = useState<'monthly' | 'yearly'>('monthly');
  const [tMonth, setTMonth] = useState(monthStr());
  const [tYear, setTYear] = useState(new Date().getFullYear());
  const [tCal, setTCal] = useState<MonthCalendar | null>(null);
  const [tYearly, setTYearly] = useState<YearlySummary | null>(null);

  // ── Student state ──
  const [sView, setSView] = useState<ViewMode>('by_date');
  const [sDate, setSDate] = useState(todayStr());
  const [sRows, setSRows] = useState<ByDateRow[]>([]);
  const [sStats, setSStats] = useState<Tally | null>(null);
  const [sFilter, setSFilter] = useState<RecordStatus | ''>('');
  const [sStudent, setSStudent] = useState<number | null>(null);
  const [sStudentList, setSStudentList] = useState<{ id: number; name: string }[]>([]);
  const [sRange, setSRange] = useState<'monthly' | 'yearly'>('monthly');
  const [sMonth, setSMonth] = useState(monthStr());
  const [sYear, setSYear] = useState(new Date().getFullYear());
  const [sCal, setSCal] = useState<MonthCalendar | null>(null);
  const [sYearly, setSYearly] = useState<YearlySummary | null>(null);

  const [loading, setLoading] = useState(false);

  // ── Mark mode ──
  const [markOpen, setMarkOpen] = useState(false);
  const [markKind, setMarkKind] = useState<'teacher' | 'student'>('teacher');
  const [markDate, setMarkDate] = useState(todayStr());
  const [markTeacherRows, setMarkTeacherRows] = useState<MarkTeacherRow[]>([]);
  const [markStudentRows, setMarkStudentRows] = useState<MarkStudentRow[]>([]);
  const [markLoading, setMarkLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // ── Class Teachers ──
  const [ctMode, setCtMode] = useState<'by_class' | 'by_teacher'>('by_class');
  const [ctClass, setCtClass] = useState<number | null>(null);
  const [ctSection, setCtSection] = useState<number | null>(null);
  const [ctTeacher, setCtTeacher] = useState<number | null>(null);
  const [assignments, setAssignments] = useState<ClassTeacherAssignment[]>([]);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignId, setAssignId] = useState<number | null>(null);
  const [aTeacher, setATeacher] = useState<number | null>(null);
  const [aClass, setAClass] = useState<number | null>(null);
  const [aSection, setASection] = useState<number | null>(null);

  // ── Loaders ──
  const loadTeacher = useCallback(async () => {
    setLoading(true);
    try {
      if (tView === 'by_date') {
        const res = await getTeacherByDate(tDate, tFilter);
        setTRows(res.rows); setTStats(res.stats);
      } else if (tTeacher) {
        const res = await getTeacherCalendar({ teacher_id: tTeacher, month: tRange === 'monthly' ? tMonth : undefined, year: tRange === 'yearly' ? tYear : undefined });
        setTCal(res.calendar ?? null); setTYearly(res.yearly ?? null);
      } else { setTCal(null); setTYearly(null); }
    } catch (e) { Alert.alert('Error', apiErr(e, 'Could not load attendance.')); }
    finally { setLoading(false); }
  }, [tView, tDate, tFilter, tTeacher, tRange, tMonth, tYear]);

  const loadStudent = useCallback(async () => {
    if (!cls || !sec) { setSRows([]); setSCal(null); setSYearly(null); return; }
    setLoading(true);
    try {
      if (sView === 'by_date') {
        const res = await getStudentByDate(cls, sec, sDate, sFilter);
        setSRows(res.rows); setSStats(res.stats);
      } else if (sStudent) {
        const res = await getStudentCalendar({ student_id: sStudent, month: sRange === 'monthly' ? sMonth : undefined, year: sRange === 'yearly' ? sYear : undefined });
        setSCal(res.calendar ?? null); setSYearly(res.yearly ?? null);
      } else { setSCal(null); setSYearly(null); }
    } catch (e) { Alert.alert('Error', apiErr(e, 'Could not load attendance.')); }
    finally { setLoading(false); }
  }, [cls, sec, sView, sDate, sFilter, sStudent, sRange, sMonth, sYear]);

  const loadClassTeachers = useCallback(async () => {
    setLoading(true);
    try {
      setAssignments(await getClassTeachers({ mode: ctMode, standard_id: ctMode === 'by_class' ? ctClass : null, section_id: ctMode === 'by_class' ? ctSection : null, teacher_id: ctMode === 'by_teacher' ? ctTeacher : null }));
    } catch (e) { Alert.alert('Error', apiErr(e, 'Could not load class teachers.')); }
    finally { setLoading(false); }
  }, [ctMode, ctClass, ctSection, ctTeacher]);

  useEffect(() => { if (tab === 'teacher') loadTeacher(); }, [tab, loadTeacher]);
  useEffect(() => { if (tab === 'student') loadStudent(); }, [tab, loadStudent]);
  useEffect(() => { if (tab === 'class_teachers') loadClassTeachers(); }, [tab, loadClassTeachers]);

  // student list for calendar picker
  useEffect(() => {
    if (tab !== 'student' || !cls || !sec) { setSStudentList([]); return; }
    import('../../api/adminAttendanceApi').then(({ getSectionStudents }) => {
      getSectionStudents(cls, sec).then(list => setSStudentList(list.map(s => ({ id: s.id, name: s.name })))).catch(() => setSStudentList([]));
    });
  }, [tab, cls, sec]);

  const { refreshing, onRefresh } = useRefresh(async () => {
    if (tab === 'teacher') await loadTeacher();
    else if (tab === 'student') await loadStudent();
    else await loadClassTeachers();
  });

  // ── Mark mode ──
  const openTeacherMark = async () => {
    setMarkKind('teacher'); setMarkDate(tDate); setMarkOpen(true); setMarkLoading(true);
    try { const res = await getTeacherMarkList(tDate); setMarkTeacherRows(res.rows); }
    catch (e) { Alert.alert('Error', apiErr(e, 'Could not load teachers.')); }
    finally { setMarkLoading(false); }
  };
  const openStudentMark = async () => {
    if (!cls || !sec) return Alert.alert('Required', 'Pick class and section first.');
    setMarkKind('student'); setMarkDate(sDate); setMarkOpen(true); setMarkLoading(true);
    try { const res = await getStudentMarkList(cls, sec, sDate); setMarkStudentRows(res.rows); }
    catch (e) { Alert.alert('Error', apiErr(e, 'Could not load students.')); }
    finally { setMarkLoading(false); }
  };
  const reloadMark = async (d: string) => {
    setMarkLoading(true);
    try {
      if (markKind === 'teacher') { const res = await getTeacherMarkList(d); setMarkTeacherRows(res.rows); }
      else if (cls && sec) { const res = await getStudentMarkList(cls, sec, d); setMarkStudentRows(res.rows); }
    } catch {} finally { setMarkLoading(false); }
  };
  const setTeacherStatus = (id: number, st: AttStatus) => setMarkTeacherRows(r => r.map(x => x.teacher_detail_id === id ? { ...x, status: st } : x));
  const setStudentStatus = (id: number, st: AttStatus) => setMarkStudentRows(r => r.map(x => x.student_detail_id === id ? { ...x, status: st } : x));
  const markAll = (st: AttStatus) => {
    if (markKind === 'teacher') setMarkTeacherRows(r => r.map(x => ({ ...x, status: st })));
    else setMarkStudentRows(r => r.map(x => ({ ...x, status: st })));
  };

  const submitMark = async () => {
    setSaving(true);
    try {
      if (markKind === 'teacher') {
        await submitTeacherAttendance({ date: markDate, marks: markTeacherRows.map(r => ({ teacher_detail_id: r.teacher_detail_id, status: r.status, remark: r.remark })) });
        setTDate(markDate); setMarkOpen(false); await loadTeacher();
      } else if (cls && sec) {
        await submitStudentAttendance({ standard_id: cls, section_id: sec, date: markDate, marks: markStudentRows.map(r => ({ student_detail_id: r.student_detail_id, user_id: r.user_id, status: r.status, remark: r.remark })) });
        setSDate(markDate); setMarkOpen(false); await loadStudent();
      }
    } catch (e) { Alert.alert('Error', apiErr(e, 'Could not save attendance.')); }
    finally { setSaving(false); }
  };

  // ── Class teacher assign ──
  const openAssign = (a?: ClassTeacherAssignment) => {
    setAssignId(a?.id ?? null);
    setATeacher(a?.teacher_id ?? null);
    setAClass(a?.standard_id ?? null);
    setASection(a?.section_id ?? null);
    setAssignOpen(true);
  };
  const saveAssign = async () => {
    if (!aTeacher) return Alert.alert('Required', 'Pick a teacher.');
    if (!aClass) return Alert.alert('Required', 'Pick a class.');
    try {
      await saveClassTeacher({ id: assignId, teacher_detail_id: aTeacher, standard_id: aClass, section_id: aSection });
      setAssignOpen(false); await loadClassTeachers();
    } catch (e) { Alert.alert('Error', apiErr(e, 'Could not save assignment.')); }
  };
  const removeAssign = (a: ClassTeacherAssignment) =>
    Alert.alert('Remove Assignment', `Remove ${a.teacher_name} from ${a.standard}${a.section ? ' ' + a.section : ''}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => { try { await deleteClassTeacher(a.id); await loadClassTeachers(); } catch (e) { Alert.alert('Error', apiErr(e, 'Could not remove.')); } } },
    ]);

  // ── Render helpers ──
  const StatusPill = ({ st }: { st: RecordStatus }) => {
    const m = STATUS_META[st];
    return <View style={[s.pill, { backgroundColor: m.color + '22' }]}><Text style={[s.pillText, { color: m.color }]}>{m.label}</Text></View>;
  };

  const StatsBar = ({ stats }: { stats: Tally | null }) => !stats ? null : (
    <View style={s.statsBar}>
      {(['present', 'absent', 'half_day', 'holiday', 'not_marked'] as RecordStatus[]).map(k => (
        <View key={k} style={s.statPillWrap}>
          <Text style={[s.statNum, { color: STATUS_META[k].color }]}>{(stats as any)[k] ?? 0}</Text>
          <Text style={s.statCap}>{STATUS_META[k].label}</Text>
        </View>
      ))}
    </View>
  );

  const FilterChips = ({ value, onChange }: { value: RecordStatus | ''; onChange: (v: RecordStatus | '') => void }) => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterBar} contentContainerStyle={s.filterContent}>
      {(['', 'present', 'absent', 'half_day', 'holiday', 'not_marked'] as (RecordStatus | '')[]).map(k => {
        const active = value === k;
        return (
          <TouchableOpacity key={k || 'all'} style={[s.pchip, active && s.pchipActive]} onPress={() => onChange(k)}>
            <Text style={[s.pchipText, active && s.pchipTextActive]}>{k === '' ? 'All' : STATUS_META[k].label}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );

  const DateStepper = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <View style={s.stepper}>
      <TouchableOpacity style={s.stepBtn} onPress={() => onChange(addDays(value, -1))}><VectorIcon iconSet="Ionicons" iconName="chevron-back" size={18} color={theme.colors.textPrimary} /></TouchableOpacity>
      <TouchableOpacity style={s.stepMid} onPress={() => onChange(todayStr())}><Text style={s.stepText}>{fmtDate(value)}</Text></TouchableOpacity>
      <TouchableOpacity style={s.stepBtn} onPress={() => onChange(addDays(value, 1))}><VectorIcon iconSet="Ionicons" iconName="chevron-forward" size={18} color={theme.colors.textPrimary} /></TouchableOpacity>
    </View>
  );

  const MonthStepper = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <View style={s.stepper}>
      <TouchableOpacity style={s.stepBtn} onPress={() => onChange(addMonths(value, -1))}><VectorIcon iconSet="Ionicons" iconName="chevron-back" size={18} color={theme.colors.textPrimary} /></TouchableOpacity>
      <View style={s.stepMid}><Text style={s.stepText}>{fmtMonth(value)}</Text></View>
      <TouchableOpacity style={s.stepBtn} onPress={() => onChange(addMonths(value, 1))}><VectorIcon iconSet="Ionicons" iconName="chevron-forward" size={18} color={theme.colors.textPrimary} /></TouchableOpacity>
    </View>
  );

  const CalendarView = ({ cal }: { cal: MonthCalendar }) => (
    <View style={s.calCard}>
      <View style={s.calDowRow}>{DOW.map(d => <Text key={d} style={s.calDow}>{d}</Text>)}</View>
      {cal.weeks.map((week, wi) => (
        <View key={wi} style={s.calWeek}>
          {week.map((cell, ci) => {
            if (!cell) return <View key={ci} style={s.calCell} />;
            const m = STATUS_META[cell.status];
            const on = cell.status !== 'off';
            return (
              <View key={ci} style={[s.calCell, on && { backgroundColor: m.color + '22' }]}>
                <Text style={[s.calDay, on && { color: m.color, fontWeight: '800' }]}>{cell.day}</Text>
              </View>
            );
          })}
        </View>
      ))}
      <View style={s.calTotals}>
        <Text style={s.calTotal}>Present {cal.totals.present_days}</Text>
        <Text style={s.calTotal}>Absent {cal.totals.absent_days}</Text>
        <Text style={s.calTotal}>Half {cal.totals.half_days}</Text>
        <Text style={[s.calTotal, { color: theme.colors.primary, fontWeight: '800' }]}>{cal.totals.percent}%</Text>
      </View>
    </View>
  );

  const YearlyView = ({ y }: { y: YearlySummary }) => (
    <View>
      <View style={s.yearTotals}>
        <Text style={s.yearTotalText}>Present {y.totals.present} · Absent {y.totals.absent} · Half {y.totals.half_day}</Text>
        <Text style={[s.yearTotalText, { color: theme.colors.primary, fontWeight: '800' }]}>{y.totals.percent}% overall</Text>
      </View>
      <View style={s.yearGrid}>
        {y.months.map((m, i) => (
          <View key={i} style={s.monthCard}>
            <Text style={s.monthLabel}>{m.label}</Text>
            <Text style={[s.monthPct, { color: m.working ? theme.colors.primary : theme.colors.textMuted }]}>{m.working ? `${m.percent}%` : '—'}</Text>
            <Text style={s.monthMeta}>P{m.present} A{m.absent} H{m.half_day}</Text>
          </View>
        ))}
      </View>
    </View>
  );

  const RowList = ({ rows }: { rows: ByDateRow[] }) => (
    <>
      {rows.length === 0 && <Text style={s.empty}>No records.</Text>}
      {rows.map((r, i) => (
        <View key={i} style={s.row}>
          <View style={s.avatar}><Text style={s.avatarText}>{initials(r.name)}</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={s.rowName}>{r.name}</Text>
            {!!r.remark && <Text style={s.rowRemark} numberOfLines={1}>{r.remark}</Text>}
          </View>
          <StatusPill st={r.status} />
        </View>
      ))}
    </>
  );

  const ClassSectionPicker = () => (
    <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterBar} contentContainerStyle={s.filterContent}>
        {(lookups?.classes ?? []).map(c => (
          <TouchableOpacity key={c.id} style={[s.pchip, cls === c.id && s.pchipActive]} onPress={() => { setCls(c.id); setSec(null); setSStudent(null); }}>
            <Text style={[s.pchipText, cls === c.id && s.pchipTextActive]}>{c.name}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      {!!cls && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterBar2} contentContainerStyle={s.filterContent}>
          {sectionsFor(cls).map(se => (
            <TouchableOpacity key={se.id} style={[s.pchip, sec === se.id && s.pchipActive]} onPress={() => { setSec(se.id); setSStudent(null); }}>
              <Text style={[s.pchipText, sec === se.id && s.pchipTextActive]}>{se.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </>
  );

  const markRows = markKind === 'teacher' ? markTeacherRows : markStudentRows;

  return (
    <View style={s.root}>
      <Header title="Attendance" onBackPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('PanelHome'))} />

      <View style={s.tabRow}>
        {([['teacher', 'Teacher'], ['student', 'Student'], ['class_teachers', 'Class Teachers']] as [MainTab, string][]).map(([t, label]) => {
          const active = tab === t;
          return (
            <TouchableOpacity key={t} style={[s.tab, active && s.tabActive]} onPress={() => setTab(t)} activeOpacity={0.8}>
              <Text style={[s.tabText, active && s.tabTextActive]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ══════════ TEACHER ══════════ */}
      {tab === 'teacher' && (
        <>
          <View style={s.viewRow}>
            {(['by_date', 'calendar'] as ViewMode[]).map(v => (
              <TouchableOpacity key={v} style={[s.viewBtn, tView === v && s.viewBtnActive]} onPress={() => setTView(v)}>
                <Text style={[s.viewBtnText, tView === v && s.viewBtnTextActive]}>{v === 'by_date' ? 'Records' : 'Calendar'}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={s.markBtn} onPress={openTeacherMark}>
              <VectorIcon iconSet="Ionicons" iconName="checkbox-outline" size={15} color="#fff" />
              <Text style={s.markBtnText}>Mark</Text>
            </TouchableOpacity>
          </View>

          {tView === 'by_date' ? (
            <>
              <DateStepper value={tDate} onChange={setTDate} />
              <FilterChips value={tFilter} onChange={setTFilter} />
              <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
                <StatsBar stats={tStats} />
                {loading ? <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 20 }} /> : <RowList rows={tRows} />}
                <View style={{ height: 40 }} />
              </ScrollView>
            </>
          ) : (
            <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterBar} contentContainerStyle={s.filterContent}>
                {(lookups?.teachers ?? []).map(t => (
                  <TouchableOpacity key={t.id} style={[s.pchip, tTeacher === t.id && s.pchipActive]} onPress={() => setTTeacher(t.id)}>
                    <Text style={[s.pchipText, tTeacher === t.id && s.pchipTextActive]}>{t.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              {!tTeacher ? <Text style={s.empty}>Pick a teacher to see their calendar.</Text> : (
                <>
                  <View style={s.rangeRow}>
                    {(['monthly', 'yearly'] as const).map(r => (
                      <TouchableOpacity key={r} style={[s.rangeBtn, tRange === r && s.rangeBtnActive]} onPress={() => setTRange(r)}>
                        <Text style={[s.rangeText, tRange === r && s.rangeTextActive]}>{r === 'monthly' ? 'Monthly' : 'Yearly'}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  {tRange === 'monthly' ? (
                    <>
                      <MonthStepper value={tMonth} onChange={setTMonth} />
                      {loading ? <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 20 }} /> : tCal ? <CalendarView cal={tCal} /> : <Text style={s.empty}>No data.</Text>}
                    </>
                  ) : (
                    <>
                      <View style={s.stepper}>
                        <TouchableOpacity style={s.stepBtn} onPress={() => setTYear(y => y - 1)}><VectorIcon iconSet="Ionicons" iconName="chevron-back" size={18} color={theme.colors.textPrimary} /></TouchableOpacity>
                        <View style={s.stepMid}><Text style={s.stepText}>{tYear}</Text></View>
                        <TouchableOpacity style={s.stepBtn} onPress={() => setTYear(y => y + 1)}><VectorIcon iconSet="Ionicons" iconName="chevron-forward" size={18} color={theme.colors.textPrimary} /></TouchableOpacity>
                      </View>
                      {loading ? <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 20 }} /> : tYearly ? <YearlyView y={tYearly} /> : <Text style={s.empty}>No data.</Text>}
                    </>
                  )}
                </>
              )}
              <View style={{ height: 40 }} />
            </ScrollView>
          )}
        </>
      )}

      {/* ══════════ STUDENT ══════════ */}
      {tab === 'student' && (
        <>
          <ClassSectionPicker />
          {!cls || !sec ? (
            <Text style={s.empty}>Pick a class and section.</Text>
          ) : (
            <>
              <View style={s.viewRow}>
                {(['by_date', 'calendar'] as ViewMode[]).map(v => (
                  <TouchableOpacity key={v} style={[s.viewBtn, sView === v && s.viewBtnActive]} onPress={() => setSView(v)}>
                    <Text style={[s.viewBtnText, sView === v && s.viewBtnTextActive]}>{v === 'by_date' ? 'Records' : 'Calendar'}</Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity style={s.markBtn} onPress={openStudentMark}>
                  <VectorIcon iconSet="Ionicons" iconName="checkbox-outline" size={15} color="#fff" />
                  <Text style={s.markBtnText}>Mark</Text>
                </TouchableOpacity>
              </View>

              {sView === 'by_date' ? (
                <>
                  <DateStepper value={sDate} onChange={setSDate} />
                  <FilterChips value={sFilter} onChange={setSFilter} />
                  <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
                    <StatsBar stats={sStats} />
                    {loading ? <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 20 }} /> : <RowList rows={sRows} />}
                    <View style={{ height: 40 }} />
                  </ScrollView>
                </>
              ) : (
                <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterBar} contentContainerStyle={s.filterContent}>
                    {sStudentList.map(st => (
                      <TouchableOpacity key={st.id} style={[s.pchip, sStudent === st.id && s.pchipActive]} onPress={() => setSStudent(st.id)}>
                        <Text style={[s.pchipText, sStudent === st.id && s.pchipTextActive]}>{st.name}</Text>
                      </TouchableOpacity>
                    ))}
                    {sStudentList.length === 0 && <Text style={s.pickerEmpty}>No students</Text>}
                  </ScrollView>
                  {!sStudent ? <Text style={s.empty}>Pick a student.</Text> : (
                    <>
                      <View style={s.rangeRow}>
                        {(['monthly', 'yearly'] as const).map(r => (
                          <TouchableOpacity key={r} style={[s.rangeBtn, sRange === r && s.rangeBtnActive]} onPress={() => setSRange(r)}>
                            <Text style={[s.rangeText, sRange === r && s.rangeTextActive]}>{r === 'monthly' ? 'Monthly' : 'Yearly'}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                      {sRange === 'monthly' ? (
                        <>
                          <MonthStepper value={sMonth} onChange={setSMonth} />
                          {loading ? <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 20 }} /> : sCal ? <CalendarView cal={sCal} /> : <Text style={s.empty}>No data.</Text>}
                        </>
                      ) : (
                        <>
                          <View style={s.stepper}>
                            <TouchableOpacity style={s.stepBtn} onPress={() => setSYear(y => y - 1)}><VectorIcon iconSet="Ionicons" iconName="chevron-back" size={18} color={theme.colors.textPrimary} /></TouchableOpacity>
                            <View style={s.stepMid}><Text style={s.stepText}>{sYear}</Text></View>
                            <TouchableOpacity style={s.stepBtn} onPress={() => setSYear(y => y + 1)}><VectorIcon iconSet="Ionicons" iconName="chevron-forward" size={18} color={theme.colors.textPrimary} /></TouchableOpacity>
                          </View>
                          {loading ? <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 20 }} /> : sYearly ? <YearlyView y={sYearly} /> : <Text style={s.empty}>No data.</Text>}
                        </>
                      )}
                    </>
                  )}
                  <View style={{ height: 40 }} />
                </ScrollView>
              )}
            </>
          )}
        </>
      )}

      {/* ══════════ CLASS TEACHERS ══════════ */}
      {tab === 'class_teachers' && (
        <>
          <View style={s.viewRow}>
            {(['by_class', 'by_teacher'] as const).map(m => (
              <TouchableOpacity key={m} style={[s.viewBtn, ctMode === m && s.viewBtnActive]} onPress={() => { setCtMode(m); setCtClass(null); setCtSection(null); setCtTeacher(null); }}>
                <Text style={[s.viewBtnText, ctMode === m && s.viewBtnTextActive]}>{m === 'by_class' ? 'By Class' : 'By Teacher'}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {ctMode === 'by_class' ? (
            <>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterBar} contentContainerStyle={s.filterContent}>
                {(lookups?.classes ?? []).map(c => (
                  <TouchableOpacity key={c.id} style={[s.pchip, ctClass === c.id && s.pchipActive]} onPress={() => { setCtClass(ctClass === c.id ? null : c.id); setCtSection(null); }}>
                    <Text style={[s.pchipText, ctClass === c.id && s.pchipTextActive]}>{c.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              {!!ctClass && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterBar2} contentContainerStyle={s.filterContent}>
                  {sectionsFor(ctClass).map(se => (
                    <TouchableOpacity key={se.id} style={[s.pchip, ctSection === se.id && s.pchipActive]} onPress={() => setCtSection(ctSection === se.id ? null : se.id)}>
                      <Text style={[s.pchipText, ctSection === se.id && s.pchipTextActive]}>{se.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterBar} contentContainerStyle={s.filterContent}>
              {(lookups?.teachers ?? []).map(t => (
                <TouchableOpacity key={t.id} style={[s.pchip, ctTeacher === t.id && s.pchipActive]} onPress={() => setCtTeacher(ctTeacher === t.id ? null : t.id)}>
                  <Text style={[s.pchipText, ctTeacher === t.id && s.pchipTextActive]}>{t.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
          <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
            {loading ? <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 20 }} /> : assignments.length === 0 ? <Text style={s.empty}>No class teachers assigned.</Text> : assignments.map(a => (
              <View key={a.id} style={s.row}>
                <View style={s.avatar}><Text style={s.avatarText}>{initials(a.teacher_name)}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.rowName}>{a.teacher_name}</Text>
                  <Text style={s.rowRemark}>{a.standard}{a.section ? ` · ${a.section}` : ''}</Text>
                </View>
                <TouchableOpacity style={s.act} onPress={() => openAssign(a)}><VectorIcon iconSet="Ionicons" iconName="create-outline" size={16} color={theme.colors.primary} /></TouchableOpacity>
                <TouchableOpacity style={s.act} onPress={() => removeAssign(a)}><VectorIcon iconSet="Ionicons" iconName="trash-outline" size={16} color={theme.colors.danger} /></TouchableOpacity>
              </View>
            ))}
            <View style={{ height: 90 }} />
          </ScrollView>
          <TouchableOpacity style={s.fab} onPress={() => openAssign()} activeOpacity={0.9}>
            <VectorIcon iconSet="Ionicons" iconName="add" size={28} color="#fff" />
          </TouchableOpacity>
        </>
      )}

      {/* ══════════ MARK MODAL ══════════ */}
      <Modal visible={markOpen} animationType="slide" onRequestClose={() => setMarkOpen(false)}>
        <View style={s.root}>
          <Header title={markKind === 'teacher' ? 'Mark Teacher Attendance' : 'Mark Student Attendance'} onBackPress={() => setMarkOpen(false)} />
          <DateStepper value={markDate} onChange={d => { setMarkDate(d); reloadMark(d); }} />
          <View style={s.markAllRow}>
            <Text style={s.markAllLabel}>Mark all:</Text>
            {MARK_OPTIONS.map(o => (
              <TouchableOpacity key={o} style={[s.markAllBtn, { borderColor: STATUS_META[o].color }]} onPress={() => markAll(o)}>
                <Text style={[s.markAllText, { color: STATUS_META[o].color }]}>{STATUS_META[o].short}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {markLoading ? <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 30 }} /> : (
            <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
              {markRows.length === 0 && <Text style={s.empty}>No one to mark.</Text>}
              {markKind === 'teacher' ? markTeacherRows.map(r => (
                <MarkRow key={r.teacher_detail_id} name={r.name} status={r.status} onSet={st => setTeacherStatus(r.teacher_detail_id, st)} />
              )) : markStudentRows.map(r => (
                <MarkRow key={r.student_detail_id} name={r.name} roll={r.roll_no} status={r.status} onSet={st => setStudentStatus(r.student_detail_id, st)} />
              ))}
              <View style={{ height: 90 }} />
            </ScrollView>
          )}
          <View style={s.submitBar}>
            <TouchableOpacity style={s.submitBtn} onPress={submitMark} disabled={saving} activeOpacity={0.9}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.submitText}>Save Attendance</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ══════════ ASSIGN MODAL ══════════ */}
      <FormModal visible={assignOpen} title={assignId ? 'Edit Class Teacher' : 'Assign Class Teacher'} onClose={() => setAssignOpen(false)} onSave={saveAssign} saving={false} saveLabel="Save">
        <Text style={s.fieldLabel}>Teacher</Text>
        <View style={s.wrapChips}>
          {(lookups?.teachers ?? []).map(t => (
            <TouchableOpacity key={t.id} style={[s.selChip, aTeacher === t.id && s.selChipActive]} onPress={() => setATeacher(t.id)}>
              <Text style={[s.selChipText, aTeacher === t.id && s.selChipTextActive]}>{t.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={s.fieldLabel}>Class</Text>
        <View style={s.wrapChips}>
          {(lookups?.classes ?? []).map(c => (
            <TouchableOpacity key={c.id} style={[s.selChip, aClass === c.id && s.selChipActive]} onPress={() => { setAClass(c.id); setASection(null); }}>
              <Text style={[s.selChipText, aClass === c.id && s.selChipTextActive]}>{c.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {!!aClass && (
          <>
            <Text style={s.fieldLabel}>Section (optional)</Text>
            <View style={s.wrapChips}>
              {sectionsFor(aClass).map(se => (
                <TouchableOpacity key={se.id} style={[s.selChip, aSection === se.id && s.selChipActive]} onPress={() => setASection(aSection === se.id ? null : se.id)}>
                  <Text style={[s.selChipText, aSection === se.id && s.selChipTextActive]}>{se.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}
      </FormModal>
    </View>
  );
};

const MarkRow = ({ name, roll, status, onSet }: { name: string; roll?: string | number | null; status: AttStatus; onSet: (s: AttStatus) => void }) => (
  <View style={s.markRow}>
    <View style={{ flex: 1 }}>
      <Text style={s.rowName}>{name}</Text>
      {roll != null && roll !== '' && <Text style={s.rowRemark}>Roll {roll}</Text>}
    </View>
    <View style={s.markBtns}>
      {MARK_OPTIONS.map(o => {
        const active = status === o;
        const m = STATUS_META[o];
        return (
          <TouchableOpacity key={o} style={[s.mBtn, active && { backgroundColor: m.color, borderColor: m.color }]} onPress={() => onSet(o)}>
            <Text style={[s.mBtnText, active ? { color: '#fff' } : { color: m.color }]}>{m.short}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  </View>
);

export default AdminAttendanceScreen;

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },

  tabRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 12 },
  tab: { flex: 1, paddingVertical: 9, borderRadius: theme.radius.full, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center' },
  tabActive: { backgroundColor: theme.colors.primaryLight, borderColor: theme.colors.primary },
  tabText: { fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary },
  tabTextActive: { color: theme.colors.primary },

  viewRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 12, alignItems: 'center' },
  viewBtn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: theme.radius.full, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border },
  viewBtnActive: { backgroundColor: theme.colors.primaryLight, borderColor: theme.colors.primary },
  viewBtnText: { fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary },
  viewBtnTextActive: { color: theme.colors.primary },
  markBtn: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: theme.colors.primary, paddingVertical: 8, paddingHorizontal: 14, borderRadius: theme.radius.full },
  markBtnText: { fontSize: 12, fontWeight: '800', color: '#fff' },

  stepper: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingTop: 12 },
  stepBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center', justifyContent: 'center' },
  stepMid: { flex: 1, height: 40, borderRadius: 12, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center', justifyContent: 'center' },
  stepText: { fontSize: 14, fontWeight: '800', color: theme.colors.textPrimary },

  filterBar: { maxHeight: 46, paddingLeft: 16, marginTop: 12 },
  filterBar2: { maxHeight: 46, paddingLeft: 16, marginTop: 4 },
  filterContent: { gap: 8, paddingRight: 16, alignItems: 'center' },
  pchip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: theme.radius.full, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border },
  pchipActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  pchipText: { fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary },
  pchipTextActive: { color: '#fff' },
  pickerEmpty: { fontSize: 12, color: theme.colors.textMuted, paddingVertical: 8 },

  scroll: { paddingHorizontal: 16, paddingTop: 12 },
  empty: { fontSize: 13, color: theme.colors.textMuted, textAlign: 'center', marginTop: 30 },

  statsBar: { flexDirection: 'row', backgroundColor: theme.colors.card, borderRadius: 14, borderWidth: 1, borderColor: theme.colors.border, paddingVertical: 12, marginBottom: 12 },
  statPillWrap: { flex: 1, alignItems: 'center' },
  statNum: { fontSize: 18, fontWeight: '900' },
  statCap: { fontSize: 9, color: theme.colors.textSecondary, fontWeight: '700', marginTop: 2 },

  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: theme.colors.card, borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: theme.colors.border },
  avatar: { width: 38, height: 38, borderRadius: 12, backgroundColor: theme.colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 13, fontWeight: '800', color: theme.colors.primary },
  rowName: { fontSize: 14, fontWeight: '700', color: theme.colors.textPrimary },
  rowRemark: { fontSize: 11, color: theme.colors.textMuted, marginTop: 2 },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: theme.radius.full },
  pillText: { fontSize: 11, fontWeight: '800' },
  act: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.background },

  rangeRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  rangeBtn: { flex: 1, paddingVertical: 8, borderRadius: 10, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center' },
  rangeBtnActive: { backgroundColor: theme.colors.primaryLight, borderColor: theme.colors.primary },
  rangeText: { fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary },
  rangeTextActive: { color: theme.colors.primary },

  calCard: { backgroundColor: theme.colors.card, borderRadius: 16, borderWidth: 1, borderColor: theme.colors.border, padding: 12, marginTop: 12 },
  calDowRow: { flexDirection: 'row' },
  calDow: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '800', color: theme.colors.textMuted, marginBottom: 6 },
  calWeek: { flexDirection: 'row' },
  calCell: { flex: 1, aspectRatio: 1, margin: 2, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  calDay: { fontSize: 12, color: theme.colors.textSecondary },
  calTotals: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: theme.colors.border },
  calTotal: { fontSize: 11, fontWeight: '700', color: theme.colors.textSecondary },

  yearTotals: { backgroundColor: theme.colors.card, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border, padding: 12, marginTop: 12 },
  yearTotalText: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },
  yearGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  monthCard: { width: '31%', backgroundColor: theme.colors.card, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border, padding: 10, alignItems: 'center' },
  monthLabel: { fontSize: 12, fontWeight: '800', color: theme.colors.textPrimary },
  monthPct: { fontSize: 15, fontWeight: '900', marginTop: 4 },
  monthMeta: { fontSize: 9, color: theme.colors.textMuted, marginTop: 2 },

  fab: { position: 'absolute', right: 18, bottom: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center', elevation: 5, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },

  fieldLabel: { fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary, marginTop: 14, marginBottom: 6 },
  wrapChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  selChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: theme.radius.full, backgroundColor: theme.colors.background, borderWidth: 1, borderColor: theme.colors.border },
  selChipActive: { backgroundColor: theme.colors.primaryLight, borderColor: theme.colors.primary },
  selChipText: { fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary },
  selChipTextActive: { color: theme.colors.primary },

  // mark modal
  markAllRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, marginTop: 12 },
  markAllLabel: { fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary },
  markAllBtn: { width: 34, height: 30, borderRadius: 8, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  markAllText: { fontSize: 12, fontWeight: '900' },
  markRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: theme.colors.card, borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: theme.colors.border },
  markBtns: { flexDirection: 'row', gap: 6 },
  mBtn: { width: 34, height: 32, borderRadius: 8, borderWidth: 1.5, borderColor: theme.colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.background },
  mBtnText: { fontSize: 12, fontWeight: '900' },
  submitBar: { padding: 16, borderTopWidth: 1, borderTopColor: theme.colors.border, backgroundColor: theme.colors.card },
  submitBtn: { height: 50, borderRadius: 14, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center' },
  submitText: { fontSize: 15, fontWeight: '800', color: '#fff' },
});
