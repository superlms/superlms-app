import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, ScrollView, StyleSheet, Text, View } from 'react-native';
import moment from 'moment';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useFocusLoad } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import {
  DATE_PRESETS,
  DatePreset,
  FeePaymentRow,
  PAY_MODES,
  PaymentFilters,
  PaymentsPage,
  getFeePayments,
  modeLabel,
  typeLabel,
} from '../../api/adminFeeApi';
import { DocHeader, DocNoData } from '../more/docUi';
import { Tabs } from '../analytics/analyticsUi';
import { DateSheet, OptionSheet } from './adminFormUi';
import { DropPill, ErrorBox, InfoRow, ListSkeleton, SearchBar } from './adminTransportUi';
import { ClassPills, PaymentLine, inr, openFeeReceipt, useFeeClasses } from './adminFeeUi';

/**
 * The panel's Payments: every fee payment, whichever table it lives in —
 * academic, transport and penalty — newest first, each with its receipt.
 * This month by default, or another range; narrowed by fee type, class,
 * section, mode and a student's name or admission number. Above the list,
 * the panel's strip: the year's fee, what has come in (academic and
 * transport), and what is left — both counted under the same filters.
 */

type TypeTab = 'all' | 'academic' | 'transport' | 'penalty';
const TYPE_TABS: { key: TypeTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'academic', label: 'Academic' },
  { key: 'transport', label: 'Transport' },
  { key: 'penalty', label: 'Penalty' },
];

const iso = (d: moment.Moment) => d.format('YYYY-MM-DD');

const AdminFeePaymentsScreen = ({ navigation, route }: any) => {
  const classes = useFeeClasses();
  const [preset, setPreset] = useState<DatePreset>(route?.params?.preset ?? 'this_month');
  const [range, setRange] = useState<{ from: string; to: string }>({ from: iso(moment().startOf('month')), to: iso(moment()) });
  const [tab, setTab] = useState<TypeTab>('all');
  const [classId, setClassId] = useState<number | null>(null);
  const [sectionId, setSectionId] = useState<number | null>(null);
  const [mode, setMode] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState<PaymentsPage | null>(null);
  const [rows, setRows] = useState<FeePaymentRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [more, setMore] = useState(false);
  const [sheet, setSheet] = useState<null | 'preset' | 'from' | 'to' | 'mode'>(null);
  const seq = useRef(0);

  const filters: PaymentFilters = {
    preset,
    date_from: range.from,
    date_to: range.to,
    standard_id: classId ?? undefined,
    section_id: sectionId ?? undefined,
    search,
    mode,
    fee_type: tab === 'all' ? '' : tab,
  };
  const key = JSON.stringify(filters);

  const load = useCallback(async () => {
    const mine = ++seq.current;
    setError(null);
    try {
      const d = await getFeePayments(JSON.parse(key), 1);
      if (mine !== seq.current) return;
      setPage(d);
      setRows(d.payments);
    } catch (e) {
      if (mine === seq.current) setError(apiErr(e, 'Could not load payments.'));
    } finally {
      if (mine === seq.current) setRefreshing(false);
    }
  }, [key]);

  // Typing waits a moment before it asks.
  useEffect(() => {
    const t = setTimeout(load, search ? 350 : 0);
    return () => clearTimeout(t);
  }, [load, search]);
  useFocusLoad(() => {
    if (rows) load();
  });

  const loadMore = async () => {
    if (!page || more || page.pagination.current_page >= page.pagination.last_page) return;
    setMore(true);
    const mine = seq.current;
    try {
      const next = await getFeePayments(JSON.parse(key), page.pagination.current_page + 1);
      if (mine !== seq.current) return;
      setPage(next);
      setRows(prev => [...(prev ?? []), ...next.payments]);
    } catch {
      // the next scroll tries again
    } finally {
      setMore(false);
    }
  };

  const presetLabel =
    preset === ''
      ? range.from === range.to
        ? moment(range.from).format('DD MMM YYYY')
        : `${moment(range.from).format('DD MMM')} – ${moment(range.to).format('DD MMM YYYY')}`
      : DATE_PRESETS.find(p => p.key === preset)?.label ?? 'This month';

  const st = page?.stats;
  const w = page?.window;
  const windowLine =
    w && w.date_from && w.date_to
      ? w.date_from === w.date_to
        ? moment(w.date_from).format('DD MMM YYYY')
        : `${moment(w.date_from).format('DD MMM')} – ${moment(w.date_to).format('DD MMM YYYY')}`
      : null;

  const Head = st ? (
    <View style={s.head}>
      <InfoRow label="Fee for the year" value={inr(st.total_fee)} />
      <InfoRow
        label="Collected"
        value={`${inr(st.total_collected)}`}
        tone="paid"
      />
      <Text style={s.split}>{`Academic ${inr(st.academic_collected)} · Transport ${inr(st.transport_collected)}${windowLine ? ` · ${windowLine}` : ''}`}</Text>
      <InfoRow label="Remaining" value={inr(st.remaining_fee)} tone={st.remaining_fee > 0 ? 'due' : undefined} last />
      <Text style={s.count}>
        {`${page!.pagination.total} ${page!.pagination.total === 1 ? 'payment' : 'payments'}`}
      </Text>
    </View>
  ) : null;

  const renderItem = ({ item, index }: { item: FeePaymentRow; index: number }) => (
    <View style={s.pad}>
      <PaymentLine
        title={item.student_name}
        meta={[
          [item.class, item.section].filter(Boolean).join(' · ') || null,
          item.admission_no ? `Adm ${item.admission_no}` : null,
          typeLabel(item.fee_type),
          modeLabel(item.payment_mode),
          item.payment_date ? moment(item.payment_date).format('DD MMM YYYY') : null,
          item.submitted_by ? `by ${item.submitted_by}` : null,
          item.penalty_amount > 0 ? `incl. ${inr(item.penalty_amount)} penalty` : null,
          item.waiver_amount > 0 ? `${inr(item.waiver_amount)} waived` : null,
        ]
          .filter(Boolean)
          .join(' · ')}
        amount={inr(item.amount)}
        onReceipt={() => openFeeReceipt(navigation, { id: item.id, kind: item.kind })}
        isLast={index === (rows?.length ?? 0) - 1}
      />
    </View>
  );

  return (
    <View style={s.root}>
      <DocHeader title="Payments" onBackPress={() => navigation.goBack()} />
      <Tabs tabs={TYPE_TABS} active={tab} onChange={setTab} />
      <SearchBar value={search} onChangeText={setSearch} placeholder="Search student or admission no…" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filters} keyboardShouldPersistTaps="handled">
        <DropPill label={presetLabel} active onPress={() => setSheet('preset')} />
        <ClassPills
          classes={classes}
          classId={classId}
          sectionId={sectionId}
          onChange={(c, sec) => {
            setClassId(c);
            setSectionId(sec);
          }}
        />
        <DropPill label={mode ? modeLabel(mode) : 'All modes'} active={!!mode} onPress={() => setSheet('mode')} />
      </ScrollView>

      {error && !rows ? (
        <ErrorBox message={error} onRetry={load} />
      ) : !rows ? (
        <ListSkeleton />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={p => `${p.kind}-${p.id}`}
          renderItem={renderItem}
          ListHeaderComponent={Head}
          ListEmptyComponent={<DocNoData icon="receipt-outline" title="No payments" subtitle="Nothing recorded for these filters." />}
          ListFooterComponent={more ? <ActivityIndicator style={s.more} color={theme.colors.primary} /> : <View style={s.foot} />}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        />
      )}

      <OptionSheet
        visible={sheet === 'preset'}
        title="Date range"
        options={DATE_PRESETS.map(p => ({ key: p.key, label: p.label }))}
        selected={[preset]}
        onPick={k => {
          if (k === '') {
            setSheet('from');
            return;
          }
          setSheet(null);
          setPreset(k as DatePreset);
        }}
        onClose={() => setSheet(s2 => (s2 === 'preset' ? null : s2))}
      />
      <DateSheet
        visible={sheet === 'from'}
        title="From"
        value={range.from}
        onPick={d => {
          setRange(r => ({ ...r, from: d }));
          setSheet('to');
        }}
        onClose={() => setSheet(null)}
      />
      <DateSheet
        visible={sheet === 'to'}
        title="To"
        value={range.to < range.from ? range.from : range.to}
        onPick={d => {
          setSheet(null);
          setRange(r => (d < r.from ? { from: d, to: r.from } : { from: r.from, to: d }));
          setPreset('');
        }}
        onClose={() => setSheet(null)}
      />
      <OptionSheet
        visible={sheet === 'mode'}
        title="Payment mode"
        options={[{ key: '', label: 'All modes' }, ...PAY_MODES.map(m => ({ key: m.key, label: m.label }))]}
        selected={[mode]}
        onPick={k => {
          setSheet(null);
          setMode(k);
        }}
        onClose={() => setSheet(null)}
      />
    </View>
  );
};

export default AdminFeePaymentsScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  filters: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingBottom: 8 },
  head: { paddingHorizontal: 20, paddingTop: 4 },
  split: { fontSize: 12, color: theme.colors.textMuted, paddingBottom: 8, marginTop: -4 },
  count: { fontSize: 12, color: theme.colors.textMuted, paddingTop: 12, paddingBottom: 2 },
  pad: { paddingHorizontal: 20 },
  more: { paddingVertical: 18 },
  foot: { height: 40 },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
