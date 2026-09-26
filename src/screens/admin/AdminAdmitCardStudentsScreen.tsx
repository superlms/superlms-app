import React, { useCallback, useMemo, useRef, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import VectorIcon from '../../components/VectorIcon';
import AppRefreshControl from '../../components/AppRefreshControl';
import { AppAlert } from '../../components/AppDialog';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { DocHeader, DocNoData } from '../more/docUi';
import { AdmitStudent, getAdmitStudents, issueAdmitCard } from '../../api/adminAdmitCardApi';
import { ListSkeleton, plural } from './adminStudentsUi';
import { AdmitStudentRow, HeadActions, HeadBtn } from './adminAdmitCardUi';

/**
 * A class's (or one section's) students for an exam, in roll order — the web
 * page's list once an exam and a class are picked. A count, a search (name,
 * roll or admission number), then All / Issued / Not issued as the student
 * app's exam tabs are drawn. A student with a card opens it; one without has
 * Issue, which gives them this exam's card on the spot.
 */

type Tab = 'all' | 'issued' | 'not_issued';

const TABS: { key: Tab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'issued', label: 'Issued' },
  { key: 'not_issued', label: 'Not issued' },
];

const AdminAdmitCardStudentsScreen = ({ navigation, route }: any) => {
  const exam: { id: number; name: string } = route?.params?.exam;
  const classId: number = route?.params?.classId;
  const sectionId: number | undefined = route?.params?.sectionId;
  const title =
    [route?.params?.className, route?.params?.sectionName].filter(Boolean).join(' · ') || 'Students';

  const [rows, setRows] = useState<AdmitStudent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<Tab>('all');
  const [busyId, setBusyId] = useState<number | null>(null);

  const seq = useRef(0);
  const load = useCallback(async () => {
    const mine = ++seq.current;
    setError(null);
    try {
      const r = await getAdmitStudents({
        exam_id: exam.id,
        standard_id: classId,
        section_id: sectionId ?? null,
        per_page: 1000,
      });
      if (mine === seq.current) setRows(r.data);
    } catch (e) {
      if (mine === seq.current) setError(apiErr(e, 'Could not load the students.'));
    } finally {
      if (mine === seq.current) setRefreshing(false);
    }
  }, [exam.id, classId, sectionId]);

  // Back from a card (deleted, or printed), the list is fresh.
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const issue = async (st: AdmitStudent) => {
    setBusyId(st.id);
    try {
      const res = await issueAdmitCard(exam.id, st.id);
      if (res?.already) AppAlert.alert('Already issued', 'This student already has an admit card for this exam.');
      await load();
    } catch (e) {
      AppAlert.alert('Could not issue', apiErr(e, 'The admit card could not be issued.'));
    } finally {
      setBusyId(null);
    }
  };

  const all = useMemo(() => rows ?? [], [rows]);
  const q = search.trim().toLowerCase();
  // The web's search: name, roll or admission number.
  const found = useMemo(
    () =>
      q
        ? all.filter(r =>
            [r.full_name, r.roll_no, r.admission_no].some(v => (v ?? '').toLowerCase().includes(q)),
          )
        : all,
    [all, q],
  );
  const counts: Record<Tab, number> = {
    all: found.length,
    issued: found.filter(r => r.issued).length,
    not_issued: found.filter(r => !r.issued).length,
  };
  const list = tab === 'all' ? found : found.filter(r => (tab === 'issued' ? r.issued : !r.issued));

  const issuedAll = all.filter(r => r.issued).length;
  const countLine = q
    ? `${plural(found.length, 'student')} found`
    : `${exam.name} · ${plural(all.length, 'student')} · ${issuedAll} issued`;

  const emptyTitle = q
    ? 'No students found'
    : tab === 'issued'
      ? 'No cards issued yet'
      : tab === 'not_issued'
        ? 'Every card is issued'
        : 'No students here yet';
  const emptySub = q
    ? 'Nothing here matches the search.'
    : tab === 'issued'
      ? 'Issue a card from a student’s row, or a whole class with + at the top.'
      : tab === 'not_issued'
        ? 'Every student here holds this exam’s card.'
        : 'Students added to this class will appear here.';

  return (
    <View style={s.root}>
      <DocHeader
        title={title}
        onBackPress={() => navigation.goBack()}
        rightSlot={
          <HeadActions>
            <HeadBtn
              icon="print-outline"
              onPress={() => navigation.navigate('AdminAdmitCardPrint', { examId: exam.id, classId, sectionId })}
            />
            <HeadBtn
              icon="add"
              onPress={() => navigation.navigate('AdminAdmitCardIssue', { examId: exam.id, classId, sectionId })}
            />
          </HeadActions>
        }
      />

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
          />
          {!!search && (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}>
              <VectorIcon iconSet="Ionicons" iconName="close" size={16} color={theme.colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* All / Issued / Not issued — the student app's exam tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabsBar} contentContainerStyle={s.tabs}>
        {TABS.map(t => {
          const active = tab === t.key;
          return (
            <TouchableOpacity
              key={t.key}
              activeOpacity={0.6}
              onPress={() => setTab(t.key)}
              style={[s.tab, active && s.tabActive]}
            >
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
          ListEmptyComponent={
            <DocNoData icon={q ? 'search-outline' : 'card-outline'} title={emptyTitle} subtitle={emptySub} />
          }
          renderItem={({ item, index }) => (
            <AdmitStudentRow
              student={item}
              isLast={index === list.length - 1}
              busy={busyId === item.id}
              onOpen={() =>
                item.admit_card_id &&
                navigation.navigate('AdminAdmitCardView', { id: item.admit_card_id, name: item.full_name })
              }
              onIssue={() => issue(item)}
            />
          )}
        />
      )}
    </View>
  );
};

export default AdminAdmitCardStudentsScreen;

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

  // Error
  centered: { alignItems: 'center', paddingTop: 72, paddingHorizontal: 24, gap: 10 },
  errorText: { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  link: { fontSize: 14, fontWeight: '600', color: theme.colors.primary },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
