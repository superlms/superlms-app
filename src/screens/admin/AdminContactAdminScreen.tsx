import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useFocusLoad } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { SuperAdminContact, SuperAdminContactStats, getSuperAdminContacts } from '../../api/adminContactApi';
import { DocHeader, DocNoData } from '../more/docUi';
import { FilterPills } from '../notification/inboxUi';
import { ErrorState, RowsSkeleton } from './adminExamUi';
import { EnquiryRow } from './AdminEnquiriesScreen';

/**
 * The panel's Contact Admin — the school's messages to the Super Admin —
 * drawn as a student's Queries list is: a row per message led by a round
 * icon, its topic and when, the message and where it stands (pending or
 * replied), and who sent it. The last 7, 15 or 30 days and pending or
 * replied, with their counts, as the panel filters them; newest first. The
 * + in the header writes a new message; a row opens it.
 */

const TITLE = 'Contact Super Admin';

type DaysKey = 'all' | '7' | '15' | '30';
const DAYS: { key: DaysKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: '7', label: '7 Days' },
  { key: '15', label: '15 Days' },
  { key: '30', label: '30 Days' },
];

type StatusKey = 'all' | 'pending' | 'replied';

// A message as the Enquiries row draws a query.
const asRow = (c: SuperAdminContact) => ({
  id: c.id,
  topic: c.topic ?? '',
  query: c.admin_query ?? '',
  image_url: c.image_url,
  admin_text: c.super_admin_text,
  replied: c.replied,
  user_name: c.user_name ?? '',
  user_email: c.user_email,
  replied_at: c.replied_at,
  created_at: c.created_at ?? undefined,
});

const AdminContactAdminScreen = ({ navigation }: any) => {
  const [items, setItems] = useState<SuperAdminContact[]>([]);
  const [stats, setStats] = useState<SuperAdminContactStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState<DaysKey>('all');
  const [status, setStatus] = useState<StatusKey>('all');
  const loadedOnce = useRef(false);

  // The list again — with the skeleton on the first load and a filter change.
  const load = useCallback(
    async (showSkeleton = !loadedOnce.current) => {
      if (showSkeleton) setLoading(true);
      setError(null);
      try {
        const res = await getSuperAdminContacts({
          days: days === 'all' ? undefined : Number(days),
          status: status === 'all' ? undefined : status,
        });
        setItems(res.contacts);
        setStats(res.stats);
        loadedOnce.current = true;
      } catch (e) {
        setError(apiErr(e, 'Could not load your messages.'));
      } finally {
        setLoading(false);
      }
    },
    [days, status],
  );

  useEffect(() => {
    load(true);
  }, [load]);
  // Back from a new message, an edit or a delete: the list as it now is, in place.
  const firstFocus = useRef(true);
  useFocusLoad(() => {
    if (firstFocus.current) {
      firstFocus.current = false;
      return;
    }
    load(false);
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await load(false);
    setRefreshing(false);
  };

  const newMessage = () => navigation.navigate('AdminContactAdminForm');
  const narrowed = days !== 'all' || status !== 'all';

  return (
    <View style={s.root}>
      <DocHeader
        title={TITLE}
        onBackPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('PanelHome'))}
        rightIcon="add"
        onRightPress={newMessage}
      />

      {/* The period, then pending or replied — with the panel's counts */}
      <View style={s.filters}>
        <FilterPills compact options={DAYS} active={days} onChange={setDays} />
      </View>
      <View style={s.filtersNext}>
        <FilterPills
          compact
          options={[
            { key: 'all' as StatusKey, label: 'All', count: stats?.total },
            { key: 'pending' as StatusKey, label: 'Pending', count: stats?.pending },
            { key: 'replied' as StatusKey, label: 'Replied', count: stats?.replied },
          ]}
          active={status}
          onChange={setStatus}
        />
      </View>
      <View style={s.fullDivider} />

      {loading ? (
        <RowsSkeleton lead="icon" />
      ) : error ? (
        <ErrorState message={error} onRetry={() => load(true)} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={c => String(c.id)}
          contentContainerStyle={[s.list, items.length === 0 && s.grow]}
          showsVerticalScrollIndicator={false}
          refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View>
              <DocNoData
                icon="chatbubbles-outline"
                title="No messages found"
                subtitle={narrowed ? 'No message matches these filters.' : 'Messages sent to Super Admin will appear here.'}
              />
              {!narrowed && (
                <TouchableOpacity style={s.emptyAction} onPress={newMessage} hitSlop={10}>
                  <Text style={s.linkText}>Send a message</Text>
                </TouchableOpacity>
              )}
            </View>
          }
          renderItem={({ item, index }) => (
            <EnquiryRow
              item={asRow(item)}
              website={false}
              isLast={index === items.length - 1}
              onPress={() => navigation.navigate('AdminContactAdminDetail', { item })}
            />
          )}
        />
      )}
    </View>
  );
};

export default AdminContactAdminScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  filters: { paddingHorizontal: 20, paddingTop: 12 },
  filtersNext: { paddingHorizontal: 20, paddingTop: 8 },
  fullDivider: { height: 1, backgroundColor: theme.colors.border, marginTop: 12 },
  list: { paddingHorizontal: 20, paddingBottom: 30 },
  grow: { flexGrow: 1 },
  emptyAction: { alignSelf: 'center', marginTop: 16 },
  linkText: { fontSize: 14, fontWeight: '600', color: theme.colors.primary },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
