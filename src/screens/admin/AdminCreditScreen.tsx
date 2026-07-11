import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import VectorIcon from '../../components/VectorIcon';
import Header from '../../components/Header';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useRefresh } from '../../hooks/useRefresh';
import { theme } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { FormModal, Field } from './AdminStandardScreen';
import {
  CreditPolicy,
  CreditQuery,
  CreditStats,
  CreditStatus,
  createCredit,
  deleteCredit,
  getCreditStats,
  getCredits,
  suggestCreditEndDate,
  updateCredit,
} from '../../api/adminCreditApi';

type Tab = 'queries' | 'policies';

const STATUS_META: Record<CreditStatus, { label: string; color: string }> = {
  pending:    { label: 'Pending',    color: '#F59E0B' },
  processing: { label: 'Processing', color: '#0EA5E9' },
  approved:   { label: 'Approved',   color: '#22C55E' },
  denied:     { label: 'Denied',     color: '#EF4444' },
};

const AdminCreditScreen = ({ navigation }: any) => {
  const [tab, setTab] = useState<Tab>('queries');
  const [stats, setStats] = useState<CreditStats | null>(null);
  const [policies, setPolicies] = useState<CreditPolicy[]>([]);

  const [items, setItems] = useState<CreditQuery[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [fStatus, setFStatus] = useState<CreditStatus | ''>('');

  // form
  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [amount, setAmount] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [heading, setHeading] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  // view
  const [viewItem, setViewItem] = useState<CreditQuery | null>(null);

  const loadStats = useCallback(async () => {
    try {
      const res = await getCreditStats();
      setStats(res.stats);
      setPolicies(res.policies);
    } catch {}
  }, []);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getCredits({ search, status: fStatus, per_page: 30 });
      setItems(res.data);
    } catch (e) { Alert.alert('Error', apiErr(e, 'Could not load credit queries.')); }
    finally { setLoading(false); }
  }, [search, fStatus]);

  useEffect(() => { loadStats(); }, [loadStats]);
  useEffect(() => { const t = setTimeout(loadList, 300); return () => clearTimeout(t); }, [loadList]);
  const { refreshing, onRefresh } = useRefresh(async () => { await Promise.all([loadStats(), loadList()]); });

  const openCreate = () => {
    setEditId(null);
    setAmount(''); setStartDate(''); setEndDate(''); setHeading(''); setReason('');
    setFormOpen(true);
  };

  const openEdit = (q: CreditQuery) => {
    if (!q.editable) { Alert.alert('Cannot edit', 'Only pending queries can be edited.'); return; }
    setEditId(q.id);
    setAmount(String(q.amount));
    setStartDate(q.start_date ?? '');
    setEndDate(q.end_date ?? '');
    setHeading(q.heading);
    setReason(q.reason);
    setFormOpen(true);
  };

  const onStartChange = async (v: string) => {
    setStartDate(v);
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
      try { setEndDate(await suggestCreditEndDate(v)); } catch {}
    }
  };

  const save = async () => {
    if (!amount.trim() || Number(amount) < 1) return Alert.alert('Required', 'Enter a valid amount.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return Alert.alert('Required', 'Enter a start date (YYYY-MM-DD).');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(endDate)) return Alert.alert('Required', 'Enter an end date (YYYY-MM-DD).');
    if (!heading.trim()) return Alert.alert('Required', 'Enter a heading.');
    if (reason.trim().length < 10) return Alert.alert('Required', 'Reason must be at least 10 characters.');
    setSaving(true);
    try {
      const payload = { amount: Number(amount), start_date: startDate, end_date: endDate, heading: heading.trim(), reason: reason.trim() };
      if (editId) await updateCredit(editId, payload);
      else await createCredit(payload);
      setFormOpen(false);
      await Promise.all([loadStats(), loadList()]);
    } catch (e) { Alert.alert('Error', apiErr(e, 'Could not save credit request.')); }
    finally { setSaving(false); }
  };

  const confirmDelete = (q: CreditQuery) =>
    Alert.alert('Delete Request', `Delete "${q.heading}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await deleteCredit(q.id); await Promise.all([loadStats(), loadList()]); }
        catch (e) { Alert.alert('Error', apiErr(e, 'Could not delete.')); }
      } },
    ]);

  const statCards = [
    { label: 'Total', value: stats?.total, color: '#6366F1' },
    { label: 'Pending', value: stats?.pending, color: '#F59E0B' },
    { label: 'Approved', value: stats?.approved, color: '#22C55E' },
    { label: 'Denied', value: stats?.denied, color: '#EF4444' },
  ];

  return (
    <View style={s.root}>
      <Header title="Credit" onBackPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('PanelHome'))} />

      <View style={s.statRow}>
        {statCards.map(c => (
          <View key={c.label} style={[s.statCard, { backgroundColor: c.color + '14' }]}>
            <Text style={[s.statVal, { color: c.color }]}>{c.value ?? '—'}</Text>
            <Text style={s.statLbl}>{c.label}</Text>
          </View>
        ))}
      </View>

      <View style={s.tabRow}>
        {(['queries', 'policies'] as Tab[]).map(t => {
          const active = tab === t;
          return (
            <TouchableOpacity key={t} style={[s.tab, active && s.tabActive]} onPress={() => setTab(t)} activeOpacity={0.8}>
              <Text style={[s.tabText, active && s.tabTextActive]}>{t === 'queries' ? 'My Requests' : 'Policies'}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {tab === 'queries' ? (
        <>
          <View style={s.searchRow}>
            <VectorIcon iconSet="Ionicons" iconName="search" size={16} color={theme.colors.textMuted} />
            <TextInput style={s.searchInput} placeholder="Search requests" placeholderTextColor={theme.colors.textMuted} value={search} onChangeText={setSearch} />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterBar} contentContainerStyle={s.filterContent}>
            {(['', 'pending', 'processing', 'approved', 'denied'] as const).map(st => (
              <TouchableOpacity key={st || 'all'} style={[s.pchip, fStatus === st && s.pchipActive]} onPress={() => setFStatus(st)}>
                <Text style={[s.pchipText, fStatus === st && s.pchipTextActive]}>{st ? STATUS_META[st].label : 'All'}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {loading ? (
            <View style={s.loader}><ActivityIndicator size="large" color={theme.colors.primary} /></View>
          ) : (
            <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}
              refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
              {items.length === 0 && <Text style={s.empty}>No credit requests yet.</Text>}
              {items.map(q => {
                const meta = STATUS_META[q.status];
                return (
                  <TouchableOpacity key={q.id} style={s.card} activeOpacity={0.85} onPress={() => setViewItem(q)}>
                    <View style={s.cardTop}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.cardTitle} numberOfLines={1}>{q.heading}</Text>
                        <Text style={s.cardSub}>₹ {q.amount.toLocaleString('en-IN')} · {q.start_label} → {q.end_label}</Text>
                      </View>
                      <View style={[s.badge, { backgroundColor: meta.color + '1F' }]}>
                        <Text style={[s.badgeText, { color: meta.color }]}>{meta.label}</Text>
                      </View>
                    </View>
                    {!!q.reason && <Text style={s.cardDesc} numberOfLines={2}>{q.reason}</Text>}
                    <View style={s.cardMeta}>
                      <Text style={s.cardMetaText}>{q.created_label}</Text>
                      <View style={{ flexDirection: 'row', gap: 6 }}>
                        {q.editable && (
                          <TouchableOpacity style={s.act} onPress={() => openEdit(q)}><VectorIcon iconSet="Ionicons" iconName="create-outline" size={16} color={theme.colors.primary} /></TouchableOpacity>
                        )}
                        {q.editable && (
                          <TouchableOpacity style={s.act} onPress={() => confirmDelete(q)}><VectorIcon iconSet="Ionicons" iconName="trash-outline" size={16} color={theme.colors.danger} /></TouchableOpacity>
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
              <View style={{ height: 90 }} />
            </ScrollView>
          )}

          <TouchableOpacity style={s.fab} onPress={openCreate} activeOpacity={0.9}>
            <VectorIcon iconSet="Ionicons" iconName="add" size={28} color="#fff" />
          </TouchableOpacity>
        </>
      ) : (
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}
          refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
          {policies.length === 0 && <Text style={s.empty}>No active credit policies.</Text>}
          {policies.map(p => (
            <View key={p.id} style={s.card}>
              <Text style={s.cardTitle}>{p.title}</Text>
              {!!p.content && <Text style={s.cardDesc}>{p.content}</Text>}
              {!!p.link && (
                <TouchableOpacity style={s.fileChip} onPress={() => Linking.openURL(p.link!)}>
                  <VectorIcon iconSet="Ionicons" iconName="link-outline" size={14} color={theme.colors.primary} />
                  <Text style={s.fileChipText}>Open link</Text>
                </TouchableOpacity>
              )}
              {!!p.document && (
                <TouchableOpacity style={s.fileChip} onPress={() => Linking.openURL(p.document!)}>
                  <VectorIcon iconSet="Ionicons" iconName="document-attach-outline" size={14} color={theme.colors.primary} />
                  <Text style={s.fileChipText}>View document</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* Create / Edit */}
      <FormModal visible={formOpen} title={editId ? 'Edit Request' : 'Ask for Credit'} onClose={() => setFormOpen(false)} onSave={save} saving={saving} saveLabel={editId ? 'Update' : 'Submit'}>
        <Field label="Amount (₹)" value={amount} onChangeText={setAmount} keyboardType="numeric" placeholder="50000" />
        <Field label="Start Date (YYYY-MM-DD)" value={startDate} onChangeText={onStartChange} placeholder="2026-07-11" />
        <Field label="End Date (YYYY-MM-DD)" value={endDate} onChangeText={setEndDate} placeholder="auto +20 days" />
        <Field label="Heading" value={heading} onChangeText={setHeading} placeholder="Reason heading" />
        <Field label="Reason" value={reason} onChangeText={setReason} placeholder="Explain why you need this credit (min 10 chars)" multiline />
      </FormModal>

      {/* View */}
      <FormModal visible={!!viewItem} title="Credit Request" onClose={() => setViewItem(null)} onSave={() => setViewItem(null)} saving={false} saveLabel="Close">
        {viewItem && (
          <View>
            <View style={s.vRow}><Text style={s.vLabel}>Heading</Text><Text style={s.vValue}>{viewItem.heading}</Text></View>
            <View style={s.vRow}><Text style={s.vLabel}>Amount</Text><Text style={s.vValue}>₹ {viewItem.amount.toLocaleString('en-IN')}</Text></View>
            <View style={s.vRow}><Text style={s.vLabel}>Period</Text><Text style={s.vValue}>{viewItem.start_label} → {viewItem.end_label}</Text></View>
            <View style={s.vRow}><Text style={s.vLabel}>Status</Text><Text style={[s.vValue, { color: STATUS_META[viewItem.status].color, fontWeight: '800' }]}>{STATUS_META[viewItem.status].label}</Text></View>
            {viewItem.penalties_per_day != null && (
              <View style={s.vRow}><Text style={s.vLabel}>Penalty/day</Text><Text style={s.vValue}>₹ {viewItem.penalties_per_day}</Text></View>
            )}
            <View style={{ marginTop: 10 }}><Text style={s.vLabel}>Reason</Text><Text style={[s.vValue, { marginTop: 4 }]}>{viewItem.reason}</Text></View>
            {!!viewItem.admin_remark && (
              <View style={{ marginTop: 10 }}><Text style={s.vLabel}>Admin Remark</Text><Text style={[s.vValue, { marginTop: 4 }]}>{viewItem.admin_remark}</Text></View>
            )}
          </View>
        )}
      </FormModal>
    </View>
  );
};

export default AdminCreditScreen;

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 40 },

  statRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 12 },
  statCard: { flex: 1, borderRadius: 12, paddingVertical: 10, alignItems: 'center' },
  statVal: { fontSize: 18, fontWeight: '900' },
  statLbl: { fontSize: 10, color: theme.colors.textSecondary, fontWeight: '700', marginTop: 2 },

  tabRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 12 },
  tab: { flex: 1, paddingVertical: 9, borderRadius: theme.radius.full, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center' },
  tabActive: { backgroundColor: theme.colors.primaryLight, borderColor: theme.colors.primary },
  tabText: { fontSize: 13, fontWeight: '700', color: theme.colors.textSecondary },
  tabTextActive: { color: theme.colors.primary },

  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginTop: 12, paddingHorizontal: 12, height: 42, borderRadius: 12, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border },
  searchInput: { flex: 1, fontSize: 14, color: theme.colors.textPrimary, paddingVertical: 0 },

  filterBar: { maxHeight: 46, paddingLeft: 16, marginTop: 10 },
  filterContent: { gap: 8, paddingRight: 16, alignItems: 'center' },
  pchip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: theme.radius.full, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border },
  pchipActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  pchipText: { fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary },
  pchipTextActive: { color: '#fff' },

  scroll: { paddingHorizontal: 16, paddingTop: 12 },
  empty: { fontSize: 13, color: theme.colors.textMuted, textAlign: 'center', marginTop: 30 },

  card: { backgroundColor: theme.colors.card, borderRadius: 16, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: theme.colors.border },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  cardTitle: { fontSize: 15, fontWeight: '900', color: theme.colors.textPrimary },
  cardSub: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },
  cardDesc: { fontSize: 13, color: theme.colors.textSecondary, marginTop: 8, lineHeight: 18 },
  cardMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  cardMetaText: { fontSize: 11, color: theme.colors.textMuted, fontWeight: '600' },
  act: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.background },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: theme.radius.full },
  badgeText: { fontSize: 11, fontWeight: '800' },
  fileChip: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: theme.colors.primaryLight },
  fileChipText: { fontSize: 12, fontWeight: '700', color: theme.colors.primary },

  fab: { position: 'absolute', right: 18, bottom: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center', elevation: 5, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },

  vRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  vLabel: { fontSize: 12, fontWeight: '700', color: theme.colors.textMuted },
  vValue: { fontSize: 13, color: theme.colors.textPrimary, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
});
