import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useFocusLoad, useRefresh } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { FeeAnalytics, getFeeAnalytics } from '../../api/adminFeeApi';
import { DocHeader } from '../more/docUi';
import { Card, CardHead, Columns, DashError, DashSkeleton, LineRow, Note, PctRow, Pill } from '../home/dashboardUi';
import { Hero } from '../analytics/analyticsUi';
import { AmountRows } from '../fees/feesUi';
import { ClassPills, inr, useFeeClasses } from './adminFeeUi';

/**
 * The panel's fee Analytics, in the student Analytics' cards: the collection
 * rate over what is billable (academic heads × the students in each class,
 * transport each rider's route fee × their months), what came in today, this
 * week and month, the last 14 days, the split by mode, each class worst
 * first, and the biggest dues — or, with a class picked, all its students.
 */

// ₹1.2L / ₹45K — short enough for a column.
const short = (n: number) => {
  const v = Number(n) || 0;
  if (v >= 1e7) return `₹${(v / 1e7).toFixed(1).replace(/\.0$/, '')}Cr`;
  if (v >= 1e5) return `₹${(v / 1e5).toFixed(1).replace(/\.0$/, '')}L`;
  if (v >= 1e3) return `₹${(v / 1e3).toFixed(1).replace(/\.0$/, '')}K`;
  return `₹${Math.round(v)}`;
};

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

const AdminFeeAnalyticsScreen = ({ navigation }: any) => {
  const classes = useFeeClasses();
  const [classId, setClassId] = useState<number | null>(null);
  const [sectionId, setSectionId] = useState<number | null>(null);
  const [data, setData] = useState<FeeAnalytics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [day, setDay] = useState<string | undefined>(undefined);

  const load = useCallback(
    async (c = classId, sec = sectionId) => {
      setError(null);
      try {
        setData(await getFeeAnalytics({ standard_id: c ?? undefined, section_id: sec ?? undefined }));
      } catch (e) {
        setError(apiErr(e, 'Could not load analytics.'));
      } finally {
        setLoading(false);
      }
    },
    [classId, sectionId],
  );
  useFocusLoad(() => load());
  const { refreshing, onRefresh } = useRefresh(load);

  const pick = (c: number | null, sec: number | null) => {
    setClassId(c);
    setSectionId(sec);
    setLoading(true);
    setData(null);
    load(c, sec);
  };

  const body = () => {
    if (!data) return null;
    const sm = data.summary;
    const points = data.daily?.points ?? [];
    const picked = points.find(p => p.title === day) ?? points[points.length - 1];

    return (
      <>
        <Hero
          kicker={classId ? 'Collection · this class' : 'Collection · whole school'}
          value={`${sm.rate}%`}
          low={sm.rate < 50}
          caption={`${inr(sm.total_collected)} collected of ${inr(sm.total_billable)} billable · ${plural(sm.students, 'student')}`}
          stats={[
            { label: 'Billable', value: short(sm.total_billable) },
            { label: 'Collected', value: short(sm.total_collected) },
            { label: 'Due', value: short(sm.total_due), low: sm.total_due > 0 },
          ]}
        />

        <Card>
          <CardHead icon="layers-outline" title="By fee" sub={`${plural(sm.riders, 'student')} on transport`} />
          <PctRow
            label="Academic"
            pct={sm.academic_billable > 0 ? Math.min(100, Math.round((sm.academic_collected / sm.academic_billable) * 100)) : 0}
            value={`${inr(sm.academic_collected)} / ${inr(sm.academic_billable)}`}
            meta={`${inr(sm.academic_due)} due`}
          />
          <PctRow
            label="Transport"
            pct={sm.transport_billable > 0 ? Math.min(100, Math.round((sm.transport_collected / sm.transport_billable) * 100)) : 0}
            value={`${inr(sm.transport_collected)} / ${inr(sm.transport_billable)}`}
            meta={`${inr(sm.transport_due)} due`}
            isLast={sm.penalty_collected <= 0}
          />
          {sm.penalty_collected > 0 && <LineRow title="Penalties collected" trailing={<Pill text={inr(sm.penalty_collected)} />} isLast />}
          <View style={s.pills}>
            <Pill text={`${sm.fully_paid} fully paid`} tone="good" />
            <Pill text={`${sm.defaulters} with dues`} tone={sm.defaulters > 0 ? 'bad' : 'neutral'} />
          </View>
        </Card>

        <Card>
          <CardHead icon="time-outline" title="Collected" />
          <AmountRows
            rows={Object.entries(data.periods ?? {}).map(([label, p]) => ({
              label: `${label} · ${plural(p.count, 'payment')}`,
              value: inr(p.amount),
            }))}
          />
        </Card>

        {points.length > 0 && (
          <Card>
            <CardHead
              icon="bar-chart-outline"
              title="Last 14 days"
              sub={picked ? `${picked.title} · ${inr(picked.amount)} · ${plural(picked.count, 'payment')}` : null}
            />
            <Columns
              data={points.map(p => ({ key: p.title, label: p.label, value: p.amount }))}
              selected={picked?.title}
              onSelect={setDay}
              max={data.daily.peak || 1}
              format={short}
            />
            <Note>{`${inr(data.daily.total)} in ${plural(data.daily.count, 'payment')} over the last 14 days.`}</Note>
          </Card>
        )}

        <Card>
          <CardHead icon="card-outline" title="By mode" />
          {data.modes.length === 0 ? (
            <Note>No payments yet.</Note>
          ) : (
            data.modes.map((m, i) => (
              <PctRow
                key={m.label}
                label={m.label === 'Upi' ? 'UPI' : m.label}
                pct={Math.round(m.pct)}
                value={inr(m.amount)}
                meta={`${plural(m.count, 'payment')} · ${m.pct}%`}
                isLast={i === data.modes.length - 1}
              />
            ))
          )}
        </Card>

        {data.classes.length > 0 && (
          <Card>
            <CardHead icon="school-outline" title="By class" sub="Lowest collection first" />
            {data.classes.map((c, i) => (
              <TouchableOpacity key={c.id} activeOpacity={0.7} disabled={!!classId} onPress={() => pick(c.id, null)}>
                <PctRow
                  label={`${c.name} · ${plural(c.students, 'student')}`}
                  pct={Math.round(c.rate)}
                  low={c.rate < 50}
                  value={`${c.rate}%`}
                  meta={`${inr(c.collected)} of ${inr(c.billable)} · ${inr(c.due)} due`}
                  isLast={i === data.classes.length - 1}
                />
              </TouchableOpacity>
            ))}
          </Card>
        )}

        <Card>
          <CardHead
            icon="people-outline"
            title={data.student_scope === 'class' ? 'Students' : 'Biggest dues'}
            sub={data.student_scope === 'class' ? 'Most owed first' : 'Across the school'}
          />
          {data.students.length === 0 ? (
            <Note>{data.student_scope === 'class' ? 'No students in this class.' : 'Nobody owes anything.'}</Note>
          ) : (
            data.students.map((r, i) => (
              <LineRow
                key={r.id}
                title={r.name}
                meta={[
                  [r.class, r.section].filter(Boolean).join(' · '),
                  r.admission_no ? `Adm ${r.admission_no}` : null,
                  `${inr(r.collected)} of ${inr(r.billable)} paid`,
                ]
                  .filter(Boolean)
                  .join(' · ')}
                trailing={<Pill text={r.due > 0 ? inr(r.due) : 'Paid'} tone={r.due > 0 ? 'bad' : 'good'} />}
                onPress={() => navigation.navigate('AdminFeeStudent', { id: r.id, name: r.name })}
                isLast={i === data.students.length - 1}
              />
            ))
          )}
        </Card>
      </>
    );
  };

  return (
    <View style={s.root}>
      <DocHeader title="Analytics" onBackPress={() => navigation.goBack()} />
      <View style={s.filters}>
        <ClassPills classes={classes} classId={classId} sectionId={sectionId} onChange={pick} />
      </View>
      {loading && !data ? (
        <DashSkeleton kpis={false} />
      ) : error && !data ? (
        <DashError message={error} onRetry={() => { setLoading(true); load(); }} />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.scroll}
          refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {body()}
        </ScrollView>
      )}
    </View>
  );
};

export default AdminFeeAnalyticsScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  filters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    backgroundColor: theme.colors.card,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  scroll: { flexGrow: 1, paddingBottom: 32 },
  pills: { flexDirection: 'row', gap: 8, paddingTop: 10, paddingBottom: 6 },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
