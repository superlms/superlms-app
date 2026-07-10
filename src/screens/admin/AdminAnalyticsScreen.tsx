import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import VectorIcon from '../../components/VectorIcon';
import Header from '../../components/Header';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useRefresh } from '../../hooks/useRefresh';
import { theme } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { ChartCard, Donut, MiniBars, StackedBar } from '../../components/Charts';
import ListRow from '../../components/ListRow';
import { AdminAnalytics, getAdminAnalytics } from '../../api/adminApi';

const PRESENT = '#22C55E';
const ABSENT = '#EF4444';
const DAY_OPTIONS = [7, 15, 30, 45, 60];
const pct = (a: number, b: number) => (a + b > 0 ? Math.round((a / (a + b)) * 100) : 0);
const inr = (n: number) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const rankColor = (rank: number) => (rank === 1 ? '#F59E0B' : rank === 2 ? '#9CA3AF' : rank === 3 ? '#B45309' : '#6366F1');

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
        height={120}
        showValue={false}
      />
    </ChartCard>
  );
};

const AdminAnalyticsScreen = ({ navigation }: any) => {
  const [data, setData] = useState<AdminAnalytics | null>(null);
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await getAdminAnalytics(days));
    } catch (e) {
      setError(apiErr(e, 'Could not load analytics.'));
    } finally {
      setLoading(false);
    }
  }, [days]);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  const { refreshing, onRefresh } = useRefresh(load);

  const statCards = data ? [
    { label: 'Students', value: data.stats.totalStudents, icon: 'people', color: '#6366F1' },
    { label: 'Present Today', value: data.stats.presentToday, icon: 'checkmark-circle', color: PRESENT },
    { label: 'Absent Today', value: data.stats.absentToday, icon: 'close-circle', color: ABSENT },
    { label: 'New (30d)', value: data.stats.newAdmissions, icon: 'person-add', color: '#F59E0B' },
    { label: 'Teachers', value: data.stats.teachers, icon: 'school', color: '#8B5CF6' },
  ] : [];

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor={theme.colors.card} />
      <Header
        title="Analytics"
        onBackPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('PanelHome'))}
      />

      {/* Period filter */}
      <View style={s.dayRow}>
        {DAY_OPTIONS.map(d => {
          const active = days === d;
          return (
            <TouchableOpacity key={d} style={[s.dayChip, active && s.dayChipActive]} onPress={() => setDays(d)} activeOpacity={0.8}>
              <Text style={[s.dayChipText, active && s.dayChipTextActive]}>{d}d</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {loading && !refreshing ? (
        <View style={s.loader}><ActivityIndicator size="large" color={theme.colors.primary} /></View>
      ) : error ? (
        <View style={s.loader}>
          <Text style={s.errorText}>{error}</Text>
          <TouchableOpacity style={s.retry} onPress={load}><Text style={s.retryText}>Retry</Text></TouchableOpacity>
        </View>
      ) : !data ? null : (
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}
          refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>

          {/* Stats */}
          <View style={s.statGrid}>
            {statCards.map(c => (
              <View key={c.label} style={[s.statCard, { backgroundColor: c.color + '12' }]}>
                <View style={[s.statIcon, { backgroundColor: c.color + '22' }]}>
                  <VectorIcon iconSet="Ionicons" iconName={c.icon} size={18} color={c.color} />
                </View>
                <Text style={[s.statVal, { color: c.color }]}>{c.value}</Text>
                <Text style={s.statLbl}>{c.label}</Text>
              </View>
            ))}
          </View>

          <AttendanceCard title="Student Attendance" icon="people" color="#6366F1"
            pie={data.student_pie} monthly={data.student_monthly} />

          <AttendanceCard title="Teacher Attendance" icon="school" color="#8B5CF6"
            pie={data.teacher_pie} monthly={data.teacher_monthly} />

          {/* Fee */}
          <ChartCard icon="cash" iconBg="#14B8A618" iconColor="#14B8A6" title="Fee Collection">
            <View style={s.pieRow}>
              <Donut size={104} stroke={12} pct={pct(data.fee.collected, data.fee.remaining)} color="#14B8A6"
                label={`${pct(data.fee.collected, data.fee.remaining)}%`} sub="collected" />
              <View style={{ flex: 1, gap: 8 }}>
                <View style={s.feeRow}><Text style={s.feeLbl}>Total</Text><Text style={s.feeVal}>{inr(data.fee.total)}</Text></View>
                <View style={s.feeRow}><Text style={s.feeLbl}>Collected</Text><Text style={[s.feeVal, { color: PRESENT }]}>{inr(data.fee.collected)}</Text></View>
                <View style={s.feeRow}><Text style={s.feeLbl}>Remaining</Text><Text style={[s.feeVal, { color: ABSENT }]}>{inr(data.fee.remaining)}</Text></View>
              </View>
            </View>
          </ChartCard>

          {/* Class distribution (today) */}
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
            <ChartCard icon="time" iconBg="#6366F118" iconColor="#6366F1" title="Recent Activity">
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

          <View style={{ height: 30 }} />
        </ScrollView>
      )}
    </View>
  );
};

export default AdminAnalyticsScreen;

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  errorText: { fontSize: 14, color: theme.colors.danger, textAlign: 'center', paddingHorizontal: 24 },
  retry: { paddingHorizontal: 24, paddingVertical: 10, borderRadius: theme.radius.full, backgroundColor: theme.colors.primary },
  retryText: { fontSize: 14, fontWeight: '700', color: '#fff' },

  dayRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 12 },
  dayChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: theme.radius.full, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border },
  dayChipActive: { backgroundColor: theme.colors.primaryLight, borderColor: theme.colors.primary },
  dayChipText: { fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary },
  dayChipTextActive: { color: theme.colors.primary },

  scroll: { padding: 16, gap: 14 },

  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: { width: '31%', flexGrow: 1, borderRadius: 16, padding: 12, gap: 6 },
  statIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  statVal: { fontSize: 19, fontWeight: '900' },
  statLbl: { fontSize: 11, color: theme.colors.textSecondary, fontWeight: '600' },

  pieRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  subLabel: { fontSize: 11, fontWeight: '700', color: theme.colors.textMuted, marginTop: 4 },

  feeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  feeLbl: { fontSize: 12, color: theme.colors.textSecondary, fontWeight: '600' },
  feeVal: { fontSize: 13, fontWeight: '800', color: theme.colors.textPrimary },

  cdRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cdLabel: { width: 64, fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary },

  topScore: { fontSize: 14, fontWeight: '900', color: PRESENT },
  actTime: { fontSize: 10, color: theme.colors.textMuted },
});
