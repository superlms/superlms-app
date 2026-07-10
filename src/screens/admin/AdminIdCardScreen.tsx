import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import VectorIcon from '../../components/VectorIcon';
import Header from '../../components/Header';
import ListRow from '../../components/ListRow';
import FilterSheet from '../../components/FilterSheet';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useRefresh } from '../../hooks/useRefresh';
import { theme } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { CardType, IdCardRow, IdCardAnalytics, getIdCards } from '../../api/adminIdCardApi';

const TYPES: { key: CardType; label: string; icon: string }[] = [
  { key: 'student', label: 'Students', icon: 'people' },
  { key: 'teacher', label: 'Teachers', icon: 'person' },
  { key: 'employee', label: 'Employees', icon: 'briefcase' },
];

const AdminIdCardScreen = ({ navigation }: any) => {
  const [type, setType] = useState<CardType>('student');
  const [rows, setRows] = useState<IdCardRow[]>([]);
  const [analytics, setAnalytics] = useState<IdCardAnalytics | null>(null);
  const [standards, setStandards] = useState<{ id: number; name: string }[]>([]);
  const [sections, setSections] = useState<{ id: number; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);

  const [fStd, setFStd] = useState<number | 0>(0);
  const [fSec, setFSec] = useState<number | 0>(0);
  const [fStatus, setFStatus] = useState<'' | 'active' | 'inactive'>('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getIdCards({
        type, search: search.trim() || undefined,
        standard: type === 'student' && fStd ? fStd : undefined,
        section: type === 'student' && fSec ? fSec : undefined,
        status: fStatus || undefined,
      });
      setRows(res.cards);
      setAnalytics(res.analytics);
      setStandards(res.standards);
      setSections(res.sections);
    } catch (e) {
      Alert.alert('Error', apiErr(e, 'Could not load ID cards.'));
    } finally {
      setLoading(false);
    }
  }, [type, search, fStd, fSec, fStatus]);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  const { refreshing, onRefresh } = useRefresh(load);

  const activeFilters = (fStd ? 1 : 0) + (fSec ? 1 : 0) + (fStatus ? 1 : 0);
  const opt = (arr: { id: number; name: string }[]) => [{ label: 'All', value: 0 }, ...arr.map(x => ({ label: x.name, value: x.id }))];

  const filterSections = [
    ...(type === 'student' ? [
      { key: 'std', title: 'Class', options: opt(standards), value: fStd, onChange: (v: any) => setFStd(v) },
      { key: 'sec', title: 'Section', options: opt(sections), value: fSec, onChange: (v: any) => setFSec(v) },
    ] : []),
    { key: 'status', title: 'Status', options: [{ label: 'All', value: '' }, { label: 'Active', value: 'active' }, { label: 'Inactive', value: 'inactive' }], value: fStatus, onChange: (v: any) => setFStatus(v) },
  ];

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor={theme.colors.card} />
      <Header
        title="ID Cards"
        onBackPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('PanelHome'))}
        rightSlot={
          <TouchableOpacity style={s.headBtn} onPress={() => setFilterOpen(true)} activeOpacity={0.8}>
            <VectorIcon iconSet="Ionicons" iconName="filter" size={18} color={theme.colors.primary} />
            {activeFilters > 0 && <View style={s.headDot}><Text style={s.headDotText}>{activeFilters}</Text></View>}
          </TouchableOpacity>
        }
      />

      <View style={s.tabRow}>
        {TYPES.map(t => {
          const active = type === t.key;
          return (
            <TouchableOpacity key={t.key} style={[s.tab, active && s.tabActive]}
              onPress={() => { setType(t.key); setSearch(''); setFStd(0); setFSec(0); setFStatus(''); }} activeOpacity={0.8}>
              <VectorIcon iconSet="Ionicons" iconName={t.icon} size={15} color={active ? theme.colors.primary : theme.colors.textSecondary} />
              <Text style={[s.tabText, active && s.tabTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={s.statRow}>
        {[
          { label: 'Total', value: analytics?.total, color: '#6366F1' },
          { label: 'Issued', value: analytics?.issued, color: '#22C55E' },
          { label: 'Remaining', value: analytics?.remaining, color: '#F59E0B' },
        ].map(c => (
          <View key={c.label} style={[s.statCard, { backgroundColor: c.color + '14' }]}>
            <Text style={[s.statVal, { color: c.color }]}>{c.value ?? '—'}</Text>
            <Text style={s.statLbl}>{c.label}</Text>
          </View>
        ))}
      </View>

      <View style={s.searchRow}>
        <VectorIcon iconSet="Ionicons" iconName="search" size={16} color={theme.colors.textMuted} />
        <TextInput style={s.searchInput} placeholder="Search name or card number"
          placeholderTextColor={theme.colors.textMuted} value={search} onChangeText={setSearch} onSubmitEditing={load} returnKeyType="search" />
        {!!search && <TouchableOpacity onPress={() => setSearch('')}><VectorIcon iconSet="Ionicons" iconName="close-circle" size={16} color={theme.colors.textMuted} /></TouchableOpacity>}
      </View>

      {loading && !refreshing ? (
        <View style={s.loader}><ActivityIndicator size="large" color={theme.colors.primary} /></View>
      ) : (
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}
          refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
          {rows.length === 0 && <Text style={s.empty}>No ID cards yet. Tap Generate to issue cards.</Text>}
          {rows.map(r => (
            <ListRow
              key={r.id}
              color={r.status === 'active' ? '#6366F1' : '#EF4444'}
              title={r.name ?? '—'}
              subtitle={r.subtitle ?? ''}
              metaIcon="card-outline"
              meta={`${r.card_number}${r.expiry_date ? ` · exp ${r.expiry_date}` : ''}`}
              tag={r.status}
              tagColor={r.status === 'active' ? '#22C55E' : '#EF4444'}
              onPress={() => navigation.navigate('AdminIdCardView', { type, card: r })}
            />
          ))}
          <View style={{ height: 90 }} />
        </ScrollView>
      )}

      <TouchableOpacity style={s.fab} onPress={() => navigation.navigate('AdminIdCardGenerate', { type, standards })} activeOpacity={0.9}>
        <VectorIcon iconSet="Ionicons" iconName="add" size={26} color="#fff" />
        <Text style={s.fabText}>Generate</Text>
      </TouchableOpacity>

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

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 40 },
  headBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border },
  headDot: { position: 'absolute', top: -2, right: -2, minWidth: 15, height: 15, paddingHorizontal: 3, borderRadius: 8, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center' },
  headDotText: { fontSize: 9, fontWeight: '800', color: '#fff' },
  tabRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 12 },
  tab: { flex: 1, flexDirection: 'row', gap: 5, paddingVertical: 9, borderRadius: theme.radius.full, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center', justifyContent: 'center' },
  tabActive: { backgroundColor: theme.colors.primaryLight, borderColor: theme.colors.primary },
  tabText: { fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary },
  tabTextActive: { color: theme.colors.primary },
  statRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 12 },
  statCard: { flex: 1, borderRadius: 14, paddingVertical: 12, alignItems: 'center' },
  statVal: { fontSize: 20, fontWeight: '900' },
  statLbl: { fontSize: 11, color: theme.colors.textSecondary, fontWeight: '600', marginTop: 2 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginTop: 12, paddingHorizontal: 12, height: 42, borderRadius: 12, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border },
  searchInput: { flex: 1, fontSize: 14, color: theme.colors.textPrimary, paddingVertical: 0 },
  scroll: { paddingHorizontal: 16, paddingTop: 10 },
  empty: { fontSize: 13, color: theme.colors.textMuted, textAlign: 'center', marginTop: 40 },
  fab: { position: 'absolute', right: 18, bottom: 24, height: 52, borderRadius: 26, paddingHorizontal: 18, flexDirection: 'row', gap: 6, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center', elevation: 5, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
  fabText: { color: '#fff', fontWeight: '800', fontSize: 14 },
});
