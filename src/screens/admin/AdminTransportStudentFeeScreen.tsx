import React, { useCallback, useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import moment from 'moment';
import VectorIcon from '../../components/VectorIcon';
import { Skeleton } from '../../components/Skeleton';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useRefresh, useFocusLoad } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { FeeSummary, YearMonthStatus, adminTransportReceiptUrl, getFeeSummary } from '../../api/adminTransportApi';
import { DocHeader, DocNoData } from '../more/docUi';
import { Words } from '../exam/examUi';
import { Avatar, ErrorBox, InfoRow, MONTH_STATUS, Section, clock, formatINR } from './adminTransportUi';

/**
 * A student's transport fee, as the admin panel's Fee Summary and Transport
 * Detail show it, written the way a student's Transport Fees page is: who they
 * are and the route they ride, the monthly fee, what the year comes to for the
 * months they are billed, what is paid and left, their contact and the bus's
 * times; then every month of the academic year — paid, partly paid, unpaid,
 * still to come or not billed — with Edit months, and the payments, each
 * opening its receipt. As on the panel, payments are only read here.
 */

const TITLE = 'Transport Fee';

const AdminTransportStudentFeeScreen = ({ navigation, route }: any) => {
  const studentId: number = route?.params?.studentId;
  const routeId: number | null = route?.params?.routeId ?? null;
  const passedName: string | undefined = route?.params?.name;

  const [data, setData] = useState<FeeSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (showSkeleton = false) => {
      if (showSkeleton) setLoading(true);
      setError(null);
      try {
        setData(await getFeeSummary(studentId, routeId));
      } catch (e) {
        setError(apiErr(e, 'Could not load the transport fee.'));
      } finally {
        setLoading(false);
      }
    },
    [studentId, routeId],
  );

  // Coming back from Edit months shows the new year in place.
  useFocusLoad(() => load());
  const { refreshing, onRefresh } = useRefresh(() => load(true));

  if (!data) {
    return (
      <View style={s.root}>
        <DocHeader title={TITLE} onBackPress={() => navigation.goBack()} />
        {loading ? (
          <View style={s.skWrap}>
            <Skeleton width={56} height={56} radius={28} />
            <Skeleton width="60%" height={18} />
            <Skeleton width="40%" height={12} />
            {[0, 1, 2, 3, 4].map(i => (
              <View key={i} style={s.skRow}>
                <Skeleton width={90} height={12} />
                <Skeleton width={70} height={12} />
              </View>
            ))}
          </View>
        ) : (
          <ErrorBox message={error ?? 'Details not available.'} onRetry={() => load(true)} />
        )}
      </View>
    );
  }

  const st = data.student;
  const r = data.route;
  const months: YearMonthStatus[] = data.months_year ?? [];
  const pct = data.annual > 0 ? Math.round((data.paid / data.annual) * 100) : 0;
  const counts = months.reduce<Record<string, number>>((acc, m) => {
    acc[m.status] = (acc[m.status] ?? 0) + 1;
    return acc;
  }, {});
  const legend = (['paid', 'partial', 'unpaid', 'upcoming', 'not_used'] as const)
    .filter(k => counts[k])
    .map(k => `${MONTH_STATUS[k]} ${counts[k]}`)
    .join(' · ');

  const figures = [
    ['Monthly', formatINR(data.monthly), undefined],
    ['Annual', `${formatINR(data.annual)} · ${data.months_count} of 12 months`, undefined],
    ['Paid', formatINR(data.paid), 'paid'],
    ['Remaining', formatINR(data.remaining), data.remaining > 0 ? 'due' : undefined],
    ['Collected', `${pct}% · ${data.payments.length} ${data.payments.length === 1 ? 'receipt' : 'receipts'}`, undefined],
  ] as [string, string, 'paid' | 'due' | undefined][];

  const details = [
    ['Route', r ? `${r.name}${r.vehicle_type ? ` — ${r.vehicle_type}` : ''}` : '—', undefined],
    ['Driver', r?.driver || '—', undefined],
    ['Pickup', clock(r?.pickup_time) ?? '—', undefined],
    ['Drop', clock(r?.drop_time) ?? '—', undefined],
    ['Mobile', st.mobile || '—', st.mobile ? () => Linking.openURL(`tel:${st.mobile}`) : undefined],
    ['Email', st.email || '—', st.email ? () => Linking.openURL(`mailto:${st.email}`) : undefined],
  ] as [string, string, (() => void) | undefined][];

  const editMonths = () =>
    r &&
    navigation.navigate('AdminTransportMonths', {
      studentId: st.id,
      routeId: r.id,
      name: st.name,
      monthly: data.monthly,
      months: data.months,
    });

  return (
    <View style={s.root}>
      <DocHeader title={TITLE} onBackPress={() => navigation.goBack()} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
        refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Who, and on which bus */}
        <View style={s.head}>
          <Avatar uri={st.image} name={st.name || passedName} size={56} />
          <View style={s.headBody}>
            <Words skeleton={loading} style={s.name}>
              {st.name || passedName || 'Student'}
            </Words>
            <Words skeleton={loading} style={s.sub}>
              {[st.admission_no, st.class].filter(Boolean).join(' · ') || '—'}
            </Words>
          </View>
        </View>

        <View style={s.rows}>
          {figures.map(([label, value, tone], i) => (
            <InfoRow key={label} label={label} value={value} tone={tone} last={i === figures.length - 1} skeleton={loading} />
          ))}
        </View>

        <Section title="Transport" skeleton={loading}>
          {details.map(([label, value, onPress], i) => (
            <InfoRow
              key={label}
              label={label}
              value={value}
              onPress={onPress}
              last={i === details.length - 1}
              skeleton={loading}
            />
          ))}
        </Section>

        {/* The academic year, month by month */}
        <Section title={`Monthly Fee Status · Apr – Mar · ${data.months_count} of 12 months billed`} skeleton={loading}>
          <View style={s.statusHead}>
            <Text style={s.legend}>{legend}</Text>
            {!!r && (
              <TouchableOpacity style={s.editBtn} onPress={editMonths} hitSlop={8} activeOpacity={0.6}>
                <VectorIcon iconSet="Feather" iconName="edit-2" size={13} color={theme.colors.primary} />
                <Text style={s.editText}>Edit months</Text>
              </TouchableOpacity>
            )}
          </View>
          {months.map((m, i) => (
            <View key={m.key} style={[s.monthRow, i < months.length - 1 && s.rowDivider]}>
              <View style={s.monthName}>
                <Words skeleton={loading} style={[s.month, m.is_current && s.monthCurrent]}>
                  {`${m.label} ${m.year}`}
                </Words>
              </View>
              <Words skeleton={loading} style={s.amount}>
                {m.status === 'not_used'
                  ? '—'
                  : m.status === 'upcoming'
                  ? formatINR(m.amount)
                  : `${formatINR(m.paid)} / ${formatINR(m.amount)}`}
              </Words>
              <View style={s.statusCol}>
                <Words
                  skeleton={loading}
                  style={[
                    s.status,
                    m.status === 'paid' && s.paid,
                    m.status === 'unpaid' && s.due,
                    m.status === 'partial' && s.partial,
                  ]}
                >
                  {MONTH_STATUS[m.status]}
                </Words>
              </View>
            </View>
          ))}
        </Section>

        {/* Payments, each with its receipt */}
        <Section title={`Transactions · ${data.payments.length} ${data.payments.length === 1 ? 'payment' : 'payments'}`} skeleton={loading}>
          {data.payments.length === 0 ? (
            <DocNoData icon="receipt-outline" title="No payments recorded yet" subtitle="Payments taken for this student's transport show here, each with its receipt." />
          ) : (
            data.payments.map((p, i) => (
              <TouchableOpacity
                key={p.id}
                style={[s.payRow, i < data.payments.length - 1 && s.rowDivider]}
                activeOpacity={0.6}
                onPress={() =>
                  navigation.navigate('AdminTransportReceipt', {
                    payment: { id: p.id, receipt_number: p.receipt },
                    url: adminTransportReceiptUrl(p.id),
                  })
                }
              >
                <View style={s.payBody}>
                  <Text style={s.payAmount}>{formatINR(p.amount)}</Text>
                  <Text style={s.payMeta} numberOfLines={1}>
                    {[p.date ? moment(p.date).format('DD MMM YYYY · dddd') : null, p.mode ? p.mode.charAt(0).toUpperCase() + p.mode.slice(1) : null]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                  <Text style={s.payMeta} numberOfLines={1}>
                    {[`Receipt ${p.receipt}`, p.remark].filter(Boolean).join(' · ')}
                  </Text>
                </View>
                <Text style={s.receipt}>Receipt</Text>
                <VectorIcon iconSet="Ionicons" iconName="chevron-forward" size={13} color={theme.colors.textMuted} />
              </TouchableOpacity>
            ))
          )}
        </Section>
      </ScrollView>
    </View>
  );
};

export default AdminTransportStudentFeeScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  scroll: { paddingBottom: 40 },

  head: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12 },
  headBody: { flex: 1, gap: 3 },
  name: { fontSize: 20, fontWeight: '700', color: theme.colors.textPrimary },
  sub: { fontSize: 13, color: theme.colors.textSecondary },

  rows: { paddingHorizontal: 20, paddingBottom: 6 },
  rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },

  // Month by month
  statusHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingTop: 6, paddingBottom: 4 },
  legend: { flex: 1, fontSize: 12, color: theme.colors.textMuted },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  editText: { fontSize: 13, fontWeight: '600', color: theme.colors.primary },
  monthRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  monthName: { flex: 1 },
  month: { fontSize: 14, color: theme.colors.textPrimary },
  monthCurrent: { fontWeight: '700' },
  amount: { fontSize: 13, fontWeight: '500', color: theme.colors.textPrimary },
  statusCol: { width: 72, alignItems: 'flex-end' },
  status: { fontSize: 13, color: theme.colors.textMuted },
  paid: { color: theme.colors.success, fontWeight: '500' },
  due: { color: theme.colors.danger, fontWeight: '500' },
  partial: { color: theme.colors.textPrimary, fontWeight: '500' },

  // A payment
  payRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  payBody: { flex: 1, gap: 3 },
  payAmount: { fontSize: 16, fontWeight: '600', color: theme.colors.textPrimary },
  payMeta: { fontSize: 13, color: theme.colors.textSecondary },
  receipt: { fontSize: 13, fontWeight: '600', color: theme.colors.primary },

  // Loading
  skWrap: { paddingHorizontal: 20, paddingTop: 20, gap: 12 },
  skRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
