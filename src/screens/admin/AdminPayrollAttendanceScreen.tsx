import React, { useCallback, useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import moment from 'moment';
import AppRefreshControl from '../../components/AppRefreshControl';
import { AppAlert } from '../../components/AppDialog';
import { useFocusLoad } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { DateAttendance, DateRow, EMP_TYPES, STAFF_STATUS, StaffStatus, getDateAttendance, markStaffAttendance, typeLabel } from '../../api/adminPayrollApi';
import { DocHeader, DocNoData } from '../more/docUi';
import { DateSheet, OptionSheet, SubmitButton } from './adminFormUi';
import { Avatar, DropPill, ErrorBox, ListSkeleton } from './adminTransportUi';
import { StatusPill } from './payrollUi';

/**
 * Payroll's staff attendance for a date, as the panel shows it: everyone's
 * status that day, a teacher's read from the Teacher module; narrowed by
 * type. Mark attendance turns the list into P / A / H / L for everyone but
 * teachers, each starting on what is already saved, and Save writes the day —
 * a day already marked is simply overwritten. A person opens their month.
 */

const today = () => moment().format('YYYY-MM-DD');

const AdminPayrollAttendanceScreen = ({ navigation }: any) => {
  const [date, setDate] = useState(today());
  const [type, setType] = useState('');
  const [data, setData] = useState<DateAttendance | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [sheet, setSheet] = useState<null | 'date' | 'type'>(null);
  const [marking, setMarking] = useState(false);
  const [draft, setDraft] = useState<Record<number, StaffStatus>>({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (d = date, t = type) => {
    setError(null);
    try {
      setData(await getDateAttendance(d, t || undefined));
    } catch (e) {
      setError(apiErr(e, 'Could not load attendance.'));
    } finally {
      setRefreshing(false);
    }
  }, [date, type]);
  useFocusLoad(() => load());

  const pickDate = (d: string) => {
    setDate(d);
    setMarking(false);
    setDraft({});
    setData(null);
    load(d, type);
  };

  const startMarking = () => {
    // Each row starts on what is already saved.
    const seed: Record<number, StaffStatus> = {};
    data?.employees.forEach(e => {
      if (e.markable && e.status && STAFF_STATUS.some(x => x.key === e.status)) seed[e.id] = e.status as StaffStatus;
    });
    setDraft(seed);
    setMarking(true);
  };

  const save = async () => {
    const marks = Object.entries(draft).map(([id, status]) => ({ id: Number(id), status }));
    setSaving(true);
    try {
      const msg = await markStaffAttendance(date, marks);
      setMarking(false);
      setDraft({});
      await load();
      AppAlert.alert('Attendance saved', msg);
    } catch (e) {
      AppAlert.alert('Not saved', apiErr(e, 'Could not save attendance.'));
    } finally {
      setSaving(false);
    }
  };

  const rows = data?.employees ?? [];
  const list = marking ? rows.filter(e => e.markable) : rows;
  const c = data?.counts;

  const renderRow = (e: DateRow, last: boolean) => (
    <TouchableOpacity
      style={[s.row, !last && s.divider]}
      activeOpacity={marking ? 1 : 0.6}
      disabled={marking}
      onPress={() => navigation.navigate('AdminPayrollCalendar', { id: e.id, name: e.name })}
    >
      <Avatar uri={e.photo} name={e.name} />
      <View style={s.body}>
        <Text style={s.name} numberOfLines={1}>{e.name}</Text>
        <Text style={s.sub} numberOfLines={1}>
          {[e.designation, e.types.map(typeLabel).join(', ')].filter(Boolean).join(' · ')}
          {!e.markable ? ' · from the Teacher module' : ''}
        </Text>
      </View>
      {marking ? (
        <View style={s.marks}>
          {STAFF_STATUS.map(st => {
            const on = draft[e.id] === st.key;
            return (
              <TouchableOpacity
                key={st.key}
                style={[s.mark, on && s[`on_${st.key}` as const]]}
                onPress={() => setDraft(prev => ({ ...prev, [e.id]: st.key }))}
                activeOpacity={0.7}
              >
                <Text style={[s.markText, on && s.markTextOn]}>{st.short}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : (
        <StatusPill status={e.status} />
      )}
    </TouchableOpacity>
  );

  return (
    <View style={s.root}>
      <DocHeader
        title={marking ? 'Mark Attendance' : 'Attendance'}
        onBackPress={() => (marking ? (setMarking(false), setDraft({})) : navigation.goBack())}
      />

      <View style={s.filters}>
        <DropPill label={date === today() ? 'Today' : moment(date).format('DD MMM YYYY')} active onPress={() => setSheet('date')} />
        <DropPill label={type ? typeLabel(type) : 'All types'} active={!!type} onPress={() => setSheet('type')} />
      </View>

      {c && !marking && (
        <Text style={s.counts}>
          {`Present ${c.present} · Absent ${c.absent} · Half day ${c.half_day} · Leave ${c.leave} · Not marked ${c.not_marked}`}
        </Text>
      )}
      {marking && <Text style={s.counts}>{`P present · A absent · H half day · L leave — ${moment(date).format('DD MMM YYYY')}. Teachers are marked in their own module.`}</Text>}

      {error && !data ? (
        <ErrorBox message={error} onRetry={() => load()} />
      ) : !data ? (
        <ListSkeleton photo />
      ) : (
        <FlatList
          data={list}
          keyExtractor={e => String(e.id)}
          renderItem={({ item, index }) => renderRow(item, index === list.length - 1)}
          ListEmptyComponent={<DocNoData icon="calendar-outline" title="No one to show" subtitle={marking ? 'Everyone here is a teacher — they are marked in the Teacher module.' : 'Add staff under Employees.'} />}
          refreshControl={marking ? undefined : <AppRefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          contentContainerStyle={s.list}
        />
      )}

      {!!data && (
        <View style={s.foot}>
          {marking ? (
            <SubmitButton label={`Save · ${Object.keys(draft).length} marked`} busy={saving} onPress={save} />
          ) : (
            <SubmitButton label={data.marked ? 'Edit attendance' : 'Mark attendance'} onPress={startMarking} />
          )}
        </View>
      )}

      <DateSheet visible={sheet === 'date'} value={date} title="Date" maxDate={today()} onPick={d => { setSheet(null); pickDate(d); }} onClose={() => setSheet(null)} />
      <OptionSheet
        visible={sheet === 'type'}
        title="Type"
        options={[{ key: '', label: 'All types' }, ...EMP_TYPES]}
        selected={[type]}
        onPick={k => { setSheet(null); setType(k); setData(null); load(date, k); }}
        onClose={() => setSheet(null)}
      />
    </View>
  );
};

export default AdminPayrollAttendanceScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  filters: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 6 },
  counts: { fontSize: 12, color: theme.colors.textMuted, paddingHorizontal: 20, paddingBottom: 6 },
  list: { paddingBottom: 110 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 20, paddingVertical: 12 },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },
  body: { flex: 1, gap: 2 },
  name: { fontSize: 15, fontWeight: '600', color: theme.colors.textPrimary },
  sub: { fontSize: 12, color: theme.colors.textSecondary },
  marks: { flexDirection: 'row', gap: 5 },
  mark: { width: 32, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.background },
  markText: { fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary },
  markTextOn: { color: theme.colors.white },
  on_present: { backgroundColor: theme.colors.success },
  on_absent: { backgroundColor: theme.colors.danger },
  on_half_day: { backgroundColor: '#F59E0B' },
  on_leave: { backgroundColor: '#3B82F6' },
  foot: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 20, backgroundColor: theme.colors.card, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.border },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
