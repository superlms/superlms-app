import React, { useCallback, useMemo, useState } from 'react';
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
import AsyncStorage from '@react-native-async-storage/async-storage';
import Header from '../../components/Header';
import VectorIcon from '../../components/VectorIcon';
import { useFocusLoad } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';
import { DocNoData } from '../more/docUi';

/**
 * Every screen in one place. The ones opened most recently sit on top, so the
 * page earns its name; below them, every link as a tile — its icon in the
 * accent colour on a quiet grey card, the name on one line — in the sidebar's
 * order, A to Z, or gathered by category. Search narrows it all to one grid.
 */

const { width } = Dimensions.get('window');
const COLUMNS = 3;
const GAP = 10;
// Three tiles and their two gaps across the page, inside its 20px margins.
const TILE_WIDTH = (width - 40 - GAP * (COLUMNS - 1)) / COLUMNS;
// The last row has to clear the raised Quick Links button in the tab bar.
const BOTTOM_CLEARANCE = 110;
const RECENT_MAX = 3;

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
      { label: 'Homework', icon: 'create-outline', route: 'Homework', roles: ['student', 'teacher'] },
      { label: 'Quiz', icon: 'help-circle-outline', route: 'Quiz', roles: ['student', 'teacher'] },
    ],
  },
  {
    title: 'Exams & Results',
    links: [
      { label: 'Exams', icon: 'school-outline', route: 'Exams', roles: ['student', 'teacher'] },
      { label: 'Admit Card', icon: 'card-outline', route: 'AdmitCardScreen', roles: ['student'] },
      { label: 'Seating Plan', icon: 'grid-outline', route: 'SeatingPlanScreen', roles: ['student'] },
      { label: 'Exam Copy', icon: 'copy-outline', route: 'ExamCopyScreen', roles: ['student'] },
      { label: 'Report Card', icon: 'ribbon-outline', route: 'ReportCardScreen', roles: ['student'] },
      { label: 'Performance', icon: 'trending-up-outline', route: 'PerformanceScreen', roles: ['student'] },
      { label: 'Upload Copy', icon: 'cloud-upload-outline', route: 'UploadCopyScreen', roles: ['teacher'] },
      { label: 'Upload Marks', icon: 'document-text-outline', route: 'UploadMarksScreen', roles: ['teacher'] },
    ],
  },
  {
    title: 'Attendance',
    links: [
      { label: 'Attendance', icon: 'clipboard-outline', route: 'Attendance', roles: ['student', 'teacher'] },
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
      { label: 'Contact School', icon: 'call-outline', route: 'ContactSchool', roles: ['student', 'teacher'] },
      { label: 'Notifications', icon: 'notifications-outline', route: 'Notifications', roles: ['student', 'teacher'] },
    ],
  },
  {
    title: 'Resources',
    links: [
      { label: 'Books', icon: 'book-outline', route: 'Book', roles: ['student', 'teacher'] },
      { label: 'Instructors', icon: 'person-outline', route: 'Instructor', roles: ['student'] },
      { label: 'Transport', icon: 'bus-outline', route: 'Transport', roles: ['student'] },
      { label: 'Calendar', icon: 'calendar-outline', route: 'Calendar', roles: ['student', 'teacher'] },
    ],
  },
  {
    title: 'Account',
    links: [
      { label: 'ID Card', icon: 'id-card-outline', route: 'IDCard', roles: ['student', 'teacher'] },
      { label: 'Settings', icon: 'settings-outline', route: 'Settings', roles: ['student', 'teacher'] },
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

// Recently opened links are remembered on the device, per role.
const recentKey = (role: Role) => `quick_links_recent_${role}`;

// ── One link ─────────────────────────────────────────────────────────────────
const LinkTile = ({ item, onPress }: { item: QuickLink; onPress: (route: string) => void }) => (
  <TouchableOpacity style={s.tile} activeOpacity={0.6} onPress={() => onPress(item.route)}>
    <VectorIcon iconSet="Ionicons" iconName={item.icon} size={24} color={theme.colors.primary} />
    <Text style={s.tileLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
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

const Section = ({
  title,
  count,
  first,
  children,
}: {
  title: string;
  count?: number;
  first?: boolean;
  children: React.ReactNode;
}) => (
  <View style={[s.section, first && s.sectionFirst]}>
    <Text style={s.sectionTitle}>
      {title}
      {count != null && <Text style={s.sectionCount}>{`  ${count}`}</Text>}
    </Text>
    {children}
  </View>
);

const QuickLinksScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const role: Role = route?.params?.userRole === 'teacher' ? 'teacher' : 'student';

  const [search, setSearch] = useState('');
  const [order, setOrder] = useState<OrderKey>('sidebar');
  const [recent, setRecent] = useState<string[]>([]);

  // Re-read on every visit, so what was just opened is already on top.
  const loadRecent = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(recentKey(role));
      const list = raw ? JSON.parse(raw) : [];
      setRecent(Array.isArray(list) ? list.filter((x: unknown) => typeof x === 'string') : []);
    } catch {
      setRecent([]);
    }
  }, [role]);

  useFocusLoad(loadRecent);

  const q = search.toLowerCase().trim();

  const roleLinks = useMemo(() => ALL_LINKS.filter(l => l.roles.includes(role)), [role]);

  const navigate = (r: string) => {
    // Remember it first — the screen is already behind us once navigation runs.
    const next = [r, ...recent.filter(x => x !== r)].slice(0, RECENT_MAX);
    setRecent(next);
    AsyncStorage.setItem(recentKey(role), JSON.stringify(next)).catch(() => {});
    navigation.navigate(r, r === 'Notifications' ? { role } : undefined);
  };

  const recentLinks = useMemo(
    () =>
      recent
        .map(r => roleLinks.find(l => l.route === r))
        .filter((l): l is QuickLink => !!l),
    [recent, roleLinks],
  );

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

  const searching = q.length > 0;

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
      {!searching && (
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
        {searching ? (
          searchResults.length === 0 ? (
            <DocNoData
              icon="search-outline"
              title="No matches"
              subtitle={`Nothing in quick links matches “${search.trim()}”.`}
            />
          ) : (
            <Section title="Results" count={searchResults.length} first>
              <Grid links={searchResults} onPress={navigate} />
            </Section>
          )
        ) : (
          <>
            {recentLinks.length > 0 && (
              <Section title="Recently opened" first>
                <Grid links={recentLinks} onPress={navigate} />
              </Section>
            )}

            {order === 'category' ? (
              CATEGORIES.map((cat, i) => {
                const links = cat.links.filter(l => l.roles.includes(role));
                if (links.length === 0) return null;
                return (
                  <Section
                    key={cat.title}
                    title={cat.title}
                    first={i === 0 && recentLinks.length === 0}
                  >
                    <Grid links={links} onPress={navigate} />
                  </Section>
                );
              })
            ) : (
              <Section title="All links" count={orderedLinks.length} first={recentLinks.length === 0}>
                <Grid links={orderedLinks} onPress={navigate} />
              </Section>
            )}
          </>
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
    marginTop: 12,
    paddingHorizontal: 12,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.background,
  },
  searchInput: { flex: 1, fontSize: 14, color: theme.colors.textPrimary, paddingVertical: 0 },

  // Order tabs
  tabs: { flexDirection: 'row', gap: 20, paddingHorizontal: 20, paddingTop: 12 },
  tab: { paddingBottom: 10, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: theme.colors.primary },
  tabText: { fontSize: 13, fontWeight: '500', color: theme.colors.textSecondary },
  tabTextActive: { color: theme.colors.primary, fontWeight: '600' },
  fullDivider: { height: 1, backgroundColor: theme.colors.border },

  // Content
  scroll: { flexGrow: 1, paddingHorizontal: 20, paddingBottom: BOTTOM_CLEARANCE },
  section: { paddingTop: 22 },
  sectionFirst: { paddingTop: 16 },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: theme.colors.textSecondary, marginBottom: 10 },
  sectionCount: { fontWeight: '400', color: theme.colors.textMuted },

  // Tiles
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  tile: {
    width: TILE_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.background,
  },
  tileLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: theme.colors.textPrimary,
    textAlign: 'center',
  },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
