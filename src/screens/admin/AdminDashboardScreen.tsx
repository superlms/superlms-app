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
import { DrawerActions } from '@react-navigation/native';
import VectorIcon from '../../components/VectorIcon';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useRefresh } from '../../hooks/useRefresh';
import { theme } from '../../utils/theme';
import { AdminDashboard, getAdminDashboard } from '../../api/adminApi';
import { AdminUser, getStoredUser } from '../../api/authApi';
import { useUnreadCount } from '../../notifications';
import { ADMIN_MODULES as MODULES } from './adminModules';

const inr = (n: number) => `₹ ${Number(n || 0).toLocaleString('en-IN')}`;

// Academic year badge, e.g. "2026–27" — mirrors the web top bar.
const academicYear = () => {
  const y = new Date().getFullYear();
  return `${y}–${String((y + 1) % 100).padStart(2, '0')}`;
};

const AdminDashboardScreen = ({ navigation }: any) => {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [stats, setStats] = useState<AdminDashboard | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [u, d] = await Promise.all([
        getStoredUser() as Promise<AdminUser | null>,
        getAdminDashboard().catch(() => null),
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
  const unreadCount = useUnreadCount();

  const moduleRoutes: Record<string, string> = {
    'quick-links': 'QuickLinks',
    announcement: 'AdminAnnouncement',
    calender: 'AdminCalendar',
    enquiries: 'AdminEnquiries',
    standard: 'AdminStandard',
    students: 'AdminStudents',
    teachers: 'AdminTeachers',
    'id-card': 'AdminIdCard',
    exam: 'AdminExam',
    syllabus: 'AdminSyllabus',
    content: 'AdminContent',
    quiz: 'AdminQuiz',
    book: 'AdminBook',
    timetable: 'AdminTimetable',
    arrangement: 'AdminArrangement',
  };

  const openModule = (m: { key: string; label: string }) => {
    if (m.key === 'dashboard') return; // already on the dashboard
    const route = moduleRoutes[m.key];
    if (route) {
      navigation.navigate(route);
      return;
    }
    Alert.alert(m.label, 'This module is coming soon to the admin app.');
  };

  const comingSoon = (label: string) =>
    Alert.alert(label, 'This feature is coming soon to the admin app.');

  const statCards = [
    { label: 'Students', value: String(stats?.students ?? '—'), icon: 'people', color: '#6366F1' },
    { label: 'Teachers', value: String(stats?.teachers ?? '—'), icon: 'school', color: '#EC4899' },
    { label: 'Fees (Month)', value: stats ? inr(stats.fees_collected_this_month) : '—', icon: 'trending-up', color: '#22C55E' },
    { label: 'Fees (Total)', value: stats ? inr(stats.fees_collected_total) : '—', icon: 'cash', color: '#0EA5E9' },
  ];

  return (
    <View style={s.root}>
      {/* Top bar */}
      <View style={s.topbar}>
        <TouchableOpacity
          style={s.menuBtn}
          onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
          activeOpacity={0.8}
        >
          <VectorIcon iconSet="Feather" iconName="menu" size={20} color={theme.colors.primary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.hello}>Welcome back</Text>
          <Text style={s.name} numberOfLines={1}>{user?.name ?? 'Admin'}</Text>
          <View style={s.metaRow}>
            {!!user?.organization?.name && <Text style={s.org} numberOfLines={1}>{user.organization.name}</Text>}
            <View style={s.yearBadge}><Text style={s.yearTxt}>{academicYear()}</Text></View>
          </View>
        </View>

        {/* Right actions — announcement · notifications · profile */}
        <TouchableOpacity style={s.iconBtn} onPress={() => comingSoon('Announcement')} activeOpacity={0.8}>
          <VectorIcon iconSet="Ionicons" iconName="megaphone-outline" size={19} color={theme.colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity style={s.iconBtn} onPress={() => navigation.navigate('Notifications')} activeOpacity={0.8}>
          <VectorIcon iconSet="Ionicons" iconName="notifications-outline" size={19} color={theme.colors.primary} />
          {unreadCount > 0 && (
            <View style={s.bellBadge}>
              <Text style={s.bellBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={s.iconBtn} onPress={() => navigation.navigate('AdminProfile')} activeOpacity={0.8}>
          <VectorIcon iconSet="Ionicons" iconName="person-circle-outline" size={22} color={theme.colors.primary} />
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
          {/* Stats */}
          <View style={s.statGrid}>
            {statCards.map(c => (
              <View key={c.label} style={[s.statCard, { backgroundColor: c.color + '12' }]}>
                <View style={[s.statIcon, { backgroundColor: c.color + '22' }]}>
                  <VectorIcon iconSet="Ionicons" iconName={c.icon} size={20} color={c.color} />
                </View>
                <Text style={[s.statVal, { color: c.color }]} numberOfLines={1}>{c.value}</Text>
                <Text style={s.statLbl}>{c.label}</Text>
              </View>
            ))}
          </View>

          {/* Modules */}
          <Text style={s.section}>Manage</Text>
          <View style={s.modGrid}>
            {MODULES.map(m => (
              <TouchableOpacity key={m.key} style={s.modCard} activeOpacity={0.8} onPress={() => openModule(m)}>
                <View style={[s.modIcon, { backgroundColor: m.color + '18' }]}>
                  <VectorIcon iconSet="Ionicons" iconName={m.icon} size={24} color={m.color} />
                </View>
                <Text style={s.modLabel}>{m.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={s.note}>More admin tools are rolling out soon.</Text>
        </ScrollView>
      )}
    </View>
  );
};

export default AdminDashboardScreen;

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellBadge: {
    position: 'absolute',
    top: 3,
    right: 3,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    borderRadius: 8,
    backgroundColor: '#EF4444',
    borderWidth: 1.5,
    borderColor: theme.colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800', lineHeight: 11 },
  scroll: { padding: 16, paddingBottom: 40 },

  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statCard: { width: '47%', borderRadius: 18, padding: 16, gap: 8 },
  statIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  statVal: { fontSize: 20, fontWeight: '900' },
  statLbl: { fontSize: 12, color: theme.colors.textSecondary, fontWeight: '600' },

  section: { fontSize: 16, fontWeight: '800', color: theme.colors.textPrimary, marginTop: 24, marginBottom: 14 },
  modGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  modCard: {
    width: '22%',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  modIcon: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  modLabel: { fontSize: 11, fontWeight: '700', color: theme.colors.textPrimary, textAlign: 'center' },

  note: { fontSize: 12, color: theme.colors.textMuted, textAlign: 'center', marginTop: 28 },
});
