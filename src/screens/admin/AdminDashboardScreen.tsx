import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import VectorIcon from '../../components/VectorIcon';
import TopBar from '../../components/TopBar';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useRefresh } from '../../hooks/useRefresh';
import { theme } from '../../utils/theme';
import { ChartCard, Donut, MiniBars, StackedBar, HBar } from '../../components/Charts';
import ListRow from '../../components/ListRow';
import { AdminAnalytics, getAdminAnalytics } from '../../api/adminApi';
import { getAssistantStatus } from '../../api/assistantApi';
import { useAdminProfile } from './useAdminProfile';

const PRESENT = '#22C55E';
const ABSENT = '#EF4444';

const inr = (n: number) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const pct = (a: number, b: number) => (a + b > 0 ? Math.round((a / (a + b)) * 100) : 0);
const rankColor = (rank: number) => (rank === 1 ? '#F59E0B' : rank === 2 ? '#9CA3AF' : rank === 3 ? '#B45309' : '#6366F1');

// ── right-aligned metric pill for a card header ──
const Badge = ({ text, color }: { text: string; color: string }) => (
  <View style={[s.badge, { backgroundColor: color + '1A' }]}>
    <Text style={[s.badgeText, { color }]}>{text}</Text>
  </View>
);

// ── Attendance card: rate + today + present & absent monthly bars ──
const AttendanceCard = ({
  title, icon, color, todayPresent, todayAbsent, pie, monthly, onPress,
}: {
  title: string; icon: string; color: string;
  todayPresent?: number; todayAbsent?: number;
  pie: { present: number; absent: number };
  monthly: { months: string[]; present: number[]; absent: number[] };
  onPress: () => void;
}) => {
  const rate = pct(pie.present, pie.absent);
  const maxVal = Math.max(1, ...monthly.present, ...monthly.absent);
  return (
    <ChartCard icon={icon} iconBg={color + '18'} iconColor={color} title={title}
      subtitle="Last 30 days" right={<Badge text={`${rate}%`} color={PRESENT} />} onPress={onPress}>
      <View style={s.pieRow}>
        <Donut size={104} stroke={12} pct={rate} color={PRESENT} label={`${rate}%`} sub="present" />
        <View style={{ flex: 1, gap: 10 }}>
          <StackedBar
            segments={[
              { label: 'Present', value: pie.present, color: PRESENT },
              { label: 'Absent', value: pie.absent, color: ABSENT },
            ]}
          />
          {(todayPresent != null || todayAbsent != null) && (
            <View style={s.todayRow}>
              <View style={[s.todayPill, { backgroundColor: PRESENT + '14' }]}>
                <Text style={[s.todayVal, { color: PRESENT }]}>{todayPresent ?? 0}</Text>
                <Text style={s.todayLbl}>present today</Text>
              </View>
              <View style={[s.todayPill, { backgroundColor: ABSENT + '14' }]}>
                <Text style={[s.todayVal, { color: ABSENT }]}>{todayAbsent ?? 0}</Text>
                <Text style={s.todayLbl}>absent today</Text>
              </View>
            </View>
          )}
        </View>
      </View>
      <Text style={s.subLabel}>Monthly present (Apr–Mar)</Text>
      <MiniBars data={monthly.months.map((m, i) => ({ label: m, value: monthly.present[i] ?? 0 }))}
        maxVal={maxVal} color={PRESENT} height={96} showValue={false} />
      <Text style={s.subLabel}>Monthly absent (Apr–Mar)</Text>
      <MiniBars data={monthly.months.map((m, i) => ({ label: m, value: monthly.absent[i] ?? 0 }))}
        maxVal={maxVal} color={ABSENT} height={96} showValue={false} />
    </ChartCard>
  );
};

const AdminDashboardScreen = ({ navigation }: any) => {
  const [data, setData] = useState<AdminAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  // LMS Assist's button shows only where the assistant is switched on.
  const [assistant, setAssistant] = useState(false);
  const profile = useAdminProfile();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await getAdminAnalytics(30).catch(() => null));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    getAssistantStatus()
      .then(st => setAssistant(!!st?.enabled))
      .catch(() => setAssistant(false));
  }, []);

  const { refreshing, onRefresh } = useRefresh(load);
  // Students and Teachers are tabs beside this one.
  const go = (route: string) => navigation.navigate(route);

  const statCards = data ? [
    { label: 'Students', value: String(data.stats.totalStudents), icon: 'people', color: '#6366F1', route: 'Students' },
    { label: 'Present Today', value: String(data.stats.presentToday), icon: 'checkmark-circle', color: PRESENT, route: 'AdminAnalytics' },
    { label: 'Absent Today', value: String(data.stats.absentToday), icon: 'close-circle', color: ABSENT, route: 'AdminAnalytics' },
    { label: 'Teachers', value: String(data.stats.teachers), icon: 'school', color: '#8B5CF6', route: 'Teachers' },
    { label: 'New (30d)', value: String(data.stats.newAdmissions), icon: 'person-add', color: '#F59E0B', route: 'Students' },
  ] : [];

  // ── derived metrics ──
  const ratio = data && data.stats.teachers > 0
    ? `1:${Math.round(data.stats.totalStudents / data.stats.teachers)}` : '—';
  const avgPerClass = data && data.structure.classes > 0
    ? Math.round(data.stats.totalStudents / data.structure.classes) : 0;
  const passRate = (() => {
    if (!data || data.performance.graded === 0) return 0;
    const v = data.performance.buckets.values;
    const pass = (v[0] ?? 0) + (v[1] ?? 0) + (v[2] ?? 0) + (v[3] ?? 0);
    return Math.round((pass / data.performance.graded) * 100);
  })();
  const enqConversion = data && data.enquiries.total > 0
    ? Math.round((data.enquiries.admitted / data.enquiries.total) * 100) : 0;

  return (
    <View style={s.root}>
      {/* The student and teacher top bar, with the school in place of the person:
          account switch, notifications, messages */}
      <TopBar
        school={profile?.organization ?? null}
        onBellPress={() => navigation.navigate('Notifications')}
        onMessagePress={() => navigation.navigate('AdminMessages')}
      />

      {loading && !refreshing ? (
        <View style={s.loader}><ActivityIndicator size="large" color={theme.colors.primary} /></View>
      ) : (
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}
          refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>

          {/* Headline stats — each opens its screen */}
          <View style={s.statGrid}>
            {statCards.map(c => (
              <TouchableOpacity key={c.label} style={[s.statCard, { backgroundColor: c.color + '12' }]}
                activeOpacity={0.85} onPress={() => go(c.route)}>
                <View style={s.statTop}>
                  <View style={[s.statIcon, { backgroundColor: c.color + '22' }]}>
                    <VectorIcon iconSet="Ionicons" iconName={c.icon} size={18} color={c.color} />
                  </View>
                  <VectorIcon iconSet="Feather" iconName="chevron-right" size={16} color={c.color} />
                </View>
                <Text style={[s.statVal, { color: c.color }]} numberOfLines={1}>{c.value}</Text>
                <Text style={s.statLbl}>{c.label}</Text>
              </TouchableOpacity>
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
              <ChartCard icon="business" iconBg="#0EA5E918" iconColor="#0EA5E9" title="School Structure"
                subtitle="Classes, sections & subjects" onPress={() => go('AdminStandard')}>
                <View style={s.miniStatRow}>
                  <MiniStat label="Classes" value={data.structure.classes} color="#0EA5E9" icon="grid" />
                  <MiniStat label="Sections" value={data.structure.sections} color="#6366F1" icon="layers" />
                  <MiniStat label="Subjects" value={data.structure.subjects} color="#EC4899" icon="book" />
                </View>
                <View style={s.divider} />
                <View style={s.kvRow}>
                  <KV label="Student–Teacher ratio" value={ratio} />
                  <KV label="Avg / class" value={String(avgPerClass)} />
                </View>
              </ChartCard>

              {/* Attendance */}
              <AttendanceCard title="Student Attendance" icon="people" color="#6366F1"
                todayPresent={data.stats.presentToday} todayAbsent={data.stats.absentToday}
                pie={data.student_pie} monthly={data.student_monthly} onPress={() => go('AdminAnalytics')} />
              <AttendanceCard title="Teacher Attendance" icon="school" color="#8B5CF6"
                pie={data.teacher_pie} monthly={data.teacher_monthly} onPress={() => go('AdminAnalytics')} />

              {/* Fee collection */}
              <ChartCard icon="cash" iconBg="#14B8A618" iconColor="#14B8A6" title="Fee Collection"
                subtitle="Collected vs remaining"
                right={<Badge text={`${pct(data.fee.collected, data.fee.remaining)}%`} color="#14B8A6" />}
                onPress={() => go('AdminAnalytics')}>
                <View style={s.pieRow}>
                  <Donut size={104} stroke={12} pct={pct(data.fee.collected, data.fee.remaining)} color="#14B8A6"
                    label={`${pct(data.fee.collected, data.fee.remaining)}%`} sub="collected" />
                  <View style={{ flex: 1, gap: 8 }}>
                    <FeeRow label="Total" value={inr(data.fee.total)} />
                    <FeeRow label="Collected" value={inr(data.fee.collected)} color={PRESENT} />
                    <FeeRow label="Remaining" value={inr(data.fee.remaining)} color={ABSENT} />
                  </View>
                </View>
                <View style={s.divider} />
                <HBar label="Collection rate" value={pct(data.fee.collected, data.fee.remaining)} max={100} color="#14B8A6" />
              </ChartCard>

              {/* Ledger */}
              <ChartCard icon="wallet" iconBg="#F59E0B18" iconColor="#F59E0B" title="Ledger"
                subtitle="Credit, expense & balance"
                right={<Badge text={data.ledger.balance >= 0 ? 'Surplus' : 'Deficit'}
                  color={data.ledger.balance >= 0 ? PRESENT : ABSENT} />}
                onPress={() => go('AdminAnalytics')}>
                <StackedBar
                  segments={[
                    { label: 'Credit', value: data.ledger.credit, color: PRESENT },
                    { label: 'Expense', value: data.ledger.expense, color: ABSENT },
                  ]}
                />
                <View style={s.ledgerRow}>
                  <FeeRow label="Credit" value={inr(data.ledger.credit)} color={PRESENT} />
                  <FeeRow label="Expense" value={inr(data.ledger.expense)} color={ABSENT} />
                  <View style={s.divider} />
                  <FeeRow label="Net balance" value={inr(data.ledger.balance)}
                    color={data.ledger.balance >= 0 ? PRESENT : ABSENT} />
                </View>
              </ChartCard>

              {/* Homework */}
              <ChartCard icon="document-text" iconBg="#22C55E18" iconColor="#22C55E" title="Homework"
                subtitle="Submissions · last 30 days"
                right={<Badge text={`${pct(data.homework.submitted, data.homework.pending)}%`} color="#22C55E" />}
                onPress={() => go('AdminAnalytics')}>
                <View style={s.pieRow}>
                  <Donut size={104} stroke={12} pct={pct(data.homework.submitted, data.homework.pending)} color="#22C55E"
                    label={`${pct(data.homework.submitted, data.homework.pending)}%`} sub="done" />
                  <View style={{ flex: 1, gap: 8 }}>
                    <FeeRow label="Assigned" value={String(data.homework.total)} />
                    <FeeRow label="Submitted" value={String(data.homework.submitted)} color={PRESENT} />
                    <FeeRow label="Pending" value={String(data.homework.pending)} color={ABSENT} />
                  </View>
                </View>
              </ChartCard>

              {/* Enquiries */}
              <ChartCard icon="clipboard" iconBg="#EC489918" iconColor="#EC4899" title="Admission Enquiries"
                subtitle="Admission pipeline"
                right={<Badge text={`${enqConversion}% won`} color={PRESENT} />}
                onPress={() => go('AdminEnquiries')}>
                <StackedBar
                  segments={[
                    { label: 'Admitted', value: data.enquiries.admitted, color: PRESENT },
                    { label: 'Pending', value: data.enquiries.pending, color: '#F59E0B' },
                    { label: 'Other', value: data.enquiries.other, color: '#9CA3AF' },
                  ]}
                />
                <View style={s.divider} />
                <View style={s.kvRow}>
                  <KV label="Total" value={String(data.enquiries.total)} />
                  <KV label="Admitted" value={String(data.enquiries.admitted)} color={PRESENT} />
                  <KV label="Pending" value={String(data.enquiries.pending)} color="#F59E0B" />
                </View>
              </ChartCard>

              {/* Exam performance */}
              {data.performance.graded > 0 && (
                <ChartCard icon="ribbon" iconBg="#6366F118" iconColor="#6366F1" title="Exam Performance"
                  subtitle={`${data.performance.graded} results graded`}
                  right={<Badge text={`${passRate}% pass`} color={PRESENT} />}
                  onPress={() => go('AdminExam')}>
                  <View style={s.pieRow}>
                    <Donut size={104} stroke={12} pct={data.performance.avg} color="#6366F1"
                      label={`${data.performance.avg}%`} sub="avg score" />
                    <View style={{ flex: 1 }}>
                      <Text style={s.subLabel}>Score distribution</Text>
                      <MiniBars data={data.performance.buckets.labels.map((l, i) => ({
                        label: l, value: data.performance.buckets.values[i] ?? 0 }))}
                        maxVal={Math.max(1, ...data.performance.buckets.values)} color="#6366F1" height={100} />
                    </View>
                  </View>
                </ChartCard>
              )}

              {/* Class distribution */}
              {data.class_distribution.labels.length > 0 && (
                <ChartCard icon="grid" iconBg="#0EA5E918" iconColor="#0EA5E9" title="Class Distribution"
                  subtitle="Present vs absent today" onPress={() => go('AdminStandard')}>
                  {data.class_distribution.labels.map((label, i) => {
                    const p = data.class_distribution.present[i] ?? 0;
                    const a = data.class_distribution.absent[i] ?? 0;
                    return (
                      <View key={label} style={s.cdRow}>
                        <Text style={s.cdLabel} numberOfLines={1}>{label}</Text>
                        <View style={{ flex: 1 }}>
                          <StackedBar height={12}
                            segments={[
                              { label: 'P', value: p, color: PRESENT },
                              { label: 'A', value: a, color: ABSENT },
                            ]}
                          />
                        </View>
                        <Text style={s.cdRate}>{pct(p, a)}%</Text>
                      </View>
                    );
                  })}
                </ChartCard>
              )}

              {/* Top students */}
              {data.top_students.length > 0 && (
                <ChartCard icon="trophy" iconBg="#F59E0B18" iconColor="#F59E0B" title="Top Students"
                  subtitle="By attendance" onPress={() => go('Students')}>
                  {data.top_students.map(t => (
                    <ListRow
                      key={t.rank}
                      variant="plain"
                      color={rankColor(t.rank)}
                      title={`${t.rank}. ${t.name}`}
                      subtitle={`${t.class}${t.section !== '—' ? ` · ${t.section}` : ''}`}
                      right={<Text style={[s.topScore, { color: rankColor(t.rank) }]}>{t.score}%</Text>}
                    />
                  ))}
                </ChartCard>
              )}

              {/* Recent activity */}
              {data.recent_activities.length > 0 && (
                <ChartCard icon="time" iconBg="#8B5CF618" iconColor="#8B5CF6" title="Recent Activity"
                  subtitle="Latest across the school">
                  {data.recent_activities.map((a, i) => (
                    <ListRow
                      key={i}
                      variant="plain"
                      color={a.color}
                      title={a.title}
                      subtitle={a.description}
                      right={a.time ? <Text style={s.actTime}>{a.time}</Text> : null}
                    />
                  ))}
                </ChartCard>
              )}
            </>
          )}

          <View style={{ height: 30 }} />
        </ScrollView>
      )}

      {assistant && (
        <TouchableOpacity style={s.assist} activeOpacity={0.85} onPress={() => navigation.navigate('AdminAssistant')}>
          <VectorIcon iconSet="Ionicons" iconName="sparkles" size={18} color={theme.colors.white} />
          <Text style={s.assistText}>LMS Assist</Text>
        </TouchableOpacity>
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

const KV = ({ label, value, color }: { label: string; value: string; color?: string }) => (
  <View style={s.kv}>
    <Text style={[s.kvVal, color ? { color } : null]}>{value}</Text>
    <Text style={s.kvLbl} numberOfLines={1}>{label}</Text>
  </View>
);

export default AdminDashboardScreen;

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 16, gap: 14, paddingBottom: 96 },

  // LMS Assist, at the bottom right
  assist: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 48,
    paddingHorizontal: 16,
    borderRadius: 24,
    backgroundColor: theme.colors.primary,
    shadowColor: theme.colors.shadow,
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  assistText: { color: theme.colors.white, fontSize: 14, fontWeight: '600' },

  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: { width: '31%', flexGrow: 1, borderRadius: 16, padding: 12, gap: 6 },
  statTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  statVal: { fontSize: 19, fontWeight: '900' },
  statLbl: { fontSize: 11, color: theme.colors.textSecondary, fontWeight: '600' },

  emptyBox: { alignItems: 'center', gap: 10, paddingVertical: 40 },
  emptyText: { fontSize: 13, color: theme.colors.textMuted, textAlign: 'center', paddingHorizontal: 32 },

  badge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: theme.radius.full },
  badgeText: { fontSize: 11, fontWeight: '800' },

  pieRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  subLabel: { fontSize: 11, fontWeight: '700', color: theme.colors.textMuted, marginTop: 4 },
  divider: { height: 1, backgroundColor: theme.colors.border, marginVertical: 4 },

  todayRow: { flexDirection: 'row', gap: 8 },
  todayPill: { flex: 1, borderRadius: 10, paddingVertical: 6, paddingHorizontal: 8 },
  todayVal: { fontSize: 16, fontWeight: '900' },
  todayLbl: { fontSize: 9, fontWeight: '600', color: theme.colors.textSecondary },

  miniStatRow: { flexDirection: 'row', gap: 10 },
  miniStat: { flex: 1, borderRadius: 14, padding: 12, gap: 6, alignItems: 'flex-start' },
  miniIcon: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  miniVal: { fontSize: 20, fontWeight: '900' },
  miniLbl: { fontSize: 11, color: theme.colors.textSecondary, fontWeight: '600' },

  kvRow: { flexDirection: 'row', gap: 10 },
  kv: { flex: 1 },
  kvVal: { fontSize: 15, fontWeight: '900', color: theme.colors.textPrimary },
  kvLbl: { fontSize: 10.5, color: theme.colors.textSecondary, fontWeight: '600', marginTop: 1 },

  feeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  feeLbl: { fontSize: 12, color: theme.colors.textSecondary, fontWeight: '600' },
  feeVal: { fontSize: 13, fontWeight: '800', color: theme.colors.textPrimary },
  ledgerRow: { gap: 6, marginTop: 4 },

  cdRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cdLabel: { width: 58, fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary },
  cdRate: { width: 38, textAlign: 'right', fontSize: 11, fontWeight: '800', color: PRESENT },

  topScore: { fontSize: 14, fontWeight: '900', color: PRESENT },
  actTime: { fontSize: 10, color: theme.colors.textMuted },
});
