import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
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
import {
  AdminEnquiry,
  EnquiryStats,
  EnquiryTab,
  deleteEnquiry,
  getAdminEnquiries,
  replyEnquiry,
} from '../../api/adminContentApi';

type StatusKey = '' | 'pending' | 'replied';

const AdminEnquiriesScreen = ({ navigation }: any) => {
  const [tab, setTab] = useState<EnquiryTab>('teacher');
  const [items, setItems] = useState<AdminEnquiry[]>([]);
  const [stats, setStats] = useState<EnquiryStats | null>(null);
  const [totals, setTotals] = useState({ teacher: 0, student: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusKey>('');

  // detail / reply
  const [selected, setSelected] = useState<AdminEnquiry | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getAdminEnquiries({ tab, search: search.trim() || undefined, status: status || undefined });
      setItems(res.enquiries);
      setStats(res.stats);
      setTotals(res.tab_totals);
    } catch (e) {
      Alert.alert('Error', apiErr(e, 'Could not load enquiries.'));
    } finally {
      setLoading(false);
    }
  }, [tab, search, status]);

  useEffect(() => {
    load();
  }, [load]);

  const { refreshing, onRefresh } = useRefresh(load);

  const openDetail = (e: AdminEnquiry) => {
    setSelected(e);
    setDetailOpen(true);
  };
  const openReply = (e: AdminEnquiry) => {
    setSelected(e);
    setReplyText(e.admin_text ?? '');
    setDetailOpen(false);
    setReplyOpen(true);
  };
  const sendReply = async () => {
    if (!selected) return;
    if (replyText.trim().length < 2) {
      Alert.alert('Required', 'Please write a reply.');
      return;
    }
    setSending(true);
    try {
      await replyEnquiry(tab, selected.id, replyText.trim());
      setReplyOpen(false);
      await load();
    } catch (e) {
      Alert.alert('Error', apiErr(e, 'Could not send reply.'));
    } finally {
      setSending(false);
    }
  };
  const confirmDelete = (e: AdminEnquiry) =>
    Alert.alert('Delete enquiry', 'Delete this enquiry?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteEnquiry(tab, e.id);
            setDetailOpen(false);
            await load();
          } catch (err) {
            Alert.alert('Error', apiErr(err, 'Could not delete.'));
          }
        },
      },
    ]);

  const StatPill = ({ label, value, color }: { label: string; value: number; color: string }) => (
    <View style={[s.statPill, { backgroundColor: color + '14' }]}>
      <Text style={[s.statValue, { color }]}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor={theme.colors.card} />
      <View style={s.topbar}>
        <TouchableOpacity style={s.menuBtn} onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('PanelHome'))} activeOpacity={0.8}>
          <VectorIcon iconSet="Ionicons" iconName="arrow-back" size={22} color={theme.colors.primary} />
        </TouchableOpacity>
        <Text style={s.title}>Enquiries</Text>
      </View>

      {/* Tabs */}
      <View style={s.tabRow}>
        {(['teacher', 'student'] as EnquiryTab[]).map(t => {
          const active = tab === t;
          return (
            <TouchableOpacity key={t} style={[s.tab, active && s.tabActive]} onPress={() => setTab(t)} activeOpacity={0.8}>
              <Text style={[s.tabText, active && s.tabTextActive]}>
                {t === 'teacher' ? 'Teachers' : 'Students'} ({t === 'teacher' ? totals.teacher : totals.student})
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Stats */}
      {!!stats && (
        <View style={s.statsRow}>
          <StatPill label="Total" value={stats.total} color="#6366F1" />
          <StatPill label="Pending" value={stats.pending} color="#F59E0B" />
          <StatPill label="Replied" value={stats.replied} color="#22C55E" />
        </View>
      )}

      {/* Search + status */}
      <View style={s.searchWrap}>
        <VectorIcon iconSet="Ionicons" iconName="search-outline" size={16} color={theme.colors.textMuted} />
        <TextInput
          style={s.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search enquiries..."
          placeholderTextColor={theme.colors.textMuted}
          onSubmitEditing={load}
          returnKeyType="search"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => { setSearch(''); }}>
            <VectorIcon iconSet="Ionicons" iconName="close-circle" size={16} color={theme.colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>
      <View style={s.statusRow}>
        {([['', 'All'], ['pending', 'Pending'], ['replied', 'Replied']] as [StatusKey, string][]).map(([k, lbl]) => {
          const active = status === k;
          return (
            <TouchableOpacity key={k || 'all'} style={[s.chip, active && s.chipActive]} onPress={() => setStatus(k)} activeOpacity={0.8}>
              <Text style={[s.chipText, active && s.chipTextActive]}>{lbl}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {loading && !refreshing ? (
        <View style={s.loader}><ActivityIndicator size="large" color={theme.colors.primary} /></View>
      ) : (
        <ScrollView
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {items.length === 0 && <Text style={s.empty}>No enquiries found.</Text>}
          {items.map(e => (
            <TouchableOpacity key={e.id} style={s.card} onPress={() => openDetail(e)} activeOpacity={0.85}>
              <View style={s.cardTop}>
                <Text style={s.cardTitle} numberOfLines={1}>{e.topic}</Text>
                <View style={[s.statusBadge, { backgroundColor: (e.replied ? '#22C55E' : '#F59E0B') + '18' }]}>
                  <Text style={[s.statusBadgeText, { color: e.replied ? '#22C55E' : '#F59E0B' }]}>{e.replied ? 'Replied' : 'Pending'}</Text>
                </View>
              </View>
              <Text style={s.cardBody} numberOfLines={2}>{e.query}</Text>
              <View style={s.cardFoot}>
                <Text style={s.cardMeta} numberOfLines={1}>{e.user_name}{e.created_at ? ` · ${new Date(e.created_at).toLocaleDateString()}` : ''}</Text>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <TouchableOpacity style={s.iconAction} onPress={() => openReply(e)} activeOpacity={0.8}>
                    <VectorIcon iconSet="Ionicons" iconName="arrow-undo-outline" size={16} color={theme.colors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity style={s.iconAction} onPress={() => confirmDelete(e)} activeOpacity={0.8}>
                    <VectorIcon iconSet="Ionicons" iconName="trash-outline" size={16} color={theme.colors.danger} />
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          ))}
          <View style={{ height: 30 }} />
        </ScrollView>
      )}

      {/* Detail modal */}
      <Modal transparent visible={detailOpen} animationType="fade" onRequestClose={() => setDetailOpen(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>{selected?.topic}</Text>
            <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
              <Text style={s.detailLabel}>From</Text>
              <Text style={s.detailValue}>{selected?.user_name}{selected?.user_email ? ` (${selected.user_email})` : ''}</Text>
              <Text style={s.detailLabel}>Query</Text>
              <Text style={s.detailValue}>{selected?.query}</Text>
              {!!selected?.image_url && (
                <TouchableOpacity onPress={() => Linking.openURL(selected.image_url!)} activeOpacity={0.85}>
                  <Image source={{ uri: selected.image_url }} style={s.detailImage} />
                </TouchableOpacity>
              )}
              {!!selected?.admin_text && (
                <>
                  <Text style={s.detailLabel}>Your reply</Text>
                  <Text style={s.detailValue}>{selected.admin_text}</Text>
                </>
              )}
            </ScrollView>
            <View style={s.modalActions}>
              <TouchableOpacity style={[s.modalBtn, s.modalBtnGhost]} onPress={() => setDetailOpen(false)} activeOpacity={0.85}>
                <Text style={s.modalBtnGhostText}>Close</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.modalBtn, s.modalBtnPrimary]} onPress={() => selected && openReply(selected)} activeOpacity={0.9}>
                <Text style={s.modalBtnPrimaryText}>{selected?.replied ? 'Edit Reply' : 'Reply'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Reply modal */}
      <Modal transparent visible={replyOpen} animationType="fade" onRequestClose={() => setReplyOpen(false)}>
        <KeyboardAvoidingView style={s.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Reply</Text>
            <TextInput
              style={[s.input, s.inputMultiline]}
              value={replyText}
              onChangeText={setReplyText}
              placeholder="Write your reply..."
              placeholderTextColor={theme.colors.textMuted}
              multiline
            />
            <View style={s.modalActions}>
              <TouchableOpacity style={[s.modalBtn, s.modalBtnGhost]} onPress={() => setReplyOpen(false)} activeOpacity={0.85}>
                <Text style={s.modalBtnGhostText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.modalBtn, s.modalBtnPrimary]} onPress={sendReply} activeOpacity={0.9} disabled={sending}>
                {sending ? <ActivityIndicator color="#fff" /> : <Text style={s.modalBtnPrimaryText}>Send</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

export default AdminEnquiriesScreen;

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topbar: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 18, paddingTop: 18, paddingBottom: 14,
    backgroundColor: theme.colors.card, borderBottomWidth: 1, borderBottomColor: theme.colors.border,
  },
  menuBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: theme.colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '900', color: theme.colors.textPrimary },

  tabRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 12 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center', backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border },
  tabActive: { backgroundColor: theme.colors.primaryLight, borderColor: theme.colors.primary },
  tabText: { fontSize: 13, fontWeight: '700', color: theme.colors.textSecondary },
  tabTextActive: { color: theme.colors.primary },

  statsRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 12 },
  statPill: { flex: 1, borderRadius: 14, paddingVertical: 12, alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: '900' },
  statLabel: { fontSize: 11, color: theme.colors.textSecondary, fontWeight: '600', marginTop: 2 },

  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginTop: 12, backgroundColor: theme.colors.card, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: theme.colors.border },
  searchInput: { flex: 1, fontSize: 14, color: theme.colors.textPrimary, padding: 0 },
  statusRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 10 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: theme.radius.full, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border },
  chipActive: { backgroundColor: theme.colors.primaryLight, borderColor: theme.colors.primary },
  chipText: { fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary },
  chipTextActive: { color: theme.colors.primary },

  scroll: { paddingHorizontal: 16, paddingTop: 12 },
  empty: { fontSize: 13, color: theme.colors.textMuted, textAlign: 'center', marginTop: 30 },

  card: { backgroundColor: theme.colors.card, borderRadius: 16, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: theme.colors.border },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { flex: 1, fontSize: 15, fontWeight: '800', color: theme.colors.textPrimary },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: theme.radius.full },
  statusBadgeText: { fontSize: 10, fontWeight: '800' },
  cardBody: { fontSize: 13, color: theme.colors.textSecondary, marginTop: 6, lineHeight: 19 },
  cardFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  cardMeta: { flex: 1, fontSize: 11, color: theme.colors.textMuted },
  iconAction: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.background },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  modalCard: { width: '100%', maxWidth: 440, backgroundColor: theme.colors.card, borderRadius: 18, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: theme.colors.textPrimary, marginBottom: 14, textAlign: 'center' },
  detailLabel: { fontSize: 11, fontWeight: '700', color: theme.colors.textMuted, marginTop: 10 },
  detailValue: { fontSize: 14, color: theme.colors.textPrimary, marginTop: 3, lineHeight: 20 },
  detailImage: { width: '100%', height: 180, borderRadius: 12, marginTop: 10, resizeMode: 'cover' },
  input: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: theme.colors.textPrimary, backgroundColor: theme.colors.background },
  inputMultiline: { minHeight: 110, textAlignVertical: 'top' },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 16 },
  modalBtn: { flex: 1, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  modalBtnGhost: { backgroundColor: theme.colors.border },
  modalBtnGhostText: { fontSize: 15, fontWeight: '700', color: theme.colors.textPrimary },
  modalBtnPrimary: { backgroundColor: theme.colors.primary },
  modalBtnPrimaryText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
