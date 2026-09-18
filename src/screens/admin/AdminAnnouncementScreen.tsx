import React, { useCallback, useMemo, useRef, useState } from 'react';
import { SectionList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import moment from 'moment';
import VectorIcon from '../../components/VectorIcon';
import { Skeleton } from '../../components/Skeleton';
import { HeaderIconButton } from '../../components/Header';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useRefresh, useFocusLoad } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import {
  AdminAnnouncement,
  AnnouncementStats,
  AnnouncementType,
  ClassOption,
  getAdminAnnouncements,
} from '../../api/adminContentApi';
import { DocHeader, DocNoData } from '../more/docUi';
import {
  BODY,
  DayHeading,
  FilterPills,
  InboxRow,
  InboxRowSkeleton,
  QUIET,
  groupByDay,
  inboxStyles as ui,
  timeLabel,
} from '../notification/inboxUi';
import { DateSheet } from './adminFormUi';

/**
 * The school's announcements, drawn as a student's Announcement list is — a
 * heading per day and a row per announcement with its round icon — with the
 * admin panel's filters over it: the period (all, or the last 7 to 60 days) or
 * one day picked from the calendar in the header, and the audience. The
 * panel's totals sit under the audience. A row opens the announcement, to
 * edit or delete; + posts a new one. Announcements go after 60 days, as on the
 * panel.
 */

const TITLE = 'Announcement';

type PeriodKey = 'all' | '7' | '15' | '30' | '60';

const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: '7', label: '7 Days' },
  { key: '15', label: '15 Days' },
  { key: '30', label: '30 Days' },
  { key: '60', label: '60 Days' },
];

type AudienceKey = 'all' | 'user' | 'teacher';

const AUDIENCES: { key: AudienceKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'user', label: 'Students' },
  { key: 'teacher', label: 'Teachers' },
];

/** Who it went to: "Everyone", "Teachers", "Students · Class 5". */
export const audienceLabel = (a: Pick<AdminAnnouncement, 'type' | 'standard_name'>) => {
  if (a.type === 'teacher') return 'Teachers';
  if (a.type === 'user') return a.standard_name ? `Students · ${a.standard_name}` : 'Students · All classes';
  return 'Everyone';
};

const postedAt = (a: AdminAnnouncement) => (a.created_at ? moment(a.created_at).valueOf() : 0);

// The school's classes, kept from the last load for the form's class picker.
let knownClasses: ClassOption[] = [];
export const lastKnownClasses = () => knownClasses;

// ── Loading ──────────────────────────────────────────────────────────────────
// The page's own shape: the period pills, the audience pills, the totals, a
// day heading and a run of rows.
const ListSkeleton = () => (
  <View>
    <View style={[ui.metaBar, s.filters]}>
      <View style={s.skPills}>
        {[34, 56, 62, 62, 62].map((w, i) => (
          <Skeleton key={i} width={w} height={28} radius={14} />
        ))}
      </View>
    </View>
    <View style={[s.audienceBar, s.skPills]}>
      {[34, 70, 70].map((w, i) => (
        <Skeleton key={i} width={w} height={28} radius={14} />
      ))}
    </View>
    <View style={s.skStats}>
      <Skeleton width={200} height={10} />
    </View>
    <View style={ui.fullDivider} />
    <View style={s.skList}>
      <View style={s.skDayHead}>
        <Skeleton width={64} height={11} />
      </View>
      {Array.from({ length: 6 }, (_, i) => (
        <InboxRowSkeleton key={i} index={i} isLast={i === 5} metaWidth={110} />
      ))}
    </View>
  </View>
);

const AdminAnnouncementScreen = ({ navigation }: any) => {
  const [items, setItems] = useState<AdminAnnouncement[]>([]);
  const [stats, setStats] = useState<AnnouncementStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<PeriodKey>('all');
  const [date, setDate] = useState<string | null>(null);
  const [audience, setAudience] = useState<AudienceKey>('all');
  const [dateOpen, setDateOpen] = useState(false);
  const loadedOnce = useRef(false);

  // The skeleton shows on the first load, a filter change, a pull to refresh
  // and Try again; coming back from an announcement updates the list in place.
  const load = useCallback(
    async (showSkeleton = !loadedOnce.current) => {
      if (showSkeleton) setLoading(true);
      setError(null);
      try {
        const res = await getAdminAnnouncements({
          type: audience === 'all' ? undefined : (audience as AnnouncementType),
          days: period === 'all' ? undefined : Number(period),
          date: date ?? undefined,
        });
        setItems(res.announcements);
        setStats(res.stats);
        knownClasses = res.standards;
        loadedOnce.current = true;
      } catch (e) {
        setError(apiErr(e, 'Could not load announcements.'));
      } finally {
        setLoading(false);
      }
    },
    [audience, period, date],
  );

  const firstRun = useRef(true);
  useFocusLoad(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    load(false);
  });
  // Opening the screen and every filter change load with the skeleton.
  React.useEffect(() => {
    load(true);
  }, [load]);

  const { refreshing, onRefresh } = useRefresh(() => load(true));

  const sections = useMemo(() => groupByDay(items, postedAt), [items]);

  // A picked day stands in for the period, as on the panel.
  const periodOptions = [
    ...PERIODS,
    ...(date ? [{ key: 'date' as const, label: moment(date).format('D MMM YYYY') }] : []),
  ];
  const pickPeriod = (k: PeriodKey | 'date') => {
    if (k === 'date') return;
    setDate(null);
    setPeriod(k);
  };

  const statsLine = stats
    ? `${stats.total} total · ${stats.this_month} this month · ${stats.last_month ?? 0} last month`
    : '';

  return (
    <View style={s.root}>
      <DocHeader
        title={TITLE}
        onBackPress={() =>
          navigation.canGoBack() ? navigation.goBack() : navigation.navigate('PanelHome')
        }
        rightSlot={
          <View style={s.headActions}>
            <HeaderIconButton icon="calendar-outline" onPress={() => setDateOpen(true)} />
            <HeaderIconButton
              icon="add"
              size={22}
              onPress={() => navigation.navigate('AdminAnnouncementForm')}
            />
          </View>
        }
      />

      {loading ? (
        <ListSkeleton />
      ) : error ? (
        <View style={s.centeredBox}>
          <VectorIcon iconSet="Ionicons" iconName="cloud-offline-outline" size={32} color={theme.colors.textMuted} />
          <Text style={s.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => load(true)} hitSlop={10}>
            <Text style={ui.linkText}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {/* Period (or the day picked), then the audience and the totals */}
          <View style={[ui.metaBar, s.filters]}>
            <FilterPills
              compact
              options={periodOptions}
              active={date ? 'date' : period}
              onChange={pickPeriod}
            />
            {!!date && (
              <TouchableOpacity style={s.clearDate} onPress={() => setDate(null)} hitSlop={8}>
                <VectorIcon iconSet="Ionicons" iconName="close-circle" size={16} color={QUIET} />
              </TouchableOpacity>
            )}
          </View>
          <View style={s.audienceBar}>
            <FilterPills compact options={AUDIENCES} active={audience} onChange={setAudience} />
          </View>
          {!!statsLine && <Text style={s.stats}>{statsLine}</Text>}
          <View style={ui.fullDivider} />

          <SectionList
            sections={sections}
            keyExtractor={a => String(a.id)}
            stickySectionHeadersEnabled={false}
            contentContainerStyle={ui.list}
            showsVerticalScrollIndicator={false}
            refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            ListEmptyComponent={
              <DocNoData
                icon="megaphone-outline"
                title="No announcements"
                subtitle={
                  date
                    ? 'Nothing was posted on this day.'
                    : 'Nothing posted for this audience and period. Announcements go after 60 days.'
                }
              />
            }
            renderSectionHeader={({ section }) => <DayHeading title={section.title} />}
            renderItem={({ item, index, section }) => {
              const at = postedAt(item);
              return (
                <InboxRow
                  icon="megaphone"
                  title={item.announcement_name}
                  body={item.announcement_content}
                  kind={audienceLabel(item)}
                  time={at ? timeLabel(at) : undefined}
                  attachment={!!(item.image_url || item.pdf_url)}
                  tinted
                  isLast={index === section.data.length - 1}
                  onPress={() => navigation.navigate('AdminAnnouncementDetail', { item })}
                />
              );
            }}
          />
        </>
      )}

      <DateSheet
        visible={dateOpen}
        value={date}
        title="Announcements of a day"
        maxDate={moment().format('YYYY-MM-DD')}
        onPick={d => setDate(d)}
        onClose={() => setDateOpen(false)}
      />
    </View>
  );
};

export default AdminAnnouncementScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  headActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },

  filters: { paddingBottom: 8, justifyContent: 'flex-start' },
  clearDate: { marginLeft: -4 },
  audienceBar: { paddingHorizontal: 20, paddingBottom: 10 },
  stats: { paddingHorizontal: 20, paddingBottom: 12, fontSize: 12, color: QUIET },

  // Skeleton, at the heights of the real lines
  skPills: { flexDirection: 'row', gap: 6 },
  skStats: { height: 16, paddingHorizontal: 20, marginBottom: 12, justifyContent: 'center' },
  skList: { paddingHorizontal: 20 },
  skDayHead: { height: 38, paddingTop: 18, paddingBottom: 2, justifyContent: 'center' },

  // Error
  centeredBox: { alignItems: 'center', paddingTop: 72, paddingHorizontal: 24, gap: 10 },
  errorText: { fontSize: 14, color: BODY, textAlign: 'center', lineHeight: 20 },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
