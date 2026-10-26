import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Animated from 'react-native-reanimated';
import moment from 'moment';
import { AppAlert } from '../../components/AppDialog';
import { useKeyboardLiftStyle } from '../../hooks/useKeyboardLift';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { SHEET_STATUS, SheetRow, SheetStatus, getAttendanceSheet, saveAttendanceSheet } from '../../api/adminPayrollApi';
import { DocHeader } from '../more/docUi';
import { SaveButton, SaveState } from '../teacherStudents/outlinedFormUi';
import { DateSheet } from './adminFormUi';
import { Avatar, DropPill, ErrorBox, ListSkeleton } from './adminTransportUi';
import { Band, FormFoot, Quiet } from './feeSetupUi';
import { personLine } from './PayrollEmployeesTab';

/**
 * Mark Attendance — the panel's panel: everyone at once, teachers first, then
 * management, drivers and employees, A to Z. It opens on today and reads what
 * is saved for the day, so a day already marked is simply corrected and saved
 * again. Each row is Present, Absent, Half day or Holiday — or × to leave it
 * unmarked (an unmarked row saves nothing, and clears an earlier mark) — with
 * a remark. All present / All absent / All holiday / Clear set every row; when
 * everyone is on Holiday, one remark is asked for and goes on every row.
 * A teacher's row goes to the Attendance module's own records.
 */

const TONE: Record<SheetStatus, { bg: string; ink: string }> = {
  present: { bg: '#10B981', ink: '#FFFFFF' },
  absent: { bg: '#EF4444', ink: '#FFFFFF' },
  half_day: { bg: '#FACC15', ink: '#713F12' },
  holiday: { bg: '#818CF8', ink: '#FFFFFF' },
};

type Row = { status: SheetStatus | ''; remark: string };

const AdminPayrollMarkScreen = ({ navigation }: any) => {
  const today = moment().format('YYYY-MM-DD');
  const [date, setDate] = useState(today);
  const [dateOpen, setDateOpen] = useState(false);
  const [people, setPeople] = useState<SheetRow[] | null>(null);
  const [rows, setRows] = useState<Record<number, Row>>({});
  const [existing, setExisting] = useState(false);
  const [label, setLabel] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [common, setCommon] = useState('');
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const busy = useRef(false);
  const seq = useRef(0);

  const lift = useKeyboardLiftStyle();

  const load = useCallback(async () => {
    const mine = ++seq.current;
    setError(null);
    setPeople(null);
    try {
      const d = await getAttendanceSheet(date);
      if (mine !== seq.current) return;
      setPeople(d.rows);
      setExisting(d.existing);
      setLabel(d.label);
      const next: Record<number, Row> = {};
      d.rows.forEach(r => (next[r.id] = { status: r.status, remark: r.remark }));
      setRows(next);
      setCommon('');
    } catch (e) {
      if (mine === seq.current) setError(apiErr(e, 'Could not load the day.'));
    }
  }, [date]);

  useEffect(() => {
    load();
  }, [load]);

  const list = people ?? [];
  const marked = useMemo(() => Object.values(rows).filter(r => r.status !== '').length, [rows]);
  const allHoliday = list.length > 0 && list.every(p => rows[p.id]?.status === 'holiday');
  const remarkMissing = allHoliday && list.some(p => !(rows[p.id]?.remark ?? '').trim());

  const pick = (id: number, status: SheetStatus | '') => setRows(prev => ({ ...prev, [id]: { ...(prev[id] ?? { remark: '' }), status } }));
  const all = (status: SheetStatus | '') =>
    setRows(prev => {
      const next = { ...prev };
      list.forEach(p => (next[p.id] = { ...(next[p.id] ?? { remark: '' }), status }));
      return next;
    });
  const remarkAll = (v: string) => {
    setCommon(v);
    setRows(prev => {
      const next = { ...prev };
      list.forEach(p => (next[p.id] = { ...(next[p.id] ?? { status: '' }), remark: v }));
      return next;
    });
  };

  const save = async () => {
    if (busy.current) return;
    if (marked === 0) return AppAlert.alert('Nothing to save', 'Mark at least one person first.');
    if (remarkMissing) return AppAlert.alert('Remark needed', 'Say what the holiday is for — the remark is compulsory when everyone is on Holiday.');
    busy.current = true;
    setSaveState('saving');
    try {
      const msg = await saveAttendanceSheet(date, rows);
      setSaveState('done');
      AppAlert.alert(existing ? 'Attendance updated' : 'Attendance saved', msg, [
        { text: 'OK', onPress: () => navigation.navigate('AdminPayrollHome', { tab: 'attendance', markedDate: date, markedAt: Date.now() }) },
      ]);
    } catch (e) {
      busy.current = false;
      setSaveState('idle');
      AppAlert.alert('Could not save', apiErr(e, 'The attendance was not saved. Please try again.'));
    }
  };

  const renderItem = ({ item, index }: { item: SheetRow; index: number }) => {
    const r = rows[item.id] ?? { status: '', remark: '' };
    return (
      <View style={[s.row, index < list.length - 1 && s.divider]}>
        <View style={s.who}>
          <Text style={s.n}>{index + 1}</Text>
          <Avatar uri={item.photo} name={item.name} size={34} />
          <View style={s.whoBody}>
            <Text style={s.name} numberOfLines={1}>{item.name}</Text>
            <Text style={s.sub} numberOfLines={1}>{personLine(item.types?.length ? item.types : [item.type], item.designation)}</Text>
          </View>
        </View>
        <View style={s.marks}>
          {SHEET_STATUS.map(o => {
            const on = r.status === o.key;
            return (
              <TouchableOpacity
                key={o.key}
                style={[s.mark, on && { backgroundColor: TONE[o.key].bg, borderColor: TONE[o.key].bg }]}
                activeOpacity={0.7}
                onPress={() => pick(item.id, o.key)}
                accessibilityLabel={o.label}
              >
                <Text style={[s.markText, on && { color: TONE[o.key].ink }]}>{o.short}</Text>
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity
            style={[s.mark, s.clearMark, r.status === '' && s.clearOn]}
            activeOpacity={0.7}
            onPress={() => pick(item.id, '')}
            accessibilityLabel="Leave unmarked"
          >
            <Text style={[s.markText, r.status === '' && s.clearOnText]}>×</Text>
          </TouchableOpacity>
          <TextInput
            style={s.remark}
            placeholder="Remark"
            placeholderTextColor={theme.colors.textMuted}
            value={r.remark}
            maxLength={255}
            onChangeText={v => setRows(prev => ({ ...prev, [item.id]: { ...(prev[item.id] ?? { status: '' }), remark: v } }))}
          />
        </View>
      </View>
    );
  };

  return (
    <View style={s.root}>
      <DocHeader title="Mark Attendance" onBackPress={() => navigation.goBack()} />
      <Band>
        <DropPill label={moment(date).format('ddd, DD MMM YYYY')} active onPress={() => setDateOpen(true)} />
        <Text style={s.count}>{`${marked} of ${list.length} marked`}</Text>
      </Band>
      <View style={s.toolbar}>
        {([
          ['present', 'All present'],
          ['absent', 'All absent'],
          ['holiday', 'All holiday'],
          ['', 'Clear'],
        ] as [SheetStatus | '', string][]).map(([k, t]) => (
          <TouchableOpacity key={t} style={s.tool} activeOpacity={0.6} onPress={() => all(k)} disabled={!people}>
            <Text style={[s.toolText, k === '' && s.toolClear]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Animated.View style={[s.flex, lift]}>
        {error && !people ? (
          <ErrorBox message={error} onRetry={load} />
        ) : !people ? (
          <View style={s.pad}>
            <ListSkeleton photo rows={8} />
          </View>
        ) : (
          <FlatList
            data={list}
            keyExtractor={p => String(p.id)}
            renderItem={renderItem}
            contentContainerStyle={s.list}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={
              <View>
                <Text style={s.dayLabel}>{label}</Text>
                <Quiet>{existing ? 'Already marked for this date — change what you need and save to update it.' : 'Only the rows you set are saved — an unmarked day stays open.'}</Quiet>
                {allHoliday && (
                  <View style={s.common}>
                    <Text style={[s.commonLabel, remarkMissing && s.bad]}>Remark for all *</Text>
                    <TextInput
                      style={[s.commonInput, remarkMissing && s.commonError]}
                      placeholder="e.g. Diwali"
                      placeholderTextColor={theme.colors.textMuted}
                      value={common}
                      onChangeText={remarkAll}
                      maxLength={255}
                    />
                    {remarkMissing && <Text style={s.bad}>Say what the holiday is for — it is needed before saving.</Text>}
                  </View>
                )}
              </View>
            }
          />
        )}
        {!!people && (
          <FormFoot>
            <SaveButton
              state={saveState}
              icon="checkmark-done-outline"
              label={existing ? 'Update Attendance' : 'Save Attendance'}
              busyLabel="Saving attendance"
              doneLabel="Attendance saved"
              onPress={save}
            />
          </FormFoot>
        )}
      </Animated.View>

      <DateSheet visible={dateOpen} title="Date" value={date} maxDate={today} onPick={d => setDate(d)} onClose={() => setDateOpen(false)} />
    </View>
  );
};

export default AdminPayrollMarkScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  flex: { flex: 1 },
  pad: { paddingHorizontal: 20 },
  list: { paddingHorizontal: 20, paddingBottom: 24 },
  count: { fontSize: 12, fontWeight: '600', color: theme.colors.textMuted },
  toolbar: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  tool: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: theme.colors.background },
  toolText: { fontSize: 12, fontWeight: '600', color: theme.colors.textSecondary },
  toolClear: { color: theme.colors.danger },
  dayLabel: { fontSize: 15, fontWeight: '700', color: theme.colors.textPrimary, paddingTop: 14 },

  common: { marginTop: 12, gap: 6 },
  commonLabel: { fontSize: 12, fontWeight: '600', color: theme.colors.textSecondary },
  commonInput: {
    height: 42,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    fontSize: 14,
    color: theme.colors.textPrimary,
  },
  commonError: { borderColor: theme.colors.danger },
  bad: { fontSize: 12, color: theme.colors.danger },

  row: { paddingVertical: 12, gap: 10 },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },
  who: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  n: { width: 18, fontSize: 11, color: theme.colors.textMuted },
  whoBody: { flex: 1, gap: 2 },
  name: { fontSize: 14, fontWeight: '600', color: theme.colors.textPrimary },
  sub: { fontSize: 12, color: theme.colors.textMuted },
  marks: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 28 },
  mark: {
    minWidth: 34,
    height: 32,
    paddingHorizontal: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markText: { fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary },
  clearMark: { minWidth: 30 },
  clearOn: { backgroundColor: theme.colors.background },
  clearOnText: { color: theme.colors.textPrimary },
  remark: {
    flex: 1,
    height: 32,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    fontSize: 12,
    color: theme.colors.textPrimary,
    paddingVertical: 0,
  },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
