import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import VectorIcon from '../../components/VectorIcon';
import { Skeleton } from '../../components/Skeleton';
import AppRefreshControl from '../../components/AppRefreshControl';
import { AppAlert } from '../../components/AppDialog';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { DocHeader, DocNoData } from '../more/docUi';
import type { Day } from '../timetable/timetableData';
import { DaySelector, PeriodRow, currentPeriodId, dateForDay, defaultDay, schoolToday } from '../timetable/timetableUi';
import {
  TtSectionWeek,
  deleteTimetable,
  getSectionTimetable,
  timetablePdfUrl,
} from '../../api/adminTimetableApi';
import { confirmDestructive } from './adminFormUi';
import { HeadActions, HeadBtn } from './adminAdmitCardUi';
import { asPeriod, dayNum } from './adminTimetableUi';
import { plural } from './adminStudentsUi';

/**
 * One section's timetable, drawn as the student's Timetable is: the school week
 * as six day pills, then the chosen day's periods — the teacher's face, the
 * time, the subject and who takes it. The header holds the panel card's
 * actions: Download (the week as the panel's PDF grid), Edit and Delete; a
 * section without a timetable has + to add one.
 *
 * Route params: classId, className, sectionId, sectionName.
 */

const AdminTimetableViewScreen = ({ navigation, route }: any) => {
  const { classId, className, sectionId, sectionName } = route?.params ?? {};
  const title = [className, sectionName].filter(Boolean).join(' · ') || 'Timetable';

  const [selectedDay, setSelectedDay] = useState<Day>(defaultDay());
  const [week, setWeek] = useState<TtSectionWeek | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const seq = useRef(0);
  const load = useCallback(async () => {
    const mine = ++seq.current;
    setError(null);
    try {
      const r = await getSectionTimetable(classId, sectionId);
      if (mine === seq.current) setWeek(r);
    } catch (e) {
      if (mine === seq.current) setError(apiErr(e, 'Could not load the timetable.'));
    } finally {
      if (mine === seq.current) setRefreshing(false);
    }
  }, [classId, sectionId]);

  // Back from editing it, the week is fresh.
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const entries = useMemo(() => week?.entries ?? [], [week]);
  const hasTimetable = entries.length > 0;
  const periods = useMemo(
    () => entries.filter(e => e.day === dayNum(selectedDay)).sort((a, b) => a.start_time.localeCompare(b.start_time)),
    [entries, selectedDay],
  );
  const liveId = currentPeriodId(periods.map(asPeriod), selectedDay === schoolToday());

  const params = { classId, className, sectionId, sectionName };
  const addOrEdit = () => navigation.navigate('AdminTimetableForm', { ...params, locked: true });

  const remove = () =>
    confirmDestructive(
      'Delete entire section timetable?',
      'All scheduled entries for this class & section will be removed.',
      'Delete',
      async () => {
        setDeleting(true);
        try {
          await deleteTimetable(classId, sectionId);
          await load();
        } catch (e) {
          AppAlert.alert('Could not delete', apiErr(e, 'Failed to delete.'));
        } finally {
          setDeleting(false);
        }
      },
    );

  const header = (
    <DocHeader
      title={title}
      onBackPress={() => navigation.goBack()}
      rightSlot={
        !week ? undefined : hasTimetable ? (
          <HeadActions>
            <HeadBtn
              icon="download-outline"
              onPress={() =>
                navigation.navigate('AdminTimetablePdf', {
                  title,
                  uri: timetablePdfUrl(classId, sectionId),
                  fileName: `timetable_${title.replace(/[^A-Za-z0-9]+/g, '_')}`,
                })
              }
            />
            <HeadBtn icon="create-outline" onPress={addOrEdit} />
            <HeadBtn icon="trash-outline" onPress={remove} busy={deleting} />
          </HeadActions>
        ) : (
          <HeadBtn icon="add" onPress={addOrEdit} />
        )
      }
    />
  );

  const body = () => {
    if (!week && !error) {
      return (
        <View style={s.list}>
          {[0, 1, 2, 3, 4].map(i => (
            <View key={i} style={[s.skeletonRow, i < 4 && s.rowDivider]}>
              <Skeleton width={44} height={44} radius={22} />
              <Skeleton width={56} height={13} style={s.skeletonTime} />
              <View style={s.skeletonBody}>
                <Skeleton width="55%" height={14} />
                <Skeleton width="35%" height={12} />
              </View>
            </View>
          ))}
        </View>
      );
    }

    if (error && !week) {
      return (
        <View style={s.centeredBox}>
          <VectorIcon iconSet="Ionicons" iconName="cloud-offline-outline" size={32} color={theme.colors.textMuted} />
          <Text style={s.errorText}>{error}</Text>
          <TouchableOpacity onPress={load} hitSlop={10}>
            <Text style={s.linkText}>Try again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.list, periods.length === 0 && s.listEmpty]}
        refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        {!hasTimetable ? (
          <View style={s.emptyWrap}>
            <DocNoData icon="time-outline" title="No timetable yet" subtitle={`Nothing is scheduled for ${title}.`} />
            <TouchableOpacity onPress={addOrEdit} hitSlop={10} style={s.emptyAction}>
              <Text style={s.linkText}>Add timetable</Text>
            </TouchableOpacity>
          </View>
        ) : periods.length === 0 ? (
          <DocNoData icon="time-outline" title="No classes" subtitle={`Nothing is scheduled for ${selectedDay}.`} />
        ) : (
          <>
            <View style={s.dayHead}>
              <Text style={s.dayTitle}>{dateForDay(selectedDay).format('dddd, D MMMM')}</Text>
              <Text style={s.dayCount}>{plural(periods.length, 'period')}</Text>
            </View>
            {periods.map((p, i) => (
              <PeriodRow
                key={p.id}
                period={asPeriod(p)}
                meta={p.teacher}
                avatar={p.teacher_image ?? null}
                avatarName={p.teacher}
                isNow={p.id === liveId}
                isLast={i === periods.length - 1}
              />
            ))}
          </>
        )}
      </ScrollView>
    );
  };

  return (
    <View style={s.root}>
      {header}

      <DaySelector selected={selectedDay} onSelect={setSelectedDay} />
      <View style={s.fullDivider} />

      {body()}
    </View>
  );
};

export default AdminTimetableViewScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  fullDivider: { height: 1, backgroundColor: theme.colors.border },

  list: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 40 },
  listEmpty: { flexGrow: 1 },
  dayHead: { paddingTop: 14, paddingBottom: 6 },
  dayTitle: { fontSize: 15, fontWeight: '600', color: theme.colors.textPrimary },
  dayCount: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: theme.colors.border },

  emptyWrap: { flexGrow: 1 },
  emptyAction: { alignSelf: 'center', marginTop: 14 },

  // Loading
  skeletonRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12 },
  skeletonTime: { marginRight: 6 },
  skeletonBody: { flex: 1, gap: 8 },

  // Error
  centeredBox: { alignItems: 'center', paddingTop: 72, paddingHorizontal: 24, gap: 10 },
  errorText: { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  linkText: { fontSize: 14, fontWeight: '600', color: theme.colors.primary },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
