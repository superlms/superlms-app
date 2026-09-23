import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import moment from 'moment';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useFocusLoad } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { QrPage, QrRequest, QrStatus, getQrRequests, qrForLine } from '../../api/adminFeeApi';
import { DocHeader, DocNoData } from '../more/docUi';
import { Tabs } from '../analytics/analyticsUi';
import { DateBlock, LineRow, Pill } from '../home/dashboardUi';
import { DateSheet, OptionSheet } from './adminFormUi';
import { DropPill, ErrorBox, ListSkeleton, SearchBar } from './adminTransportUi';
import { QR_STATUS, inr } from './adminFeeUi';

/**
 * The panel's QR Payments: what students paid on the school's QR and sent
 * from the app with the UTR or a screenshot. The ones to check come first,
 * oldest first — checked in the order they came in; Approved, Rejected and
 * All are a tab away. Narrowed by fee, by the day it was paid, and by a
 * name, admission number or UTR. A row opens it to check.
 */

type Tab = QrStatus | 'all';

const day = (iso?: string | null) => (iso ? moment(iso).format('D MMM') : '');
const today = () => moment().format('YYYY-MM-DD');
const yesterday = () => moment().subtract(1, 'day').format('YYYY-MM-DD');

const AdminFeeQrScreen = ({ navigation }: any) => {
  const [tab, setTab] = useState<Tab>('pending');
  const [feeType, setFeeType] = useState('');
  const [date, setDate] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState<QrPage | null>(null);
  const [rows, setRows] = useState<QrRequest[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [more, setMore] = useState(false);
  const [sheet, setSheet] = useState<null | 'fee' | 'day' | 'date'>(null);
  const seq = useRef(0);

  const status = tab === 'all' ? '' : tab;

  const load = useCallback(async () => {
    const mine = ++seq.current;
    setError(null);
    try {
      const d = await getQrRequests({ status, fee_type: feeType, search, date }, 1);
      if (mine !== seq.current) return;
      setPage(d);
      setRows(d.requests);
    } catch (e) {
      if (mine === seq.current) setError(apiErr(e, 'Could not load QR payments.'));
    } finally {
      if (mine === seq.current) setRefreshing(false);
    }
  }, [status, feeType, search, date]);

  useEffect(() => {
    const t = setTimeout(load, search ? 350 : 0);
    return () => clearTimeout(t);
  }, [load, search]);
  // Back from a decision, the list moves on.
  useFocusLoad(() => {
    if (rows) load();
  });

  const loadMore = async () => {
    if (!page || more || page.pagination.current_page >= page.pagination.last_page) return;
    setMore(true);
    const mine = seq.current;
    try {
      const next = await getQrRequests({ status, fee_type: feeType, search, date }, page.pagination.current_page + 1);
      if (mine !== seq.current) return;
      setPage(next);
      setRows(prev => [...(prev ?? []), ...next.requests]);
    } catch {
      // the next scroll tries again
    } finally {
      setMore(false);
    }
  };

  const st = page?.stats;
  const tabs: { key: Tab; label: string }[] = [
    { key: 'pending', label: st ? `To check · ${st.pending}` : 'To check' },
    { key: 'approved', label: st ? `Approved · ${st.approved}` : 'Approved' },
    { key: 'rejected', label: st ? `Rejected · ${st.rejected}` : 'Rejected' },
    { key: 'all', label: st ? `All · ${st.total}` : 'All' },
  ];

  const renderItem = ({ item, index }: { item: QrRequest; index: number }) => {
    const pill = QR_STATUS[item.status] ?? QR_STATUS.pending;
    const amount = item.status === 'approved' && item.approved_amount != null ? item.approved_amount : item.amount;
    const forWhat = qrForLine(item);
    const who = item.student;
    return (
      <View style={s.pad}>
        <LineRow
          lead={<DateBlock iso={item.paid_on} accent={item.status === 'pending'} />}
          title={`${who?.name || 'Student removed'} · ${inr(amount)}`}
          meta={[
            [who?.class, who?.section].filter(Boolean).join(' · ') || null,
            who?.admission_no ? `Adm ${who.admission_no}` : null,
            `${item.fee_type === 'transport' ? 'Transport' : 'Academic'}${forWhat ? ` · ${forWhat}` : ''}`,
            item.utr ? `UTR ${item.utr}` : 'Screenshot only',
            item.status === 'approved' && item.receipt_number ? `Receipt ${item.receipt_number}` : null,
            item.status === 'rejected' && item.review_note ? item.review_note : null,
            `sent ${day(item.submitted_at)}`,
          ]
            .filter(Boolean)
            .join(' · ')}
          metaLines={2}
          trailing={<Pill text={pill.text} tone={pill.tone} />}
          onPress={() => navigation.navigate('AdminFeeQrReview', { id: item.id })}
          isLast={index === (rows?.length ?? 0) - 1}
        />
      </View>
    );
  };

  return (
    <View style={s.root}>
      <DocHeader title="QR Payments" onBackPress={() => navigation.goBack()} />
      <Tabs tabs={tabs} active={tab} onChange={setTab} />
      <SearchBar value={search} onChangeText={setSearch} placeholder="Search name, admission no or UTR…" />
      <View style={s.filters}>
        <DropPill label={feeType ? (feeType === 'transport' ? 'Transport' : 'Academic') : 'All fees'} active={!!feeType} onPress={() => setSheet('fee')} />
        <DropPill label={date ? `Paid ${moment(date).format('DD MMM YYYY')}` : 'Any day'} active={!!date} onPress={() => setSheet('day')} />
      </View>

      {error && !rows ? (
        <ErrorBox message={error} onRetry={load} />
      ) : !rows ? (
        <ListSkeleton />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={r => String(r.id)}
          renderItem={renderItem}
          ListHeaderComponent={
            st ? (
              <Text style={s.count}>
                {`${date ? moment(date).format('DD MMM') : 'In all'}: ${st.total} sent · ${inr(st.amount)} · ${st.pending} to check`}
              </Text>
            ) : null
          }
          ListEmptyComponent={
            <DocNoData
              icon="qr-code-outline"
              title={tab === 'pending' ? 'Nothing to check' : 'No payments'}
              subtitle={tab === 'pending' ? 'Payments students send from the app wait here to be checked.' : 'Nothing here for these filters.'}
            />
          }
          ListFooterComponent={more ? <ActivityIndicator style={s.more} color={theme.colors.primary} /> : <View style={s.foot} />}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        />
      )}

      <OptionSheet
        visible={sheet === 'fee'}
        title="Fee"
        options={[
          { key: '', label: 'All fees' },
          { key: 'academic', label: 'Academic' },
          { key: 'transport', label: 'Transport' },
        ]}
        selected={[feeType]}
        onPick={k => {
          setSheet(null);
          setFeeType(k);
        }}
        onClose={() => setSheet(null)}
      />
      <OptionSheet
        visible={sheet === 'day'}
        title="Paid on"
        options={[
          { key: '', label: 'Any day' },
          { key: 'today', label: 'Today' },
          { key: 'yesterday', label: 'Yesterday' },
          { key: 'pick', label: 'Pick a day…' },
        ]}
        selected={[date === today() ? 'today' : date === yesterday() ? 'yesterday' : date ? 'pick' : '']}
        onPick={k => {
          if (k === 'pick') {
            setSheet('date');
            return;
          }
          setSheet(null);
          setDate(k === 'today' ? today() : k === 'yesterday' ? yesterday() : '');
        }}
        onClose={() => setSheet(v => (v === 'day' ? null : v))}
      />
      <DateSheet
        visible={sheet === 'date'}
        title="Paid on"
        value={date || today()}
        maxDate={today()}
        onPick={d => {
          setSheet(null);
          setDate(d);
        }}
        onClose={() => setSheet(null)}
      />
    </View>
  );
};

export default AdminFeeQrScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  filters: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingBottom: 8 },
  count: { fontSize: 12, color: theme.colors.textMuted, paddingHorizontal: 20, paddingVertical: 6 },
  pad: { paddingHorizontal: 20 },
  more: { paddingVertical: 18 },
  foot: { height: 40 },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
