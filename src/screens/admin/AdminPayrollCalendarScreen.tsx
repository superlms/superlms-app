import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Skeleton } from '../../components/Skeleton';
import { useFocusLoad } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { EmployeeAttendance, getEmployeeAttendance, typeLabel } from '../../api/adminPayrollApi';
import { DocHeader } from '../more/docUi';
import { OptionSheet } from './adminFormUi';
import { Avatar, DropPill, ErrorBox } from './adminTransportUi';
import { academicYears, dayTone, monthOptions } from './payrollUi';

/**
 * One person's attendance, as the panel's employee view draws it: the
 * academic year (April → March, up to today) or one month, each month a
 * Sunday-first calendar with its present / absent / half day / leave /
 * holiday counts and present-%. A day with nothing marked reads as a holiday.
 * A teacher's days come from the Teacher module.
 */

const WEEK = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const AdminPayrollCalendarScreen = ({ navigation, route }: any) => {
  const id: number = route?.params?.id;
  const years = academicYears();
  const [year, setYear] = useState(years[0].key);
  const [month, setMonth] = useState('');
  const [data, setData] = useState<EmployeeAttendance | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<null | 'year' | 'month'>(null);
  const { width } = useWindowDimensions();
  const cell = Math.floor((width - 40) / 7);

  const load = useCallback(async (y = year, m = month) => {
    setError(null);
    try {
      setData(await getEmployeeAttendance(id, m ? { month: m } : { year: y }));
    } catch (err) {
      setError(apiErr(err, 'Could not load attendance.'));
    }
  }, [id, year, month]);
  useFocusLoad(() => load());

  const c = data?.counts;
  const e = data?.employee;

  return (
    <View style={s.root}>
      <DocHeader title="Attendance" onBackPress={() => navigation.goBack()} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        <View style={s.head}>
          <Avatar uri={e?.photo} name={e?.name ?? route?.params?.name} size={48} />
          <View style={s.headBody}>
            <Text style={s.name}>{e?.name ?? route?.params?.name ?? ''}</Text>
            <Text style={s.sub}>{e ? [e.designation, e.types.map(typeLabel).join(', ')].filter(Boolean).join(' · ') : ''}</Text>
          </View>
        </View>

        <View style={s.filters}>
          <DropPill label={years.find(y => y.key === year)?.label ?? 'Year'} active={!month} onPress={() => setSheet('year')} />
          <DropPill label={month ? monthOptions().find(m => m.key === month)?.label ?? month : 'One month'} active={!!month} onPress={() => setSheet('month')} />
        </View>

        {error && !data ? (
          <ErrorBox message={error} onRetry={() => load()} />
        ) : !data ? (
          <View style={s.skWrap}>{[0, 1].map(i => <Skeleton key={i} width="100%" height={220} radius={12} />)}</View>
        ) : (
          <>
            <Text style={s.period}>{data.period}</Text>
            {c && (
              <Text style={s.counts}>
                {`Present ${c.present ?? 0} · Absent ${c.absent ?? 0} · Half day ${c.half_day ?? 0} · Leave ${c.leave ?? 0} · Holiday ${c.holiday ?? 0}`}
              </Text>
            )}
            {data.months.length === 0 && <Text style={s.counts}>Nothing to show for this period yet.</Text>}
            {[...data.months].reverse().map(m => (
              <View key={m.key} style={s.month}>
                <View style={s.monthHead}>
                  <Text style={s.monthTitle}>{m.label}</Text>
                  <Text style={s.pct}>{m.counts.marked ? `${m.pct}% present` : 'Nothing marked'}</Text>
                </View>
                <View style={s.grid}>
                  {WEEK.map((d, i) => (
                    <Text key={`w${i}`} style={[s.week, { width: cell }]}>{d}</Text>
                  ))}
                  {Array.from({ length: m.lead }).map((_, i) => (
                    <View key={`b${i}`} style={{ width: cell, height: cell }} />
                  ))}
                  {m.cells.map(d => {
                    const t = dayTone(d.in_period ? d.status : null);
                    return (
                      <View key={d.date} style={{ width: cell, height: cell, padding: 2 }}>
                        <View style={[s.day, d.in_period && { backgroundColor: d.status === 'holiday' ? theme.colors.background : t.bg }, d.dim && s.dim]}>
                          <Text style={[s.dayText, d.in_period && d.status !== 'holiday' && { color: t.ink, fontWeight: '700' }, !d.in_period && s.outside]}>
                            {d.day}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
                <Text style={s.monthCounts}>
                  {`P ${m.counts.present} · A ${m.counts.absent} · H ${m.counts.half_day} · L ${m.counts.leave} · Holiday ${m.counts.holiday}`}
                </Text>
              </View>
            ))}
          </>
        )}
      </ScrollView>

      <OptionSheet
        visible={sheet === 'year'}
        title="Academic year"
        options={years}
        selected={[year]}
        onPick={k => { setSheet(null); setYear(k); setMonth(''); setData(null); load(k, ''); }}
        onClose={() => setSheet(null)}
      />
      <OptionSheet
        visible={sheet === 'month'}
        title="Month"
        options={monthOptions()}
        selected={[month]}
        onPick={k => { setSheet(null); setMonth(k); setData(null); load(year, k); }}
        onClose={() => setSheet(null)}
      />
    </View>
  );
};

export default AdminPayrollCalendarScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  scroll: { paddingBottom: 40 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 18 },
  headBody: { flex: 1, gap: 2 },
  name: { fontSize: 18, fontWeight: '700', color: theme.colors.textPrimary },
  sub: { fontSize: 13, color: theme.colors.textSecondary },
  filters: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 4 },
  period: { fontSize: 15, fontWeight: '700', color: theme.colors.textPrimary, paddingHorizontal: 20, paddingTop: 12 },
  counts: { fontSize: 12, color: theme.colors.textMuted, paddingHorizontal: 20, paddingTop: 4 },
  month: { marginHorizontal: 20, marginTop: 18 },
  monthHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 },
  monthTitle: { fontSize: 14, fontWeight: '600', color: theme.colors.textPrimary },
  pct: { fontSize: 12, color: theme.colors.textMuted },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  week: { textAlign: 'center', fontSize: 11, fontWeight: '600', color: theme.colors.textMuted, paddingBottom: 4 },
  day: { flex: 1, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  dayText: { fontSize: 12, color: theme.colors.textSecondary },
  outside: { color: theme.colors.border },
  dim: { opacity: 0.3 },
  monthCounts: { fontSize: 11, color: theme.colors.textMuted, marginTop: 4 },
  skWrap: { paddingHorizontal: 20, paddingTop: 16, gap: 14 },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
