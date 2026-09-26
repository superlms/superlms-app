import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import moment from 'moment';
import VectorIcon from '../../components/VectorIcon';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useFocusLoad } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { AdminEnquiry, EnquiryStats, EnquiryTab, getAdminEnquiries } from '../../api/adminContentApi';
import { DocHeader, DocNoData } from '../more/docUi';
import { FilterPills } from '../notification/inboxUi';
import { ErrorState, RowsSkeleton, SearchField, UnderlineTabs } from './adminExamUi';

/**
 * The panel's Enquiries, drawn as a student's Queries list is — a row per
 * query led by a round icon, its topic and when, the query and where it
 * stands — with the sender under it. Three tabs, as on the panel: students'
 * and teachers' Contact School queries, and what the school's website sent
 * (which takes no reply). A search over topic, query, name and email, the last
 * 7, 15 or 30 days, and — for students' and teachers' — pending or replied,
 * with their counts. Newest first, ten at a time as the list scrolls. A row
 * opens the enquiry.
 *
 * Route params: tab – the tab to open on (students', as on the panel).
 */

const TITLE = 'Enquiries';

const TABS: { key: EnquiryTab; label: string }[] = [
  { key: 'student', label: 'Students' },
  { key: 'teacher', label: 'Teachers' },
  { key: 'website', label: 'Website' },
];

type DaysKey = 'all' | '7' | '15' | '30';
const DAYS: { key: DaysKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: '7', label: '7 Days' },
  { key: '15', label: '15 Days' },
  { key: '30', label: '30 Days' },
];

type StatusKey = 'all' | 'pending' | 'replied';

const PENDING = '#F59E0B';
const REPLIED = '#10B981';

// "Today" or "3d ago", as on a student's Queries.
const ago = (iso?: string) => {
  if (!iso) return '';
  const n = moment().startOf('day').diff(moment(iso).startOf('day'), 'days');
  return n <= 0 ? 'Today' : `${n}d ago`;
};

// ── One enquiry ──────────────────────────────────────────────────────────────
//   (💬)  Fee receipt for September .................. 2d ago
//         I paid the fee online but have not ...... ● Pending
//         Aarav Sharma · aarav@school.in                   📎
export const EnquiryRow = ({
  item,
  website,
  isLast,
  onPress,
}: {
  item: AdminEnquiry;
  website: boolean;
  isLast: boolean;
  onPress: () => void;
}) => {
  const color = item.replied ? REPLIED : PENDING;
  const from = [item.user_name, website ? item.phone || item.user_email : item.user_email].filter(Boolean).join(' · ');
  return (
    <TouchableOpacity style={[s.row, !isLast && s.divider]} activeOpacity={0.6} onPress={onPress}>
      <View style={s.lead}>
        <VectorIcon
          iconSet="Ionicons"
          iconName={website ? 'globe-outline' : 'chatbubble-ellipses-outline'}
          size={17}
          color={theme.colors.textSecondary}
        />
      </View>
      <View style={s.body}>
        <View style={s.line}>
          <Text style={s.subject} numberOfLines={1}>
            {item.topic || (website ? 'No subject' : 'No topic')}
          </Text>
          <Text style={s.time}>{ago(item.created_at)}</Text>
        </View>
        <View style={s.line}>
          <Text style={s.preview} numberOfLines={1}>
            {item.query || '—'}
          </Text>
          {!website && (
            <View style={s.status}>
              <View style={[s.dot, { backgroundColor: color }]} />
              <Text style={[s.statusText, { color }]}>{item.replied ? 'Replied' : 'Pending'}</Text>
            </View>
          )}
        </View>
        <View style={s.line}>
          <Text style={s.from} numberOfLines={1}>
            {from}
          </Text>
          {!!item.image_url && <VectorIcon iconSet="Feather" iconName="paperclip" size={11} color={theme.colors.textMuted} />}
        </View>
      </View>
    </TouchableOpacity>
  );
};

const AdminEnquiriesScreen = ({ navigation, route }: any) => {
  const [tab, setTab] = useState<EnquiryTab>(route?.params?.tab ?? 'student');
  const [items, setItems] = useState<AdminEnquiry[]>([]);
  const [stats, setStats] = useState<EnquiryStats | null>(null);
  const [totals, setTotals] = useState<{ teacher: number; student: number; website?: number } | null>(null);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [days, setDays] = useState<DaysKey>('all');
  const [status, setStatus] = useState<StatusKey>('all');
  const loadedOnce = useRef(false);
  const website = tab === 'website';

  // The panel searches as it is typed, a moment after the last key.
  useEffect(() => {
    const t = setTimeout(() => setSearch(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  const fetchPage = useCallback(
    (p: number) =>
      getAdminEnquiries({
        tab,
        search: search || undefined,
        days: days === 'all' ? undefined : Number(days),
        status: website || status === 'all' ? undefined : status,
        page: p,
      }),
    [tab, search, days, status, website],
  );

  // The first page again — with the skeleton on a tab or filter change.
  const load = useCallback(
    async (showSkeleton = !loadedOnce.current) => {
      if (showSkeleton) setLoading(true);
      setError(null);
      try {
        const res = await fetchPage(1);
        setItems(res.enquiries);
        setStats(res.stats);
        setTotals(res.tab_totals);
        setPage(1);
        setLastPage(res.pagination?.last_page ?? 1);
        loadedOnce.current = true;
      } catch (e) {
        setError(apiErr(e, 'Could not load enquiries.'));
      } finally {
        setLoading(false);
      }
    },
    [fetchPage],
  );

  useEffect(() => {
    load(true);
  }, [load]);
  // Back from a reply or a delete: the list as it now is, in place.
  const firstFocus = useRef(true);
  useFocusLoad(() => {
    if (firstFocus.current) {
      firstFocus.current = false;
      return;
    }
    load(false);
  });

  const loadMore = async () => {
    if (loading || loadingMore || page >= lastPage) return;
    setLoadingMore(true);
    try {
      const res = await fetchPage(page + 1);
      setItems(prev => [...prev, ...res.enquiries.filter(e => !prev.some(x => x.id === e.id))]);
      setPage(page + 1);
      setLastPage(res.pagination?.last_page ?? page + 1);
    } catch {
      // A scroll to the end tries again.
    } finally {
      setLoadingMore(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await load(false);
    setRefreshing(false);
  };

  const pickTab = (t: EnquiryTab) => {
    if (t === tab) return;
    setTab(t);
    setItems([]);
  };

  const narrowed = !!(search || days !== 'all' || (!website && status !== 'all'));

  return (
    <View style={s.root}>
      <DocHeader
        title={TITLE}
        onBackPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('PanelHome'))}
      />

      <UnderlineTabs
        tabs={TABS.map(t => ({ ...t, count: totals ? (totals as any)[t.key] ?? 0 : undefined }))}
        active={tab}
        onChange={pickTab}
      />

      <SearchField value={query} onChangeText={setQuery} placeholder="Search topic, query, name, email" />

      {/* The period, then — where there are replies — pending or replied */}
      <View style={s.filters}>
        <FilterPills compact options={DAYS} active={days} onChange={setDays} />
      </View>
      {!website && (
        <View style={s.filtersNext}>
          <FilterPills
            compact
            options={[
              { key: 'all' as StatusKey, label: 'All' },
              { key: 'pending' as StatusKey, label: 'Pending', count: stats?.pending },
              { key: 'replied' as StatusKey, label: 'Replied', count: stats?.replied },
            ]}
            active={status}
            onChange={setStatus}
          />
        </View>
      )}
      <View style={s.fullDivider} />

      {loading ? (
        <RowsSkeleton lead="icon" />
      ) : error ? (
        <ErrorState message={error} onRetry={() => load(true)} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={e => String(e.id)}
          contentContainerStyle={[s.list, items.length === 0 && s.grow]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          onEndReachedThreshold={0.4}
          onEndReached={loadMore}
          ListEmptyComponent={
            <DocNoData
              icon={website ? 'globe-outline' : 'chatbubbles-outline'}
              title="No enquiries found"
              subtitle={
                narrowed
                  ? 'No enquiry matches these filters.'
                  : `${TABS.find(t => t.key === tab)!.label.replace(/s$/, '')} enquiries will appear here.`
              }
            />
          }
          ListFooterComponent={
            loadingMore ? <ActivityIndicator style={s.more} color={theme.colors.primary} /> : null
          }
          renderItem={({ item, index }) => (
            <EnquiryRow
              item={item}
              website={website}
              isLast={index === items.length - 1}
              onPress={() => navigation.navigate('AdminEnquiryDetail', { tab, enquiry: item })}
            />
          )}
        />
      )}
    </View>
  );
};

export default AdminEnquiriesScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  filters: { paddingHorizontal: 20, paddingTop: 12 },
  filtersNext: { paddingHorizontal: 20, paddingTop: 8 },
  fullDivider: { height: 1, backgroundColor: theme.colors.border, marginTop: 12 },
  list: { paddingHorizontal: 20, paddingBottom: 30 },
  grow: { flexGrow: 1 },
  more: { paddingVertical: 16 },

  // Row — as a student's query
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  divider: { borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  lead: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
  },
  body: { flex: 1, gap: 4 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  subject: { flex: 1, fontSize: 15, fontWeight: '500', color: theme.colors.textPrimary },
  time: { fontSize: 12, color: theme.colors.textMuted },
  preview: { flex: 1, fontSize: 13, color: theme.colors.textSecondary },
  status: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 12, fontWeight: '500' },
  from: { flex: 1, fontSize: 12, color: theme.colors.textMuted },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
