import React, { useCallback, useMemo, useRef, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import VectorIcon from '../../components/VectorIcon';
import AppRefreshControl from '../../components/AppRefreshControl';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { DocHeader, DocNoData } from '../more/docUi';
import { RcIssueStudent, getReportCardIssueStudents } from '../../api/adminReportCardApi';
import { ListSkeleton, plural } from './adminStudentsUi';
import { RcState, RcStudentRow, stateOf } from './adminReportCardUi';

/**
 * One section's students — the panel's Issue Report Cards screen once a class
 * and section are loaded, drawn as the student app's lists are. A count, a
 * search (name, roll or admission number), then All / Eligible / Incomplete /
 * Issued as the panel's legend has them, with their counts. A student whose
 * every exam-subject mark is in, and who holds no card here yet, is eligible
 * and is ticked for the batch; one whose marks are not all in says how many
 * are missing; one with a card opens it. Select all eligible and Continue sit
 * at the foot, as on the panel; Continue asks what goes on the cards.
 */

type Tab = 'all' | RcState;

const TABS: { key: Tab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'eligible', label: 'Eligible' },
  { key: 'incomplete', label: 'Incomplete' },
  { key: 'issued', label: 'Issued' },
];

const AdminReportCardStudentsScreen = ({ navigation, route }: any) => {
  const classId: number = route?.params?.classId;
  const sectionId: number = route?.params?.sectionId;
  const className: string = route?.params?.className ?? '';
  const sectionName: string = route?.params?.sectionName ?? '';
  const title = [className, sectionName].filter(Boolean).join(' · ') || 'Students';
  const insets = useSafeAreaInsets();

  const [rows, setRows] = useState<RcIssueStudent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<Tab>('all');
  const [selected, setSelected] = useState<number[]>([]);

  const seq = useRef(0);
  const load = useCallback(async () => {
    const mine = ++seq.current;
    setError(null);
    try {
      const r = await getReportCardIssueStudents(classId, sectionId);
      if (mine !== seq.current) return;
      setRows(r);
      // A tick stays only on a student who is still eligible.
      const eligible = new Set(r.filter(x => stateOf(x) === 'eligible').map(x => x.id));
      setSelected(prev => prev.filter(id => eligible.has(id)));
    } catch (e) {
      if (mine === seq.current) setError(apiErr(e, 'Could not load the students.'));
    } finally {
      if (mine === seq.current) setRefreshing(false);
    }
  }, [classId, sectionId]);

  // Back from issuing (or a card revoked), the list is fresh.
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const all = useMemo(() => rows ?? [], [rows]);
  const q = search.trim().toLowerCase();
  // The search: name, roll or admission number.
  const found = useMemo(
    () => (q ? all.filter(r => [r.full_name, r.roll_no, r.admission_no].some(v => (v ?? '').toLowerCase().includes(q))) : all),
    [all, q],
  );
  const counts: Record<Tab, number> = {
    all: found.length,
    eligible: found.filter(r => stateOf(r) === 'eligible').length,
    incomplete: found.filter(r => stateOf(r) === 'incomplete').length,
    issued: found.filter(r => stateOf(r) === 'issued').length,
  };
  const list = tab === 'all' ? found : found.filter(r => stateOf(r) === tab);

  const eligibleAll = all.filter(r => stateOf(r) === 'eligible');
  const issuedAll = all.filter(r => stateOf(r) === 'issued').length;
  const allTicked = eligibleAll.length > 0 && selected.length === eligibleAll.length;

  const countLine = q
    ? `${plural(found.length, 'student')} found`
    : `${plural(all.length, 'student')} · ${issuedAll} issued · ${eligibleAll.length} eligible`;

  const toggle = (id: number) => setSelected(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  const toggleAll = () => setSelected(allTicked ? [] : eligibleAll.map(r => r.id));

  const onRow = (st: RcIssueStudent) => {
    const state = stateOf(st);
    if (state === 'issued' && st.report_card_id) {
      navigation.navigate('AdminReportCardView', { id: st.report_card_id, name: st.full_name });
    } else if (state === 'eligible') {
      toggle(st.id);
    }
  };

  const proceed = () => {
    const picked = all
      .filter(r => selected.includes(r.id))
      .sort((a, b) => a.full_name.localeCompare(b.full_name))
      .map(r => ({ id: r.id, full_name: r.full_name, admission_no: r.admission_no, registration_number: r.registration_number ?? '' }));
    navigation.navigate('AdminReportCardIssue', { classId, className, sectionId, sectionName, students: picked });
  };

  const emptyTitle = q
    ? 'No students found'
    : tab === 'eligible'
      ? 'Nobody is ready yet'
      : tab === 'incomplete'
        ? 'Every student’s marks are in'
        : tab === 'issued'
          ? 'No report cards issued yet'
          : 'No students found';
  const emptySub = q
    ? 'Nothing here matches the search.'
    : tab === 'eligible'
      ? 'A student is eligible once every exam-subject mark is in and no card is issued yet.'
      : tab === 'incomplete'
        ? 'No student here is missing marks.'
        : tab === 'issued'
          ? 'Tick eligible students and Continue to issue their cards.'
          : 'No students are enrolled in this class and section.';

  return (
    <View style={s.root}>
      <DocHeader title={title} onBackPress={() => navigation.goBack()} />

      <View style={s.searchWrap}>
        <View style={s.searchRow}>
          <VectorIcon iconSet="Ionicons" iconName="search" size={16} color={theme.colors.textMuted} />
          <TextInput
            style={s.searchInput}
            placeholder="Search name, roll, admission"
            placeholderTextColor={theme.colors.textMuted}
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
          />
          {!!search && (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}>
              <VectorIcon iconSet="Ionicons" iconName="close" size={16} color={theme.colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* All / Eligible / Incomplete / Issued — the panel's legend, as the student app's tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabsBar} contentContainerStyle={s.tabs}>
        {TABS.map(t => {
          const active = tab === t.key;
          return (
            <TouchableOpacity key={t.key} activeOpacity={0.6} onPress={() => setTab(t.key)} style={[s.tab, active && s.tabActive]}>
              <Text style={[s.tabText, active && s.tabTextActive]}>
                {t.label}
                <Text style={s.tabCount}>{`  ${rows ? counts[t.key] : ''}`}</Text>
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      <View style={s.fullDivider} />

      {!rows && !error ? (
        <ListSkeleton photo />
      ) : error && !rows ? (
        <View style={s.centered}>
          <VectorIcon iconSet="Ionicons" iconName="cloud-offline-outline" size={32} color={theme.colors.textMuted} />
          <Text style={s.errorText}>{error}</Text>
          <TouchableOpacity onPress={load} hitSlop={10}>
            <Text style={s.link}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={list}
          keyExtractor={i => String(i.id)}
          contentContainerStyle={[s.list, list.length === 0 && s.listEmpty]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          ListHeaderComponent={all.length > 0 ? <Text style={s.count}>{countLine}</Text> : null}
          ListEmptyComponent={<DocNoData icon={q ? 'search-outline' : 'document-text-outline'} title={emptyTitle} subtitle={emptySub} />}
          renderItem={({ item, index }) => (
            <RcStudentRow
              student={item}
              selected={selected.includes(item.id)}
              isLast={index === list.length - 1}
              onPress={() => onRow(item)}
            />
          )}
        />
      )}

      {/* Select all eligible, and Continue — as the panel's footer */}
      {eligibleAll.length > 0 && (
        <View style={[s.foot, { paddingBottom: insets.bottom + 12 }]}>
          <TouchableOpacity style={s.selectAll} onPress={toggleAll} hitSlop={8} activeOpacity={0.6}>
            <VectorIcon
              iconSet="Ionicons"
              iconName={allTicked ? 'checkbox' : 'square-outline'}
              size={20}
              color={allTicked ? theme.colors.primary : theme.colors.textMuted}
            />
            <Text style={s.selectAllText}>{`Select all eligible (${selected.length}/${eligibleAll.length})`}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.continueBtn, selected.length === 0 && s.idle]}
            onPress={proceed}
            disabled={selected.length === 0}
            activeOpacity={0.85}
          >
            <Text style={s.continueText}>{selected.length > 0 ? `Continue (${selected.length})` : 'Continue'}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

export default AdminReportCardStudentsScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },

  // Search
  searchWrap: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 2 },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 44,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
  },
  searchInput: { flex: 1, fontSize: 15, color: theme.colors.textPrimary, padding: 0 },

  // Tabs. A horizontal ScrollView grows to fill a column by default, so the
  // bar is held to its content.
  tabsBar: { flexGrow: 0 },
  tabs: { paddingHorizontal: 20, paddingTop: 12, gap: 20 },
  tab: { paddingBottom: 10, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: theme.colors.primary },
  tabText: { fontSize: 13, fontWeight: '500', color: theme.colors.textSecondary },
  tabTextActive: { color: theme.colors.primary, fontWeight: '600' },
  tabCount: { fontWeight: '400', color: theme.colors.textMuted },
  fullDivider: { height: 1, backgroundColor: theme.colors.border },

  // List
  list: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 40 },
  listEmpty: { flexGrow: 1 },
  count: { fontSize: 12, color: theme.colors.textMuted, paddingTop: 12, paddingBottom: 2 },

  // Foot
  foot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.card,
  },
  selectAll: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  selectAllText: { flexShrink: 1, fontSize: 13, fontWeight: '500', color: theme.colors.textPrimary },
  continueBtn: {
    height: 44,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  idle: { opacity: 0.5 },
  continueText: { fontSize: 14, fontWeight: '700', color: theme.colors.white },

  // Error
  centered: { alignItems: 'center', paddingTop: 72, paddingHorizontal: 24, gap: 10 },
  errorText: { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  link: { fontSize: 14, fontWeight: '600', color: theme.colors.primary },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
