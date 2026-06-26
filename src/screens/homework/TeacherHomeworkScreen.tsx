import React, { useCallback, useMemo, useRef, useState } from 'react';
import ScreenSkeleton from '../../components/Skeleton';
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Header from '../../components/Header';
import VectorIcon from '../../components/VectorIcon';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useRefresh } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';
import {
  getTeacherHomework,
  deleteHomework,
  homeworkSubjectVisual,
  homeworkErrorMessage,
  type HomeworkItem,
} from '../../api/homeworkApi';
import { getTeacherClassesSubjects } from '../../api/marksApi';

const PRIMARY = theme.colors.primary;
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const toKey = (d: Date) => d.toISOString().slice(0, 10);
const buildDays = (): Date[] => {
  const days: Date[] = [];
  const today = new Date();
  for (let i = -14; i <= 0; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    days.push(d);
  }
  return days;
};

const HomeworkCard = ({ hw, onOpenFile, onDelete }: {
  hw: HomeworkItem;
  onOpenFile: (hw: HomeworkItem) => void;
  onDelete: (hw: HomeworkItem) => void;
}) => {
  const v = homeworkSubjectVisual(hw.subject?.name ?? '');
  return (
    <View style={s.hwCard}>
      <View style={[s.hwAccent, { backgroundColor: v.color }]} />
      <View style={s.hwBody}>
        <View style={s.hwTop}>
          <View style={[s.hwIcon, { backgroundColor: v.bg }]}>
            <Text style={{ fontSize: 18 }}>{v.icon}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.hwTitle} numberOfLines={2}>{hw.title}</Text>
            <Text style={s.hwSubject} numberOfLines={1}>
              {hw.subject?.name ?? 'Subject'} · {hw.standard ?? ''} {hw.section ?? ''}
            </Text>
          </View>
          <TouchableOpacity onPress={() => onDelete(hw)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <VectorIcon iconSet="Ionicons" iconName="trash-outline" size={18} color={theme.colors.danger} />
          </TouchableOpacity>
        </View>

        {!!hw.description && <Text style={s.hwDesc} numberOfLines={3}>{hw.description}</Text>}

        <View style={s.hwFooter}>
          <View style={s.hwMeta}>
            <VectorIcon iconSet="Ionicons" iconName="time-outline" size={12} color={theme.colors.textMuted} />
            <Text style={s.hwMetaText}>{hw.assigned_time ?? ''}</Text>
          </View>
          {!!hw.file_url && (
            <TouchableOpacity style={s.fileChip} onPress={() => onOpenFile(hw)} activeOpacity={0.8}>
              <VectorIcon
                iconSet="Ionicons"
                iconName={hw.file_type === 'image' ? 'image-outline' : 'document-text-outline'}
                size={13}
                color={PRIMARY}
              />
              <Text style={s.fileChipText}>Attachment</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
};

const TeacherHomeworkScreen = ({ navigation }: any) => {
  const days = buildDays();
  const todayKey = toKey(new Date());
  const stripRef = useRef<ScrollView>(null);

  const [selectedKey, setSelectedKey] = useState(todayKey);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<HomeworkItem[]>([]);
  const [noSubjects, setNoSubjects] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [res, subs] = await Promise.all([
        getTeacherHomework(15),
        getTeacherClassesSubjects().catch(() => []),
      ]);
      setItems(res?.homeworks ?? []);
      setNoSubjects((subs?.length ?? 0) === 0);
    } catch (e: any) {
      console.log('[getTeacherHomework] Error:', e?.response?.status, e?.message);
      setError(homeworkErrorMessage(e));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const { refreshing, onRefresh } = useRefresh(load);

  // Refetch whenever the screen gains focus (e.g. returning from Add).
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const datesWithHw = useMemo(() => new Set(items.map(h => h.assigned_date)), [items]);
  const dayItems = useMemo(
    () => items.filter(h => h.assigned_date === selectedKey),
    [items, selectedKey],
  );

  const selectedDate = new Date(selectedKey + 'T00:00:00');
  const listTitle =
    selectedKey === todayKey
      ? "Today's Homework"
      : `Homework · ${selectedDate.getDate()} ${MONTH_NAMES[selectedDate.getMonth()]}`;

  const openFile = async (hw: HomeworkItem) => {
    if (!hw.file_url) return;
    try {
      await Linking.openURL(hw.file_url);
    } catch {
      Alert.alert('Error', 'Unable to open this attachment.');
    }
  };

  const confirmDelete = (hw: HomeworkItem) => {
    Alert.alert('Delete homework', `Remove "${hw.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteHomework(hw.id);
            setItems(prev => prev.filter(h => h.id !== hw.id));
          } catch (e: any) {
            Alert.alert('Error', homeworkErrorMessage(e));
          }
        },
      },
    ]);
  };

  return (
    <View style={s.root}>
      <Header title="Homework" onBackPress={() => navigation.goBack()} />

      {noSubjects && !loading && !error ? (
        <ScrollView
          contentContainerStyle={s.noSubjScroll}
          showsVerticalScrollIndicator={false}
          refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <View style={s.emptyRing}>
            <VectorIcon iconSet="Ionicons" iconName="book-outline" size={36} color={PRIMARY} />
          </View>
          <Text style={s.bigEmptyTitle}>No subject assigned</Text>
          <Text style={s.bigEmptySub}>
            No classes or subjects are assigned to you in the timetable yet.
          </Text>
        </ScrollView>
      ) : (
      <>

      {/* Date strip */}
      <View style={s.dateStripWrap}>
        <View style={s.stripHeader}>
          <Text style={s.monthLabel}>
            {MONTH_NAMES[selectedDate.getMonth()]} {selectedDate.getFullYear()}
          </Text>
          <Text style={s.stripHint}>Last 15 days</Text>
        </View>
        <ScrollView
          ref={stripRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.dateStrip}
          onContentSizeChange={() => stripRef.current?.scrollToEnd({ animated: false })}
        >
          {days.map(d => {
            const key = toKey(d);
            const active = key === selectedKey;
            const isToday = key === todayKey;
            const hasHW = datesWithHw.has(key);
            return (
              <TouchableOpacity
                key={key}
                style={[s.dateCell, active && s.dateCellActive]}
                onPress={() => setSelectedKey(key)}
                activeOpacity={0.8}
              >
                <Text style={[s.dateDayName, active && s.dateTextActive]}>
                  {isToday ? 'Today' : DAY_NAMES[d.getDay()]}
                </Text>
                <Text style={[s.dateNum, active && s.dateNumActive]}>{d.getDate()}</Text>
                <Text style={[s.dateMonth, active && s.dateTextActive]}>{MONTH_NAMES[d.getMonth()]}</Text>
                {hasHW && <View style={[s.hwDot, active && s.hwDotActive]} />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {loading ? (
        <View style={s.center}>
          <ScreenSkeleton variant="list" />
        </View>
      ) : error ? (
        <View style={s.center}>
          <VectorIcon iconSet="Ionicons" iconName="cloud-offline-outline" size={40} color={theme.colors.danger} />
          <Text style={s.errorText}>{error}</Text>
          <TouchableOpacity style={s.retryBtn} onPress={load} activeOpacity={0.85}>
            <Text style={s.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          <View style={s.listHeader}>
            <Text style={s.listTitle}>{listTitle}</Text>
            <View style={s.countBadge}>
              <Text style={s.countText}>
                {dayItems.length} task{dayItems.length !== 1 ? 's' : ''}
              </Text>
            </View>
          </View>

          {dayItems.length === 0 ? (
            <View style={s.empty}>
              <VectorIcon iconSet="Ionicons" iconName="document-text-outline" size={48} color={theme.colors.textMuted} />
              <Text style={s.emptyTitle}>No homework</Text>
              <Text style={s.emptySubtitle}>
                {selectedKey === todayKey
                  ? 'Tap + to add today’s homework.'
                  : 'Nothing was assigned on this day.'}
              </Text>
            </View>
          ) : (
            dayItems.map(hw => (
              <HomeworkCard key={hw.id} hw={hw} onOpenFile={openFile} onDelete={confirmDelete} />
            ))
          )}

          <View style={{ height: 90 }} />
        </ScrollView>
      )}

      {/* Add homework FAB */}
      <TouchableOpacity
        style={s.fab}
        activeOpacity={0.9}
        onPress={() => navigation.navigate('AddHomework')}
      >
        <VectorIcon iconSet="Ionicons" iconName="add" size={26} color="#fff" />
      </TouchableOpacity>
      </>
      )}
    </View>
  );
};

export default TeacherHomeworkScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },

  // Date strip
  dateStripWrap: {
    backgroundColor: theme.colors.card,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    paddingTop: 10,
    paddingBottom: 14,
  },
  stripHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  monthLabel: { fontSize: 13, fontWeight: '800', color: theme.colors.textSecondary },
  stripHint: { fontSize: 11, fontWeight: '600', color: theme.colors.textMuted },
  dateStrip: { paddingHorizontal: 12, gap: 8 },
  dateCell: {
    width: 56,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: theme.colors.border,
    gap: 2,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  dateCellActive: {
    backgroundColor: PRIMARY,
    shadowColor: PRIMARY,
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  dateDayName: { fontSize: 10, fontWeight: '700', color: theme.colors.textMuted, textTransform: 'uppercase' },
  dateTextActive: { color: 'rgba(255,255,255,0.85)' },
  dateNum: { fontSize: 18, fontWeight: '900', color: theme.colors.textPrimary },
  dateNumActive: { color: '#fff' },
  dateMonth: { fontSize: 10, fontWeight: '600', color: theme.colors.textMuted },
  hwDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: PRIMARY, marginTop: 2 },
  hwDotActive: { backgroundColor: theme.colors.card },

  // List
  scroll: { padding: theme.spacing.lg },
  listHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  listTitle: { fontSize: 18, fontWeight: '900', color: theme.colors.textPrimary },
  countBadge: { backgroundColor: theme.colors.primaryLight, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  countText: { fontSize: 12, fontWeight: '700', color: PRIMARY },

  // States
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: theme.spacing.xl, gap: 10 },
  errorText: { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center' },
  retryBtn: { marginTop: 4, paddingHorizontal: 24, paddingVertical: 10, borderRadius: theme.radius.full, backgroundColor: PRIMARY },
  retryText: { fontSize: 14, fontWeight: '700', color: '#fff' },

  // HW card
  hwCard: {
    flexDirection: 'row',
    backgroundColor: theme.colors.card,
    borderRadius: 16,
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  hwAccent: { width: 5 },
  hwBody: { flex: 1, padding: 14 },
  hwTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  hwIcon: { width: 40, height: 40, borderRadius: theme.radius.sm, alignItems: 'center', justifyContent: 'center' },
  hwTitle: { fontSize: 15, fontWeight: '800', color: theme.colors.textPrimary },
  hwSubject: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },
  hwDesc: { fontSize: 13, color: theme.colors.textSecondary, lineHeight: 19, marginTop: 8 },
  hwFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  hwMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  hwMetaText: { fontSize: 11, color: theme.colors.textMuted, fontWeight: '600' },
  fileChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: theme.colors.primaryLight,
    borderRadius: theme.radius.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  fileChipText: { fontSize: 11, fontWeight: '700', color: PRIMARY },

  // Empty
  empty: { alignItems: 'center', paddingTop: 50, gap: 8 },
  emptyTitle: { fontSize: 17, fontWeight: '900', color: theme.colors.textPrimary },
  emptySubtitle: { fontSize: 13, color: theme.colors.textMuted, textAlign: 'center' },

  // No-subject-assigned (books style)
  noSubjScroll: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, paddingTop: 80 },
  emptyRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  bigEmptyTitle: { fontSize: 16, fontWeight: '800', color: theme.colors.textPrimary, marginBottom: 4 },
  bigEmptySub: { fontSize: 13, color: theme.colors.textMuted, textAlign: 'center', lineHeight: 19 },

  // FAB
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 26,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: PRIMARY,
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 8,
  },
});


// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
