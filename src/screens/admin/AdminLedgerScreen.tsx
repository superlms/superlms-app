import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import moment from 'moment';
import VectorIcon from '../../components/VectorIcon';
import { Skeleton } from '../../components/Skeleton';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useFocusLoad } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { LedgerEntry, LedgerPage, LedgerWindow, getLedger, ledgerStatementUrl } from '../../api/adminLedgerApi';
import { downloadPdf } from '../../api/pdfDownload';
import { HeaderIconButton } from '../../components/Header';
import { AppAlert } from '../../components/AppDialog';
import { DocHeader, DocNoData } from '../more/docUi';
import { DateSheet, OptionSheet } from './adminFormUi';
import { ErrorBox, InfoRow, formatINR } from './adminTransportUi';

/**
 * The school's Ledger, as the admin panel keeps it — every fee, transport
 * and admission payment and every salary, beside the credits and expenses
 * entered by hand — drawn the way a student's pages are: the period's
 * figures at the top, then the statement day by day, newest first, each line
 * with the balance after it. The period is all time by default, or this month,
 * a month (April 2026 onwards), a range, or one day; the header's download
 * saves the panel's PDF statement for it straight to the phone. A manual
 * entry can be corrected for 7 days after it was made.
 */

const TITLE = 'Ledger';

// The Month list starts here: no month before April 2026 is offered.
const FIRST_MONTH = '2026-04';

const iso = (d: moment.Moment) => d.format('YYYY-MM-DD');
const thisMonth = (): LedgerWindow => ({ kind: 'range', start: iso(moment().startOf('month')), end: iso(moment()) });

const windowLabel = (w: LedgerWindow) => {
  if (w.kind === 'overall') return 'All time';
  if (w.kind === 'month') return moment(w.month, 'YYYY-MM').format('MMMM YYYY');
  if (w.start === w.end) return moment(w.start).format('DD MMM YYYY');
  return `${moment(w.start).format('DD MMM')} – ${moment(w.end).format('DD MMM YYYY')}`;
};

type Row = { kind: 'day'; key: string; date: string } | { kind: 'entry'; key: string; entry: LedgerEntry; last: boolean };

const Chip = ({ label, active, onPress, icon }: { label: string; active?: boolean; onPress: () => void; icon?: string }) => (
  <TouchableOpacity style={[s.chip, active && s.chipActive]} onPress={onPress} activeOpacity={0.7}>
    <Text style={[s.chipText, active && s.chipTextActive]} numberOfLines={1}>
      {label}
    </Text>
    {!!icon && <VectorIcon iconSet="Ionicons" iconName={icon} size={13} color={active ? theme.colors.white : theme.colors.textSecondary} />}
  </TouchableOpacity>
);

const AdminLedgerScreen = ({ navigation }: any) => {
  // Opens on Overall — all time.
  const [win, setWin] = useState<LedgerWindow>({ kind: 'overall' });
  const [downloading, setDownloading] = useState(false);
  const [page, setPage] = useState<LedgerPage | null>(null);
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<null | 'month' | 'day' | 'from' | 'to'>(null);
  const [rangeFrom, setRangeFrom] = useState<string | null>(null);
  // Set while From hands the range sheet over to To.
  const handingOver = useRef(false);
  const seq = useRef(0);

  const load = useCallback(async (w: LedgerWindow, quiet = false) => {
    const mine = ++seq.current;
    if (!quiet) setLoading(true);
    setError(null);
    try {
      const d = await getLedger(w, 1);
      if (mine !== seq.current) return;
      setPage(d);
      setEntries(d.entries);
    } catch (e) {
      if (mine === seq.current) setError(apiErr(e, 'Could not load the ledger.'));
    } finally {
      if (mine === seq.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  // Back from an entry, the statement shows it in place.
  useFocusLoad(() => load(win, !!page));

  const pick = (w: LedgerWindow) => {
    setWin(w);
    setPage(null);
    setEntries([]);
    load(w);
  };

  const loadMore = async () => {
    if (!page || more || page.pagination.current_page >= page.pagination.last_page) return;
    setMore(true);
    try {
      const next = await getLedger(win, page.pagination.current_page + 1);
      setPage(next);
      setEntries(prev => [...prev, ...next.entries]);
    } catch {
      // the next scroll tries again
    } finally {
      setMore(false);
    }
  };

  // This month back to April 2026, newest first.
  const months = useMemo(() => {
    const out: { key: string; label: string }[] = [];
    const first = moment(FIRST_MONTH, 'YYYY-MM');
    for (const m = moment().startOf('month'); !m.isBefore(first); m.subtract(1, 'month')) {
      out.push({ key: m.format('YYYY-MM'), label: m.format('MMMM YYYY') });
    }
    return out;
  }, []);

  // The statement as rows: a heading for each day, then its lines.
  const rows: Row[] = useMemo(() => {
    const out: Row[] = [];
    entries.forEach((e, i) => {
      if (i === 0 || entries[i - 1].date !== e.date) out.push({ kind: 'day', key: `d-${e.date}-${i}`, date: e.date });
      out.push({ kind: 'entry', key: `e-${i}`, entry: e, last: i === entries.length - 1 || entries[i + 1].date !== e.date });
    });
    return out;
  }, [entries]);

  const openEntry = (e: LedgerEntry) => {
    if (e.manual_id && e.editable) navigation.navigate('AdminLedgerForm', { id: e.manual_id });
  };

  // The statement PDF, saved straight to the phone's Downloads — not opened.
  const downloadStatement = async () => {
    if (downloading) return;
    setDownloading(true);
    const fileName = `Ledger-Statement-${windowLabel(win).replace(/[\\/:*?"<>|\s–]+/g, '-').replace(/-+/g, '-')}.pdf`;
    try {
      await downloadPdf(ledgerStatementUrl(win), fileName);
      if (Platform.OS === 'android') AppAlert.alert('Downloaded', `${fileName} is saved in Downloads.`);
    } catch {
      AppAlert.alert('Could not download', 'Please check your connection and try again.');
    } finally {
      setDownloading(false);
    }
  };

  const sum = page?.summary;
  const isThisMonth = win.kind === 'range' && win.start === iso(moment().startOf('month')) && win.end === iso(moment());
  const isDay = win.kind === 'range' && win.start === win.end && !isThisMonth;
  const isRange = win.kind === 'range' && !isThisMonth && !isDay;

  const Head = (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
        <Chip label="Overall" active={win.kind === 'overall'} onPress={() => pick({ kind: 'overall' })} />
        <Chip label="This month" active={isThisMonth} onPress={() => pick(thisMonth())} />
        <Chip label={win.kind === 'month' ? windowLabel(win) : 'Month'} active={win.kind === 'month'} icon="chevron-down" onPress={() => setSheet('month')} />
        <Chip label={isRange ? windowLabel(win) : 'Date range'} active={isRange} icon="chevron-down" onPress={() => setSheet('from')} />
        <Chip label={isDay ? windowLabel(win) : 'One day'} active={isDay} icon="chevron-down" onPress={() => setSheet('day')} />
      </ScrollView>

      {/* The balance, then the period's figures */}
      <View style={s.hero}>
        <Text style={s.heroLabel}>Net balance</Text>
        {sum ? (
          <Text style={[s.heroValue, sum.net_balance < 0 && s.negative]}>{formatINR(sum.net_balance)}</Text>
        ) : (
          <Skeleton width={160} height={30} />
        )}
        <Text style={s.heroSub}>All time · {windowLabel(win)} below</Text>
      </View>

      <View style={s.rowsPad}>
        {win.kind !== 'overall' && <InfoRow label="Opening balance" value={sum ? formatINR(sum.opening) : ''} skeleton={!sum} />}
        <InfoRow label="Credits" value={sum ? `+ ${formatINR(sum.period_credit)}` : ''} tone="paid" skeleton={!sum} />
        <InfoRow label="Expenses" value={sum ? `− ${formatINR(sum.period_expense)}` : ''} tone="due" skeleton={!sum} />
        <InfoRow label="Closing balance" value={sum ? formatINR(sum.closing) : ''} last skeleton={!sum} />
      </View>

      <View style={s.actions}>
        <TouchableOpacity style={s.action} activeOpacity={0.8} onPress={() => navigation.navigate('AdminLedgerForm', { type: 'credit' })}>
          <VectorIcon iconSet="Ionicons" iconName="add-circle-outline" size={18} color={theme.colors.success} />
          <Text style={s.actionText}>Add credit</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.action} activeOpacity={0.8} onPress={() => navigation.navigate('AdminLedgerForm', { type: 'expense' })}>
          <VectorIcon iconSet="Ionicons" iconName="remove-circle-outline" size={18} color={theme.colors.danger} />
          <Text style={s.actionText}>Add expense</Text>
        </TouchableOpacity>
      </View>

      <View style={s.divider} />
      <Text style={s.listTitle}>
        {page ? `Statement · ${page.pagination.total} ${page.pagination.total === 1 ? 'entry' : 'entries'}` : 'Statement'}
      </Text>
    </View>
  );

  const renderRow = ({ item }: { item: Row }) => {
    if (item.kind === 'day') {
      return <Text style={s.day}>{moment(item.date).format('DD MMM YYYY · dddd')}</Text>;
    }
    const e = item.entry;
    const credit = e.type === 'credit';
    const canEdit = !!e.manual_id && e.editable;
    const route = [e.from, e.to].filter(Boolean).join(' → ');
    return (
      <TouchableOpacity
        style={[s.entry, !item.last && s.entryDivider]}
        activeOpacity={canEdit ? 0.6 : 1}
        disabled={!canEdit}
        onPress={() => openEntry(e)}
      >
        <View style={[s.dot, credit ? s.dotIn : s.dotOut]}>
          <VectorIcon iconSet="Ionicons" iconName={credit ? 'arrow-down' : 'arrow-up'} size={14} color={credit ? theme.colors.success : theme.colors.danger} />
        </View>
        <View style={s.entryBody}>
          <Text style={s.entryTitle} numberOfLines={1}>
            {e.source}
            {canEdit ? '  ✎' : ''}
          </Text>
          {!!route && (
            <Text style={s.entryMeta} numberOfLines={1}>
              {route}
            </Text>
          )}
          <Text style={s.entryMeta} numberOfLines={2}>
            {[e.time, e.mode, e.reason, e.collected_by ? `Collected by ${e.collected_by}` : null].filter(Boolean).join(' · ')}
          </Text>
        </View>
        <View style={s.entryRight}>
          <Text style={[s.amount, credit ? s.positive : s.negative]}>
            {credit ? '+' : '−'} {formatINR(e.amount)}
          </Text>
          <Text style={s.balance}>{formatINR(e.balance)}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={s.root}>
      <DocHeader
        title={TITLE}
        onBackPress={() => navigation.goBack()}
        rightSlot={
          <View style={s.headActions}>
            {downloading ? (
              <ActivityIndicator style={s.headBusy} size="small" color={theme.colors.primary} />
            ) : (
              <HeaderIconButton icon="download-outline" onPress={downloadStatement} />
            )}
          </View>
        }
      />

      {error && !page ? (
        <ErrorBox message={error} onRetry={() => load(win)} />
      ) : (
        <FlatList
          data={loading && !page ? [] : rows}
          keyExtractor={r => r.key}
          renderItem={renderRow}
          ListHeaderComponent={Head}
          ListEmptyComponent={
            loading ? (
              <View style={s.skList}>
                {[0, 1, 2, 3, 4].map(i => (
                  <View key={i} style={s.skRow}>
                    <Skeleton width={32} height={32} radius={16} />
                    <View style={{ flex: 1, gap: 6 }}>
                      <Skeleton width="50%" height={13} />
                      <Skeleton width="70%" height={11} />
                    </View>
                    <Skeleton width={70} height={13} />
                  </View>
                ))}
              </View>
            ) : (
              <DocNoData icon="calculator-outline" title="Nothing recorded" subtitle="Fees, salaries and the credits and expenses you add show here." />
            )
          }
          ListFooterComponent={more ? <ActivityIndicator style={s.more} color={theme.colors.primary} /> : <View style={s.foot} />}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <AppRefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load(win, true);
              }}
            />
          }
        />
      )}

      <OptionSheet
        visible={sheet === 'month'}
        title="Month"
        options={months}
        selected={win.kind === 'month' ? [win.month] : []}
        onPick={k => {
          setSheet(null);
          pick({ kind: 'month', month: k });
        }}
        onClose={() => setSheet(null)}
      />
      <DateSheet
        visible={sheet === 'day'}
        title="One day"
        value={isDay && win.kind === 'range' ? win.start : iso(moment())}
        maxDate={iso(moment())}
        onPick={d => {
          setSheet(null);
          pick({ kind: 'range', start: d, end: d });
        }}
        onClose={() => setSheet(null)}
      />
      {/* Date range: one sheet that asks From, then To. A day tapped closes a
          DateSheet by itself, so the sheet stays open when From moves it on
          to To, and closes once To is picked. */}
      <DateSheet
        visible={sheet === 'from' || sheet === 'to'}
        title={sheet === 'to' ? `To · from ${moment(rangeFrom ?? undefined).format('DD MMM YYYY')}` : 'From'}
        value={
          sheet === 'to'
            ? rangeFrom ?? iso(moment())
            : isRange && win.kind === 'range'
            ? win.start
            : iso(moment().startOf('month'))
        }
        maxDate={iso(moment())}
        onPick={d => {
          if (sheet === 'from') {
            setRangeFrom(d);
            setSheet('to');
            handingOver.current = true;
            return;
          }
          setSheet(null);
          const from = rangeFrom ?? d;
          const [a, b] = from <= d ? [from, d] : [d, from];
          pick({ kind: 'range', start: a, end: b });
        }}
        // The close that follows From's pick is skipped, so To stays open; a
        // tap outside or Back still closes it, on From or To.
        onClose={() => {
          if (handingOver.current) {
            handingOver.current = false;
            return;
          }
          setSheet(null);
        }}
      />
    </View>
  );
};

export default AdminLedgerScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },

  headActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  headBusy: { width: 40 },

  chips: { gap: 8, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 4 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
    borderWidth: 1, borderColor: theme.colors.border,
  },
  chipActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  chipText: { fontSize: 13, fontWeight: '500', color: theme.colors.textSecondary },
  chipTextActive: { color: theme.colors.white },

  hero: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 8, gap: 4 },
  heroLabel: { fontSize: 13, color: theme.colors.textSecondary },
  heroValue: { fontSize: 30, fontWeight: '700', color: theme.colors.textPrimary },
  heroSub: { fontSize: 12, color: theme.colors.textMuted },

  rowsPad: { paddingHorizontal: 20 },

  actions: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 16 },
  action: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 11, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border,
  },
  actionText: { fontSize: 14, fontWeight: '600', color: theme.colors.textPrimary },

  divider: { height: 8, backgroundColor: theme.colors.background },
  listTitle: { fontSize: 15, fontWeight: '700', color: theme.colors.textPrimary, paddingHorizontal: 20, paddingTop: 16 },
  day: { fontSize: 12, fontWeight: '600', color: theme.colors.textMuted, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 2, textTransform: 'uppercase', letterSpacing: 0.4 },

  entry: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginHorizontal: 20, paddingVertical: 12 },
  entryDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },
  dot: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  dotIn: { backgroundColor: theme.colors.success + '1A' },
  dotOut: { backgroundColor: theme.colors.danger + '1A' },
  entryBody: { flex: 1, gap: 2 },
  entryTitle: { fontSize: 15, fontWeight: '600', color: theme.colors.textPrimary },
  entryMeta: { fontSize: 12, color: theme.colors.textSecondary },
  entryRight: { alignItems: 'flex-end', gap: 3 },
  amount: { fontSize: 15, fontWeight: '600' },
  positive: { color: theme.colors.success },
  negative: { color: theme.colors.danger },
  balance: { fontSize: 12, color: theme.colors.textMuted },

  skList: { paddingHorizontal: 20, paddingTop: 12, gap: 16 },
  skRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  more: { paddingVertical: 18 },
  foot: { height: 40 },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
