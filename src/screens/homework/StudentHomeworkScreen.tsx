import React, { useCallback, useRef, useState } from 'react';
import ScreenSkeleton from '../../components/Skeleton';
import {
  ActivityIndicator, Linking, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View, SafeAreaView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Header from '../../components/Header';
import VectorIcon from '../../components/VectorIcon';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useRefresh } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';
import { Homework } from './homeworkData';
import AttachmentPreviewModal from '../announcement/AttachmentPreviewModal';
import {
  getStudentHomework,
  homeworkSubjectVisual,
  homeworkErrorMessage,
  type HomeworkItem,
} from '../../api/homeworkApi';

const PRIMARY = theme.colors.primary;

// Map an API homework row into the screen's Homework shape.
const mapHomework = (h: HomeworkItem): Homework => {
  const v = homeworkSubjectVisual(h.subject?.name ?? '');
  return {
    id: String(h.id),
    subjectId: String(h.subject?.id ?? '0'),
    subjectName: h.subject?.name ?? 'Subject',
    subjectIcon: v.icon,
    subjectColor: v.color,
    teacherName: h.assigned_by ?? 'Teacher',
    title: h.title,
    description: h.description ?? '',
    dueDate: h.assigned_date ?? '',
    createdAt: h.assigned_time ?? '',
    attachments: h.file_url
      ? [{ type: h.file_type === 'image' ? 'image' : 'pdf', name: 'Attachment', url: h.file_url }]
      : undefined,
  };
};

// Last 15 days ending today — today sits at the far right of the strip
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

const toKey = (d: Date) => d.toISOString().slice(0, 10);

const DAY_NAMES  = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

interface SubjectGroup {
  subjectId: string;
  subjectName: string;
  subjectIcon: string;
  subjectColor: string;
  teacherName: string;
  items: Homework[];
}

// Group one day's homework into one card per subject
const groupBySubject = (homeworks: Homework[]): SubjectGroup[] => {
  const groups: SubjectGroup[] = [];
  homeworks.forEach(hw => {
    let g = groups.find(x => x.subjectId === hw.subjectId);
    if (!g) {
      g = {
        subjectId: hw.subjectId,
        subjectName: hw.subjectName,
        subjectIcon: hw.subjectIcon,
        subjectColor: hw.subjectColor,
        teacherName: hw.teacherName,
        items: [],
      };
      groups.push(g);
    }
    g.items.push(hw);
  });
  return groups;
};

// ─── Subject card (exam-card template) ────────────────────────────────────────
const SubjectCard = ({
  group,
  isCompleted,
  expanded,
  onToggleExpand,
  onMarkComplete,
  onPreviewImage,
}: {
  group: SubjectGroup;
  isCompleted: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  onMarkComplete: () => void;
  onPreviewImage: (url?: string) => void;
}) => (
  <View style={s.card}>
    {/* Accent bar */}
    <View style={[s.accentBar, { backgroundColor: isCompleted ? '#22C55E' : group.subjectColor }]} />

    <View style={s.cardInner}>
      {/* Top row: subject icon + name/teacher + status badge */}
      <View style={s.cardTop}>
        <View style={[s.iconWrap, { backgroundColor: group.subjectColor + '20' }]}>
          <Text style={s.iconEmoji}>{group.subjectIcon}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[s.subName, isCompleted && s.subNameDone]} numberOfLines={1}>
            {group.subjectName}
          </Text>
          <Text style={s.subMeta} numberOfLines={1}>
            {group.teacherName} · {group.items.length} task{group.items.length !== 1 ? 's' : ''}
          </Text>
        </View>
        <View style={[s.badge, { backgroundColor: isCompleted ? '#DCFCE7' : '#FEF3C7' }]}>
          <View style={[s.badgeDot, { backgroundColor: isCompleted ? '#16A34A' : '#D97706' }]} />
          <Text style={[s.badgeText, { color: isCompleted ? '#16A34A' : '#D97706' }]}>
            {isCompleted ? 'Completed' : 'Pending'}
          </Text>
        </View>
      </View>
    </View>

    {/* Bottom action row — exam-card toggle template */}
    <View style={s.actionsRow}>
      <TouchableOpacity style={s.actionBtn} onPress={onToggleExpand} activeOpacity={0.7}>
        <Text style={s.actionText}>
          {expanded ? 'Hide Homework' : 'View Homework'}
        </Text>
        <VectorIcon
          iconSet="Ionicons"
          iconName={expanded ? 'chevron-up' : 'chevron-down'}
          size={14}
          color={PRIMARY}
        />
      </TouchableOpacity>
      <View style={s.actionDivider} />
      {isCompleted ? (
        <View style={s.actionBtn}>
          <VectorIcon
            iconSet="Ionicons"
            iconName="checkmark-circle"
            size={14}
            color="#16A34A"
          />
          <Text style={[s.actionText, { color: '#16A34A' }]}>Completed</Text>
        </View>
      ) : (
        <TouchableOpacity style={s.actionBtn} onPress={onMarkComplete} activeOpacity={0.7}>
          <VectorIcon
            iconSet="Ionicons"
            iconName="checkmark-circle-outline"
            size={14}
            color="#16A34A"
          />
          <Text style={[s.actionText, { color: '#16A34A' }]}>Mark as Complete</Text>
        </TouchableOpacity>
      )}
    </View>

    {/* Dropdown — homework details */}
    {expanded && (
      <View style={s.dropBox}>
        {group.items.map((hw, i) => (
          <View
            key={hw.id}
            style={[s.hwItem, i < group.items.length - 1 && s.hwItemBorder]}
          >
            <View style={s.hwItemHeader}>
              <View style={[s.subjectDot, { backgroundColor: group.subjectColor }]} />
              <Text style={[s.hwItemTitle, isCompleted && s.subNameDone]}>
                {hw.title}
              </Text>
            </View>
            <Text style={s.hwItemDesc}>{hw.description}</Text>

            {/* Attachments (image / pdf) */}
            {!!hw.attachments?.length && (
              <View style={s.attachRow}>
                {hw.attachments.map((att, ai) => (
                  <TouchableOpacity
                    key={ai}
                    style={s.attachChip}
                    activeOpacity={0.7}
                    onPress={() => {
                      if (att.type === 'image') onPreviewImage(att.url);
                      else if (att.url) Linking.openURL(att.url).catch(() => {});
                    }}
                  >
                    <View
                      style={[
                        s.attachIconBox,
                        { backgroundColor: att.type === 'image' ? theme.colors.primaryLight : '#FEE2E2' },
                      ]}
                    >
                      <VectorIcon
                        iconSet="Ionicons"
                        iconName={att.type === 'image' ? 'image-outline' : 'document-text-outline'}
                        size={14}
                        color={att.type === 'image' ? PRIMARY : '#EF4444'}
                      />
                    </View>
                    <Text style={s.attachText} numberOfLines={1}>{att.name}</Text>
                    {att.type === 'image' && (
                      <VectorIcon
                        iconSet="Ionicons"
                        iconName="eye-outline"
                        size={13}
                        color={theme.colors.textMuted}
                      />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        ))}
      </View>
    )}
  </View>
);

// ─── Screen ───────────────────────────────────────────────────────────────────
const StudentHomeworkScreen = ({ navigation }: any) => {
  const days = buildDays();
  const todayKey = toKey(new Date());
  const stripRef = useRef<ScrollView>(null);
  const [selectedKey, setSelectedKey] = useState(todayKey);
  const [completedIds, setCompletedIds] = useState<string[]>([]);
  const [expandedSub, setExpandedSub] = useState<string | null>(null);
  const [confirmGroup, setConfirmGroup] = useState<SubjectGroup | null>(null);
  const [preview, setPreview] = useState<{ url?: string; color: string } | null>(null);

  const [allHomeworks, setAllHomeworks] = useState<Homework[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getStudentHomework(15);
      setAllHomeworks((res?.homeworks ?? []).map(mapHomework));
    } catch (e: any) {
      console.log('[getStudentHomework] Error:', e?.response?.status, e?.message);
      setError(homeworkErrorMessage(e));
      setAllHomeworks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const { refreshing, onRefresh } = useRefresh(load);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const homeworks: Homework[] = allHomeworks.filter(h => h.dueDate === selectedKey);
  const groups = groupBySubject(homeworks);
  const isGroupDone = (g: SubjectGroup) => g.items.every(h => completedIds.includes(h.id));
  const pending   = groups.filter(g => !isGroupDone(g));
  const completed = groups.filter(g => isGroupDone(g));

  // One-way: once confirmed complete, it cannot be reversed.
  const confirmComplete = () => {
    if (confirmGroup) {
      const ids = confirmGroup.items.map(h => h.id);
      setCompletedIds(prev => [...prev, ...ids.filter(id => !prev.includes(id))]);
    }
    setConfirmGroup(null);
  };

  const selectedDate = new Date(selectedKey + 'T00:00:00');
  const listTitle =
    selectedKey === todayKey
      ? "Today's Homework"
      : `Homework · ${selectedDate.getDate()} ${MONTH_NAMES[selectedDate.getMonth()]}`;

  return (
    <SafeAreaView style={s.root}>
      <Header title="Homework" onBackPress={() => navigation.goBack()} />

      {/* ── Date strip (last 15 days, today at the end) ── */}
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
            const key     = toKey(d);
            const active  = key === selectedKey;
            const isToday = key === todayKey;
            const hasHW   = allHomeworks.some(h => h.dueDate === key);
            return (
              <TouchableOpacity
                key={key}
                style={[s.dateCell, active && s.dateCellActive]}
                onPress={() => { setSelectedKey(key); setExpandedSub(null); }}
                activeOpacity={0.8}
              >
                <Text style={[s.dateDayName, active && s.dateDayNameActive]}>
                  {isToday ? 'Today' : DAY_NAMES[d.getDay()]}
                </Text>
                <Text style={[s.dateNum, active && s.dateNumActive]}>
                  {d.getDate()}
                </Text>
                <Text style={[s.dateMonth, active && s.dateMonthActive]}>
                  {MONTH_NAMES[d.getMonth()]}
                </Text>
                {hasHW && <View style={[s.hwDot, active && s.hwDotActive]} />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ── Subject cards ── */}
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
              {groups.length} subject{groups.length !== 1 ? 's' : ''}
            </Text>
          </View>
        </View>

        {loading ? (
          <View style={s.empty}>
            <ScreenSkeleton variant="list" />
          </View>
        ) : error ? (
          <View style={s.empty}>
            <VectorIcon iconSet="Ionicons" iconName="cloud-offline-outline" size={48} color={theme.colors.danger} />
            <Text style={s.emptyTitle}>Couldn’t load homework</Text>
            <Text style={s.emptySubtitle}>{error}</Text>
            <TouchableOpacity style={s.retryBtn} onPress={load} activeOpacity={0.85}>
              <Text style={s.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : groups.length === 0 ? (
          <View style={s.empty}>
            <VectorIcon iconSet="Ionicons" iconName="checkmark-circle-outline" size={52} color={theme.colors.textMuted} />
            <Text style={s.emptyTitle}>No homework!</Text>
            <Text style={s.emptySubtitle}>Nothing assigned for this date.</Text>
          </View>
        ) : (
          <>
            {pending.map(g => (
              <SubjectCard
                key={g.subjectId}
                group={g}
                isCompleted={false}
                expanded={expandedSub === g.subjectId}
                onToggleExpand={() => setExpandedSub(expandedSub === g.subjectId ? null : g.subjectId)}
                onMarkComplete={() => setConfirmGroup(g)}
                onPreviewImage={url => setPreview({ url, color: g.subjectColor })}
              />
            ))}

            {pending.length === 0 && completed.length > 0 && (
              <View style={s.allDone}>
                <Text style={s.allDoneEmoji}>🎉</Text>
                <Text style={s.allDoneText}>All homework completed!</Text>
              </View>
            )}

            {completed.length > 0 && (
              <>
                <View style={s.completedHeader}>
                  <VectorIcon iconSet="Ionicons" iconName="checkmark-done-outline" size={16} color="#16A34A" />
                  <Text style={s.completedTitle}>Completed</Text>
                  <View style={s.completedBadge}>
                    <Text style={s.completedBadgeText}>{completed.length}</Text>
                  </View>
                </View>
                {completed.map(g => (
                  <SubjectCard
                    key={g.subjectId}
                    group={g}
                    isCompleted
                    expanded={expandedSub === g.subjectId}
                    onToggleExpand={() => setExpandedSub(expandedSub === g.subjectId ? null : g.subjectId)}
                    onMarkComplete={() => {}}
                    onPreviewImage={url => setPreview({ url, color: g.subjectColor })}
                  />
                ))}
              </>
            )}
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ── Image attachment preview ── */}
      <AttachmentPreviewModal
        visible={!!preview}
        accentColor={preview?.color ?? PRIMARY}
        imageUrl={preview?.url}
        onClose={() => setPreview(null)}
      />

      {/* ── Mark-as-complete confirmation ── */}
      <Modal
        transparent
        visible={!!confirmGroup}
        animationType="fade"
        onRequestClose={() => setConfirmGroup(null)}
      >
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalIconWrap}>
              <VectorIcon
                iconSet="Ionicons"
                iconName="checkmark-circle-outline"
                size={28}
                color="#16A34A"
              />
            </View>

            <Text style={s.modalTitle}>Mark as Complete?</Text>
            <Text style={s.modalDesc}>
              {confirmGroup?.subjectName} homework will be moved to Completed.
              This cannot be undone.
            </Text>

            <View style={s.modalActions}>
              <TouchableOpacity
                style={[s.modalBtn, s.modalBtnGhost]}
                activeOpacity={0.85}
                onPress={() => setConfirmGroup(null)}
              >
                <Text style={[s.modalBtnText, s.modalBtnGhostText]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[s.modalBtn, s.modalBtnConfirm]}
                activeOpacity={0.9}
                onPress={confirmComplete}
              >
                <Text style={[s.modalBtnText, s.modalBtnConfirmText]}>
                  Yes, Complete
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default StudentHomeworkScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },

  // Date strip
  dateStripWrap: {
    backgroundColor: theme.colors.card,
    borderBottomWidth: 1, borderBottomColor: theme.colors.border,
    paddingTop: 10, paddingBottom: 14,
  },
  stripHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, marginBottom: 10,
  },
  monthLabel: { fontSize: 13, fontWeight: '800', color: theme.colors.textSecondary },
  stripHint:  { fontSize: 11, fontWeight: '600', color: theme.colors.textMuted },
  dateStrip: { paddingHorizontal: 12, gap: 8 },
  dateCell: {
    width: 56, alignItems: 'center', paddingVertical: 10, borderRadius: 16,
    backgroundColor: theme.colors.border, gap: 2,
    borderWidth: 1, borderColor: 'transparent',
  },
  dateCellActive: {
    backgroundColor: PRIMARY,
    shadowColor: PRIMARY, shadowOpacity: 0.35, shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 }, elevation: 5,
  },
  dateDayName: { fontSize: 10, fontWeight: '700', color: theme.colors.textMuted, textTransform: 'uppercase' },
  dateDayNameActive: { color: 'rgba(255,255,255,0.85)' },
  dateNum: { fontSize: 18, fontWeight: '900', color: theme.colors.textPrimary },
  dateNumActive: { color: '#fff' },
  dateMonth: { fontSize: 10, fontWeight: '600', color: theme.colors.textMuted },
  dateMonthActive: { color: 'rgba(255,255,255,0.85)' },
  hwDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: PRIMARY, marginTop: 2 },
  hwDotActive: { backgroundColor: theme.colors.card },

  // List
  scroll: { padding: theme.spacing.lg },
  listHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  listTitle: { fontSize: 18, fontWeight: '900', color: theme.colors.textPrimary },
  countBadge: { backgroundColor: theme.colors.primaryLight, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  countText: { fontSize: 12, fontWeight: '700', color: PRIMARY },

  // Card — exam template
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
    shadowColor: '#000000',
    elevation: 3,
    marginBottom: 14,
  },
  accentBar: { height: 4, width: '100%' },
  cardInner: { padding: theme.spacing.md },

  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconEmoji: { fontSize: 20 },
  subName: { fontSize: 16, fontWeight: '700', color: theme.colors.textPrimary },
  subNameDone: { textDecorationLine: 'line-through', color: theme.colors.textSecondary },
  subMeta: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.radius.full,
  },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: 12, fontWeight: '700' },

  // Bottom actions — exam toggle template
  actionsRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
  },
  actionDivider: { width: 1, backgroundColor: theme.colors.border },
  actionText: { fontSize: 13, fontWeight: '600', color: theme.colors.primary },

  // Dropdown — homework details
  dropBox: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 4,
  },
  hwItem: { paddingVertical: 12, gap: 6 },
  hwItemBorder: { borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  hwItemHeader: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  subjectDot: { width: 7, height: 7, borderRadius: 4 },
  hwItemTitle: { flex: 1, fontSize: 14, fontWeight: '700', color: theme.colors.textPrimary },
  hwItemDesc: { fontSize: 13, color: theme.colors.textSecondary, lineHeight: 20, paddingLeft: 14 },

  // Attachments
  attachRow: { gap: 8, paddingLeft: 14, marginTop: 2 },
  attachChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  attachIconBox: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },

  // Completed section
  completedHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 10, marginBottom: 12,
  },
  completedTitle: { fontSize: 15, fontWeight: '900', color: '#16A34A' },
  completedBadge: {
    backgroundColor: '#DCFCE7', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999,
  },
  completedBadgeText: { fontSize: 11, fontWeight: '800', color: '#16A34A' },
  allDone: { alignItems: 'center', paddingVertical: 18, gap: 4 },
  allDoneEmoji: { fontSize: 30 },
  allDoneText: { fontSize: 14, fontWeight: '700', color: '#16A34A' },

  // Empty
  empty: { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyTitle: { fontSize: 17, fontWeight: '900', color: theme.colors.textPrimary },
  emptySubtitle: { fontSize: 13, color: theme.colors.textMuted, textAlign: 'center', paddingHorizontal: 24 },
  retryBtn: { marginTop: 6, paddingHorizontal: 24, paddingVertical: 10, borderRadius: theme.radius.full, backgroundColor: PRIMARY },
  retryText: { fontSize: 14, fontWeight: '700', color: '#fff' },

  // Confirmation modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.lg,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  modalIconWrap: {
    width: 72,
    height: 72,
    borderRadius: theme.radius.full,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: theme.spacing.md,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.colors.textPrimary,
    textAlign: 'center',
  },
  modalDesc: {
    marginTop: theme.spacing.sm,
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  modalActions: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginTop: theme.spacing.xl,
  },
  modalBtn: {
    flex: 1,
    height: 48,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtnText: {
    fontSize: 15,
    fontWeight: '700',
  },
  modalBtnGhost: {
    backgroundColor: theme.colors.border,
  },
  modalBtnGhostText: {
    color: theme.colors.textPrimary,
  },
  modalBtnConfirm: {
    backgroundColor: '#16A34A',
  },
  modalBtnConfirmText: {
    color: theme.colors.white,
  },
});


// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
