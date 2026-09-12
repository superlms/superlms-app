import React, { useCallback, useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import VectorIcon from '../../components/VectorIcon';
import { Skeleton } from '../../components/Skeleton';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useRefresh } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import {
  AdminAnnouncement,
  AnnouncementType,
  getAdminAnnouncements,
} from '../../api/adminContentApi';
import { DocHeader, DocNoData } from '../more/docUi';

const TITLE = 'Announcements';

// 'all_filter' asks the API for everything; the other keys are real audiences.
type FilterKey = 'all_filter' | AnnouncementType;

const AUDIENCES: { key: FilterKey; label: string }[] = [
  { key: 'all_filter', label: 'All' },
  { key: 'all', label: 'Both' },
  { key: 'user', label: 'Students' },
  { key: 'teacher', label: 'Teachers' },
];

const PERIODS: { label: string; value: number | null }[] = [
  { label: 'All time', value: null },
  { label: 'Last 7 days', value: 7 },
  { label: 'Last 15 days', value: 15 },
  { label: 'Last 30 days', value: 30 },
  { label: 'Last 45 days', value: 45 },
  { label: 'Last 60 days', value: 60 },
];

export const TYPE_LABEL: Record<AnnouncementType, string> = {
  all: 'Both',
  user: 'Students',
  teacher: 'Teachers',
};

// "12 Sep 2026", or nothing when the date is missing / unparseable.
export const fmtDate = (iso?: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

// ── One announcement as a plain three-line row, separated by a divider ────────
//   title ......................... 12 Sep 2026
//   content preview ........................ 📎
//   Students · Principal
const AnnouncementRow = ({
  item,
  isLast,
  onPress,
}: {
  item: AdminAnnouncement;
  isLast: boolean;
  onPress: () => void;
}) => {
  const hasFile = !!(item.image_url || item.pdf_url);

  return (
    <TouchableOpacity
      style={[s.row, !isLast && s.rowDivider]}
      activeOpacity={0.6}
      onPress={onPress}
    >
      <View style={s.rowLine}>
        <Text style={s.rowTitle} numberOfLines={1}>
          {item.announcement_name}
        </Text>
        <Text style={s.rowDate}>{fmtDate(item.created_at)}</Text>
      </View>

      {(!!item.announcement_content || hasFile) && (
        <View style={s.rowLine}>
          <Text style={s.rowPreview} numberOfLines={1}>
            {item.announcement_content}
          </Text>
          {hasFile && (
            <VectorIcon iconSet="Feather" iconName="paperclip" size={13} color={theme.colors.textMuted} />
          )}
        </View>
      )}

      <Text style={s.rowMeta} numberOfLines={1}>
        {TYPE_LABEL[item.type]}
        {item.creator_name ? ` · ${item.creator_name}` : ''}
      </Text>
    </TouchableOpacity>
  );
};

// ── Period chooser: a quiet text button that opens a plain bottom sheet ───────
const PeriodSheet = ({
  visible,
  value,
  onPick,
  onClose,
}: {
  visible: boolean;
  value: number | null;
  onPick: (v: number | null) => void;
  onClose: () => void;
}) => {
  const insets = useSafeAreaInsets();

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={s.sheetWrap}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        <View style={[s.sheet, { paddingBottom: insets.bottom + 12 }]}>
          <View style={s.sheetHandle} />
          <Text style={s.sheetTitle}>Select period</Text>
          {PERIODS.map((p, i) => {
            const active = p.value === value;
            return (
              <TouchableOpacity
                key={p.label}
                style={[s.sheetRow, i < PERIODS.length - 1 && s.rowDivider]}
                activeOpacity={0.6}
                onPress={() => {
                  onPick(p.value);
                  onClose();
                }}
              >
                <Text style={[s.sheetRowText, active && s.sheetRowTextActive]}>{p.label}</Text>
                {active && (
                  <VectorIcon iconSet="Ionicons" iconName="checkmark" size={18} color={theme.colors.primary} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </Modal>
  );
};

const AdminAnnouncementScreen = ({ navigation }: any) => {
  const [items, setItems] = useState<AdminAnnouncement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [audience, setAudience] = useState<FilterKey>('all_filter');
  const [days, setDays] = useState<number | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getAdminAnnouncements(
        audience === 'all_filter' ? undefined : audience,
        days ?? undefined,
      );
      setItems(res.announcements);
    } catch (e) {
      setError(apiErr(e, 'Could not load announcements.'));
    } finally {
      setLoading(false);
    }
  }, [audience, days]);

  // Refetch on focus and whenever a filter changes.
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const { refreshing, onRefresh } = useRefresh(load);

  const periodLabel = PERIODS.find(p => p.value === days)?.label ?? 'All time';
  const countLabel = `${items.length} ${items.length === 1 ? 'announcement' : 'announcements'}`;

  return (
    <View style={s.root}>
      <DocHeader
        title={TITLE}
        onBackPress={() =>
          navigation.canGoBack() ? navigation.goBack() : navigation.navigate('PanelHome')
        }
        rightIcon="add"
        onRightPress={() => navigation.navigate('AdminAnnouncementForm')}
      />

      {/* Audience segment and period, pinned under the header */}
      <View style={s.filterBar}>
        <View style={s.segment}>
          {AUDIENCES.map(a => {
            const active = audience === a.key;
            return (
              <TouchableOpacity
                key={a.key}
                activeOpacity={0.7}
                onPress={() => setAudience(a.key)}
                style={[s.segmentItem, active && s.segmentItemActive]}
              >
                <Text style={[s.segmentText, active && s.segmentTextActive]} numberOfLines={1}>
                  {a.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={s.metaBar}>
          <Text style={s.metaBarText}>{loading ? '' : countLabel}</Text>
          <TouchableOpacity
            style={s.periodBtn}
            activeOpacity={0.6}
            onPress={() => setSheetOpen(true)}
            hitSlop={8}
          >
            <Text style={s.periodText}>{periodLabel}</Text>
            <VectorIcon iconSet="Ionicons" iconName="chevron-down" size={14} color={theme.colors.textMuted} />
          </TouchableOpacity>
        </View>
      </View>
      <View style={s.fullDivider} />

      {loading && !refreshing ? (
        <View style={s.list}>
          {[0, 1, 2, 3, 4].map(i => (
            <View key={i} style={[s.skeletonRow, i < 4 && s.rowDivider]}>
              <View style={s.rowLine}>
                <Skeleton width="55%" height={14} />
                <Skeleton width={60} height={10} />
              </View>
              <Skeleton width="80%" height={12} />
              <Skeleton width="35%" height={10} />
            </View>
          ))}
        </View>
      ) : error ? (
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
          contentContainerStyle={s.list}
          refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {items.length === 0 ? (
            <DocNoData
              icon="megaphone-outline"
              title="No announcements"
              subtitle="Nothing posted for this audience and period."
            />
          ) : (
            items.map((item, i) => (
              <AnnouncementRow
                key={item.id}
                item={item}
                isLast={i === items.length - 1}
                onPress={() => navigation.navigate('AdminAnnouncementDetail', { item })}
              />
            ))
          )}
        </ScrollView>
      )}

      <PeriodSheet
        visible={sheetOpen}
        value={days}
        onPick={setDays}
        onClose={() => setSheetOpen(false)}
      />
    </View>
  );
};

export default AdminAnnouncementScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },

  // Filter bar
  filterBar: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 10, gap: 10 },
  segment: {
    flexDirection: 'row',
    padding: 3,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
  segmentItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    paddingHorizontal: 2,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  segmentItemActive: {
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.border,
  },
  segmentText: { fontSize: 13, fontWeight: '500', color: theme.colors.textSecondary },
  segmentTextActive: { color: theme.colors.primary, fontWeight: '600' },

  metaBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  metaBarText: { fontSize: 12, color: theme.colors.textMuted },
  periodBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  periodText: { fontSize: 12, fontWeight: '500', color: theme.colors.textSecondary },

  fullDivider: { height: 1, backgroundColor: theme.colors.border },

  // List
  list: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 40 },
  row: { paddingVertical: 12, gap: 4 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  rowLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowTitle: { flex: 1, fontSize: 15, fontWeight: '500', color: theme.colors.textPrimary },
  rowDate: { fontSize: 12, color: theme.colors.textMuted },
  rowPreview: { flex: 1, fontSize: 13, color: theme.colors.textSecondary },
  rowMeta: { fontSize: 12, color: theme.colors.textMuted },

  // Loading skeleton
  skeletonRow: { paddingVertical: 14, gap: 8 },

  // Error
  centeredBox: { alignItems: 'center', paddingTop: 72, paddingHorizontal: 24, gap: 10 },
  errorText: { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  linkText: { fontSize: 14, fontWeight: '600', color: theme.colors.primary },

  // Period sheet
  sheetWrap: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    maxHeight: '70%',
    backgroundColor: theme.colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.border,
    marginBottom: 14,
  },
  sheetTitle: { fontSize: 16, fontWeight: '600', color: theme.colors.textPrimary, marginBottom: 4 },
  sheetRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  sheetRowText: { flex: 1, fontSize: 15, color: theme.colors.textPrimary },
  sheetRowTextActive: { color: theme.colors.primary, fontWeight: '600' },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
