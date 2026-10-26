import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import Select from '../../components/Select';
import { AppAlert } from '../../components/AppDialog';
import { useKeyboardLiftStyle } from '../../hooks/useKeyboardLift';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import {
  CustomRow,
  CycleKind,
  CycleRow,
  addCycles,
  currentAcademicYear,
  deleteCycle,
  fieldErrorOf,
  fillBlankPercents,
  getCycle,
  percentTotal,
  plainNumber,
  previewCycle,
  rebalanceToHundred,
  saveCycle,
  shiftPercentRows,
  trimPercent,
} from '../../api/adminFeeSetupApi';
import { DocHeader } from '../more/docUi';
import { FieldPair, FormHeading, OutlinedField, SaveButton, SaveState } from '../teacherStudents/outlinedFormUi';
import { useRevealFocused } from './adminProfileUi';
import { QuietAction, confirmDestructive } from './adminFormUi';
import { AddRowButton, DateBox, FormFoot, Quiet, RowHead, pct } from './feeSetupUi';

/**
 * Add Fee Cycle, and editing one installment or the registration fee — the
 * panel's slide-in.
 *
 * Adding (this year's academic fee): pick how it is built —
 *   Monthly    twelve equal installments, April to March, each due on the day
 *              of the month picked;
 *   Quarterly  four equal ones (Apr–Jun, Jul–Sep, Oct–Dec, Jan–Mar), each due
 *              on its quarter's last day;
 *   Custom     any number of installments, each its number, the stretch of the
 *              year it covers, its due date, its % and its penalty a day —
 *              change one % and the difference is shared out equally across the
 *              others, so the set stays at 100%.
 * Monthly and Quarterly replace what the year already has. An optional
 * registration fee is collected up front, before the installments split what
 * is left of the fee.
 *
 * Editing an installment: its number, dates, % and penalty; the other
 * installments' new % is shown as the % is typed, and written with it. The
 * registration fee has its own short form. Both can be deleted here.
 */

const DUE_DAYS = Array.from({ length: 28 }, (_, i) => ({ value: i + 1, label: String(i + 1) }));
const SERIALS = Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: `Installment ${i + 1}` }));

type Wrong = { field: string; message: string } | null;

const AdminFeeCycleFormScreen = ({ navigation, route }: any) => {
  const id: number | undefined = route.params?.id;
  const year: string = route.params?.year || currentAcademicYear();
  const existing: number = route.params?.existing ?? 0;

  const [loading, setLoading] = useState(!!id);
  const [cycle, setCycle] = useState<CycleRow | null>(null);
  const isToken = !!cycle?.is_token;

  // Adding
  const [mode, setMode] = useState<CycleKind | ''>('');
  const [dueDay, setDueDay] = useState(10);
  const [penalty, setPenalty] = useState('0');
  const [rows, setRows] = useState<CustomRow[]>([]);

  // Editing one installment
  const [serial, setSerial] = useState(1);
  const [due, setDue] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [percent, setPercent] = useState('');
  const [preview, setPreview] = useState<{ id: number; serial: number; was: number; percent: number }[]>([]);

  // The registration fee
  const [tokenAmount, setTokenAmount] = useState('');
  const [tokenDue, setTokenDue] = useState('');
  const [tokenPenalty, setTokenPenalty] = useState('0');

  const [wrong, setWrong] = useState<Wrong>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [deleting, setDeleting] = useState(false);
  const busy = useRef(false);

  const lift = useKeyboardLiftStyle();
  const { ref: scrollRef, scrollProps } = useRevealFocused();
  const errorOf = (f: string) => (wrong?.field === f ? wrong.message : null);
  const typed = (f: string) => setWrong(w => (w?.field === f ? null : w));

  // Opened to edit: what is saved, and the registration fee of its cycle.
  useEffect(() => {
    if (!id) return;
    let live = true;
    getCycle(id)
      .then(d => {
        if (!live) return;
        setCycle(d.cycle);
        setSerial(d.cycle.serial || 1);
        setDue(d.cycle.due_date ?? '');
        setStart(d.cycle.start_date ?? '');
        setEnd(d.cycle.end_date ?? '');
        setPercent(trimPercent(d.cycle.fee_percent));
        setPenalty(plainNumber(d.cycle.penalty_per_day));
        const token = d.cycle.is_token ? d.cycle : d.token;
        setTokenAmount(token ? plainNumber(token.amount) : '');
        setTokenDue(token?.due_date ?? '');
        setTokenPenalty(token ? plainNumber(token.penalty_per_day) : '0');
      })
      .catch(e => AppAlert.alert('Not found', apiErr(e, 'Could not load the installment.'), [{ text: 'OK', onPress: () => navigation.goBack() }]))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [id, navigation]);

  // The other installments' new % as this one's is typed.
  useEffect(() => {
    if (!id || isToken || !cycle) return;
    if (percent.trim() === '' || isNaN(Number(percent))) {
      setPreview([]);
      return;
    }
    const t = setTimeout(() => {
      previewCycle(id, percent.trim())
        .then(p => setPreview(Number(percent) === cycle.fee_percent ? [] : p))
        .catch(() => setPreview([]));
    }, 500);
    return () => clearTimeout(t);
  }, [id, isToken, cycle, percent]);

  // ── Custom rows, as the panel adds and balances them ──────────────────────
  const nextSerial = (list: CustomRow[]) => {
    const used = new Set(list.map(r => r.serial));
    for (let i = 1; i <= 12; i++) if (!used.has(i)) return i;
    return 1;
  };
  const blankRow = (list: CustomRow[]): CustomRow => ({
    serial: nextSerial(list),
    start_date: '',
    end_date: '',
    due_date: '',
    fee_percent: '',
    penalty_per_day: '0',
  });

  const pickMode = (m: CycleKind) => {
    setMode(m);
    setWrong(null);
    if (m === 'custom' && rows.length === 0) setRows(fillBlankPercents([blankRow([])]));
  };

  const addRow = () =>
    setRows(prev => {
      const next = [...prev, blankRow(prev)];
      const i = next.length - 1;
      next[i].fee_percent = trimPercent(Math.round((100 / next.length) * 100) / 100);
      return shiftPercentRows(next, i);
    });

  const removeRow = (i: number) => setRows(prev => rebalanceToHundred(prev.filter((_, n) => n !== i)));

  const setRow = (i: number, key: keyof CustomRow, v: any) => {
    setRows(prev => prev.map((r, n) => (n === i ? { ...r, [key]: v } : r)));
    typed(`rows.${i}.${key}`);
  };

  // A % typed and left: the others take up the difference.
  const settlePercent = (i: number) =>
    setRows(prev => (String(prev[i]?.fee_percent ?? '').trim() === '' ? fillBlankPercents(prev) : shiftPercentRows(prev, i)));

  const total = useMemo(() => percentTotal(rows), [rows]);

  // ── Save ───────────────────────────────────────────────────────────────────
  const stop = (field: string, message: string) => {
    setWrong({ field, message });
    AppAlert.alert('Check the form', message);
  };

  const tokenFields = { token_amount: tokenAmount.trim(), token_due_date: tokenDue, token_penalty_per_day: tokenPenalty.trim() || '0' };

  const save = async () => {
    if (busy.current) return;

    if (isToken) {
      if (!(Number(tokenAmount) > 0)) return stop('amount', 'Enter a registration fee amount.');
      if (!tokenDue) return stop('due_date', 'Set a due date for the registration fee.');
    } else if (id) {
      if (!due) return stop('due_date', 'Pick the due date.');
      if (percent.trim() === '' || isNaN(Number(percent)) || Number(percent) < 0 || Number(percent) > 100) {
        return stop('fee_percent', 'Fee % must be between 0 and 100.');
      }
      if (start && end && end < start) return stop('end_date', 'The end date cannot come before the start date.');
    } else {
      if (!mode) return stop('mode', 'Pick the cycle type.');
      if (mode === 'custom') {
        if (rows.length === 0) return stop('rows', 'Add at least one installment.');
        for (let i = 0; i < rows.length; i++) {
          const r = rows[i];
          if (!r.start_date) return stop(`rows.${i}.start_date`, `Row ${i + 1}: pick both a start and an end date.`);
          if (!r.end_date) return stop(`rows.${i}.end_date`, `Row ${i + 1}: pick both a start and an end date.`);
          if (r.end_date < r.start_date) return stop(`rows.${i}.end_date`, `Row ${i + 1}: the end date cannot come before the start date.`);
          if (!r.due_date) return stop(`rows.${i}.due_date`, `Row ${i + 1}: pick the due date.`);
        }
      }
    }
    if (!isToken && Number(tokenAmount) > 0 && !tokenDue) {
      return stop('token_due_date', 'Set a due date for the registration fee, or leave its amount blank.');
    }

    setWrong(null);
    busy.current = true;
    setSaveState('saving');
    try {
      let msg: string;
      if (isToken) {
        msg = await saveCycle(id!, { amount: tokenAmount.trim(), due_date: tokenDue, penalty_per_day: tokenPenalty.trim() || '0' });
      } else if (id) {
        msg = await saveCycle(id, {
          serial,
          due_date: due,
          start_date: start,
          end_date: end,
          fee_percent: percent.trim(),
          penalty_per_day: penalty.trim() || '0',
          ...tokenFields,
        });
      } else {
        msg = await addCycles({
          mode: mode as CycleKind,
          monthly_due_day: dueDay,
          penalty_per_day: penalty.trim() || '0',
          rows: mode === 'custom' ? rows : undefined,
          ...tokenFields,
        });
      }
      setSaveState('done');
      AppAlert.alert('Saved', msg, [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } catch (e) {
      busy.current = false;
      setSaveState('idle');
      const w = fieldErrorOf(e);
      if (w?.field) stop(w.field, w.message);
      else AppAlert.alert('Not saved', w?.message ?? 'Could not save the fee cycle.');
    }
  };

  const remove = () =>
    confirmDestructive(
      isToken ? 'Delete the registration fee?' : 'Delete installment?',
      'This removes it from the fee cycle. This cannot be undone.',
      'Delete',
      async () => {
        setDeleting(true);
        try {
          const msg = await deleteCycle(id!);
          AppAlert.alert('Deleted', msg, [{ text: 'OK', onPress: () => navigation.goBack() }]);
        } catch (e) {
          AppAlert.alert('Not deleted', apiErr(e, 'Could not delete it.'));
        } finally {
          setDeleting(false);
        }
      },
    );

  const title = isToken
    ? 'Edit Registration Fee'
    : id
      ? 'Edit Installment'
      : mode === ''
        ? 'Add Fee Cycle'
        : mode === 'monthly'
          ? 'Monthly Fee Cycle'
          : mode === 'quarterly'
            ? 'Quarterly Fee Cycle'
            : 'Custom Installment';

  // ── Pieces ─────────────────────────────────────────────────────────────────
  const penaltyField = (
    <OutlinedField
      half
      label="Penalty / Day (₹)"
      keyboardType="decimal-pad"
      value={penalty}
      onChangeText={(v: string) => setPenalty(v.replace(/[^0-9.]/g, ''))}
    />
  );

  const tokenBlock = (
    <>
      <FormHeading title="Registration Fee (optional, one-time)" />
      <Quiet>Collected once, up front — the installments then split whatever is left of the fee.</Quiet>
      <FieldPair>
        <OutlinedField
          half
          label="Amount (₹)"
          placeholder="e.g. 500"
          keyboardType="decimal-pad"
          value={tokenAmount}
          onChangeText={(v: string) => {
            setTokenAmount(v.replace(/[^0-9.]/g, ''));
            typed('token_due_date');
          }}
        />
        <OutlinedField
          half
          label="Penalty / Day (₹)"
          keyboardType="decimal-pad"
          value={tokenPenalty}
          onChangeText={(v: string) => setTokenPenalty(v.replace(/[^0-9.]/g, ''))}
        />
      </FieldPair>
      <DateBox
        label="Due Date"
        value={tokenDue}
        clearable
        onChange={v => {
          setTokenDue(v);
          typed('token_due_date');
        }}
        error={errorOf('token_due_date')}
      />
    </>
  );

  const body = () => {
    if (loading) return <ActivityIndicator style={s.loading} color={theme.colors.primary} />;

    if (isToken) {
      return (
        <>
          <Text style={s.intro}>The one-time up-front charge, collected before installments.</Text>
          <FormHeading title="Registration Fee" first />
          <OutlinedField
            required
            label="Amount (₹)"
            placeholder="e.g. 500"
            keyboardType="decimal-pad"
            value={tokenAmount}
            onChangeText={(v: string) => {
              setTokenAmount(v.replace(/[^0-9.]/g, ''));
              typed('amount');
            }}
            error={errorOf('amount')}
          />
          <FieldPair>
            <DateBox half required label="Due Date" value={tokenDue} onChange={v => { setTokenDue(v); typed('due_date'); }} error={errorOf('due_date')} />
            <OutlinedField
              half
              label="Penalty / Day (₹)"
              keyboardType="decimal-pad"
              value={tokenPenalty}
              onChangeText={(v: string) => setTokenPenalty(v.replace(/[^0-9.]/g, ''))}
            />
          </FieldPair>
          <View style={s.quietAction}>
            <QuietAction icon="trash-2" label="Delete registration fee" danger busy={deleting} onPress={remove} />
          </View>
        </>
      );
    }

    if (id && cycle) {
      return (
        <>
          <Text style={s.intro}>{`${cycle.fee_type === 'transport' ? 'Transport' : 'Academic'} fee · Academic year ${cycle.year}`}</Text>
          <Text style={s.introSub}>The rupee amount is computed per class from its own fee.</Text>
          <FormHeading title="Installment" first />
          <FieldPair>
            <View style={s.half}>
              <Select notched required label="Installment No." value={serial} options={SERIALS} onChange={v => setSerial(Number(v))} />
            </View>
            <DateBox half required label="Due Date" value={due} onChange={v => { setDue(v); typed('due_date'); }} error={errorOf('due_date')} />
          </FieldPair>
          <FieldPair>
            <DateBox half clearable label="Start Date" value={start} onChange={v => { setStart(v); typed('start_date'); }} error={errorOf('start_date')} />
            <DateBox half clearable label="End Date" value={end} onChange={v => { setEnd(v); typed('end_date'); }} error={errorOf('end_date')} />
          </FieldPair>
          <FieldPair>
            <OutlinedField
              half
              required
              label="Fee % to Collect"
              placeholder="e.g. 25"
              keyboardType="decimal-pad"
              value={percent}
              onChangeText={(v: string) => {
                setPercent(v.replace(/[^0-9.]/g, ''));
                typed('fee_percent');
              }}
              error={errorOf('fee_percent')}
            />
            {penaltyField}
          </FieldPair>
          {preview.length > 0 && (
            <View style={s.preview}>
              <Text style={s.previewTitle}>The other installments will be re-balanced</Text>
              {preview.map(p => (
                <Text key={p.id} style={s.previewLine}>{`#${p.serial}   ${pct(p.was)} → ${pct(p.percent)}`}</Text>
              ))}
            </View>
          )}
          {tokenBlock}
          <View style={s.quietAction}>
            <QuietAction icon="trash-2" label="Delete installment" danger busy={deleting} onPress={remove} />
          </View>
        </>
      );
    }

    return (
      <>
        <Text style={s.intro}>{mode === '' ? 'Choose how you want to build the fee cycle' : 'The rupee amount is computed per class from its own fee'}</Text>
        <FormHeading title="Cycle" first />
        <Select
          notched
          required
          label="Cycle Type"
          placeholder="Select…"
          value={mode || null}
          options={[
            { value: 'monthly', label: 'Monthly — split into 12 equal installments' },
            { value: 'quarterly', label: 'Quarterly — split into 4 equal installments' },
            { value: 'custom', label: 'Custom — add installments yourself' },
          ]}
          onChange={v => pickMode(v as CycleKind)}
          error={errorOf('mode')}
        />
        {mode !== '' && <Quiet>{`Academic fee · Academic year ${year}`}</Quiet>}
        {(mode === 'monthly' || mode === 'quarterly') && existing > 0 && (
          <Quiet tone="warn">{`This replaces the ${existing} installment${existing === 1 ? '' : 's'} already set for ${year}.`}</Quiet>
        )}

        {mode === 'monthly' && (
          <FieldPair>
            <View style={s.half}>
              <Select notched required label="Due day of month" value={dueDay} options={DUE_DAYS} onChange={v => setDueDay(Number(v))} />
            </View>
            {penaltyField}
          </FieldPair>
        )}

        {mode === 'quarterly' && (
          <>
            <FieldPair>
              {penaltyField}
              <View style={s.half} />
            </FieldPair>
            <Quiet>Q1 Apr–Jun · Q2 Jul–Sep · Q3 Oct–Dec · Q4 Jan–Mar</Quiet>
          </>
        )}

        {mode === 'custom' && (
          <>
            <FormHeading title="Installments" />
            <Quiet>
              Change one row's % and the difference is shared out equally across the others — they keep their own numbers, and the set stays at 100%.
            </Quiet>
            {rows.map((r, i) => (
              <View key={i}>
                <RowHead title={`Row ${i + 1}`} sub={pct(r.fee_percent || 0)} onRemove={rows.length > 1 ? () => removeRow(i) : undefined} />
                <FieldPair>
                  <View style={s.half}>
                    <Select notched required label="Installment" value={r.serial} options={SERIALS.map(x => ({ ...x, label: `#${x.value}` }))} onChange={v => setRow(i, 'serial', Number(v))} />
                  </View>
                  <DateBox half required label="Due Date" value={r.due_date} onChange={v => setRow(i, 'due_date', v)} error={errorOf(`rows.${i}.due_date`)} />
                </FieldPair>
                <FieldPair>
                  <DateBox half required label="Start" value={r.start_date} onChange={v => setRow(i, 'start_date', v)} error={errorOf(`rows.${i}.start_date`)} />
                  <DateBox half required label="End" value={r.end_date} onChange={v => setRow(i, 'end_date', v)} error={errorOf(`rows.${i}.end_date`)} />
                </FieldPair>
                <FieldPair>
                  <OutlinedField
                    half
                    required
                    label="Fee %"
                    placeholder="e.g. 25"
                    keyboardType="decimal-pad"
                    value={r.fee_percent}
                    onChangeText={(v: string) => setRow(i, 'fee_percent', v.replace(/[^0-9.]/g, ''))}
                    onEndEditing={() => settlePercent(i)}
                    error={errorOf(`rows.${i}.fee_percent`)}
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
            <AddRowButton label="Add installment" onPress={addRow} />
            <Quiet tone={Math.abs(total - 100) < 0.01 ? 'good' : 'bad'}>{`Total ${pct(total)}`}</Quiet>
          </>
        )}

        {mode !== '' && tokenBlock}
      </>
    );
  };

  const canSave = !loading && (isToken || !!id || mode !== '');

  return (
    <View style={s.root}>
      <DocHeader title={title} onBackPress={() => navigation.goBack()} />
      <Animated.View style={[s.flex, lift]}>
        <ScrollView ref={scrollRef} contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} {...scrollProps}>
          {body()}
          <View style={s.tail} />
        </ScrollView>
        {canSave && (
          <FormFoot>
            <SaveButton
              state={saveState}
              icon="checkmark-circle-outline"
              label={id ? (isToken ? 'Update Registration Fee' : 'Update Installment') : 'Save Fee Cycle'}
              busyLabel="Saving fee cycle"
              doneLabel="Fee cycle saved"
              onPress={save}
            />
          </FormFoot>
        )}
      </Animated.View>
    </View>
  );
};

export default AdminFeeCycleFormScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  flex: { flex: 1 },
  half: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 16 },
  loading: { marginTop: 48 },
  intro: { fontSize: 13, lineHeight: 19, color: theme.colors.textSecondary },
  introSub: { fontSize: 12, lineHeight: 17, color: theme.colors.textMuted, marginTop: 2 },
  tail: { height: 24 },
  quietAction: { marginTop: 28, alignItems: 'flex-start' },
  preview: {
    marginTop: 14,
    padding: 12,
    borderRadius: 10,
    backgroundColor: theme.colors.primaryLight,
    gap: 3,
  },
  previewTitle: { fontSize: 12, fontWeight: '700', color: theme.colors.primary, marginBottom: 2 },
  previewLine: { fontSize: 12, color: theme.colors.textSecondary, fontVariant: ['tabular-nums'] },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
