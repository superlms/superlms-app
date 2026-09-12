import React, { useCallback, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import VectorIcon from '../../components/VectorIcon';
import Header from '../../components/Header';
import { Skeleton } from '../../components/Skeleton';
import FilterSheet from '../../components/FilterSheet';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useRefresh } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { CardType, IdCardRow, IdCardAnalytics, getIdCards } from '../../api/adminIdCardApi';
import { DocNoData } from '../more/docUi';

const TITLE = 'ID Cards';

const TYPES: { key: CardType; label: string }[] = [
  { key: 'student', label: 'Students' },
  { key: 'teacher', label: 'Teachers' },
  { key: 'employee', label: 'Employees' },
];

// ── One card as a plain three-line row ───────────────────────────────────────
const CardRow = ({
  row,
  isLast,
  onPress,
}: {
  row: IdCardRow;
  isLast: boolean;
  onPress: () => void;
}) => {
  const meta = [
    row.card_number,
    row.expiry_date ? `Exp ${row.expiry_date}` : null,
    row.status ? row.status.charAt(0).toUpperCase() + row.status.slice(1) : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <TouchableOpacity
      style={[s.row, !isLast && s.rowDivider]}
      activeOpacity={0.6}
      onPress={onPress}
    >
      <Text style={s.rowTitle} numberOfLines={1}>
        {row.name ?? '—'}
      </Text>
      {!!row.subtitle && (
        <Text style={s.rowSub} numberOfLines={1}>
          {row.subtitle}
        </Text>
      )}
      <Text style={s.rowMeta} numberOfLines={1}>
        {meta}
      </Text>
    </TouchableOpacity>
  );
};

const AdminIdCardScreen = ({ navigation }: any) => {
  const [type, setType] = useState<CardType>('student');
  const [rows, setRows] = useState<IdCardRow[]>([]);
  const [analytics, setAnalytics] = useState<IdCardAnalytics | null>(null);
  const [standards, setStandards] = useState<{ id: number; name: string }[]>([]);
  const [sections, setSections] = useState<{ id: number; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);

  const [fStd, setFStd] = useState<number | 0>(0);
  const [fSec, setFSec] = useState<number | 0>(0);
  const [fStatus, setFStatus] = useState<'' | 'active' | 'inactive'>('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getIdCards({
        type,
        search: search.trim() || undefined,
        standard: type === 'student' && fStd ? fStd : undefined,
        section: type === 'student' && fSec ? fSec : undefined,
        status: fStatus || undefined,
      });
      setRows(res.cards);
      setAnalytics(res.analytics);
      setStandards(res.standards);
      setSections(res.sections);
    } catch (e) {
      setError(apiErr(e, 'Could not load ID cards.'));
    } finally {
      setLoading(false);
    }
  }, [type, search, fStd, fSec, fStatus]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const { refreshing, onRefresh } = useRefresh(load);

  const activeFilters = (fStd ? 1 : 0) + (fSec ? 1 : 0) + (fStatus ? 1 : 0);
  const opt = (arr: { id: number; name: string }[]) => [
    { label: 'All', value: 0 },
    ...arr.map(x => ({ label: x.name, value: x.id })),
  ];

  const filterSections = [
    ...(type === 'student'
      ? [
          { key: 'std', title: 'Class', options: opt(standards), value: fStd, onChange: (v: any) => setFStd(v) },
          { key: 'sec', title: 'Section', options: opt(sections), value: fSec, onChange: (v: any) => setFSec(v) },
        ]
      : []),
    {
      key: 'status',
      title: 'Status',
      options: [
        { label: 'All', value: '' },
        { label: 'Active', value: 'active' },
        { label: 'Inactive', value: 'inactive' },
      ],
      value: fStatus,
      onChange: (v: any) => setFStatus(v),
    },
  ];

  const summary = analytics
    ? `${analytics.total} total · ${analytics.issued} issued · ${analytics.remaining} remaining`
    : '';

  return (
    <View style={s.root}>
      <Header
        title={TITLE}
        divider
        height={50}
        onBackPress={() =>
          navigation.canGoBack() ? navigation.goBack() : navigation.navigate('PanelHome')
        }
        rightSlot={
          <View style={s.headActions}>
            <TouchableOpacity
              style={s.headBtn}
              activeOpacity={0.6}
              hitSlop={6}
              onPress={() => setFilterOpen(true)}
            >
              <VectorIcon iconSet="Ionicons" iconName="filter" size={18} color={theme.colors.primary} />
              {activeFilters > 0 && <View style={s.headDot} />}
            </TouchableOpacity>
            <TouchableOpacity
              style={s.headBtn}
              activeOpacity={0.6}
              hitSlop={6}
              onPress={() => navigation.navigate('AdminIdCardGenerate', { type, standards })}
            >
              <VectorIcon iconSet="Ionicons" iconName="add" size={22} color={theme.colors.primary} />
            </TouchableOpacity>
          </View>
        }
      />

      {/* Who the cards are for — the web page's tab strip */}
      <View style={s.tabs}>
        {TYPES.map(t => {
          const active = type === t.key;
          return (
            <TouchableOpacity
              key={t.key}
              style={[s.tab, active && s.tabActive]}
              activeOpacity={0.6}
              onPress={() => {
                setType(t.key);
                setSearch('');
                setFStd(0);
                setFSec(0);
                setFStatus('');
              }}
            >
              <Text style={[s.tabText, active && s.tabTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <View style={s.fullDivider} />

      {/* Search and the running totals */}
      <View style={s.searchWrap}>
        <View style={s.searchRow}>
          <VectorIcon iconSet="Ionicons" iconName="search" size={16} color={theme.colors.textMuted} />
          <TextInput
            style={s.searchInput}
            placeholder="Search name or card number"
            placeholderTextColor={theme.colors.textMuted}
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={load}
            returnKeyType="search"
          />
          {!!search && (
            <TouchableOpacity onPress={() => { setSearch(''); }} hitSlop={8}>
              <VectorIcon iconSet="Ionicons" iconName="close" size={16} color={theme.colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
        {!!summary && <Text style={s.summary}>{summary}</Text>}
      </View>
      <View style={s.fullDivider} />

      {loading && !refreshing ? (
        <View style={s.list}>
          {[0, 1, 2, 3, 4].map(i => (
            <View key={i} style={[s.skeletonRow, i < 4 && s.rowDivider]}>
              <Skeleton width="55%" height={14} />
              <Skeleton width="35%" height={12} />
              <Skeleton width="70%" height={10} />
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
          {rows.length === 0 ? (
            <DocNoData
              icon="card-outline"
              title="No ID cards found"
              subtitle="Use the plus at the top to issue a batch."
            />
          ) : (
            rows.map((r, i) => (
              <CardRow
                key={r.id}
                row={r}
                isLast={i === rows.length - 1}
                onPress={() => navigation.navigate('AdminIdCardView', { type, card: r })}
              />
            ))
          )}
        </ScrollView>
      )}

      <FilterSheet
        visible={filterOpen}
        onClose={() => setFilterOpen(false)}
        onClear={() => { setFStd(0); setFSec(0); setFStatus(''); }}
        sections={filterSections}
      />
    </View>
  );
};

export default AdminIdCardScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },

  headActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headBtn: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  headDot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.primary,
  },

  // Tabs
  tabs: { flexDirection: 'row', gap: 22, paddingHorizontal: 20 },
  tab: { paddingTop: 14, paddingBottom: 10, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: theme.colors.primary },
  tabText: { fontSize: 13, fontWeight: '500', color: theme.colors.textSecondary },
  tabTextActive: { color: theme.colors.primary, fontWeight: '600' },

  fullDivider: { height: 1, backgroundColor: theme.colors.border },

  // Search
  searchWrap: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 10, gap: 8 },
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
  summary: { fontSize: 12, color: theme.colors.textMuted },

  // List
  list: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 40 },
  row: { paddingVertical: 14, gap: 3 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  rowTitle: { fontSize: 15, fontWeight: '500', color: theme.colors.textPrimary },
  rowSub: { fontSize: 13, color: theme.colors.textSecondary },
  rowMeta: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },

  // Loading skeleton
  skeletonRow: { paddingVertical: 14, gap: 8 },

  // Error
  centeredBox: { alignItems: 'center', paddingTop: 72, paddingHorizontal: 24, gap: 10 },
  errorText: { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  linkText: { fontSize: 14, fontWeight: '600', color: theme.colors.primary },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
