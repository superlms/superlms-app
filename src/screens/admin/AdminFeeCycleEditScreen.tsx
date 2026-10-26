import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { AppAlert } from '../../components/AppDialog';
import { useKeyboardLiftStyle } from '../../hooks/useKeyboardLift';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import {
  BulkRow,
  CycleKind,
  KIND_LABEL,
  equalSplitRows,
  fillBlankPercents,
  getCycleBulk,
  percentTotal,
  saveCycleBulk,
  shiftPercentRows,
} from '../../api/adminFeeSetupApi';
import { DocHeader } from '../more/docUi';
import { FieldPair, OutlinedField, SaveButton, SaveState } from '../teacherStudents/outlinedFormUi';
import { useRevealFocused } from './adminProfileUi';
import { DateBox, FormFoot, Quiet, RowHead, pct } from './feeSetupUi';

/**
 * Edit the whole fee cycle — the panel's editor from a cycle's Edit: every
 * installment of the fee type and year as its own row, labelled the way the
 * cycle was built ("April 2026", "Q1 · Apr–Jun", "Installment #3"), with its
 * dates, its % and its penalty a day. A % typed moves only the difference —
 * the other rows each give up (or take back) an equal slice — so the cycle
 * still totals 100%; Equal split gives everyone an even share again.
 */

const AdminFeeCycleEditScreen = ({ navigation, route }: any) => {
  const { feeType, year } = route.params as { feeType: string; year: string };
  const [kind, setKind] = useState<CycleKind>('custom');
  const [rows, setRows] = useState<BulkRow[] | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [wrong, setWrong] = useState<number | null>(null);
  const busy = useRef(false);

  const lift = useKeyboardLiftStyle();
  const { ref: scrollRef, scrollProps } = useRevealFocused();

  useEffect(() => {
    let live = true;
    getCycleBulk(feeType, year)
      .then(d => {
        if (!live) return;
        setKind(d.kind);
        setRows(
          d.rows.map(r => ({
            ...r,
            start_date: r.start_date ?? '',
            end_date: r.end_date ?? '',
            due_date: r.due_date ?? '',
            fee_percent: String(r.fee_percent ?? ''),
            penalty_per_day: String(r.penalty_per_day ?? '0'),
          })),
        );
      })
      .catch(e => AppAlert.alert('Not opened', apiErr(e, 'Could not load the fee cycle.'), [{ text: 'OK', onPress: () => navigation.goBack() }]));
    return () => {
      live = false;
    };
  }, [feeType, year, navigation]);

  const total = useMemo(() => percentTotal(rows ?? []), [rows]);
  const balanced = Math.abs(total - 100) < 0.01;

  const setRow = (i: number, key: keyof BulkRow, v: string) => {
    setRows(prev => (prev ?? []).map((r, n) => (n === i ? { ...r, [key]: v } : r)));
    if (wrong === i) setWrong(null);
  };

  const settle = (i: number) =>
    setRows(prev => {
      const list = prev ?? [];
      return String(list[i]?.fee_percent ?? '').trim() === '' ? fillBlankPercents(list) : shiftPercentRows(list, i);
    });

  const stop = (i: number, message: string) => {
    setWrong(i);
    AppAlert.alert('Check the form', message);
  };

  const save = async () => {
    if (busy.current || !rows) return;
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (!r.due_date) return stop(i, `${r.label}: pick a due date.`);
      const p = Number(r.fee_percent);
      if (r.fee_percent.trim() === '' || isNaN(p) || p < 0 || p > 100) return stop(i, `${r.label}: fee % must be between 0 and 100.`);
      if (!!r.start_date !== !!r.end_date) return stop(i, `${r.label}: give both a start and an end date, or neither.`);
      if (r.start_date && r.end_date < r.start_date) return stop(i, `${r.label}: the end date cannot come before the start date.`);
    }
    if (!balanced) {
      return AppAlert.alert('Check the form', `The installments must add up to 100% — they currently add up to ${pct(total)}.`);
    }
    busy.current = true;
    setSaveState('saving');
    try {
      const msg = await saveCycleBulk(feeType, year, rows);
      setSaveState('done');
      AppAlert.alert('Saved', msg, [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } catch (e) {
      busy.current = false;
      setSaveState('idle');
      AppAlert.alert('Not saved', apiErr(e, 'Could not save the fee cycle.'));
    }
  };

  return (
    <View style={s.root}>
      <DocHeader title={`Edit ${KIND_LABEL[kind] ?? 'Custom'} Fee Cycle`} onBackPress={() => navigation.goBack()} />
      <Animated.View style={[s.flex, lift]}>
        <ScrollView ref={scrollRef} contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} {...scrollProps}>
          <Text style={s.intro}>{`${feeType === 'transport' ? 'Transport' : 'Academic'} fee · Academic year ${year}`}</Text>
          {!rows ? (
            <ActivityIndicator style={s.loading} color={theme.colors.primary} />
          ) : (
            <>
              <View style={s.totalRow}>
                <Text style={[s.total, !balanced && s.bad]}>{`${rows.length} installments · ${pct(total)}`}</Text>
                <TouchableOpacity onPress={() => setRows(prev => equalSplitRows(prev ?? []))} hitSlop={8} activeOpacity={0.6}>
                  <Text style={s.equal}>Equal split</Text>
                </TouchableOpacity>
              </View>
              {!balanced && (
                <Quiet tone="bad">These don't add up to 100% — press "Equal split", or retype any one % to pull the rest back into line.</Quiet>
              )}
              {rows.map((r, i) => (
                <View key={r.id} style={wrong === i ? s.wrong : undefined}>
                  <RowHead title={r.label} sub={`Installment #${r.serial}`} />
                  <FieldPair>
                    <DateBox half clearable label="Start" value={r.start_date} onChange={v => setRow(i, 'start_date', v)} />
                    <DateBox half clearable label="End" value={r.end_date} onChange={v => setRow(i, 'end_date', v)} />
                  </FieldPair>
                  <DateBox required label="Due Date" value={r.due_date} onChange={v => setRow(i, 'due_date', v)} />
                  <FieldPair>
                    <OutlinedField
                      half
                      required
                      label="Fee %"
                      keyboardType="decimal-pad"
                      value={r.fee_percent}
                      onChangeText={(v: string) => setRow(i, 'fee_percent', v.replace(/[^0-9.]/g, ''))}
                      onEndEditing={() => settle(i)}
                    />
                    <OutlinedField
                      half
                      label="Penalty / Day (₹)"
                      keyboardType="decimal-pad"
                      value={r.penalty_per_day}
                      onChangeText={(v: string) => setRow(i, 'penalty_per_day', v.replace(/[^0-9.]/g, ''))}
                    />
                  </FieldPair>
                </View>
              ))}
            </>
          )}
          <View style={s.tail} />
        </ScrollView>
        {!!rows && (
          <FormFoot>
            <SaveButton state={saveState} icon="checkmark-circle-outline" label="Save Fee Cycle" busyLabel="Saving installments" doneLabel="Installments saved" onPress={save} />
          </FormFoot>
        )}
      </Animated.View>
    </View>
  );
};

export default AdminFeeCycleEditScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  flex: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 16 },
  loading: { marginTop: 48 },
  intro: { fontSize: 13, lineHeight: 19, color: theme.colors.textSecondary },
  totalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 },
  total: { fontSize: 13, fontWeight: '700', color: theme.colors.textPrimary },
  bad: { color: theme.colors.danger },
  equal: { fontSize: 13, fontWeight: '600', color: theme.colors.primary },
  wrong: { borderLeftWidth: 2, borderLeftColor: theme.colors.danger, paddingLeft: 8, marginLeft: -10 },
  tail: { height: 24 },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
