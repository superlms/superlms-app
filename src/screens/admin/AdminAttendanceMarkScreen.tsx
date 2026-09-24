import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import moment from 'moment';
import { AppAlert } from '../../components/AppDialog';
import { HeaderIconButton } from '../../components/Header';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import {
  AttClass,
  AttStatus,
  MarkRow,
  MarkStatus,
  getAttendanceLookups,
  getStudentDay,
  getTeacherDay,
  saveStudentDay,
  saveTeacherDay,
} from '../../api/adminAttendanceApi';
import { DocHeader, DocNoData } from '../more/docUi';
import { DateSheet, OptionSheet, SubmitButton } from './adminFormUi';
import { Avatar, DropPill, ErrorBox, ListSkeleton } from './adminTransportUi';
import { Field, FormModal } from './AdminStandardScreen';
import { STATUS, dayLabel } from './adminAttendanceUi';

/**
 * Mark Attendance — the panel's mark panel for teachers or for one section of
 * a class, on a fresh day (today); the teachers' day is changed from the
 * calendar in the header. Every row starts on what is saved for the
 * day, or blank — Sunday on Holiday — and only the rows given a status are
 * saved; tapping a row's status again leaves it unmarked, and a row left blank
 * clears what was saved for it. All present / absent / holiday / Clear set
 * every row; with everyone on Holiday, one remark goes on every row. Mark this
 * day as holiday saves the whole day as a holiday at once. Saved, the day's
 * register opens.
 */

type Who = 'teacher' | 'student';
type Row = MarkRow;

const PICKS: AttStatus[] = ['present', 'absent', 'half_day', 'holiday'];
const ALL: { key: MarkStatus; label: string }[] = [
  { key: 'present', label: 'All present' },
  { key: 'absent', label: 'All absent' },
  { key: 'holiday', label: 'All holiday' },
  { key: '', label: 'Clear' },
];

const today = () => moment().format('YYYY-MM-DD');

const AdminAttendanceMarkScreen = ({ navigation, route }: any) => {
  const who: Who = route?.params?.who === 'student' ? 'student' : 'teacher';
  const people = who === 'teacher' ? 'teacher' : 'student';

  const [date, setDate] = useState(today());
  const [classes, setClasses] = useState<AttClass[]>([]);
  const [classId, setClassId] = useState<number | null>(null);
  const [sectionId, setSectionId] = useState<number | null>(null);

  const [rows, setRows] = useState<Row[] | null>(null);
  const [existing, setExisting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<null | 'save' | 'holiday'>(null);
  const [sheet, setSheet] = useState<null | 'date' | 'class' | 'section'>(null);
  // The remark being written: one row's, or everyone's.
  const [remarkFor, setRemarkFor] = useState<null | number | 'all'>(null);
  const [remarkText, setRemarkText] = useState('');

  useEffect(() => {
    if (who !== 'student') return;
    getAttendanceLookups()
      .then(r => setClasses(r.classes ?? []))
      .catch(() => {});
  }, [who]);

  const ready = who === 'teacher' || (!!classId && !!sectionId);

  const seq = useRef(0);
  const load = useCallback(async () => {
    if (!ready) return;
    const mine = ++seq.current;
    setError(null);
    setRows(null);
    try {
      const day = who === 'teacher' ? await getTeacherDay(date) : await getStudentDay(classId!, sectionId!, date);
      if (mine !== seq.current) return;
      setRows(day.rows);
      setExisting(day.existing);
    } catch (e) {
      if (mine === seq.current) setError(apiErr(e, 'Could not load the day.'));
    }
  }, [who, ready, date, classId, sectionId]);

  useEffect(() => {
    load();
  }, [load]);

  const cls = classes.find(c => c.id === classId) ?? null;
  const sec = cls?.sections.find(x => x.id === sectionId) ?? null;

  const list = rows ?? [];
  const total = list.length;
  const marked = list.filter(r => r.status !== '').length;
  const allHoliday = total > 0 && list.every(r => r.status === 'holiday');
  const isToday = date === today();
  const isSunday = moment(date).day() === 0;

  const setStatus = (id: number, st: MarkStatus) =>
    setRows(prev => prev && prev.map(r => (r.id === id ? { ...r, status: st } : r)));
  const setAll = (st: MarkStatus) => setRows(prev => prev && prev.map(r => ({ ...r, status: st })));

  const openRemark = (target: number | 'all') => {
    setRemarkFor(target);
    setRemarkText(target === 'all' ? sharedRemark(list) : list.find(r => r.id === target)?.remark ?? '');
  };
  const applyRemark = () => {
    const text = remarkText.trim();
    setRows(prev => prev && prev.map(r => (remarkFor === 'all' || r.id === remarkFor ? { ...r, remark: text } : r)));
    setRemarkFor(null);
  };

  // Saved: the day's register opens on what was just marked.
  const done = (title: string, message: string) => {
    if (who === 'teacher') {
      navigation.popTo('AdminTeacherAttendance', { showDate: date, showAt: Date.now() });
    } else {
      navigation.popTo('AdminStudentAttendance', { show: { classId, sectionId, date }, showAt: Date.now() });
    }
    AppAlert.alert(title, message);
  };

  const submit = async (holiday: boolean) => {
    if (!rows) return;
    if (!holiday && marked === 0) {
      AppAlert.alert('Nothing to save', `Mark at least one ${people} first.`);
      return;
    }
    setSaving(holiday ? 'holiday' : 'save');
    try {
      const marks = rows.map(r => ({ id: r.id, status: holiday ? ('holiday' as MarkStatus) : r.status, remark: r.remark }));
      const res =
        who === 'teacher'
          ? await saveTeacherDay({ date, holiday, marks })
          : await saveStudentDay({ standard_id: classId!, section_id: sectionId!, date, holiday, marks });
      done(res.title, res.message);
    } catch (e) {
      AppAlert.alert('Not saved', apiErr(e, 'Could not save attendance.'));
    } finally {
      setSaving(null);
    }
  };

  const markHoliday = () =>
    AppAlert.alert(
      isToday ? 'Mark today as holiday?' : 'Mark this day as holiday?',
      `${moment(date).format('dddd, D MMM YYYY')} is saved as a holiday for ${who === 'teacher' ? 'all teachers' : 'this class'}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Mark holiday', onPress: () => submit(true) },
      ],
    );

  const note = existing
    ? 'Already submitted for this date — change what you need and save to update it.'
    : isSunday
    ? 'Sunday is a standing holiday, so everyone starts on Holiday.'
    : 'Only the rows you set are saved — an unmarked day stays open.';

  const renderRow = ({ item: r, index }: { item: Row; index: number }) => (
    <View style={[s.row, index < list.length - 1 && s.divider, r.status === '' && s.rowOpen]}>
      <Avatar uri={r.image} name={r.name} size={36} />
      <View style={s.body}>
        <Text style={s.name} numberOfLines={1}>{r.name}</Text>
        {!!r.sub && <Text style={s.sub} numberOfLines={1}>{r.sub}</Text>}
        <TouchableOpacity onPress={() => openRemark(r.id)} hitSlop={6} activeOpacity={0.6}>
          <Text style={[s.remark, !r.remark && s.remarkAdd]} numberOfLines={1}>
            {r.remark || 'Add remark'}
          </Text>
        </TouchableOpacity>
      </View>
      <View style={s.picks}>
        {PICKS.map(st => {
          const on = r.status === st;
          return (
            <TouchableOpacity
              key={st}
              style={[s.pick, on && { backgroundColor: STATUS[st].solid }]}
              // Tapped again, the row is left unmarked.
              onPress={() => setStatus(r.id, on ? '' : st)}
              activeOpacity={0.7}
              accessibilityLabel={`${STATUS[st].label}${on ? ', chosen' : ''}`}
            >
              <Text style={[s.pickText, on && s.pickTextOn]}>{STATUS[st].short}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  const header = (
    <View>
      <Text style={s.day}>{moment(date).format('dddd, D MMMM YYYY')}</Text>
      <Text style={[s.note, existing && s.noteEdit]}>{note}</Text>

      <View style={s.toolbar}>
        {ALL.map(a => (
          <TouchableOpacity key={a.label} style={s.allBtn} activeOpacity={0.7} onPress={() => setAll(a.key)}>
            <Text style={[s.allText, a.key === '' && s.allTextQuiet]}>{a.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={s.count}>{`${marked} of ${total} marked · P present · A absent · HD half day · H holiday`}</Text>

      {/* Everyone on Holiday: one remark, written once, goes on every row. */}
      {allHoliday && (
        <TouchableOpacity style={s.remarkAll} activeOpacity={0.7} onPress={() => openRemark('all')}>
          <Text style={s.remarkAllLabel}>Remark for all</Text>
          <Text style={[s.remarkAllValue, !sharedRemark(list) && s.remarkAdd]} numberOfLines={1}>
            {sharedRemark(list) || 'e.g. Diwali'}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <View style={s.root}>
      {who === 'teacher' ? (
        // The teachers' day is picked from the calendar in the header.
        <DocHeader
          title="Mark Attendance"
          onBackPress={() => navigation.goBack()}
          rightSlot={<HeaderIconButton icon="calendar-outline" onPress={() => setSheet('date')} />}
        />
      ) : (
        <>
          <DocHeader title="Mark Student Attendance" onBackPress={() => navigation.goBack()} />
          <View style={s.filters}>
            <DropPill label={cls?.name ?? 'Select class'} active={!!cls} onPress={() => setSheet('class')} />
            <DropPill label={sec ? `Section ${sec.name}` : 'Select section'} active={!!sec} onPress={() => setSheet(cls ? 'section' : 'class')} />
            <DropPill label={dayLabel(date)} active onPress={() => setSheet('date')} />
          </View>
        </>
      )}

      <View style={s.flex}>
        {!ready ? (
          <DocNoData icon="people-outline" title="Select class & section" subtitle="Pick the class and section whose attendance you are marking." />
        ) : error && !rows ? (
          <ErrorBox message={error} onRetry={load} />
        ) : !rows ? (
          <ListSkeleton photo />
        ) : (
          <FlatList
            data={list}
            keyExtractor={r => String(r.id)}
            renderItem={renderRow}
            ListHeaderComponent={header}
            ListEmptyComponent={
              <DocNoData
                icon="people-outline"
                title={who === 'teacher' ? 'No teachers found' : 'No students found'}
                subtitle={who === 'teacher' ? 'Add teachers under Teachers.' : 'This section has no students yet.'}
              />
            }
            contentContainerStyle={s.list}
            showsVerticalScrollIndicator={false}
          />
        )}

        {ready && !!rows && total > 0 && (
          <View style={s.foot}>
            <TouchableOpacity onPress={markHoliday} disabled={!!saving} activeOpacity={0.6} style={s.holidayBtn}>
              <Text style={s.holidayText}>
                {saving === 'holiday' ? 'Saving…' : isToday ? 'Mark today as holiday' : 'Mark this day as holiday'}
              </Text>
            </TouchableOpacity>
            <SubmitButton
              label={`${existing ? 'Update' : 'Save'} attendance · ${marked} marked`}
              busy={saving === 'save'}
              onPress={() => submit(false)}
            />
          </View>
        )}
      </View>

      <DateSheet visible={sheet === 'date'} value={date} title="Date" onPick={d => { setSheet(null); setDate(d); }} onClose={() => setSheet(null)} />
      <OptionSheet
        visible={sheet === 'class'}
        title="Class"
        options={classes.map(c => ({ key: String(c.id), label: c.name }))}
        selected={cls ? [String(cls.id)] : []}
        onPick={k => {
          setSheet(null);
          setClassId(Number(k));
          setSectionId(null);
          setRows(null);
          setExisting(false);
        }}
        onClose={() => setSheet(null)}
        emptyText="No classes yet."
      />
      <OptionSheet
        visible={sheet === 'section'}
        title="Section"
        options={(cls?.sections ?? []).map(x => ({ key: String(x.id), label: `Section ${x.name}` }))}
        selected={sec ? [String(sec.id)] : []}
        onPick={k => { setSheet(null); setSectionId(Number(k)); }}
        onClose={() => setSheet(null)}
        emptyText="No sections in this class."
      />

      <FormModal
        visible={remarkFor !== null}
        title={remarkFor === 'all' ? 'Remark for all' : list.find(r => r.id === remarkFor)?.name ?? 'Remark'}
        onClose={() => setRemarkFor(null)}
        onSave={applyRemark}
        saveLabel="Done"
      >
        <Field
          label="Remark"
          value={remarkText}
          onChangeText={setRemarkText}
          placeholder={remarkFor === 'all' ? 'e.g. Diwali' : 'Remark'}
          maxLength={255}
          autoFocus
        />
      </FormModal>
    </View>
  );
};

// The remark every row shares, if they share one — a saved holiday opens with it.
const sharedRemark = (rows: Row[]) => {
  const set = new Set(rows.map(r => r.remark ?? ''));
  return set.size === 1 ? [...set][0] : '';
};

export default AdminAttendanceMarkScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  flex: { flex: 1 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4 },
  list: { paddingBottom: 150 },

  day: { fontSize: 15, fontWeight: '600', color: theme.colors.textPrimary, paddingHorizontal: 20, paddingTop: 12 },
  note: { fontSize: 12, color: theme.colors.textMuted, paddingHorizontal: 20, paddingTop: 2, lineHeight: 17 },
  noteEdit: { color: '#B45309' },
  toolbar: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 20, paddingTop: 12 },
  allBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: theme.radius.full, backgroundColor: theme.colors.background },
  allText: { fontSize: 12, fontWeight: '600', color: theme.colors.textSecondary },
  allTextQuiet: { color: theme.colors.textMuted },
  count: { fontSize: 11, color: theme.colors.textMuted, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  remarkAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 20,
    marginTop: 8,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
  },
  remarkAllLabel: { fontSize: 13, fontWeight: '600', color: theme.colors.textSecondary },
  remarkAllValue: { flex: 1, fontSize: 13, color: theme.colors.textPrimary, textAlign: 'right' },

  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 10 },
  rowOpen: { backgroundColor: theme.colors.background + '80' },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },
  body: { flex: 1, gap: 1 },
  name: { fontSize: 14, fontWeight: '500', color: theme.colors.textPrimary },
  sub: { fontSize: 11, color: theme.colors.textMuted },
  remark: { fontSize: 11, color: theme.colors.textSecondary, paddingTop: 2 },
  remarkAdd: { color: theme.colors.primary },
  picks: { flexDirection: 'row', gap: 4 },
  pick: { width: 32, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.background },
  pickText: { fontSize: 11, fontWeight: '700', color: theme.colors.textSecondary },
  pickTextOn: { color: theme.colors.white },

  foot: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 20,
    gap: 6,
    backgroundColor: theme.colors.card,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
  },
  holidayBtn: { alignSelf: 'center', paddingVertical: 6 },
  holidayText: { fontSize: 13, fontWeight: '600', color: theme.colors.primary },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
