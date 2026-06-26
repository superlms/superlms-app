import React, { useMemo, useState } from 'react';
import {
  Dimensions,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import VectorIcon from '../../components/VectorIcon';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useRefresh } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';

const { width } = Dimensions.get('window');
// 4 columns: 16px page padding each side + 14px card padding each side + 3 gaps
const ITEM_SIZE = (width - 32 - 28 - 18) / 4;

type Role = 'student' | 'teacher';

interface QuickLink {
  label: string;
  icon: string;
  color: string;
  bg: string;
  route: string;
  roles: Role[];
}

interface Category {
  title: string;
  icon: string;
  accent: string;
  accentBg: string;
  links: QuickLink[];
}

const CATEGORIES: Category[] = [
  {
    title: 'Academics',
    icon: 'school-outline',
    accent: '#4F46E5',
    accentBg: '#E0E7FF',
    links: [
      { label: 'Subjects',     icon: 'library-outline',       color: '#4F46E5', bg: '#E0E7FF', route: 'Subjects',         roles: ['student', 'teacher'] },
      { label: 'Syllabus',     icon: 'layers-outline',        color: '#DC2626', bg: '#FEE2E2', route: 'Syllabus',         roles: ['student', 'teacher'] },
      { label: 'Timetable',    icon: 'time-outline',          color: '#0EA5E9', bg: '#E0F2FE', route: 'Timetable',        roles: ['student', 'teacher'] },
      { label: 'Content',      icon: 'folder-open-outline',   color: '#D97706', bg: '#FEF3C7', route: 'Content',          roles: ['student', 'teacher'] },
      { label: 'Homework',     icon: 'book-outline',          color: '#7C3AED', bg: '#EDE9FE', route: 'Homework',         roles: ['student', 'teacher'] },
      { label: 'Quiz',         icon: 'help-circle-outline',   color: '#0EA5E9', bg: '#DBEAFE', route: 'Quiz',             roles: ['student', 'teacher'] },
    ],
  },
  {
    title: 'Exams & Results',
    icon: 'document-text-outline',
    accent: '#7C3AED',
    accentBg: '#EDE9FE',
    links: [
      { label: 'Exams',        icon: 'document-text-outline', color: '#4F46E5', bg: '#E0E7FF', route: 'Exams',            roles: ['student', 'teacher'] },
      { label: 'Admit Card',   icon: 'card-outline',          color: '#16A34A', bg: '#DCFCE7', route: 'AdmitCardScreen',  roles: ['student'] },
      { label: 'Seating Plan', icon: 'grid-outline',          color: '#D97706', bg: '#FEF3C7', route: 'SeatingPlanScreen',roles: ['student'] },
      { label: 'Exam Copy',    icon: 'copy-outline',          color: '#0EA5E9', bg: '#E0F2FE', route: 'ExamCopyScreen',   roles: ['student'] },
      { label: 'Report Card',  icon: 'ribbon-outline',        color: '#DC2626', bg: '#FEE2E2', route: 'ReportCardScreen', roles: ['student'] },
      { label: 'Performance',  icon: 'trending-up-outline',   color: '#16A34A', bg: '#DCFCE7', route: 'PerformanceScreen',roles: ['student'] },
      { label: 'Upload Copy',  icon: 'cloud-upload-outline',  color: '#0EA5E9', bg: '#E0F2FE', route: 'UploadCopyScreen', roles: ['teacher'] },
      { label: 'Upload Marks', icon: 'create-outline',        color: '#16A34A', bg: '#DCFCE7', route: 'UploadMarksScreen',roles: ['teacher'] },
    ],
  },
  {
    title: 'Attendance',
    icon: 'calendar-outline',
    accent: '#16A34A',
    accentBg: '#DCFCE7',
    links: [
      { label: 'Attendance',   icon: 'calendar-outline',      color: '#16A34A', bg: '#DCFCE7', route: 'Attendance',       roles: ['student', 'teacher'] },
      { label: 'Mark Attend.', icon: 'checkbox-outline',      color: '#4F46E5', bg: '#E0E7FF', route: 'MarkAttendance',   roles: ['teacher'] },
    ],
  },
  {
    title: 'Finance',
    icon: 'wallet-outline',
    accent: '#D97706',
    accentBg: '#FEF3C7',
    links: [
      { label: 'Fees',         icon: 'card-outline',          color: '#D97706', bg: '#FEF3C7', route: 'Fees',             roles: ['student'] },
    ],
  },
  {
    title: 'Communication',
    icon: 'chatbubbles-outline',
    accent: '#0EA5E9',
    accentBg: '#E0F2FE',
    links: [
      { label: 'Chats',        icon: 'chatbubbles-outline',   color: '#4F46E5', bg: '#E0E7FF', route: 'Chats',            roles: ['student', 'teacher'] },
      { label: 'Announcement', icon: 'megaphone-outline',     color: '#0EA5E9', bg: '#E0F2FE', route: 'Announcement',     roles: ['student', 'teacher'] },
      { label: 'Contact',      icon: 'call-outline',          color: '#16A34A', bg: '#DCFCE7', route: 'ContactSchool',    roles: ['student', 'teacher'] },
      { label: 'Notifications',icon: 'notifications-outline', color: '#DC2626', bg: '#FEE2E2', route: 'Notifications',    roles: ['student', 'teacher'] },
    ],
  },
  {
    title: 'Resources',
    icon: 'bookmarks-outline',
    accent: '#7C3AED',
    accentBg: '#EDE9FE',
    links: [
      { label: 'Books',        icon: 'bookmarks-outline',     color: '#7C3AED', bg: '#EDE9FE', route: 'Book',             roles: ['student', 'teacher'] },
      { label: 'Instructor',   icon: 'person-outline',        color: '#0EA5E9', bg: '#E0F2FE', route: 'Instructor',       roles: ['student'] },
      { label: 'Transport',    icon: 'bus-outline',           color: '#16A34A', bg: '#DCFCE7', route: 'Transport',        roles: ['student'] },
      { label: 'Calendar',     icon: 'calendar-outline',      color: '#D97706', bg: '#FEF3C7', route: 'Calendar',         roles: ['student', 'teacher'] },
    ],
  },
  {
    title: 'Account',
    icon: 'person-circle-outline',
    accent: '#64748B',
    accentBg: '#F1F5F9',
    links: [
      { label: 'Settings',     icon: 'settings-outline',      color: theme.colors.textSecondary, bg: '#F1F5F9', route: 'Settings',         roles: ['student', 'teacher'] },
      { label: 'ID Card',      icon: 'id-card-outline',       color: '#4F46E5', bg: '#E0E7FF', route: 'IDCard',           roles: ['student', 'teacher'] },
      { label: 'More',         icon: 'apps-outline',          color: theme.colors.textSecondary, bg: '#F1F5F9', route: 'More',             roles: ['student', 'teacher'] },
    ],
  },
];

// Route order as it appears in the drawer sidebar (DrawerNavigator menuItems).
const SIDEBAR_ORDER: Record<Role, string[]> = {
  teacher: [
    'Announcement', 'Calendar', 'Homework', 'Timetable', 'MarkAttendance',
    'Attendance', 'Subjects', 'Syllabus', 'Content', 'Quiz', 'Book', 'IDCard',
    'Chats', 'Exams', 'UploadMarksScreen', 'UploadCopyScreen', 'ContactSchool',
    'Settings', 'More',
  ],
  student: [
    'Fees', 'Announcement', 'Calendar', 'Transport', 'Homework', 'Timetable',
    'Attendance', 'Subjects', 'Syllabus', 'Content', 'Quiz', 'Book',
    'Instructor', 'IDCard', 'Chats', 'Exams', 'PerformanceScreen',
    'ContactSchool', 'Settings', 'More',
  ],
};

type OrderKey = 'sidebar' | 'ascending' | 'category';

const ORDER_OPTIONS: { key: OrderKey; label: string; icon: string }[] = [
  { key: 'sidebar', label: 'Sidebar Order', icon: 'menu-outline' },
  { key: 'ascending', label: 'A → Z (Ascending)', icon: 'swap-vertical-outline' },
  { key: 'category', label: 'Category-wise', icon: 'grid-outline' },
];

// Each link enriched with its category metadata.
interface FlatLink extends QuickLink {
  categoryTitle: string;
  categoryIcon: string;
  categoryAccent: string;
  categoryBg: string;
}

const FLAT_LINKS: FlatLink[] = CATEGORIES.flatMap(c =>
  c.links.map(l => ({
    ...l,
    categoryTitle: c.title,
    categoryIcon: c.icon,
    categoryAccent: c.accent,
    categoryBg: c.accentBg,
  })),
);

const QuickLinksScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const role: Role = route?.params?.userRole === 'teacher' ? 'teacher' : 'student';

  const [search, setSearch] = useState('');
  const [order, setOrder] = useState<OrderKey>('sidebar');
  const [orderOpen, setOrderOpen] = useState(false);

  // TODO: wire to an API loader if this screen gains server data.
  const { refreshing, onRefresh } = useRefresh(() => {});

  const q = search.toLowerCase().trim();

  const navigate = (r: string) =>
    navigation.navigate(r, r === 'Notifications' ? { role } : undefined);

  const roleLinks = useMemo(
    () => FLAT_LINKS.filter(l => l.roles.includes(role)),
    [role],
  );

  const searchResults = useMemo(
    () => (q ? roleLinks.filter(l => l.label.toLowerCase().includes(q)) : []),
    [q, roleLinks],
  );

  const orderedLinks = useMemo(() => {
    if (order === 'ascending') {
      return [...roleLinks].sort((a, b) => a.label.localeCompare(b.label));
    }
    // sidebar
    const seq = SIDEBAR_ORDER[role];
    const idx = (r: string) => {
      const i = seq.indexOf(r);
      return i === -1 ? seq.length + 1 : i;
    };
    return [...roleLinks].sort((a, b) => idx(a.route) - idx(b.route));
  }, [order, roleLinks, role]);

  const activeOrder = ORDER_OPTIONS.find(o => o.key === order)!;

  // ── Grid tile ──
  const LinkTile = ({ item }: { item: QuickLink }) => (
    <TouchableOpacity
      style={[s.item, { width: ITEM_SIZE }]}
      activeOpacity={0.75}
      onPress={() => navigate(item.route)}
    >
      <View style={[s.itemIconWrap, { backgroundColor: item.bg }]}>
        <View style={[s.itemIconInner, { backgroundColor: item.color + '22' }]}>
          <VectorIcon
            iconSet="Ionicons"
            iconName={item.icon}
            size={22}
            color={item.color}
          />
        </View>
      </View>
      <Text style={s.itemLabel} numberOfLines={2}>
        {item.label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor={theme.colors.white} />

      {/* ── Heading ── */}
      <View style={s.header}>
        <Text style={s.headerTitle}>Quick Links</Text>
      </View>

      {/* Search */}
      <View style={s.searchWrap}>
        <VectorIcon iconSet="Ionicons" iconName="search-outline" size={17} color={theme.colors.textMuted} />
        <TextInput
          style={s.searchInput}
          placeholder="Search anything..."
          placeholderTextColor={theme.colors.textMuted}
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')} activeOpacity={0.7}>
            <VectorIcon iconSet="Ionicons" iconName="close-circle" size={17} color={theme.colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* ── Order dropdown ── */}
      <View style={s.orderBar}>
        <Text style={s.orderLabel}>Show as</Text>
        <View style={s.orderSelectWrap}>
          <TouchableOpacity
            style={s.orderSelect}
            activeOpacity={0.8}
            onPress={() => setOrderOpen(o => !o)}
          >
            <VectorIcon
              iconSet="Ionicons"
              iconName={activeOrder.icon}
              size={15}
              color={theme.colors.primary}
            />
            <Text style={s.orderSelectText}>{activeOrder.label}</Text>
            <VectorIcon
              iconSet="Ionicons"
              iconName={orderOpen ? 'chevron-up' : 'chevron-down'}
              size={15}
              color={theme.colors.primary}
            />
          </TouchableOpacity>

          {orderOpen && (
            <View style={s.orderDropdown}>
              {ORDER_OPTIONS.map((o, i) => {
                const active = o.key === order;
                return (
                  <TouchableOpacity
                    key={o.key}
                    style={[
                      s.orderItem,
                      i === ORDER_OPTIONS.length - 1 && s.orderItemLast,
                      active && s.orderItemActive,
                    ]}
                    activeOpacity={0.7}
                    onPress={() => {
                      setOrder(o.key);
                      setOrderOpen(false);
                    }}
                  >
                    <VectorIcon
                      iconSet="Ionicons"
                      iconName={o.icon}
                      size={15}
                      color={active ? theme.colors.primary : theme.colors.textSecondary}
                    />
                    <Text
                      style={[s.orderItemText, active && s.orderItemTextActive]}
                    >
                      {o.label}
                    </Text>
                    {active && (
                      <VectorIcon
                        iconSet="Ionicons"
                        iconName="checkmark"
                        size={15}
                        color={theme.colors.primary}
                      />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
        refreshControl={
          <AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* ── Search results ── */}
        {q.length > 0 ? (
          <View style={s.section}>
            <View style={s.sectionHead}>
              <View style={[s.sectionPill, { backgroundColor: theme.colors.primaryLight }]}>
                <VectorIcon iconSet="Ionicons" iconName="search-outline" size={12} color={theme.colors.primary} />
                <Text style={[s.sectionPillText, { color: theme.colors.primary }]}>Search</Text>
              </View>
              <Text style={s.sectionTitle}>"{search}"</Text>
            </View>
            {searchResults.length === 0 ? (
              <View style={s.emptyBox}>
                <View style={s.emptyIconWrap}>
                  <VectorIcon iconSet="Ionicons" iconName="search-outline" size={30} color={theme.colors.textMuted} />
                </View>
                <Text style={s.emptyTitle}>No results</Text>
                <Text style={s.emptySubtitle}>Try a different keyword</Text>
              </View>
            ) : (
              <View style={s.gridCard}>
                <View style={s.grid}>
                  {searchResults.map(item => (
                    <LinkTile key={item.route} item={item} />
                  ))}
                </View>
              </View>
            )}
          </View>
        ) : order === 'category' ? (
          // ── Category-wise ──
          CATEGORIES.map(cat => {
            const links = cat.links.filter(l => l.roles.includes(role));
            if (links.length === 0) return null;
            return (
              <View key={cat.title} style={s.section}>
                <View style={s.sectionHead}>
                  <View style={[s.sectionPill, { backgroundColor: cat.accentBg }]}>
                    <VectorIcon iconSet="Ionicons" iconName={cat.icon} size={12} color={cat.accent} />
                    <Text style={[s.sectionPillText, { color: cat.accent }]}>{cat.title}</Text>
                  </View>
                  <View style={[s.sectionLine, { backgroundColor: cat.accent + '30' }]} />
                </View>
                <View style={[s.gridCard, { borderTopColor: cat.accent, borderTopWidth: 3 }]}>
                  <View style={s.grid}>
                    {links.map(item => (
                      <LinkTile key={item.route} item={item} />
                    ))}
                  </View>
                </View>
              </View>
            );
          })
        ) : (
          // ── Sidebar / Ascending (flat grid) ──
          <View style={s.section}>
            <View style={s.gridCard}>
              <View style={s.grid}>
                {orderedLinks.map(item => (
                  <LinkTile key={item.route} item={item} />
                ))}
              </View>
            </View>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
};

export default QuickLinksScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.border },

  // Heading
  header: {
    backgroundColor: theme.colors.card,
    paddingHorizontal: 16,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.sm,
    height: 60,
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: theme.colors.textPrimary,
  },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16,
    marginTop: 14,
    backgroundColor: theme.colors.card,
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 11,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  searchInput: { flex: 1, fontSize: 14, color: theme.colors.textPrimary, padding: 0 },

  // Order bar
  orderBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 4,
    zIndex: 50,
  },
  orderLabel: { fontSize: 13, fontWeight: '700', color: theme.colors.textSecondary },
  orderSelectWrap: { position: 'relative' },
  orderSelect: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: theme.colors.card,
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
    borderRadius: theme.radius.full,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  orderSelectText: { fontSize: 13, fontWeight: '700', color: theme.colors.primary },
  orderDropdown: {
    position: 'absolute',
    top: 44,
    right: 0,
    minWidth: 210,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  orderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  orderItemLast: { borderBottomWidth: 0 },
  orderItemActive: { backgroundColor: theme.colors.primaryLight },
  orderItemText: { flex: 1, fontSize: 13, fontWeight: '600', color: theme.colors.textSecondary },
  orderItemTextActive: { color: theme.colors.primary, fontWeight: '700' },

  // Scroll
  scroll: { paddingHorizontal: 16, paddingTop: 10 },

  // Section
  section: { marginBottom: 18 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  sectionPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 999,
  },
  sectionPillText: { fontSize: 12, fontWeight: '800' },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: theme.colors.textPrimary },
  sectionLine: { flex: 1, height: 1.5, borderRadius: 1 },

  // Grid card
  gridCard: {
    backgroundColor: theme.colors.card,
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 14,
    rowGap: 8,
  },

  // Grid tile
  item: {
    alignItems: 'center',
    paddingVertical: 10,
    gap: 7,
  },
  itemIconWrap: {
    width: 54, height: 54,
    borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  itemIconInner: {
    width: 44, height: 44,
    borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
  },
  itemLabel: {
    fontSize: 10.5, fontWeight: '700',
    color: theme.colors.textSecondary,
    textAlign: 'center', lineHeight: 14,
  },

  // Empty
  emptyBox: {
    alignItems: 'center', paddingVertical: 36,
    backgroundColor: theme.colors.card, borderRadius: 18,
    gap: 6,
  },
  emptyIconWrap: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: theme.colors.background,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: { fontSize: 15, fontWeight: '800', color: theme.colors.textPrimary },
  emptySubtitle: { fontSize: 12, color: theme.colors.textMuted },
});


// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
