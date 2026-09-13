import React, { useMemo, useState } from 'react';
import {
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Header from '../../components/Header';
import VectorIcon from '../../components/VectorIcon';
import { theme, onThemeChange } from '../../utils/theme';
import { DocNoData } from '../more/docUi';

/**
 * Every screen in one place, as a quiet grid: a plain icon on the page's grey
 * and its name under it. Search narrows the grid; the tabs choose between the
 * sidebar's order, A to Z, and the links gathered by category.
 */

const { width } = Dimensions.get('window');
// Four columns across the page, inside its 20px margins.
const COLUMNS = 4;
const ITEM_WIDTH = (width - 40) / COLUMNS;

type Role = 'student' | 'teacher';

interface QuickLink {
  label: string;
  icon: string;
  route: string;
  roles: Role[];
}

interface Category {
  title: string;
  links: QuickLink[];
}

const CATEGORIES: Category[] = [
  {
    title: 'Academics',
    links: [
      { label: 'Subjects', icon: 'library-outline', route: 'Subjects', roles: ['student', 'teacher'] },
      { label: 'Syllabus', icon: 'layers-outline', route: 'Syllabus', roles: ['student', 'teacher'] },
      { label: 'Timetable', icon: 'time-outline', route: 'Timetable', roles: ['student', 'teacher'] },
      { label: 'Content', icon: 'folder-open-outline', route: 'Content', roles: ['student', 'teacher'] },
      { label: 'Homework', icon: 'book-outline', route: 'Homework', roles: ['student', 'teacher'] },
      { label: 'Quiz', icon: 'help-circle-outline', route: 'Quiz', roles: ['student', 'teacher'] },
    ],
  },
  {
    title: 'Exams & Results',
    links: [
      { label: 'Exams', icon: 'document-text-outline', route: 'Exams', roles: ['student', 'teacher'] },
      { label: 'Admit Card', icon: 'card-outline', route: 'AdmitCardScreen', roles: ['student'] },
      { label: 'Seating Plan', icon: 'grid-outline', route: 'SeatingPlanScreen', roles: ['student'] },
      { label: 'Exam Copy', icon: 'copy-outline', route: 'ExamCopyScreen', roles: ['student'] },
      { label: 'Report Card', icon: 'ribbon-outline', route: 'ReportCardScreen', roles: ['student'] },
      { label: 'Performance', icon: 'trending-up-outline', route: 'PerformanceScreen', roles: ['student'] },
      { label: 'Upload Copy', icon: 'cloud-upload-outline', route: 'UploadCopyScreen', roles: ['teacher'] },
      { label: 'Upload Marks', icon: 'create-outline', route: 'UploadMarksScreen', roles: ['teacher'] },
    ],
  },
  {
    title: 'Attendance',
    links: [
      { label: 'Attendance', icon: 'calendar-outline', route: 'Attendance', roles: ['student', 'teacher'] },
      { label: 'Mark Attendance', icon: 'checkbox-outline', route: 'MarkAttendance', roles: ['teacher'] },
    ],
  },
  {
    title: 'Finance',
    links: [{ label: 'Fees', icon: 'cash-outline', route: 'Fees', roles: ['student'] }],
  },
  {
    title: 'Communication',
    links: [
      { label: 'Chats', icon: 'chatbubbles-outline', route: 'Chats', roles: ['student', 'teacher'] },
      { label: 'Announcements', icon: 'megaphone-outline', route: 'Announcement', roles: ['student', 'teacher'] },
      { label: 'Contact', icon: 'call-outline', route: 'ContactSchool', roles: ['student', 'teacher'] },
      { label: 'Notifications', icon: 'notifications-outline', route: 'Notifications', roles: ['student', 'teacher'] },
    ],
  },
  {
    title: 'Resources',
    links: [
      { label: 'Books', icon: 'bookmarks-outline', route: 'Book', roles: ['student', 'teacher'] },
      { label: 'Instructors', icon: 'person-outline', route: 'Instructor', roles: ['student'] },
      { label: 'Transport', icon: 'bus-outline', route: 'Transport', roles: ['student'] },
      { label: 'Calendar', icon: 'calendar-number-outline', route: 'Calendar', roles: ['student', 'teacher'] },
    ],
  },
  {
    title: 'Account',
    links: [
      { label: 'Settings', icon: 'settings-outline', route: 'Settings', roles: ['student', 'teacher'] },
      { label: 'ID Card', icon: 'id-card-outline', route: 'IDCard', roles: ['student', 'teacher'] },
      { label: 'More', icon: 'apps-outline', route: 'More', roles: ['student', 'teacher'] },
    ],
  },
];

// Route order as it appears in the drawer sidebar (DrawerNavigator menus).
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

const ORDER_TABS: { key: OrderKey; label: string }[] = [
  { key: 'sidebar', label: 'Sidebar order' },
  { key: 'ascending', label: 'A to Z' },
  { key: 'category', label: 'By category' },
];

const ALL_LINKS: QuickLink[] = CATEGORIES.flatMap(c => c.links);

// ── One link ─────────────────────────────────────────────────────────────────
const LinkTile = ({ item, onPress }: { item: QuickLink; onPress: (route: string) => void }) => (
  <TouchableOpacity style={s.item} activeOpacity={0.6} onPress={() => onPress(item.route)}>
    <View style={s.itemIcon}>
      <VectorIcon iconSet="Ionicons" iconName={item.icon} size={22} color={theme.colors.textSecondary} />
    </View>
    <Text style={s.itemLabel} numberOfLines={2}>
      {item.label}
    </Text>
  </TouchableOpacity>
);

const Grid = ({ links, onPress }: { links: QuickLink[]; onPress: (route: string) => void }) => (
  <View style={s.grid}>
    {links.map(item => (
      <LinkTile key={item.route} item={item} onPress={onPress} />
    ))}
  </View>
);

const QuickLinksScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const role: Role = route?.params?.userRole === 'teacher' ? 'teacher' : 'student';

  const [search, setSearch] = useState('');
  const [order, setOrder] = useState<OrderKey>('sidebar');

  const q = search.toLowerCase().trim();

  const navigate = (r: string) =>
    navigation.navigate(r, r === 'Notifications' ? { role } : undefined);

  const roleLinks = useMemo(() => ALL_LINKS.filter(l => l.roles.includes(role)), [role]);

  const searchResults = useMemo(
    () => (q ? roleLinks.filter(l => l.label.toLowerCase().includes(q)) : []),
    [q, roleLinks],
  );

  const orderedLinks = useMemo(() => {
    if (order === 'ascending') {
      return [...roleLinks].sort((a, b) => a.label.localeCompare(b.label));
    }
    const seq = SIDEBAR_ORDER[role];
    const idx = (r: string) => {
      const i = seq.indexOf(r);
      return i === -1 ? seq.length + 1 : i;
    };
    return [...roleLinks].sort((a, b) => idx(a.route) - idx(b.route));
  }, [order, roleLinks, role]);

  return (
    <View style={s.root}>
      <Header title="Quick Links" showBack={false} divider height={50} />

      {/* Search */}
      <View style={s.search}>
        <VectorIcon iconSet="Ionicons" iconName="search-outline" size={16} color={theme.colors.textMuted} />
        <TextInput
          style={s.searchInput}
          placeholder="Search quick links"
          placeholderTextColor={theme.colors.textMuted}
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')} hitSlop={8} activeOpacity={0.6}>
            <VectorIcon iconSet="Ionicons" iconName="close-circle" size={16} color={theme.colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* How to lay the links out — hidden while searching, which has one answer */}
      {q.length === 0 && (
        <>
          <View style={s.tabs}>
            {ORDER_TABS.map(t => {
              const active = t.key === order;
              return (
                <TouchableOpacity
                  key={t.key}
                  activeOpacity={0.6}
                  onPress={() => setOrder(t.key)}
                  style={[s.tab, active && s.tabActive]}
                >
                  <Text style={[s.tabText, active && s.tabTextActive]}>{t.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={s.fullDivider} />
        </>
      )}

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={s.scroll}
      >
        {q.length > 0 ? (
          searchResults.length === 0 ? (
            <DocNoData
              icon="search-outline"
              title="No matches"
              subtitle={`Nothing in quick links matches “${search.trim()}”.`}
            />
          ) : (
            <View style={s.block}>
              <Grid links={searchResults} onPress={navigate} />
            </View>
          )
        ) : order === 'category' ? (
          CATEGORIES.map((cat, i) => {
            const links = cat.links.filter(l => l.roles.includes(role));
            if (links.length === 0) return null;
            return (
              <View key={cat.title}>
                {i > 0 && <View style={s.sectionDivider} />}
                <View style={s.block}>
                  <Text style={s.sectionTitle}>{cat.title}</Text>
                  <Grid links={links} onPress={navigate} />
                </View>
              </View>
            );
          })
        ) : (
          <View style={s.block}>
            <Grid links={orderedLinks} onPress={navigate} />
          </View>
        )}
      </ScrollView>
    </View>
  );
};

export default QuickLinksScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },

  // Search
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 42,
    marginHorizontal: 20,
    marginTop: 14,
    paddingHorizontal: 12,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.background,
  },
  searchInput: { flex: 1, fontSize: 14, color: theme.colors.textPrimary, paddingVertical: 0 },

  // Order tabs
  tabs: { flexDirection: 'row', gap: 20, paddingHorizontal: 20, paddingTop: 14 },
  tab: { paddingBottom: 10, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: theme.colors.primary },
  tabText: { fontSize: 13, fontWeight: '500', color: theme.colors.textSecondary },
  tabTextActive: { color: theme.colors.primary, fontWeight: '600' },
  fullDivider: { height: 1, backgroundColor: theme.colors.border },

  // Content
  scroll: { flexGrow: 1, paddingBottom: 40 },
  block: { paddingHorizontal: 20, paddingTop: 16 },
  sectionDivider: { height: 1, backgroundColor: theme.colors.divider, marginTop: 8 },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: theme.colors.textSecondary, marginBottom: 4 },

  // Grid
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 6 },
  item: { width: ITEM_WIDTH, alignItems: 'center', paddingVertical: 10, gap: 8 },
  itemIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemLabel: {
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
    color: theme.colors.textPrimary,
    textAlign: 'center',
    paddingHorizontal: 4,
  },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
