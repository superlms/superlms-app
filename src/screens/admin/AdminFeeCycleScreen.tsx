import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import AppRefreshControl from '../../components/AppRefreshControl';
import { AppAlert } from '../../components/AppDialog';
import { useFocusLoad } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { authHeader, downloadFile } from '../../api/pdfDownload';
import {
  CalcRow,
  CalcStudent,
  CalcSummary,
  CycleGroup,
  KIND_LABEL,
  cycleCsvUrl,
  getCalculator,
  getCycles,
} from '../../api/adminFeeSetupApi';
import { DocHeader } from '../more/docUi';
import { UnderlineTabs } from './adminExamUi';
import { ErrorBox, ListSkeleton } from './adminTransportUi';
import { ClassPills, useFeeClasses } from './adminFeeUi';
import {
  Band,
  ClearPill,
  GroupHead,
  GroupsSkeleton,
  HeadActions,
  HeadBtn,
  NumLine,
  PickPill,
  Prompt,
  Quiet,
  Strip,
  dmy,
  pct,
  plural,
  rupees,
} from './feeSetupUi';

/**
 * Fee Cycle — the panel's tab: Fee Cycle and Calculator.
 *
 * Fee Cycle: one group for each fee type and academic year — the kind it was
 * built as (Monthly, Quarterly, Custom), how many installments, what they add
 * up to and the registration fee — with Edit (the whole cycle at once) and
 * Download (CSV). Each installment reads as it was built ("April 2026",
 * "Q1 · Apr–Jun", "Installment #3") with its due date, period, % and penalty
 * a day; a row opens it to edit or delete. + adds a fee cycle.
 *
 * Calculator: a class (a section, an installment) and every student of it as
 * their View Fee works it out — each installment's amount, the class's total,
 * what is collected and what remains, then the students.
 */

type Tab = 'cycle' | 'calculator';

const AdminFeeCycleScreen = ({ navigation }: any) => {
  const classes = useFeeClasses();
  const [tab, setTab] = useState<Tab>('cycle');

  // ── Fee Cycle ──────────────────────────────────────────────────────────────
  const [groups, setGroups] = useState<CycleGroup[] | null>(null);
  const [counts, setCounts] = useState({ total: 0, academic: 0, transport: 0 });
  const [year, setYear] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const d = await getCycles();
      setGroups(d.groups);
      setCounts(d.counts);
      setYear(d.current_year);
    } catch (e) {
      setError(apiErr(e, 'Could not load the fee cycle.'));
    }
  }, []);

  // ── Calculator ─────────────────────────────────────────────────────────────
  const [classId, setClassId] = useState<number | null>(null);
  const [sectionId, setSectionId] = useState<number | null>(null);
  const [serial, setSerial] = useState<string>('');
  const [calc, setCalc] = useState<{ rows: CalcRow[]; students: CalcStudent[]; summary: CalcSummary | null; installments: number[] } | null>(null);
  const [calcError, setCalcError] = useState<string | null>(null);
  const cseq = useRef(0);

  const loadCalc = useCallback(async () => {
    const mine = ++cseq.current;
    setCalc(null);
    setCalcError(null);
    if (!classId) return;
    try {
      const d = await getCalculator(classId, sectionId);
      if (mine === cseq.current) setCalc(d);
    } catch (e) {
      if (mine === cseq.current) setCalcError(apiErr(e, 'Could not work out the class.'));
    }
  }, [classId, sectionId]);

  useEffect(() => {
    loadCalc();
  }, [loadCalc]);

  useFocusLoad(load);

  const [refreshing, setRefreshing] = useState(false);
  const refresh = async () => {
    setRefreshing(true);
    try {
      await (tab === 'cycle' ? load() : loadCalc());
    } finally {
      setRefreshing(false);
    }
  };

  const download = async (g: CycleGroup) => {
    setDownloading(g.key);
    try {
      await downloadFile(cycleCsvUrl(g.fee_type, g.year), `fee-cycle-${g.fee_type}-${g.year.replace(/[^A-Za-z0-9-]+/g, '-')}.csv`, await authHeader());
    } catch (e) {
      AppAlert.alert('Not downloaded', apiErr(e, 'Could not download the fee cycle.'));
    } finally {
      setDownloading(null);
    }
  };

  const existingFor = (feeType: string, y: string) => groups?.find(g => g.fee_type === feeType && g.year === y)?.count ?? 0;

  // ── Views ──────────────────────────────────────────────────────────────────
  const cycleTab = () => {
    if (error && !groups) return <ErrorBox message={error} onRetry={load} />;
    if (!groups) return <GroupsSkeleton groups={1} lines={6} />;
    if (groups.length === 0) return <Prompt icon="repeat-outline" title="No installments yet" sub="Tap + (Add Fee Cycle) to define the fee cycle." />;
    return (
      <View style={s.pad}>
        <Strip items={[{ label: 'Total', value: counts.total }, { label: 'Academic', value: counts.academic }, { label: 'Transport', value: counts.transport }]} />
        {groups.map(g => {
          const balanced = Math.abs(g.percent - 100) < 0.01;
          return (
            <View key={g.key}>
              <GroupHead
                icon="repeat-outline"
                title={`${g.fee_type === 'transport' ? 'Transport' : 'Academic'} Fee`}
                badge={{ text: KIND_LABEL[g.kind] ?? 'Custom', tone: g.kind === 'custom' ? 'muted' : 'accent' }}
                sub={[
                  g.year,
                  plural(g.count, 'installment'),
                  `totals ${pct(g.percent)}${balanced ? '' : ' ⚠'}`,
                  g.token ? `registration fee ${rupees(g.token.amount)}` : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
                actions={[
                  {
                    icon: 'create-outline',
                    label: 'Edit the whole cycle',
                    onPress: () => navigation.navigate('AdminFeeCycleEdit', { feeType: g.fee_type, year: g.year }),
                  },
                  { icon: 'download-outline', label: 'Download', busy: downloading === g.key, onPress: () => download(g) },
                ]}
              />
              {!balanced && <Quiet tone="bad">{`These add up to ${pct(g.percent)} — Edit the cycle to bring them to 100%.`}</Quiet>}
              {g.rows.map((c, i) => (
                <NumLine
                  key={c.id}
                  n={c.is_token ? '—' : i + (g.token ? 0 : 1)}
                  label={c.label}
                  tag={c.is_token ? null : `#${c.serial}`}
                  sub={[
                    `Due ${dmy(c.due_date)}`,
                    c.start_date && c.end_date ? `${dmy(c.start_date)} – ${dmy(c.end_date)}` : null,
                    `Penalty ${rupees(c.penalty_per_day)}/day`,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                  value={c.is_token ? rupees(c.amount) : pct(c.fee_percent)}
                  onPress={() => navigation.navigate('AdminFeeCycleForm', { id: c.id })}
                  isLast={i === g.rows.length - 1}
                />
              ))}
            </View>
          );
        })}
      </View>
    );
  };

  const calculatorTab = () => {
    if (!classId) return <Prompt icon="calculator-outline" title="Select a class" sub="Every student's fee comes up — or a section's, for just its students." />;
    if (calcError && !calc) return <ErrorBox message={calcError} onRetry={loadCalc} />;
    if (!calc) return <ListSkeleton rows={6} />;
    if (calc.rows.length === 0) return <Prompt icon="repeat-outline" title="No academic installments defined yet" sub="Add one from the Fee Cycle tab." />;

    const cs = calc.summary!;
    const part = serial === '' ? null : serial;
    const rows = calc.rows.filter(r => part === null || r.serial === `#${part}`);
    const feeSpan = cs.fee_max - cs.fee_min > 0.009 ? `${rupees(cs.fee_min)} – ${rupees(cs.fee_max)}` : rupees(cs.fee_min);

    return (
      <View style={s.pad}>
        <Strip
          items={[
            { label: 'Students', value: cs.students },
            { label: 'Fee per student', value: feeSpan },
            { label: 'Total', value: rupees(cs.total) },
            { label: 'Collected', value: rupees(cs.collected), color: '#059669' },
            { label: 'Remaining', value: rupees(cs.remaining), color: cs.remaining > 0 ? theme.colors.danger : undefined },
            { label: 'Paid up', value: `${cs.paid_up} of ${cs.students}` },
          ]}
        />
        {cs.students > 0 && cs.total <= 0 && <Quiet tone="warn">No academic fee structure found for this class — amounts show ₹0.</Quiet>}

        <GroupHead icon="list-outline" title="Installments" sub={`Total for the ${sectionId ? 'section' : 'class'}`} />
        {rows.map((r, i) => (
          <NumLine
            key={r.serial}
            label={`${r.serial}${r.span ? ` (${r.span})` : ''}`}
            sub={[`Due ${r.due_date ?? '—'}`, r.percent === null ? null : pct(r.percent), r.amount === null ? 'Varies' : `${rupees(r.amount)} each`]
              .filter(Boolean)
              .join(' · ')}
            value={rupees(r.class_total)}
            valueSub={`Collected ${rupees(r.collected)} · Left ${rupees(r.remaining)}`}
            isLast={i === rows.length - 1}
          />
        ))}

        <GroupHead
          icon="people-outline"
          title="Students"
          sub={`${part === null ? "This year's academic fee, net of concession" : `Installment ${part}`} · ${sectionId ? 'this section' : 'every section'}`}
        />
        {calc.students.length === 0 ? (
          <Quiet>{`No students in this ${sectionId ? 'section' : 'class'}.`}</Quiet>
        ) : (
          calc.students.map((st, i) => {
            const amount = part === null ? st.fee : st.parts[part]?.amount ?? 0;
            const got = part === null ? st.paid : st.parts[part]?.paid ?? 0;
            const left = Math.max(0, Math.round((amount - got) * 100) / 100);
            const [tone, word] =
              amount <= 0 ? [undefined, '—'] : left <= 0 ? ['good', 'Paid'] : got > 0 ? ['warn', 'Partial'] : ['bad', 'Due'];
            return (
              <NumLine
                key={st.id}
                n={i + 1}
                label={st.name}
                sub={[
                  `Adm ${st.admission || '—'} · Roll ${st.roll || '—'} · ${st.section}`,
                  `Paid ${rupees(got)} · Left ${rupees(left)}${part === null ? ` · Cleared ${st.cleared} of ${Object.keys(st.parts).length}` : ''}`,
                ].join('\n')}
                value={rupees(amount)}
                valueSub={word}
                tone={tone as any}
                isLast={i === calc.students.length - 1}
              />
            );
          })
        )}
      </View>
    );
  };

  const installments = calc?.installments ?? [];

  return (
    <View style={s.root}>
      <DocHeader
        title="Fee Cycle"
        onBackPress={() => navigation.goBack()}
        rightSlot={
          tab === 'cycle' ? (
            <HeadActions>
              <HeadBtn
                icon="add"
                onPress={() =>
                  navigation.navigate('AdminFeeCycleForm', { year, existing: existingFor('academic', year) })
                }
              />
            </HeadActions>
          ) : undefined
        }
      />
      <UnderlineTabs
        tabs={[
          { key: 'cycle', label: 'Fee Cycle' },
          { key: 'calculator', label: 'Calculator' },
        ]}
        active={tab}
        onChange={setTab}
      />
      {tab === 'calculator' && (
        <Band>
          <ClassPills
            classes={classes}
            classId={classId}
            sectionId={sectionId}
            allLabel="Select class…"
            onChange={(c, sec) => {
              setClassId(c);
              setSectionId(sec);
            }}
          />
          <PickPill
            title="Installment"
            label={serial ? `Installment ${serial}` : 'All installments'}
            active={!!serial}
            options={[{ key: '', label: 'All installments' }, ...installments.map(n => ({ key: String(n), label: `Installment ${n}` }))]}
            value={serial}
            onPick={k => setSerial(k)}
          />
          {(!!classId || !!serial) && (
            <ClearPill
              onPress={() => {
                setClassId(null);
                setSectionId(null);
                setSerial('');
              }}
            />
          )}
        </Band>
      )}
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={refresh} />}
      >
        {tab === 'cycle' ? cycleTab() : calculatorTab()}
      </ScrollView>
    </View>
  );
};

export default AdminFeeCycleScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  pad: { paddingHorizontal: 20 },
  scroll: { paddingBottom: 40 },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
