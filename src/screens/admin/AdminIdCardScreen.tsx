import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { DrawerActions } from '@react-navigation/native';
import VectorIcon from '../../components/VectorIcon';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useRefresh } from '../../hooks/useRefresh';
import { theme } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { FormModal, Field, ChipPicker } from './AdminStandardScreen';
import {
  CardType,
  IdCardRow,
  IdCardAnalytics,
  IdCardView,
  deleteIdCard,
  generateIdCards,
  getIdCard,
  getIdCards,
  updateIdCard,
} from '../../api/adminIdCardApi';

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
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // generate
  const [genModal, setGenModal] = useState(false);
  const [genExpiry, setGenExpiry] = useState('');
  const [genStandards, setGenStandards] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);

  // edit
  const [editModal, setEditModal] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [eExpiry, setEExpiry] = useState('');
  const [eStatus, setEStatus] = useState<'active' | 'inactive'>('active');

  // view
  const [viewCard, setViewCard] = useState<IdCardView | null>(null);
  const [viewLoading, setViewLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getIdCards({ type, search });
      setRows(res.cards);
      setAnalytics(res.analytics);
      setStandards(res.standards);
    } catch (e) {
      Alert.alert('Error', apiErr(e, 'Could not load ID cards.'));
    } finally {
      setLoading(false);
    }
  }, [type, search]);

  useEffect(() => { load(); }, [load]);
  const { refreshing, onRefresh } = useRefresh(load);

  const openGenerate = () => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    setGenExpiry(d.toISOString().slice(0, 10));
    setGenStandards([]);
    setGenModal(true);
  };
  const runGenerate = async () => {
    if (!genExpiry) return Alert.alert('Required', 'Expiry date is required.');
    setSaving(true);
    try {
      const res = await generateIdCards({ type, expiry_date: genExpiry, standard_ids: type === 'student' ? genStandards : undefined });
      setGenModal(false);
      await load();
      Alert.alert('Done', res.generated > 0 ? `Generated ${res.generated} card(s).` : 'No new cards — all already have an active ID card.');
    } catch (e) {
      Alert.alert('Error', apiErr(e, 'Could not generate cards.'));
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (r: IdCardRow) => {
    setEditId(r.id);
    setEExpiry(r.expiry_date ?? '');
    setEStatus((r.status as any) === 'inactive' ? 'inactive' : 'active');
    setEditModal(true);
  };
  const saveEdit = async () => {
    if (!editId || !eExpiry) return Alert.alert('Required', 'Expiry date is required.');
    setSaving(true);
    try {
      await updateIdCard(type, editId, { expiry_date: eExpiry, status: eStatus });
      setEditModal(false);
      await load();
    } catch (e) {
      Alert.alert('Error', apiErr(e, 'Could not update card.'));
    } finally {
      setSaving(false);
    }
  };

  const openView = async (r: IdCardRow) => {
    setViewLoading(true);
    setViewCard({} as IdCardView);
    try {
      setViewCard(await getIdCard(type, r.id));
    } catch (e) {
      setViewCard(null);
      Alert.alert('Error', apiErr(e, 'Could not load card.'));
    } finally {
      setViewLoading(false);
    }
  };

  const remove = (r: IdCardRow) =>
    Alert.alert('Delete Card', `Delete card ${r.card_number}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await deleteIdCard(type, r.id); await load(); }
        catch (e) { Alert.alert('Error', apiErr(e, 'Could not delete.')); }
      } },
    ]);

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor={theme.colors.card} />
      <View style={s.topbar}>
        <TouchableOpacity style={s.menuBtn} onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('PanelHome'))} activeOpacity={0.8}>
          <VectorIcon iconSet="Ionicons" iconName="arrow-back" size={22} color={theme.colors.primary} />
        </TouchableOpacity>
        <Text style={s.title}>ID Cards</Text>
      </View>

      {/* Type tabs */}
      <View style={s.tabRow}>
        {TYPES.map(t => {
          const active = type === t.key;
          return (
            <TouchableOpacity key={t.key} style={[s.tab, active && s.tabActive]} onPress={() => { setType(t.key); setSearch(''); }} activeOpacity={0.8}>
              <VectorIcon iconSet="Ionicons" iconName={t.icon} size={15} color={active ? theme.colors.primary : theme.colors.textSecondary} />
              <Text style={[s.tabText, active && s.tabTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Analytics */}
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
          placeholderTextColor={theme.colors.textMuted} value={search} onChangeText={setSearch} returnKeyType="search" />
        {!!search && <TouchableOpacity onPress={() => setSearch('')}><VectorIcon iconSet="Ionicons" iconName="close-circle" size={16} color={theme.colors.textMuted} /></TouchableOpacity>}
      </View>

      {loading && !refreshing ? (
        <View style={s.loader}><ActivityIndicator size="large" color={theme.colors.primary} /></View>
      ) : (
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}
          refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
          {rows.length === 0 && <Text style={s.empty}>No ID cards yet. Tap Generate to issue cards.</Text>}
          {rows.map(r => (
            <TouchableOpacity key={r.id} style={s.card} activeOpacity={0.85} onPress={() => openView(r)}>
              <View style={s.cardMain}>
                <View style={[s.avatar, { backgroundColor: '#6366F118' }]}>
                  <VectorIcon iconSet="Ionicons" iconName="card" size={20} color="#6366F1" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.cardTitle}>{r.name ?? '—'}</Text>
                  <Text style={s.cardSub}>{r.subtitle}</Text>
                  <Text style={s.cardMeta}>{r.card_number}{r.expiry_date ? ` · exp ${r.expiry_date}` : ''}</Text>
                </View>
                <View style={[s.statusTag, { backgroundColor: (r.status === 'active' ? '#22C55E' : '#EF4444') + '18' }]}>
                  <Text style={[s.statusTagText, { color: r.status === 'active' ? '#16A34A' : '#EF4444' }]}>{r.status}</Text>
                </View>
              </View>
              <View style={s.cardActions}>
                <TouchableOpacity style={s.act} onPress={() => openView(r)}><VectorIcon iconSet="Ionicons" iconName="eye-outline" size={17} color={theme.colors.textSecondary} /></TouchableOpacity>
                <TouchableOpacity style={s.act} onPress={() => openEdit(r)}><VectorIcon iconSet="Ionicons" iconName="create-outline" size={17} color={theme.colors.primary} /></TouchableOpacity>
                <TouchableOpacity style={s.act} onPress={() => remove(r)}><VectorIcon iconSet="Ionicons" iconName="trash-outline" size={17} color={theme.colors.danger} /></TouchableOpacity>
              </View>
            </TouchableOpacity>
          ))}
          <View style={{ height: 90 }} />
        </ScrollView>
      )}

      <TouchableOpacity style={s.fab} onPress={openGenerate} activeOpacity={0.9}>
        <VectorIcon iconSet="Ionicons" iconName="add" size={26} color="#fff" />
        <Text style={s.fabText}>Generate</Text>
      </TouchableOpacity>

      {/* Generate modal */}
      <FormModal visible={genModal} title={`Generate ${type} ID cards`}
        onClose={() => setGenModal(false)} onSave={runGenerate} saving={saving} saveLabel="Generate">
        <Field label="Expiry Date" value={genExpiry} onChangeText={setGenExpiry} placeholder="YYYY-MM-DD" />
        {type === 'student' && (
          <>
            <Text style={s.fieldLabel}>Classes (leave empty for all)</Text>
            <ChipPicker multi items={standards.map(x => ({ id: x.id, label: x.name }))} selected={genStandards}
              onToggle={(id: number) => setGenStandards(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])} />
          </>
        )}
        <Text style={s.note}>Only people without an active card get a new one.</Text>
      </FormModal>

      {/* Edit modal */}
      <FormModal visible={editModal} title="Edit ID Card"
        onClose={() => setEditModal(false)} onSave={saveEdit} saving={saving} saveLabel="Save">
        <Field label="Expiry Date" value={eExpiry} onChangeText={setEExpiry} placeholder="YYYY-MM-DD" />
        <Text style={s.fieldLabel}>Status</Text>
        <ChipPicker items={[{ id: 'active', label: 'Active' }, { id: 'inactive', label: 'Inactive' }]}
          selected={[eStatus]} onToggle={(id: any) => setEStatus(id)} />
      </FormModal>

      {/* View card modal */}
      <Modal transparent visible={!!viewCard} animationType="fade" onRequestClose={() => setViewCard(null)}>
        <View style={s.overlay}>
          <View style={s.viewCard}>
            {viewLoading || !viewCard?.card_number ? (
              <View style={{ paddingVertical: 40 }}><ActivityIndicator size="large" color={theme.colors.primary} /></View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={s.idHeader}>
                  {!!viewCard.school?.logo && <Image source={{ uri: viewCard.school.logo }} style={s.idLogo} />}
                  <Text style={s.idSchool}>{viewCard.school?.name}</Text>
                </View>
                <View style={s.idBody}>
                  {viewCard.photo ? <Image source={{ uri: viewCard.photo }} style={s.idPhoto} /> : (
                    <View style={[s.idPhoto, s.idPhotoPlaceholder]}><VectorIcon iconSet="Ionicons" iconName="person" size={34} color={theme.colors.textMuted} /></View>
                  )}
                  <Text style={s.idName}>{viewCard.name}</Text>
                  <Text style={s.idSubtitle}>{viewCard.subtitle}</Text>
                </View>
                <View style={s.idRows}>
                  {Object.entries(viewCard.front_rows || {}).map(([k, v]) => (
                    <View key={k} style={s.idRow}>
                      <Text style={s.idRowKey}>{k}</Text>
                      <Text style={s.idRowVal} numberOfLines={1}>{v}</Text>
                    </View>
                  ))}
                  <View style={s.idRow}><Text style={s.idRowKey}>Card No</Text><Text style={s.idRowVal}>{viewCard.card_number}</Text></View>
                  <View style={s.idRow}><Text style={s.idRowKey}>Valid Till</Text><Text style={s.idRowVal}>{viewCard.expiry_date}</Text></View>
                </View>
                {!!viewCard.qr_code && <Image source={{ uri: viewCard.qr_code }} style={s.idQr} />}
              </ScrollView>
            )}
            <TouchableOpacity style={s.closeBtn} onPress={() => setViewCard(null)} activeOpacity={0.85}>
              <Text style={s.closeBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default AdminIdCardScreen;

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 40 },
  topbar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingTop: 18, paddingBottom: 14, backgroundColor: theme.colors.card, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  menuBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: theme.colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '900', color: theme.colors.textPrimary, flex: 1 },

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

  card: { backgroundColor: theme.colors.card, borderRadius: 16, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: theme.colors.border },
  cardMain: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 15, fontWeight: '800', color: theme.colors.textPrimary },
  cardSub: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },
  cardMeta: { fontSize: 11, color: theme.colors.textMuted, marginTop: 3 },
  statusTag: { borderRadius: theme.radius.full, paddingHorizontal: 10, paddingVertical: 3 },
  statusTagText: { fontSize: 10, fontWeight: '800', textTransform: 'capitalize' },
  cardActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 10 },
  act: { width: 34, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.background },

  fab: { position: 'absolute', right: 18, bottom: 24, height: 52, borderRadius: 26, paddingHorizontal: 18, flexDirection: 'row', gap: 6, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center', elevation: 5, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
  fabText: { color: '#fff', fontWeight: '800', fontSize: 14 },

  fieldLabel: { fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary, marginTop: 12, marginBottom: 6 },
  note: { fontSize: 11, color: theme.colors.textMuted, marginTop: 12 },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  viewCard: { width: '100%', maxWidth: 360, maxHeight: '88%', backgroundColor: theme.colors.card, borderRadius: 20, padding: 18 },
  idHeader: { alignItems: 'center', marginBottom: 12 },
  idLogo: { width: 130, height: 50, resizeMode: 'contain', marginBottom: 6 },
  idSchool: { fontSize: 15, fontWeight: '900', color: theme.colors.textPrimary, textAlign: 'center' },
  idBody: { alignItems: 'center', marginBottom: 12 },
  idPhoto: { width: 84, height: 84, borderRadius: 14, marginBottom: 8 },
  idPhotoPlaceholder: { backgroundColor: theme.colors.background, alignItems: 'center', justifyContent: 'center' },
  idName: { fontSize: 16, fontWeight: '900', color: theme.colors.textPrimary },
  idSubtitle: { fontSize: 12, fontWeight: '700', color: theme.colors.primary, marginTop: 2 },
  idRows: { gap: 6, marginBottom: 12 },
  idRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  idRowKey: { fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary },
  idRowVal: { fontSize: 12, color: theme.colors.textPrimary, flexShrink: 1, textAlign: 'right' },
  idQr: { width: 120, height: 120, alignSelf: 'center', marginTop: 6 },
  closeBtn: { marginTop: 14, height: 46, borderRadius: 12, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center' },
  closeBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
