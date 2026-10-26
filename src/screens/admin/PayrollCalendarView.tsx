import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Skeleton } from '../../components/Skeleton';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { EmployeeAttendance, getEmployeeAttendance, typeLabel } from '../../api/adminPayrollApi';
import { OptionSheet } from './adminFormUi';
import { Avatar, DropPill, ErrorBox } from './adminTransportUi';
import { academicYears, dayTone, monthOptions } from './payrollUi';

/**
 * One person's attendance, as the panel's Attendance tab draws it once a
 * person is picked: who they are and the period, the period's working days,
 * present, absent, half days (when there are any) and holidays, then each
 * month as a quiet Sunday-first calendar — April first — with the same
 * figures beside it in short (W · P · A · ½ · H). A day with nothing marked
 * reads as a holiday; a teacher's days are the Attendance module's.
 *
 * The academic year by default, or one month.
 */

const WEEK = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const PayrollCalendarView = ({ employeeId, name, refreshKey = 0 }: { employeeId: number; name?: string; refreshKey?: number }) => {
  const years = academicYears();
  const [year, setYear] = useState(years[0].key);
  const [month, setMonth] = useState('');
  const [data, setData] = useState<EmployeeAttendance | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<null | 'year' | 'month'>(null);
  const { width } = useWindowDimensions();
  const cell = Math.floor((width - 40) / 7);
  const seq = useRef(0);

  const load = useCallback(async () => {
    const mine = ++seq.current;
    setError(null);
    try {
      const d = await getEmployeeAttendance(employeeId, month ? { month } : { year });
      if (mine === seq.current) setData(d);
    } catch (err) {
      if (mine === seq.current) setError(apiErr(err, 'Could not load attendance.'));
    }
  }, [employeeId, year, month]);

  useEffect(() => {
    setData(null);
    load();
  }, [load, refreshKey]);

  const c = data?.counts;
  const e = data?.employee;

  return (
    <View>
      <View style={s.head}>
        <Avatar uri={e?.photo} name={e?.name ?? name} size={44} />
        <View style={s.headBody}>
          <Text style={s.name}>{e?.name ?? name ?? ''}</Text>
          <Text style={s.sub}>{e ? [e.types.map(typeLabel).join(', '), data?.period].filter(Boolean).join(' · ') : ''}</Text>
        </View>
      </View>

      <View style={s.filters}>
        <DropPill label={years.find(y => y.key === year)?.label ?? 'Year'} active={!month} onPress={() => setSheet('year')} />
        <DropPill label={month ? monthOptions().find(m => m.key === month)?.label ?? month : 'One month'} active={!!month} onPress={() => setSheet('month')} />
      </View>

      {error && !data ? (
        <ErrorBox message={error} onRetry={load} />
      ) : !data ? (
        <View style={s.skWrap}>{[0, 1].map(i => <Skeleton key={i} width="100%" height={220} radius={12} />)}</View>
      ) : (
        <>
          {/* Working days are the days the person was marked on (holidays apart). */}
          {c && (
            <Text style={s.counts}>
              {[
                `Working days ${c.marked ?? 0}`,
                `Present ${c.present ?? 0}`,
                `Absent ${c.absent ?? 0}`,
                (c.half_day ?? 0) > 0 ? `Half day ${c.half_day}` : null,
                `Holiday ${c.holiday ?? 0}`,
              ]
                .filter(Boolean)
                .join(' · ')}
            </Text>
          )}
          {data.months.length === 0 && <Text style={s.counts}>Nothing to show for this period.</Text>}
          {data.months.map(m => (
            <View key={m.key} style={s.month}>
              <View style={s.monthHead}>
                <Text style={s.monthTitle}>{m.label}</Text>
                <Text style={s.monthCounts}>
                  {[
                    `W ${m.counts.marked}`,
                    `P ${m.counts.present}`,
                    `A ${m.counts.absent}`,
                    m.counts.half_day > 0 ? `½ ${m.counts.half_day}` : null,
                    `H ${m.counts.holiday}`,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
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
                    <View key={d.date} style={[s.cellPad, { width: cell, height: cell }]}>
                      <View style={[s.day, d.in_period && d.status !== 'holiday' && { backgroundColor: t.bg }, d.dim && s.dim]}>
                        <Text
                          style={[
                            s.dayText,
                            d.in_period && d.status !== 'holiday' && [s.dayStrong, { color: t.ink }],
                            (!d.in_period || d.status === 'holiday') && s.outside,
                          ]}
                        >
                          {d.day}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          ))}
          <View style={s.legend}>
            {[
              ['present', 'Present'],
              ['absent', 'Absent'],
              ['half_day', 'Half day'],
              ['holiday', 'Holiday / not marked'],
            ].map(([k, label]) => (
              <View key={k} style={s.legendItem}>
                <View style={[s.legendDot, { backgroundColor: k === 'holiday' ? theme.colors.border : dayTone(k).ink }]} />
                <Text style={s.legendText}>{label}</Text>
              </View>
            ))}
          </View>
        </>
      )}

      <OptionSheet
        visible={sheet === 'year'}
        title="Academic year"
        options={years}
        selected={[year]}
        onPick={k => {
          setSheet(null);
          setYear(k);
          setMonth('');
        }}
        onClose={() => setSheet(null)}
      />
      <OptionSheet
        visible={sheet === 'month'}
        title="Month"
        options={monthOptions()}
        selected={[month]}
        onPick={k => {
          setSheet(null);
          setMonth(k);
        }}
        onClose={() => setSheet(null)}
      />
    </View>
  );
};

export default PayrollCalendarView;

const __mk_s = () => StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 16 },
  headBody: { flex: 1, gap: 2 },
  name: { fontSize: 16, fontWeight: '700', color: theme.colors.textPrimary },
  sub: { fontSize: 12, color: theme.colors.textMuted },
  filters: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 2 },
  counts: { fontSize: 12, color: theme.colors.textSecondary, paddingHorizontal: 20, paddingTop: 10, lineHeight: 18 },
  month: { marginHorizontal: 20, marginTop: 18, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.border },
  monthHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6, gap: 8 },
  monthTitle: { fontSize: 14, fontWeight: '600', color: theme.colors.textPrimary },
  monthCounts: { fontSize: 11, color: theme.colors.textMuted },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  week: { textAlign: 'center', fontSize: 11, fontWeight: '600', color: theme.colors.textMuted, paddingBottom: 4 },
  day: { flex: 1, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  dayText: { fontSize: 12, color: theme.colors.textSecondary },
  dayStrong: { fontWeight: '700' },
  cellPad: { padding: 2 },
  outside: { color: theme.colors.border },
  dim: { opacity: 0.3 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, paddingHorizontal: 20, paddingTop: 16 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, color: theme.colors.textMuted },
  skWrap: { paddingHorizontal: 20, paddingTop: 16, gap: 14 },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
