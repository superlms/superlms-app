import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import VectorIcon from '../../components/VectorIcon';
import { Skeleton } from '../../components/Skeleton';
import AppRefreshControl from '../../components/AppRefreshControl';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { DocHeader, DocNoData } from '../more/docUi';
import type { Day } from '../timetable/timetableData';
import { DaySelector, PeriodRow, currentPeriodId, dateForDay, defaultDay, schoolToday } from '../timetable/timetableUi';
import { SectionCard, getTimetable, teacherTimetablePdfUrl } from '../../api/adminTimetableApi';
import { HeadBtn } from './adminAdmitCardUi';
import { asPeriod, dayNum } from './adminTimetableUi';
import { plural } from './adminStudentsUi';

/**
 * One teacher's week — the panel's Teacher View — drawn as the teacher's own
 * Timetable is: six day pills, then the chosen day's periods with the time, the
 * subject and the class and section. Download gives the panel's PDF of it.
 *
 * Route params: teacherId, teacherName.
 */

interface Slot {
  id: number;
  day: number;
  start_time: string;
  end_time: string;
  subject: string;
  where: string;
}

// The panel's cards (class · section → subject rows with their days), one period per day.
const slotsOf = (cards: SectionCard[]): Slot[] => {
  const out: Slot[] = [];
  let id = 1;
  cards.forEach(c => {
    const where = [c.standard, c.section].filter(Boolean).join(' · ');
    c.subject_groups.forEach(g => {
      g.days.forEach(d => {
        out.push({ id: id++, day: d, start_time: g.start_time, end_time: g.end_time, subject: g.subject, where });
      });
    });
  });
  return out;
};

const AdminTimetableTeacherScreen = ({ navigation, route }: any) => {
  const teacherId: number = route?.params?.teacherId;
  const teacherName: string = route?.params?.teacherName ?? 'Teacher';

  const [selectedDay, setSelectedDay] = useState<Day>(defaultDay());
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const seq = useRef(0);
  const load = useCallback(async () => {
    const mine = ++seq.current;
    setError(null);
    try {
      const r = await getTimetable({ view: 'teacher', teacher_id: teacherId });
      if (mine === seq.current) setSlots(slotsOf(r.cards ?? []));
    } catch (e) {
      if (mine === seq.current) setError(apiErr(e, 'Could not load the timetable.'));
    } finally {
      if (mine === seq.current) setRefreshing(false);
    }
  }, [teacherId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const all = useMemo(() => slots ?? [], [slots]);
  const periods = useMemo(
    () => all.filter(x => x.day === dayNum(selectedDay)).sort((a, b) => a.start_time.localeCompare(b.start_time)),
    [all, selectedDay],
  );
  const liveId = currentPeriodId(periods.map(asPeriod), selectedDay === schoolToday());

  return (
    <View style={s.root}>
      <DocHeader
        title={teacherName}
        onBackPress={() => navigation.goBack()}
        rightSlot={
          all.length > 0 ? (
            <HeadBtn
              icon="download-outline"
              onPress={() =>
                navigation.navigate('AdminTimetablePdf', {
                  title: teacherName,
                  uri: teacherTimetablePdfUrl(teacherId),
                  fileName: `timetable_${teacherName.replace(/[^A-Za-z0-9]+/g, '_')}`,
                })
              }
            />
          ) : undefined
        }
      />

      <DaySelector selected={selectedDay} onSelect={setSelectedDay} />
      <View style={s.fullDivider} />

      {!slots && !error ? (
        <View style={s.list}>
          {[0, 1, 2, 3, 4].map(i => (
            <View key={i} style={[s.skeletonRow, i < 4 && s.rowDivider]}>
              <Skeleton width={56} height={13} style={s.skeletonTime} />
              <View style={s.skeletonBody}>
                <Skeleton width="55%" height={14} />
                <Skeleton width="35%" height={12} />
              </View>
            </View>
          ))}
        </View>
      ) : error && !slots ? (
        <View style={s.centeredBox}>
          <VectorIcon iconSet="Ionicons" iconName="cloud-offline-outline" size={32} color={theme.colors.textMuted} />
          <Text style={s.errorText}>{error}</Text>
          <TouchableOpacity onPress={load} hitSlop={10}>
            <Text style={s.linkText}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[s.list, periods.length === 0 && s.listEmpty]}
          refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        >
          {all.length === 0 ? (
            <DocNoData icon="time-outline" title="No periods yet" subtitle={`${teacherName} has no classes in the timetable.`} />
          ) : periods.length === 0 ? (
            <DocNoData icon="time-outline" title="No classes" subtitle={`Not teaching on ${selectedDay}.`} />
          ) : (
            <>
              <View style={s.dayHead}>
                <Text style={s.dayTitle}>{dateForDay(selectedDay).format('dddd, D MMMM')}</Text>
                <Text style={s.dayCount}>{plural(periods.length, 'class', 'classes')}</Text>
              </View>
              {periods.map((p, i) => (
                <PeriodRow
                  key={p.id}
                  period={asPeriod(p)}
                  meta={p.where}
                  isNow={p.id === liveId}
                  isLast={i === periods.length - 1}
                />
              ))}
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
};

export default AdminTimetableTeacherScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  fullDivider: { height: 1, backgroundColor: theme.colors.border },

  list: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 40 },
  listEmpty: { flexGrow: 1 },
  dayHead: { paddingTop: 14, paddingBottom: 6 },
  dayTitle: { fontSize: 15, fontWeight: '600', color: theme.colors.textPrimary },
  dayCount: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: theme.colors.border },

  skeletonRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12 },
  skeletonTime: { marginRight: 6 },
  skeletonBody: { flex: 1, gap: 8 },

  centeredBox: { alignItems: 'center', paddingTop: 72, paddingHorizontal: 24, gap: 10 },
  errorText: { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  linkText: { fontSize: 14, fontWeight: '600', color: theme.colors.primary },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
