import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, ScrollView, StyleSheet, Text, View } from 'react-native';
import moment from 'moment';
import AppRefreshControl from '../../components/AppRefreshControl';
import { AppAlert } from '../../components/AppDialog';
import { useFocusLoad } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { QrPage, QrRequest, QrStatus, getQrRequests, qrForLine } from '../../api/adminFeeApi';
import { SchoolQr, deletePaymentQr, getPaymentQr } from '../../api/adminFeeSetupApi';
import { DocHeader, DocNoData } from '../more/docUi';
import { DateBlock, LineRow, Pill } from '../home/dashboardUi';
import { QrImage } from '../fees/qrUi';
import { UnderlineTabs } from './adminExamUi';
import { DateSheet, QuietAction, confirmDestructive } from './adminFormUi';
import { DropPill, ErrorBox, ListSkeleton, SearchBar } from './adminTransportUi';
import { QR_STATUS, inr } from './adminFeeUi';
import { Band, ClearPill, HeadActions, HeadLink, PickPill, Prompt, Strip } from './feeSetupUi';

/**
 * QR Payments — the panel's tab, with its two tabs.
 *
 * QR Payments: what students paid on the school's QR and sent from the app
 * with the UTR or a screenshot. The ones to check come first, oldest first —
 * checked in the order they came in. The band narrows them by status (To
 * check, Approved, Rejected, All), fee and the day paid, and the search by a
 * name, admission number or UTR; the line over the list counts them as the
 * panel's header does. A row opens it to check.
 *
 * Payment QR: the school's own UPI QR, which students see in the app's Fees
 * and pay on, with its UPI ID and account name — Add QR / Edit QR in the
 * header, and Remove under it.
 */

type View2 = 'payments' | 'qr';
type Status = QrStatus | '';

const today = () => moment().format('YYYY-MM-DD');
const day = (iso?: string | null) => (iso ? moment(iso).format('D MMM') : '');

const STATUS_OPTIONS: { key: Status; label: string }[] = [
  { key: 'pending', label: 'To check' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: '', label: 'All Status' },
];

// ── Payment QR ───────────────────────────────────────────────────────────────
const PaymentQrView = ({ navigation, qr, loading, error, onRetry, onRemoved }: {
  navigation: any;
  qr: SchoolQr | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onRemoved: () => void;
}) => {
  const [removing, setRemoving] = useState(false);

  if (error && !qr) return <ErrorBox message={error} onRetry={onRetry} />;
  if (loading && !qr) return <ListSkeleton rows={3} />;

  const saved = qr?.qr ?? null;
  if (!saved || !saved.image_url) {
    return (
      <Prompt
        icon="qr-code-outline"
        title="No payment QR yet"
        sub="Add the school's UPI QR — students see it in the app's Fees and pay on it; what they report waits under QR Payments to be checked."
      />
    );
  }

  const remove = () =>
    confirmDestructive('Remove the payment QR?', 'Students will no longer see it in the app.', 'Remove', async () => {
      setRemoving(true);
      try {
        const msg = await deletePaymentQr();
        onRemoved();
        AppAlert.alert('Removed', msg);
      } catch (e) {
        AppAlert.alert('Not removed', apiErr(e, 'Could not remove the QR.'));
      } finally {
        setRemoving(false);
      }
    });

  return (
    <View style={s.pad}>
      <QrImage url={saved.image_url} onPress={() => navigation.navigate('AdminFeeQrImage', { uri: saved.image_url, title: 'Payment QR' })} />
      <View style={s.facts}>
        <View style={s.fact}>
          <Text style={s.factLabel}>UPI ID</Text>
          <Text style={s.factValue} selectable>{saved.upi_id || '—'}</Text>
        </View>
        <View style={[s.fact, s.factLast]}>
          <Text style={s.factLabel}>Account name</Text>
          <Text style={s.factValue}>{saved.payee_name || qr?.school_name || '—'}</Text>
        </View>
      </View>
      <Text style={s.note}>Shown to students in the app's Fees. The money goes straight to the school's account; what they report waits under QR Payments to be checked.</Text>
      <View style={s.quietAction}>
        <QuietAction icon="trash-2" label="Remove QR" danger busy={removing} onPress={remove} />
      </View>
    </View>
  );
};

const AdminFeeQrScreen = ({ navigation, route }: any) => {
  const [view, setView] = useState<View2>(route.params?.view === 'qr' ? 'qr' : 'payments');

  // ── QR Payments ────────────────────────────────────────────────────────────
  const [status, setStatus] = useState<Status>('pending');
  const [feeType, setFeeType] = useState('');
  const [date, setDate] = useState('');
  const [dateOpen, setDateOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState<QrPage | null>(null);
  const [rows, setRows] = useState<QrRequest[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [more, setMore] = useState(false);
  const seq = useRef(0);

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

  // ── Payment QR ─────────────────────────────────────────────────────────────
  const [qr, setQr] = useState<SchoolQr | null>(null);
  const [qrLoading, setQrLoading] = useState(true);
  const [qrError, setQrError] = useState<string | null>(null);
  const loadQr = useCallback(async () => {
    setQrError(null);
    try {
      setQr(await getPaymentQr());
    } catch (e) {
      setQrError(apiErr(e, 'Could not load the payment QR.'));
    } finally {
      setQrLoading(false);
    }
  }, []);

  // Back from a decision or the QR form, both are fresh.
  useFocusLoad(() => {
    if (rows) load();
    loadQr();
  });

  const st = page?.stats;
  const statusLabel = STATUS_OPTIONS.find(o => o.key === status)?.label ?? 'All Status';
  const filtered = search !== '' || feeType !== '' || date !== '' || status !== 'pending';

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

  const hasQr = !!qr?.qr?.image_url;

  return (
    <View style={s.root}>
      <DocHeader
        title="QR Payments"
        onBackPress={() => navigation.goBack()}
        rightSlot={
          view === 'qr' && !qrLoading ? (
            <HeadActions>
              <HeadLink label={hasQr ? 'Edit QR' : 'Add QR'} onPress={() => navigation.navigate('AdminFeePaymentQrForm', { qr })} />
            </HeadActions>
          ) : undefined
        }
      />
      <UnderlineTabs
        tabs={[
          { key: 'payments', label: 'QR Payments' },
          { key: 'qr', label: 'Payment QR' },
        ]}
        active={view}
        onChange={setView}
      />

      {view === 'qr' ? (
        <ScrollView
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await loadQr(); setRefreshing(false); }} />}
        >
          <PaymentQrView
            navigation={navigation}
            qr={qr}
            loading={qrLoading}
            error={qrError}
            onRetry={() => { setQrLoading(true); loadQr(); }}
            onRemoved={loadQr}
          />
        </ScrollView>
      ) : (
        <>
          <View style={s.search}>
            <SearchBar value={search} onChangeText={setSearch} placeholder="Search student, admission no. or UTR…" />
          </View>
          <Band>
            <PickPill
              title="Status"
              label={statusLabel}
              active={status !== ''}
              options={STATUS_OPTIONS.map(o => ({ key: o.key as string, label: o.label }))}
              value={status}
              onPick={k => setStatus(k as Status)}
            />
            <PickPill
              title="Fee"
              label={feeType ? (feeType === 'transport' ? 'Transport' : 'Academic') : 'All Fees'}
              active={!!feeType}
              options={[
                { key: '', label: 'All Fees' },
                { key: 'academic', label: 'Academic' },
                { key: 'transport', label: 'Transport' },
              ]}
              value={feeType}
              onPick={setFeeType}
            />
            <DropPill label={date ? `Paid ${moment(date).format('DD MMM YYYY')}` : 'Paid on'} active={!!date} onPress={() => setDateOpen(true)} />
            {filtered && (
              <ClearPill
                onPress={() => {
                  setSearch('');
                  setFeeType('');
                  setDate('');
                  setStatus('pending');
                }}
              />
            )}
          </Band>

          {error && !rows ? (
            <ErrorBox message={error} onRetry={load} />
          ) : !rows ? (
            <View style={s.pad}>
              <ListSkeleton />
            </View>
          ) : (
            <FlatList
              data={rows}
              keyExtractor={r => String(r.id)}
              renderItem={renderItem}
              ListHeaderComponent={
                st ? (
                  <View style={s.pad}>
                    <Strip
                      items={[
                        { label: date ? moment(date).format('DD MMM') : 'Total', value: `${st.total} · ${inr(st.amount)}` },
                        { label: 'To check', value: st.pending, color: '#D97706' },
                        { label: 'Approved', value: st.approved, color: '#059669' },
                        { label: 'Rejected', value: st.rejected, color: theme.colors.danger },
                      ]}
                    />
                  </View>
                ) : null
              }
              ListEmptyComponent={
                <DocNoData
                  icon="qr-code-outline"
                  title={status === 'pending' ? 'Nothing to check' : 'No payments'}
                  subtitle={status === 'pending' ? 'Payments students send from the app wait here to be checked.' : 'Nothing here for these filters.'}
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
        </>
      )}

      <DateSheet
        visible={dateOpen}
        title="Paid on"
        value={date || today()}
        maxDate={today()}
        onPick={d => setDate(d)}
        onClose={() => setDateOpen(false)}
      />
    </View>
  );
};

export default AdminFeeQrScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  search: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 2 },
  pad: { paddingHorizontal: 20 },
  scroll: { paddingTop: 16, paddingBottom: 40 },
  more: { paddingVertical: 18 },
  foot: { height: 40 },

  facts: { marginTop: 16, borderTopWidth: 1, borderTopColor: theme.colors.border },
  fact: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  factLast: { borderBottomWidth: 0 },
  factLabel: { fontSize: 13, color: theme.colors.textMuted },
  factValue: { flexShrink: 1, fontSize: 15, fontWeight: '500', color: theme.colors.textPrimary, textAlign: 'right' },
  note: { fontSize: 12, color: theme.colors.textMuted, lineHeight: 18, marginTop: 6 },
  quietAction: { marginTop: 24, alignItems: 'flex-start' },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
