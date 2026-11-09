import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  AppStateStatus,
  Image,
  Linking,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { CommonActions } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import VectorIcon from '../../components/VectorIcon';
import { AppDialog } from '../../components/AppDialog';
import { theme } from '../../utils/theme';
import constant from '../../utils/constant';
import { logoutCurrentAccount } from '../../utils/logoutAccount';
import {
  PlatformFee,
  getPlatformFee,
  getPlatformFeePayment,
  platformFeeDue,
  startPlatformFeePayment,
} from '../../api/platformFeeApi';

/**
 * What a student sees on opening the app when their school has them pay the
 * platform fee themselves and it is not paid yet: the fee, and Pay Now —
 * PhonePe's checkout (UPI, cards, net banking). Nothing else of the app opens
 * until it is paid (the server answers every other request 402 and the API
 * client brings this screen back). Once PhonePe says it came, the student goes
 * on to their dashboard.
 *
 * Route params: { fee?: PlatformFee } — what the 402 or the login already knew.
 */

type Phase = 'idle' | 'starting' | 'awaiting' | 'checking' | 'paid' | 'failed';

const POLL_ATTEMPTS = 6;
const POLL_DELAY_MS = 2500;
const sleep = (ms: number) => new Promise<void>(r => setTimeout(() => r(), ms));

const inr = (n: number) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

const FILE_ORIGIN = constant.API_BASE_URL.replace(/\/api\/v\d+\/?$/, '');
const fileUrl = (url?: string | null) =>
  !url ? undefined : /^https?:\/\//i.test(url) ? url : `${FILE_ORIGIN}/${url.replace(/^\/+/, '')}`;

// What paying opens, in the order the student meets them.
const UNLOCKS = [
  { icon: 'calendar-outline', label: 'Attendance' },
  { icon: 'cash-outline', label: 'School fees' },
  { icon: 'create-outline', label: 'Homework' },
  { icon: 'school-outline', label: 'Exams & results' },
];

const PlatformFeeScreen = ({ navigation, route }: any) => {
  const insets = useSafeAreaInsets();
  const [fee, setFee] = useState<PlatformFee | null>(route?.params?.fee?.amount ? route.params.fee : null);
  const [loading, setLoading] = useState(!fee);
  const [refreshing, setRefreshing] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [logoutVisible, setLogoutVisible] = useState(false);

  const orderRef = useRef<string | null>(null);
  const pollingRef = useRef(false);

  const openApp = useCallback(() => {
    navigation.dispatch(
      CommonActions.reset({ index: 0, routes: [{ name: 'DrawerRoot', params: { userRole: 'student' } }] }),
    );
  }, [navigation]);

  const load = useCallback(async () => {
    try {
      const next = await getPlatformFee();
      setFee(next);
      setError(null);
      // Paid meanwhile (or the school changed who pays): straight on.
      if (!next.must_pay && phase !== 'paid') openApp();
    } catch (e: any) {
      const due = platformFeeDue(e);
      if (due?.amount) setFee(due);
      else setError(e?.response?.data?.message ?? 'Could not load your fee. Pull down to try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [openApp, phase]);

  useEffect(() => {
    load();
    // Only once, on opening.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const poll = useCallback(async () => {
    const orderId = orderRef.current;
    if (!orderId || pollingRef.current) return;
    pollingRef.current = true;
    setPhase('checking');
    setError(null);
    try {
      for (let i = 0; i < POLL_ATTEMPTS; i++) {
        const res = await getPlatformFeePayment(orderId);
        if (res.fee) setFee(res.fee);
        if (res.state === 'COMPLETED') {
          setPhase(res.fee && res.fee.must_pay ? 'idle' : 'paid');
          return;
        }
        if (res.state === 'FAILED') {
          setPhase('failed');
          setError('The payment did not go through. No money was taken — please try again.');
          return;
        }
        await sleep(POLL_DELAY_MS);
      }
      // Still with PhonePe: the student can check again.
      setPhase('awaiting');
    } catch (e: any) {
      setPhase('awaiting');
      setError(e?.response?.data?.message ?? 'Could not check the payment. Tap “I have paid” to check again.');
    } finally {
      pollingRef.current = false;
    }
  }, []);

  // Back from PhonePe's checkout: ask how it went.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active' && phase === 'awaiting' && orderRef.current) poll();
    });
    return () => sub.remove();
  }, [phase, poll]);

  const payNow = async () => {
    setError(null);
    setPhase('starting');
    try {
      const start = await startPlatformFeePayment();
      orderRef.current = start.merchant_order_id;
      if (!start.redirect_url) throw new Error('No payment page was received.');
      await Linking.openURL(start.redirect_url);
      setPhase('awaiting');
    } catch (e: any) {
      setPhase('idle');
      const msg = e?.response?.data?.message ?? e?.message ?? 'Could not start the payment.';
      // Already paid (say, by the school's office): reload, which opens the app.
      if (e?.response?.status === 422) load();
      setError(msg);
    }
  };

  const busy = phase === 'starting' || phase === 'checking';
  const due = fee ? Math.max(0, fee.due) : 0;
  const logo = fileUrl(fee?.school?.logo);
  const partPaid = !!fee && fee.collected > 0 && due > 0;

  // ── Paid ──────────────────────────────────────────────────────────────────
  if (phase === 'paid') {
    return (
      <View style={[s.root, s.center, { paddingBottom: insets.bottom + 24 }]}>
        <StatusBar barStyle="dark-content" backgroundColor={theme.colors.card} />
        <View style={s.okCircle}>
          <VectorIcon iconSet="Ionicons" iconName="checkmark" size={44} color={theme.colors.white} />
        </View>
        <Text style={s.okTitle}>Payment successful</Text>
        <Text style={s.okText}>
          {fee?.last_payment?.amount ? `${inr(fee.last_payment.amount)} paid` : 'Your fee is paid'}
          {fee?.last_payment?.receipt_number ? ` · Receipt ${fee.last_payment.receipt_number}` : ''}
        </Text>
        <Text style={s.okHint}>Thank you! Everything in the app is open for you now.</Text>
        <TouchableOpacity style={[s.payBtn, s.okBtn]} onPress={openApp} activeOpacity={0.85}>
          <Text style={s.payText}>Continue to the app</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor={theme.colors.card} />

      {/* The school, and a way out */}
      <View style={s.top}>
        <View style={s.school}>
          {logo ? (
            <Image source={{ uri: logo }} style={s.logo} />
          ) : (
            <View style={[s.logo, s.logoFallback]}>
              <Text style={s.logoLetter}>{(fee?.school?.name || 'S').charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <View style={s.schoolText}>
            <Text style={s.schoolName} numberOfLines={1}>{fee?.school?.name || 'Your school'}</Text>
            <Text style={s.schoolSub}>Platform fee</Text>
          </View>
        </View>
        <TouchableOpacity onPress={() => setLogoutVisible(true)} hitSlop={10} activeOpacity={0.6} style={s.logout}>
          <VectorIcon iconSet="Ionicons" iconName="log-out-outline" size={18} color={theme.colors.textSecondary} />
          <Text style={s.logoutText}>Log out</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={[s.center, s.fill]}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={s.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        >
          {/* The fee */}
          <View style={s.hero}>
            <View style={s.heroGlow} />
            <Text style={s.kicker}>
              {(fee?.label || 'Annual Platform Fee').toUpperCase()} · {fee?.academic_year ?? ''}
            </Text>
            <Text style={s.amount}>{inr(due)}</Text>
            <View style={s.duePill}>
              <View style={s.dueDot} />
              <Text style={s.duePillText}>
                {partPaid ? `${inr(fee!.collected)} of ${inr(fee!.amount)} paid · rest due now` : 'Due now'}
              </Text>
            </View>

            {!!fee?.student?.name && (
              <View style={s.heroRows}>
                {[
                  ['Student', fee.student.name],
                  ['Class', fee.student.class || '—'],
                  ['Admission no.', fee.student.admission_no || '—'],
                ].map(([label, value]) => (
                  <View key={label} style={s.heroRow}>
                    <Text style={s.heroLabel}>{label}</Text>
                    <Text style={s.heroValue} numberOfLines={1}>{value}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Why */}
          <View style={s.note}>
            <View style={s.noteIcon}>
              <VectorIcon iconSet="Ionicons" iconName="lock-closed" size={18} color={theme.colors.primary} />
            </View>
            <View style={s.noteBody}>
              <Text style={s.noteTitle}>Your app opens after payment</Text>
              <Text style={s.noteText}>
                Your school has asked students to pay this fee in the app. Until it is paid, the app stays locked and
                your attendance and school fee cannot be recorded.
              </Text>
            </View>
          </View>

          <View style={s.unlocks}>
            {UNLOCKS.map(u => (
              <View key={u.label} style={s.unlock}>
                <VectorIcon iconSet="Ionicons" iconName={u.icon} size={18} color={theme.colors.textSecondary} />
                <Text style={s.unlockText}>{u.label}</Text>
              </View>
            ))}
          </View>

          {!!error && (
            <View style={s.error}>
              <VectorIcon iconSet="Ionicons" iconName="alert-circle" size={18} color={theme.colors.danger} />
              <Text style={s.errorText}>{error}</Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* Pay now — and, once PhonePe is open, a way to check */}
      {!loading && (
        <View style={[s.footer, { paddingBottom: insets.bottom + 16 }]}>
          {phase === 'awaiting' ? (
            <>
              <TouchableOpacity style={s.payBtn} onPress={poll} activeOpacity={0.85}>
                <Text style={s.payText}>I have paid — check status</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={payNow} hitSlop={8} activeOpacity={0.6} style={s.again}>
                <Text style={s.againText}>Open payment again</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              style={[s.payBtn, (busy || due <= 0) && s.payBtnIdle]}
              onPress={payNow}
              disabled={busy || due <= 0}
              activeOpacity={0.85}
            >
              {busy ? (
                <ActivityIndicator size="small" color={theme.colors.white} />
              ) : (
                <>
                  <VectorIcon iconSet="Ionicons" iconName="shield-checkmark" size={18} color={theme.colors.white} />
                  <Text style={s.payText}>Pay {inr(due)} now</Text>
                </>
              )}
            </TouchableOpacity>
          )}
          <Text style={s.secure}>Secure payment by PhonePe · UPI, cards and net banking</Text>
        </View>
      )}

      <AppDialog
        visible={logoutVisible}
        title="Log out?"
        message="You can sign in again any time to pay your fee."
        actions={[
          { text: 'Cancel', style: 'cancel', onPress: () => setLogoutVisible(false) },
          {
            text: 'Log out',
            style: 'destructive',
            onPress: () => {
              setLogoutVisible(false);
              logoutCurrentAccount(navigation);
            },
          },
        ]}
        onRequestClose={() => setLogoutVisible(false)}
        onBackdropPress={() => setLogoutVisible(false)}
      />
    </View>
  );
};

export default PlatformFeeScreen;

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  center: { alignItems: 'center', justifyContent: 'center' },
  fill: { flex: 1 },

  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 12,
    backgroundColor: theme.colors.card,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.divider,
  },
  school: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 12 },
  logo: { width: 40, height: 40, borderRadius: 12, backgroundColor: theme.colors.primaryLight },
  logoFallback: { alignItems: 'center', justifyContent: 'center' },
  logoLetter: { fontSize: 16, fontWeight: '700', color: theme.colors.primary },
  schoolText: { marginLeft: 12, flex: 1 },
  schoolName: { fontSize: 15, fontWeight: '700', color: theme.colors.textPrimary },
  schoolSub: { fontSize: 12, color: theme.colors.textMuted, marginTop: 1 },
  logout: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  logoutText: { fontSize: 13, fontWeight: '600', color: theme.colors.textSecondary },

  scroll: { padding: 20, paddingBottom: 32 },

  hero: {
    backgroundColor: '#1E1B4B',
    borderRadius: 22,
    padding: 22,
    overflow: 'hidden',
    shadowColor: '#1E1B4B',
    shadowOpacity: 0.25,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  heroGlow: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: '#4F46E5',
    opacity: 0.55,
    top: -110,
    right: -70,
  },
  kicker: { fontSize: 11, fontWeight: '700', letterSpacing: 0.9, color: 'rgba(255,255,255,0.65)' },
  amount: { fontSize: 44, fontWeight: '800', color: theme.colors.white, marginTop: 10, letterSpacing: -1 },
  duePill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(251,113,133,0.18)',
  },
  dueDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#FB7185', marginRight: 6 },
  duePillText: { fontSize: 12, fontWeight: '600', color: '#FECDD3' },
  heroRows: {
    marginTop: 20,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.18)',
    gap: 9,
  },
  heroRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroLabel: { fontSize: 13, color: 'rgba(255,255,255,0.6)' },
  heroValue: { fontSize: 13, fontWeight: '600', color: theme.colors.white, maxWidth: '62%', textAlign: 'right' },

  note: {
    flexDirection: 'row',
    marginTop: 18,
    padding: 16,
    borderRadius: 16,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  noteIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noteBody: { flex: 1, marginLeft: 12 },
  noteTitle: { fontSize: 14, fontWeight: '700', color: theme.colors.textPrimary },
  noteText: { fontSize: 13, lineHeight: 19, color: theme.colors.textSecondary, marginTop: 3 },

  unlocks: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  unlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  unlockText: { fontSize: 13, color: theme.colors.textSecondary, fontWeight: '500' },

  error: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 16,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#FEF2F2',
  },
  errorText: { flex: 1, fontSize: 13, lineHeight: 19, color: '#B91C1C' },

  footer: {
    paddingHorizontal: 20,
    paddingTop: 14,
    backgroundColor: theme.colors.card,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.divider,
  },
  payBtn: {
    height: 54,
    borderRadius: 16,
    backgroundColor: theme.colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  payBtnIdle: { opacity: 0.6 },
  payText: { fontSize: 16, fontWeight: '700', color: theme.colors.white },
  again: { alignSelf: 'center', marginTop: 12 },
  againText: { fontSize: 14, fontWeight: '600', color: theme.colors.primary },
  secure: { fontSize: 12, color: theme.colors.textMuted, textAlign: 'center', marginTop: 10 },

  okCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: theme.colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  okTitle: { fontSize: 22, fontWeight: '800', color: theme.colors.textPrimary },
  okText: { fontSize: 15, color: theme.colors.textSecondary, marginTop: 8, textAlign: 'center', paddingHorizontal: 24 },
  okHint: { fontSize: 13, color: theme.colors.textMuted, marginTop: 6, textAlign: 'center', paddingHorizontal: 32 },
  okBtn: { alignSelf: 'stretch', marginHorizontal: 20, marginTop: 28 },
});
