import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import VectorIcon from '../../components/VectorIcon';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useRefresh } from '../../hooks/useRefresh';
import { theme } from '../../utils/theme';
import { AccountsDashboard, getAccountsDashboard } from '../../api/accountsApi';
import { AccountsUser, getStoredUser, logout } from '../../api/authApi';

const inr = (n: number) => `₹ ${Number(n || 0).toLocaleString('en-IN')}`;

// Academic year badge, e.g. "2026–27" — mirrors the web top bar.
const academicYear = () => {
  const y = new Date().getFullYear();
  return `${y}–${String((y + 1) % 100).padStart(2, '0')}`;
};

// Modules mirror the web accounts sidebar, in the same order (config/menu.php → 'accounts').
// Most are still wired in later phases.
const MODULES: { key: string; label: string; icon: string; color: string }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: 'home', color: '#6366F1' },
  { key: 'payroll', label: 'Payroll', icon: 'wallet', color: '#22C55E' },
  { key: 'credit', label: 'Credit', icon: 'card', color: '#0EA5E9' },
  { key: 'admissions', label: 'Admissions', icon: 'person-add', color: '#F59E0B' },
  { key: 'fee-submission', label: 'Fee Submission', icon: 'cash', color: '#EC4899' },
  { key: 'view-fee', label: 'View Fee', icon: 'eye', color: '#8B5CF6' },
  { key: 'fee-structure', label: 'Fee Structure', icon: 'list', color: '#14B8A6' },
  { key: 'payments', label: 'Payments', icon: 'cash', color: '#EF4444' },
  { key: 'penalties', label: 'Penalties', icon: 'alert-circle', color: '#3B82F6' },
  { key: 'fee-cycles', label: 'Fee Cycles', icon: 'refresh', color: '#10B981' },
  { key: 'attendance', label: 'Attendance', icon: 'checkbox', color: '#F97316' },
  { key: 'transport', label: 'Transport', icon: 'bus', color: '#6366F1' },
  { key: 'calendar', label: 'Calendar', icon: 'calendar', color: '#22C55E' },
  { key: 'id-card', label: 'ID Card', icon: 'card', color: '#0EA5E9' },
  { key: 'admit-card', label: 'Admit Card', icon: 'ticket', color: '#F59E0B' },
  { key: 'report-card', label: 'Report Card', icon: 'documents', color: '#EC4899' },
  { key: 'tc-certificate', label: 'TC & Certificates', icon: 'ribbon', color: '#8B5CF6' },
];

const AccountsDashboardScreen = ({ navigation }: any) => {
  const [user, setUser] = useState<AccountsUser | null>(null);
  const [stats, setStats] = useState<AccountsDashboard | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [u, d] = await Promise.all([
        getStoredUser() as Promise<AccountsUser | null>,
        getAccountsDashboard().catch(() => null),
      ]);
      setUser(u);
      setStats(d);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const { refreshing, onRefresh } = useRefresh(load);

  const onLogout = () => {
    Alert.alert('Logout', 'Sign out of the accounts account?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await logout();
          const rootNav = navigation.getParent?.() ?? navigation;
          rootNav.reset({ index: 0, routes: [{ name: 'Login' }] });
        },
      },
    ]);
  };

  const openModule = (label: string) =>
    Alert.alert(label, 'This module is coming soon to the accounts app.');

  const statCards = [
    { label: "Today's Collection", value: stats ? inr(stats.fees_collected_today) : '—', icon: 'today', color: '#22C55E' },
    { label: 'This Month', value: stats ? inr(stats.fees_collected_this_month) : '—', icon: 'trending-up', color: '#0EA5E9' },
    { label: 'Total Collected', value: stats ? inr(stats.fees_collected_total) : '—', icon: 'cash', color: '#6366F1' },
    { label: 'Pending Dues', value: stats ? inr(stats.pending) : '—', icon: 'alert-circle', color: '#EF4444' },
    { label: 'Transport', value: stats ? inr(stats.transport_collected) : '—', icon: 'bus', color: '#14B8A6' },
    { label: 'Students', value: String(stats?.students ?? '—'), icon: 'people', color: '#8B5CF6' },
  ];

  return (
    <View style={s.root}>
      <View style={s.topbar}>
        <TouchableOpacity style={s.menuBtn} onPress={() => navigation.openDrawer()} activeOpacity={0.8}>
          <VectorIcon iconSet="Feather" iconName="menu" size={20} color={theme.colors.primary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.hello}>Accounts</Text>
          <Text style={s.name} numberOfLines={1}>{user?.name ?? 'Accounts'}</Text>
          <View style={s.metaRow}>
            {!!user?.organization?.name && <Text style={s.org} numberOfLines={1}>{user.organization.name}</Text>}
            <View style={s.yearBadge}><Text style={s.yearTxt}>{academicYear()}</Text></View>
          </View>
        </View>
        <TouchableOpacity style={s.logoutBtn} onPress={onLogout} activeOpacity={0.8}>
          <VectorIcon iconSet="Ionicons" iconName="log-out-outline" size={20} color={theme.colors.danger} />
        </TouchableOpacity>
      </View>

      {loading && !refreshing ? (
        <View style={s.loader}><ActivityIndicator size="large" color={theme.colors.primary} /></View>
      ) : (
        <ScrollView
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <View style={s.statGrid}>
            {statCards.map(c => (
              <View key={c.label} style={[s.statCard, { backgroundColor: c.color + '12' }]}>
                <View style={[s.statIcon, { backgroundColor: c.color + '22' }]}>
                  <VectorIcon iconSet="Ionicons" iconName={c.icon} size={18} color={c.color} />
                </View>
                <Text style={[s.statVal, { color: c.color }]} numberOfLines={1}>{c.value}</Text>
                <Text style={s.statLbl}>{c.label}</Text>
              </View>
            ))}
          </View>

          <Text style={s.section}>Manage</Text>
          <View style={s.modGrid}>
            {MODULES.map(m => (
              <TouchableOpacity key={m.key} style={s.modCard} activeOpacity={0.8} onPress={() => openModule(m.label)}>
                <View style={[s.modIcon, { backgroundColor: m.color + '18' }]}>
                  <VectorIcon iconSet="Ionicons" iconName={m.icon} size={24} color={m.color} />
                </View>
                <Text style={s.modLabel}>{m.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={s.note}>More accounts tools are rolling out soon.</Text>
        </ScrollView>
      )}
    </View>
  );
};

export default AccountsDashboardScreen;

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 14,
    backgroundColor: theme.colors.card,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  menuBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hello: { fontSize: 12, color: theme.colors.textMuted, fontWeight: '600' },
  name: { fontSize: 20, fontWeight: '900', color: theme.colors.textPrimary, marginTop: 1 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  org: { fontSize: 12, color: theme.colors.textSecondary, flexShrink: 1 },
  yearBadge: {
    backgroundColor: theme.colors.primary + '14',
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.primary + '22',
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  yearTxt: { fontSize: 10, fontWeight: '700', color: theme.colors.primary },
  logoutBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.danger + '14',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: { padding: 16, paddingBottom: 40 },

  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statCard: { width: '47%', borderRadius: 18, padding: 14, gap: 6 },
  statIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  statVal: { fontSize: 17, fontWeight: '900' },
  statLbl: { fontSize: 11, color: theme.colors.textSecondary, fontWeight: '600' },

  section: { fontSize: 16, fontWeight: '800', color: theme.colors.textPrimary, marginTop: 24, marginBottom: 14 },
  modGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  modCard: { width: '22%', alignItems: 'center', gap: 8, paddingVertical: 6 },
  modIcon: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  modLabel: { fontSize: 11, fontWeight: '700', color: theme.colors.textPrimary, textAlign: 'center' },

  note: { fontSize: 12, color: theme.colors.textMuted, textAlign: 'center', marginTop: 28 },
});
