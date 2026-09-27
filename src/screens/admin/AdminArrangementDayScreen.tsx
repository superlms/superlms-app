import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import moment from 'moment';
import VectorIcon from '../../components/VectorIcon';
import AppRefreshControl from '../../components/AppRefreshControl';
import { Skeleton } from '../../components/Skeleton';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { DocHeader, DocNoData } from '../more/docUi';
import { MonthBar } from '../calendar/calendarUi';
import {
  ArrangementResult,
  ArrangementSlot,
  ArrangementTeacher,
  getArrangementDay,
} from '../../api/adminArrangementApi';
import { ErrorState, FilterBar, FilterChip } from './adminExamUi';
import { DateSheet, OptionSheet } from './adminFormUi';
import { slotClassLine, slotTimeLine } from './adminArrangementUi';

/**
 * Arrangement — the panel's Teacher Arrangements, drawn as the student app
 * draws a day. A day (arrows, or the date for a calendar) and a class to
 * narrow to; the panel's counts (teachers, absent, available, arranged); then
 * each teacher marked absent that day, as the panel lists them: how many of
 * their periods are covered, pending or fully covered, and who covered them;
 * then their periods, one row each — the period (P5), the time, the class and
 * subject, and who covers it or that nobody does yet. A period opens its page,
 * where a substitute is assigned, changed or taken off. A teacher with no
 * periods that day says so.
 */

const todayKey = () => moment().format('YYYY-MM-DD');

// "Mon, 28 Sep 2026", "Today, 27 Sep"
const dayLabel = (key: string) => {
  const d = moment(key, 'YYYY-MM-DD');
  const diff = d.diff(moment().startOf('day'), 'days');
  if (diff === 0) return `Today, ${d.format('D MMM')}`;
  if (diff === -1) return `Yesterday, ${d.format('D MMM')}`;
  if (diff === 1) return `Tomorrow, ${d.format('D MMM')}`;
  return d.format('ddd, D MMM YYYY');
};

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

// Who took this teacher's periods, and how many each.
const coveredBy = (t: ArrangementTeacher) => {
  const counts = new Map<string, number>();
  t.slots.forEach(s => {
    const name = s.arrangement?.substitute_name;
    if (name) counts.set(name, (counts.get(name) ?? 0) + 1);
  });
  return [...counts.entries()].map(([name, n]) => `${name} · ${plural(n, 'period')}`).join(', ');
};

const AdminArrangementDayScreen = ({ navigation }: any) => {
  const [date, setDate] = useState(todayKey);
  const [classId, setClassId] = useState<number | null>(null);
  const [data, setData] = useState<ArrangementResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [sheet, setSheet] = useState<'class' | 'date' | null>(null);
  // The classes, kept from the first answer so the pill works while a day loads.
  const [classes, setClasses] = useState<{ id: number; name: string }[]>([]);

  const seq = useRef(0);
  const load = useCallback(async () => {
    const mine = ++seq.current;
    setError(null);
    try {
      const r = await getArrangementDay(date, classId);
      if (mine !== seq.current) return;
      setData(r);
      if (r.classes?.length) setClasses(r.classes);
    } catch (e) {
      if (mine === seq.current) setError(apiErr(e, 'Could not load arrangements.'));
    } finally {
      if (mine === seq.current) setRefreshing(false);
    }
  }, [date, classId]);

  // A new day or class shows the skeleton and asks again.
  useEffect(() => {
    setData(null);
    load();
  }, [load]);

  // Back from a period (assigned, changed or taken off), the day is fresh.
  const loadRef = useRef(load);
  loadRef.current = load;
  const focusedOnce = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (!focusedOnce.current) {
        focusedOnce.current = true;
        return;
      }
      loadRef.current();
    }, []),
  );

  const shift = (days: number) => setDate(d => moment(d, 'YYYY-MM-DD').add(days, 'days').format('YYYY-MM-DD'));
  const cls = classes.find(c => c.id === classId) ?? null;
  const isToday = date === todayKey();
  const dayName = data?.day_name || moment(date, 'YYYY-MM-DD').format('dddd');

  const openSlot = (t: ArrangementTeacher, slot: ArrangementSlot, i: number) =>
    navigation.navigate('AdminArrangementSlot', { date, teacherName: t.teacher_name, slot: { ...slot, period: slot.period ?? i + 1 } });

  const teacherBlock = (t: ArrangementTeacher, idx: number, count: number) => {
    const total = t.slots.length;
    const covered = t.slots.filter(s => !!s.arrangement).length;
    const pending = total - covered;
    const cover = coveredBy(t);
    return (
      <View key={t.teacher_id} style={[s.teacher, idx < count - 1 && s.teacherDivider]}>
        <View style={s.teacherHead}>
          <View style={s.initial}>
            <Text style={s.initialText}>{(t.teacher_name || 'T').charAt(0).toUpperCase()}</Text>
          </View>
          <View style={s.teacherText}>
            <Text style={s.teacherName} numberOfLines={1}>{t.teacher_name}</Text>
            <Text style={s.teacherLine}>
              {isToday ? 'Absent today' : 'Absent'}
              {total > 0 ? (
                <Text style={s.accent}>{` · ${covered} of ${plural(total, 'period')} covered`}</Text>
              ) : (
                ' · no periods scheduled'
              )}
            </Text>
          </View>
          {pending > 0 ? (
            <Text style={[s.tag, s.tagPending]}>{pending} pending</Text>
          ) : total > 0 ? (
            <Text style={[s.tag, s.tagDone]}>Fully covered</Text>
          ) : null}
        </View>

        {!!cover && (
          <Text style={s.cover}>
            <Text style={s.coverLabel}>Covered by: </Text>
            {cover}
          </Text>
        )}

        {total === 0 ? (
          <Text style={s.none}>No classes scheduled for this teacher on {dayName}.</Text>
        ) : (
          t.slots.map((slot, i) => {
            const arr = slot.arrangement;
            const free = slot.available_substitutes?.length ?? 0;
            return (
              <TouchableOpacity key={slot.slot_id} style={s.slot} activeOpacity={0.6} onPress={() => openSlot(t, slot, i)}>
                <View style={s.slotBody}>
                  <Text style={s.slotTime}>{slotTimeLine(slot, i + 1)}</Text>
                  <Text style={s.slotClass} numberOfLines={1}>{slotClassLine(slot)}</Text>
                  {arr ? (
                    <View style={s.status}>
                      <VectorIcon iconSet="Ionicons" iconName="checkmark-circle" size={14} color={DONE} />
                      <Text style={[s.statusText, s.statusDone]} numberOfLines={1}>
                        {arr.substitute_name}
                        {arr.reason?.trim() ? <Text style={s.remark}>{`  ·  ${arr.reason.trim()}`}</Text> : null}
                      </Text>
                    </View>
                  ) : (
                    <View style={s.status}>
                      <VectorIcon iconSet="Ionicons" iconName="alert-circle-outline" size={14} color={PENDING} />
                      <Text style={[s.statusText, s.statusPending]}>
                        Not covered{free > 0 ? ` · ${free} free then` : ' · none available'}
                      </Text>
                    </View>
                  )}
                </View>
                <VectorIcon iconSet="Ionicons" iconName="chevron-forward" size={14} color={theme.colors.textMuted} />
              </TouchableOpacity>
            );
          })
        )}
      </View>
    );
  };

  let body: React.ReactNode;
  if (!data && error) {
    body = <ErrorState message={error} onRetry={load} />;
  } else if (!data) {
    body = (
      <View style={s.list}>
        <View style={s.skCount}>
          <Skeleton width="70%" height={11} />
        </View>
        {[0, 1].map(i => (
          <View key={i} style={[s.teacher, s.teacherDivider]}>
            <View style={s.teacherHead}>
              <Skeleton width={38} height={38} radius={19} />
              <View style={s.skText}>
                <Skeleton width="48%" height={14} />
                <Skeleton width="62%" height={11} />
              </View>
            </View>
            {[0, 1, 2].map(j => (
              <View key={j} style={[s.slot, s.skText]}>
                <Skeleton width="44%" height={12} />
                <Skeleton width="36%" height={11} />
                <Skeleton width="52%" height={11} />
              </View>
            ))}
          </View>
        ))}
      </View>
    );
  } else {
    const st = data.stats;
    body = (
      <ScrollView
        style={s.fill}
        contentContainerStyle={[s.list, data.teachers.length === 0 && s.grow]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <AppRefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
          />
        }
      >
        {/* The panel's Total · Absent · Available · Arranged */}
        <Text style={s.count}>
          {`${plural(st.total_teachers, 'teacher')} · `}
          <Text style={s.countAbsent}>{st.absent} absent</Text>
          {` · ${st.available} available · `}
          <Text style={s.accent}>{st.arrangements} arranged</Text>
        </Text>

        {data.teachers.length === 0 ? (
          <DocNoData
            icon="checkmark-done-outline"
            title="No teachers marked absent for this date."
            subtitle="Mark attendance to begin arranging substitutes."
          />
        ) : (
          data.teachers.map((t, i) => teacherBlock(t, i, data.teachers.length))
        )}
      </ScrollView>
    );
  }

  return (
    <View style={s.root}>
      <DocHeader
        title="Arrangement"
        onBackPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('PanelHome'))}
      />

      <MonthBar label={dayLabel(date)} onPrev={() => shift(-1)} onNext={() => shift(1)} onPressLabel={() => setSheet('date')} />

      <FilterBar onClear={classId || !isToday ? () => { setClassId(null); setDate(todayKey()); } : undefined}>
        <FilterChip label={cls?.name ?? 'All Classes'} active={!!cls} disabled={classes.length === 0} onPress={() => setSheet('class')} />
      </FilterBar>
      <View style={s.fullDivider} />

      {body}

      <OptionSheet
        visible={sheet === 'class'}
        title="Class"
        options={[{ key: '', label: 'All Classes' }, ...classes.map(c => ({ key: String(c.id), label: c.name }))]}
        selected={[String(classId ?? '')]}
        onPick={k => setClassId(k ? Number(k) : null)}
        onClose={() => setSheet(null)}
      />
      <DateSheet visible={sheet === 'date'} value={date} onPick={setDate} onClose={() => setSheet(null)} title="Arrangements for" />
    </View>
  );
};

export default AdminArrangementDayScreen;

// Covered in green, pending in the panel's amber.
const DONE = '#16A34A';
const PENDING = '#D97706';

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  fill: { flex: 1 },
  grow: { flexGrow: 1 },
  fullDivider: { height: 1, backgroundColor: theme.colors.border, marginTop: 12 },
  list: { paddingHorizontal: 20, paddingBottom: 40 },
  count: { fontSize: 12, color: theme.colors.textMuted, paddingTop: 12, paddingBottom: 2 },
  countAbsent: { color: theme.colors.danger },
  accent: { color: theme.colors.primary },

  // An absent teacher
  teacher: { paddingTop: 16, paddingBottom: 8 },
  teacherDivider: { borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  teacherHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  initial: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialText: { fontSize: 15, fontWeight: '700', color: '#DC2626' },
  teacherText: { flex: 1 },
  teacherName: { fontSize: 15, fontWeight: '600', color: theme.colors.textPrimary },
  teacherLine: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
  tag: { fontSize: 11, fontWeight: '600', paddingHorizontal: 8, paddingVertical: 3, borderRadius: theme.radius.full, overflow: 'hidden' },
  tagPending: { color: '#B45309', backgroundColor: '#FEF3C7' },
  tagDone: { color: '#15803D', backgroundColor: '#DCFCE7' },
  cover: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 10, lineHeight: 17 },
  coverLabel: { fontWeight: '600', color: theme.colors.textPrimary },
  none: { fontSize: 13, color: theme.colors.textMuted, paddingVertical: 12 },

  // A period
  slot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    marginLeft: 50,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
    marginTop: 8,
  },
  slotBody: { flex: 1, gap: 2 },
  slotTime: { fontSize: 12, fontWeight: '600', color: theme.colors.primary },
  slotClass: { fontSize: 14, fontWeight: '500', color: theme.colors.textPrimary },
  status: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  statusText: { flexShrink: 1, fontSize: 12, fontWeight: '500' },
  statusDone: { color: DONE },
  statusPending: { color: PENDING },
  remark: { fontWeight: '400', color: theme.colors.textMuted },

  // Loading
  skCount: { paddingTop: 14, paddingBottom: 4 },
  skText: { flex: 1, gap: 7 },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
