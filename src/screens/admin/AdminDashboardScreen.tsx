import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
import { ChartCard, Donut, MiniBars, StackedBar } from '../../components/Charts';
import { AdminAnalytics, getAdminAnalytics } from '../../api/adminApi';
import { AdminUser, getStoredUser } from '../../api/authApi';
import { useUnreadCount } from '../../notifications';

const PRESENT = '#22C55E';
const ABSENT = '#EF4444';

const inr = (n: number) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const pct = (a: number, b: number) => (a + b > 0 ? Math.round((a / (a + b)) * 100) : 0);

// ── Attendance card: present donut + present/absent split + monthly bars ──
const AttendanceCard = ({
  title, icon, color, pie, monthly,
}: {
  title: string; icon: string; color: string;
  pie: { present: number; absent: number };
  monthly: { months: string[]; present: number[]; absent: number[] };
}) => {
  const present = pct(pie.present, pie.absent);
  const maxVal = Math.max(1, ...monthly.present, ...monthly.absent);
  return (
    <ChartCard icon={icon} iconBg={color + '18'} iconColor={color} title={title}>
      <View style={s.pieRow}>
        <Donut size={104} stroke={12} pct={present} color={PRESENT} label={`${present}%`} sub="present" />
        <View style={{ flex: 1 }}>
          <StackedBar
            segments={[
              { label: 'Present', value: pie.present, color: PRESENT },
              { label: 'Absent', value: pie.absent, color: ABSENT },
            ]}
          />
        </View>
      </View>
      <Text style={s.subLabel}>Monthly present (Apr–Mar)</Text>
      <MiniBars
        data={monthly.months.map((m, i) => ({ label: m, value: monthly.present[i] ?? 0 }))}
        maxVal={maxVal}
        color={PRESENT}
        height={110}
        showValue={false}
      />
    </ChartCard>
  );
};

const AdminDashboardScreen = ({ navigation }: any) => {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [data, setData] = useState<AdminAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [u, d] = await Promise.all([
        getStoredUser() as Promise<AdminUser | null>,
        getAdminAnalytics(30).catch(() => null),
      ]);
      setUser(u);
      setData(d);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const { refreshing, onRefresh } = useRefresh(load);
  const unreadCount = useUnreadCount();

  const statCards = data ? [
    { label: 'Students', value: String(data.stats.totalStudents), icon: 'people', color: '#6366F1' },
    { label: 'Present Today', value: String(data.stats.presentToday), icon: 'checkmark-circle', color: PRESENT },
    { label: 'Absent Today', value: String(data.stats.absentToday), icon: 'close-circle', color: ABSENT },
    { label: 'Teachers', value: String(data.stats.teachers), icon: 'school', color: '#8B5CF6' },
    { label: 'New (30d)', value: String(data.stats.newAdmissions), icon: 'person-add', color: '#F59E0B' },
  ] : [];

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
          <Text style={s.hello}>Welcome back 👋</Text>
          <Text style={s.name} numberOfLines={2}>{user?.name ?? 'Admin'}</Text>
        </View>

        <TouchableOpacity style={s.iconBtn} onPress={() => navigation.navigate('Notifications')} activeOpacity={0.8}>
          <VectorIcon iconSet="Ionicons" iconName="notifications-outline" size={19} color={theme.colors.primary} />
          {unreadCount > 0 && (
            <View style={s.bellBadge}>
              <Text style={s.bellBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
            </View>
          )}
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
          {/* Headline stats */}
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

          {!data ? (
            <View style={s.emptyBox}>
              <VectorIcon iconSet="Ionicons" iconName="cloud-offline-outline" size={28} color={theme.colors.textMuted} />
              <Text style={s.emptyText}>Could not load school data. Pull to refresh.</Text>
            </View>
          ) : (
            <>
              {/* School structure */}
              <ChartCard icon="business" iconBg="#0EA5E918" iconColor="#0EA5E9" title="School Structure">
                <View style={s.miniStatRow}>
                  <MiniStat label="Classes" value={data.structure.classes} color="#0EA5E9" icon="grid" />
                  <MiniStat label="Sections" value={data.structure.sections} color="#6366F1" icon="layers" />
                  <MiniStat label="Subjects" value={data.structure.subjects} color="#EC4899" icon="book" />
                </View>
              </ChartCard>

              {/* Attendance */}
              <AttendanceCard title="Student Attendance" icon="people" color="#6366F1"
                pie={data.student_pie} monthly={data.student_monthly} />
              <AttendanceCard title="Teacher Attendance" icon="school" color="#8B5CF6"
                pie={data.teacher_pie} monthly={data.teacher_monthly} />

              {/* Fee collection */}
              <ChartCard icon="cash" iconBg="#14B8A618" iconColor="#14B8A6" title="Fee Collection">
                <View style={s.pieRow}>
                  <Donut size={104} stroke={12} pct={pct(data.fee.collected, data.fee.remaining)} color="#14B8A6"
                    label={`${pct(data.fee.collected, data.fee.remaining)}%`} sub="collected" />
                  <View style={{ flex: 1, gap: 8 }}>
                    <FeeRow label="Total" value={inr(data.fee.total)} />
                    <FeeRow label="Collected" value={inr(data.fee.collected)} color={PRESENT} />
                    <FeeRow label="Remaining" value={inr(data.fee.remaining)} color={ABSENT} />
                  </View>
                </View>
              </ChartCard>

              {/* Ledger */}
              <ChartCard icon="wallet" iconBg="#F59E0B18" iconColor="#F59E0B" title="Ledger">
                <StackedBar
                  segments={[
                    { label: 'Credit', value: data.ledger.credit, color: PRESENT },
                    { label: 'Expense', value: data.ledger.expense, color: ABSENT },
                  ]}
                />
                <View style={s.ledgerRow}>
                  <FeeRow label="Credit" value={inr(data.ledger.credit)} color={PRESENT} />
                  <FeeRow label="Expense" value={inr(data.ledger.expense)} color={ABSENT} />
                  <FeeRow label="Balance" value={inr(data.ledger.balance)}
                    color={data.ledger.balance >= 0 ? PRESENT : ABSENT} />
                </View>
              </ChartCard>

              {/* Homework */}
              <ChartCard icon="document-text" iconBg="#22C55E18" iconColor="#22C55E" title="Homework (30d)">
                <View style={s.pieRow}>
                  <Donut size={104} stroke={12}
                    pct={pct(data.homework.submitted, data.homework.pending)} color="#22C55E"
                    label={`${pct(data.homework.submitted, data.homework.pending)}%`} sub="done" />
                  <View style={{ flex: 1, gap: 8 }}>
                    <FeeRow label="Assigned" value={String(data.homework.total)} />
                    <FeeRow label="Submitted" value={String(data.homework.submitted)} color={PRESENT} />
                    <FeeRow label="Pending" value={String(data.homework.pending)} color={ABSENT} />
                  </View>
                </View>
              </ChartCard>

              {/* Enquiries */}
              <ChartCard icon="clipboard" iconBg="#EC489918" iconColor="#EC4899" title="Admission Enquiries">
                <StackedBar
                  segments={[
                    { label: 'Admitted', value: data.enquiries.admitted, color: PRESENT },
                    { label: 'Pending', value: data.enquiries.pending, color: '#F59E0B' },
                    { label: 'Other', value: data.enquiries.other, color: '#9CA3AF' },
                  ]}
                />
                <FeeRow label="Total enquiries" value={String(data.enquiries.total)} />
              </ChartCard>

              {/* Exam performance */}
              {data.performance.graded > 0 && (
                <ChartCard icon="ribbon" iconBg="#6366F118" iconColor="#6366F1" title="Exam Performance">
                  <View style={s.pieRow}>
                    <Donut size={104} stroke={12} pct={data.performance.avg} color="#6366F1"
                      label={`${data.performance.avg}%`} sub="avg score" />
                    <View style={{ flex: 1 }}>
                      <Text style={s.subLabel}>Score distribution</Text>
                      <MiniBars
                        data={data.performance.buckets.labels.map((l, i) => ({
                          label: l, value: data.performance.buckets.values[i] ?? 0,
                        }))}
                        maxVal={Math.max(1, ...data.performance.buckets.values)}
                        color="#6366F1"
                        height={100}
                      />
                    </View>
                  </View>
                </ChartCard>
              )}

              {/* Class distribution */}
              {data.class_distribution.labels.length > 0 && (
                <ChartCard icon="grid" iconBg="#0EA5E918" iconColor="#0EA5E9" title="Class Distribution (Today)">
                  {data.class_distribution.labels.map((label, i) => (
                    <View key={label} style={s.cdRow}>
                      <Text style={s.cdLabel} numberOfLines={1}>{label}</Text>
                      <View style={{ flex: 1 }}>
                        <StackedBar height={12}
                          segments={[
                            { label: 'P', value: data.class_distribution.present[i] ?? 0, color: PRESENT },
                            { label: 'A', value: data.class_distribution.absent[i] ?? 0, color: ABSENT },
                          ]}
                        />
                      </View>
                    </View>
                  ))}
                </ChartCard>
              )}

              {/* Top students */}
              {data.top_students.length > 0 && (
                <ChartCard icon="trophy" iconBg="#F59E0B18" iconColor="#F59E0B" title="Top Students">
                  {data.top_students.map(t => (
                    <View key={t.rank} style={s.topRow}>
                      <View style={[s.rankBadge,
                        t.rank === 1 && { backgroundColor: '#F59E0B' },
                        t.rank === 2 && { backgroundColor: '#9CA3AF' },
                        t.rank === 3 && { backgroundColor: '#B45309' }]}>
                        <Text style={s.rankText}>{t.rank}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.topName} numberOfLines={1}>{t.name}</Text>
                        <Text style={s.topMeta}>{t.class}{t.section !== '—' ? ` · ${t.section}` : ''}</Text>
                      </View>
                      <Text style={s.topScore}>{t.score}%</Text>
                    </View>
                  ))}
                </ChartCard>
              )}

              {/* Recent activity */}
              {data.recent_activities.length > 0 && (
                <ChartCard icon="time" iconBg="#8B5CF618" iconColor="#8B5CF6" title="Recent Activity">
                  {data.recent_activities.map((a, i) => (
                    <View key={i} style={s.actRow}>
                      <View style={[s.actDot, { backgroundColor: a.color }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={s.actTitle}>{a.title}</Text>
                        <Text style={s.actDesc} numberOfLines={1}>{a.description}</Text>
                      </View>
                      {!!a.time && <Text style={s.actTime}>{a.time}</Text>}
                    </View>
                  ))}
                </ChartCard>
              )}
            </>
          )}

          <View style={{ height: 30 }} />
        </ScrollView>
      )}
    </View>
  );
};

// ── small helpers ──
const MiniStat = ({ label, value, color, icon }: { label: string; value: number; color: string; icon: string }) => (
  <View style={[s.miniStat, { backgroundColor: color + '10' }]}>
    <View style={[s.miniIcon, { backgroundColor: color + '20' }]}>
      <VectorIcon iconSet="Ionicons" iconName={icon} size={16} color={color} />
    </View>
    <Text style={[s.miniVal, { color }]}>{value}</Text>
    <Text style={s.miniLbl}>{label}</Text>
  </View>
);

const FeeRow = ({ label, value, color }: { label: string; value: string; color?: string }) => (
  <View style={s.feeRow}>
    <Text style={s.feeLbl}>{label}</Text>
    <Text style={[s.feeVal, color ? { color } : null]}>{value}</Text>
  </View>
);

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
  name: { fontSize: 15, fontWeight: '900', color: theme.colors.textPrimary, marginTop: 1, lineHeight: 19 },
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

  scroll: { padding: 16, gap: 14, paddingBottom: 40 },

  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: { width: '31%', flexGrow: 1, borderRadius: 16, padding: 12, gap: 6 },
  statIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  statVal: { fontSize: 19, fontWeight: '900' },
  statLbl: { fontSize: 11, color: theme.colors.textSecondary, fontWeight: '600' },

  emptyBox: { alignItems: 'center', gap: 10, paddingVertical: 40 },
  emptyText: { fontSize: 13, color: theme.colors.textMuted, textAlign: 'center', paddingHorizontal: 32 },

  pieRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  subLabel: { fontSize: 11, fontWeight: '700', color: theme.colors.textMuted, marginTop: 4 },

  miniStatRow: { flexDirection: 'row', gap: 10 },
  miniStat: { flex: 1, borderRadius: 14, padding: 12, gap: 6, alignItems: 'flex-start' },
  miniIcon: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  miniVal: { fontSize: 20, fontWeight: '900' },
  miniLbl: { fontSize: 11, color: theme.colors.textSecondary, fontWeight: '600' },

  feeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  feeLbl: { fontSize: 12, color: theme.colors.textSecondary, fontWeight: '600' },
  feeVal: { fontSize: 13, fontWeight: '800', color: theme.colors.textPrimary },
  ledgerRow: { gap: 6, marginTop: 4 },

  cdRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cdLabel: { width: 64, fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary },

  topRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
  rankBadge: { width: 26, height: 26, borderRadius: 13, backgroundColor: theme.colors.textMuted, alignItems: 'center', justifyContent: 'center' },
  rankText: { fontSize: 12, fontWeight: '900', color: '#fff' },
  topName: { fontSize: 14, fontWeight: '700', color: theme.colors.textPrimary },
  topMeta: { fontSize: 11, color: theme.colors.textMuted, marginTop: 1 },
  topScore: { fontSize: 14, fontWeight: '900', color: PRESENT },

  actRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  actDot: { width: 9, height: 9, borderRadius: 5 },
  actTitle: { fontSize: 13, fontWeight: '700', color: theme.colors.textPrimary },
  actDesc: { fontSize: 11, color: theme.colors.textSecondary, marginTop: 1 },
  actTime: { fontSize: 10, color: theme.colors.textMuted },
});
