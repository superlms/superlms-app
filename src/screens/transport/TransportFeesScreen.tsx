import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import AppRefreshControl from '../../components/AppRefreshControl';
import { theme, onThemeChange } from '../../utils/theme';
import { DocHeader, DocNoData } from '../more/docUi';
import { Words } from '../exam/examUi';
import {
  STATUS_LABEL,
  TransportState,
  feeYear,
  formatINR,
  useMyTransport,
} from './transportUi';

/**
 * Transport Fees: what the bus has come to so far this year and what is left,
 * then each month that has been billed — April onwards — with its fee and
 * whether it is paid. Months still ahead are not shown; the school bills them
 * when they come.
 *
 * A load — the first, a pull to refresh, Try again — draws the page as a
 * skeleton from the route this phone kept, or an ordinary one.
 */

const TITLE = 'Transport Fees';

const TransportFeesScreen = ({ navigation }: any) => {
  const { drawn, loading, notUsing, error, blocked, reload } = useMyTransport();

  if (blocked || !drawn) {
    return (
      <TransportState
        title={TITLE}
        notUsing={notUsing}
        error={error}
        onBack={() => navigation.goBack()}
        onRetry={reload}
      />
    );
  }

  const skeleton = loading;
  const year = feeYear(drawn);
  const months = year.months;
  const settled = year.due === 0;

  return (
    <View style={s.root}>
      <DocHeader title={TITLE} onBackPress={() => navigation.goBack()} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.scroll, months.length === 0 && s.grow]}
        // The skeleton stands in for the spinner.
        refreshControl={<AppRefreshControl refreshing={false} onRefresh={reload} />}
      >
        {/* Paid so far, against what has been billed */}
        <View style={s.head}>
          <Words skeleton={skeleton} style={s.kicker}>
            PAID SO FAR
          </Words>
          <Words skeleton={skeleton} style={s.title}>
            {formatINR(year.paid)}
          </Words>
          <Words skeleton={skeleton} style={s.sub}>
            of {formatINR(year.billed)} billed to date · {formatINR(year.monthly)} a month
          </Words>
          <Words skeleton={skeleton} style={[s.standing, settled ? s.settled : s.owing]}>
            {settled ? 'No dues' : `${formatINR(year.due)} due`}
          </Words>
        </View>

        {months.length === 0 ? (
          <DocNoData
            icon="wallet-outline"
            title="Nothing billed yet"
            subtitle="The months of this year's transport fee will appear here as they are billed."
            skeleton={skeleton}
          />
        ) : (
          <View style={s.rows}>
            <Words skeleton={skeleton} style={s.count}>
              {months.length === 1 ? '1 month billed' : `${months.length} months billed`}
            </Words>
            {months.map((m, i) => (
              <View key={m.key} style={[s.row, i < months.length - 1 && s.rowDivider]}>
                <Words skeleton={skeleton} style={s.month}>
                  {m.label}
                </Words>
                <Words skeleton={skeleton} style={s.amount}>
                  {m.amount > 0 ? formatINR(m.amount) : '—'}
                </Words>
                <View style={s.statusCol}>
                  <Words
                    skeleton={skeleton}
                    style={[
                      s.status,
                      m.status === 'paid' && s.statusPaid,
                      m.status === 'pending' && s.statusDue,
                      m.status === 'partial' && s.statusPartial,
                    ]}
                  >
                    {STATUS_LABEL[m.status] ?? '—'}
                  </Words>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

export default TransportFeesScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  scroll: { paddingBottom: 40 },
  grow: { flexGrow: 1 },

  // What has been paid
  head: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16 },
  kicker: { fontSize: 11, fontWeight: '600', letterSpacing: 1, color: theme.colors.textMuted },
  title: { fontSize: 32, fontWeight: '700', color: theme.colors.textPrimary, marginTop: 4, lineHeight: 40 },
  sub: { fontSize: 13, color: theme.colors.textSecondary, marginTop: 2 },
  standing: { fontSize: 14, fontWeight: '600', marginTop: 8 },
  settled: { color: theme.colors.success },
  owing: { color: theme.colors.danger },

  // Month by month
  rows: { paddingHorizontal: 20 },
  count: { fontSize: 12, color: theme.colors.textMuted, marginBottom: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13 },
  rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },
  month: { flex: 1, fontSize: 14, color: theme.colors.textPrimary },
  amount: { fontSize: 14, fontWeight: '500', color: theme.colors.textPrimary },
  statusCol: { width: 66, alignItems: 'flex-end' },
  status: { fontSize: 13, color: theme.colors.textMuted },
  statusPaid: { color: theme.colors.success, fontWeight: '500' },
  statusDue: { color: theme.colors.danger, fontWeight: '500' },
  statusPartial: { color: theme.colors.textPrimary, fontWeight: '500' },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
