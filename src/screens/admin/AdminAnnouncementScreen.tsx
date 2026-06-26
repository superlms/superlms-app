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
import { apiErr, pickImage, pickPdf } from '../../utils/filePickers';
import { PickedFile } from '../../api/adminProfileApi';
import {
  AdminAnnouncement,
  AnnouncementStats,
  AnnouncementType,
  createAnnouncement,
  deleteAnnouncement,
  getAdminAnnouncements,
  updateAnnouncement,
} from '../../api/adminContentApi';

type FilterKey = 'all_filter' | 'all' | 'user' | 'teacher';
const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all_filter', label: 'All' },
  { key: 'all', label: 'Both' },
  { key: 'user', label: 'Students' },
  { key: 'teacher', label: 'Teachers' },
];

const TYPE_LABEL: Record<AnnouncementType, string> = { all: 'Both', user: 'Students', teacher: 'Teachers' };
const TYPE_COLOR: Record<AnnouncementType, string> = { all: '#6366F1', user: '#0EA5E9', teacher: '#EC4899' };

const AdminAnnouncementScreen = ({ navigation }: any) => {
  const [items, setItems] = useState<AdminAnnouncement[]>([]);
  const [stats, setStats] = useState<AnnouncementStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKey>('all_filter');

  // form modal
  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [content, setContent] = useState('');
  const [type, setType] = useState<AnnouncementType>('all');
  const [file, setFile] = useState<PickedFile | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getAdminAnnouncements(filter === 'all_filter' ? undefined : filter);
      setItems(res.announcements);
      setStats(res.stats);
    } catch (e) {
      Alert.alert('Error', apiErr(e, 'Could not load announcements.'));
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  const { refreshing, onRefresh } = useRefresh(load);

  const openCreate = () => {
    setEditId(null);
    setName('');
    setContent('');
    setType('all');
    setFile(null);
    setModal(true);
  };
  const openEdit = (a: AdminAnnouncement) => {
    setEditId(a.id);
    setName(a.announcement_name);
    setContent(a.announcement_content);
    setType(a.type);
    setFile(null);
    setModal(true);
  };

  const save = async () => {
    if (!name.trim() || !content.trim()) {
      Alert.alert('Required', 'Title and content are required.');
      return;
    }
    setSaving(true);
    try {
      const payload = { announcement_name: name.trim(), announcement_content: content.trim(), type, file };
      if (editId) await updateAnnouncement(editId, payload);
      else await createAnnouncement(payload);
      setModal(false);
      await load();
    } catch (e) {
      Alert.alert('Error', apiErr(e, 'Could not save announcement.'));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (a: AdminAnnouncement) =>
    Alert.alert('Delete', `Delete "${a.announcement_name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteAnnouncement(a.id);
            await load();
          } catch (e) {
            Alert.alert('Error', apiErr(e, 'Could not delete.'));
          }
        },
      },
    ]);

  const attach = async (kind: 'image' | 'pdf') => {
    const f = kind === 'image' ? await pickImage() : await pickPdf();
    if (f) setFile(f);
  };

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor={theme.colors.card} />
      <View style={s.topbar}>
        <TouchableOpacity style={s.menuBtn} onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('PanelHome'))} activeOpacity={0.8}>
          <VectorIcon iconSet="Ionicons" iconName="arrow-back" size={22} color={theme.colors.primary} />
        </TouchableOpacity>
        <Text style={s.title}>Announcements</Text>
        {!!stats && <Text style={s.headCount}>{stats.total}</Text>}
      </View>

      {/* Filters */}
      <View style={s.filterRow}>
        {FILTERS.map(f => {
          const active = filter === f.key;
          return (
            <TouchableOpacity key={f.key} style={[s.chip, active && s.chipActive]} onPress={() => setFilter(f.key)} activeOpacity={0.8}>
              <Text style={[s.chipText, active && s.chipTextActive]}>{f.label}</Text>
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
          {items.length === 0 && <Text style={s.empty}>No announcements yet.</Text>}
          {items.map(a => (
            <View key={a.id} style={s.card}>
              <View style={s.cardTop}>
                <View style={[s.typeBadge, { backgroundColor: TYPE_COLOR[a.type] + '18' }]}>
                  <Text style={[s.typeBadgeText, { color: TYPE_COLOR[a.type] }]}>{TYPE_LABEL[a.type]}</Text>
                </View>
                <View style={{ flex: 1 }} />
                <TouchableOpacity style={s.iconAction} onPress={() => openEdit(a)} activeOpacity={0.8}>
                  <VectorIcon iconSet="Ionicons" iconName="create-outline" size={17} color={theme.colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity style={s.iconAction} onPress={() => confirmDelete(a)} activeOpacity={0.8}>
                  <VectorIcon iconSet="Ionicons" iconName="trash-outline" size={17} color={theme.colors.danger} />
                </TouchableOpacity>
              </View>
              <Text style={s.cardTitle}>{a.announcement_name}</Text>
              <Text style={s.cardBody}>{a.announcement_content}</Text>
              {!!a.image_url && <Image source={{ uri: a.image_url }} style={s.cardImage} />}
              {!!a.pdf_url && (
                <TouchableOpacity style={s.pdfRow} onPress={() => Linking.openURL(a.pdf_url!)} activeOpacity={0.8}>
                  <VectorIcon iconSet="Ionicons" iconName="document-text" size={16} color="#EF4444" />
                  <Text style={s.pdfText}>View PDF</Text>
                </TouchableOpacity>
              )}
              <Text style={s.cardMeta}>{a.creator_name ?? 'Admin'}{a.created_at ? ` · ${new Date(a.created_at).toLocaleDateString()}` : ''}</Text>
            </View>
          ))}
          <View style={{ height: 90 }} />
        </ScrollView>
      )}

      <TouchableOpacity style={s.fab} onPress={openCreate} activeOpacity={0.9}>
        <VectorIcon iconSet="Ionicons" iconName="add" size={28} color="#fff" />
      </TouchableOpacity>

      {/* Form modal */}
      <Modal transparent visible={modal} animationType="fade" onRequestClose={() => setModal(false)}>
        <KeyboardAvoidingView style={s.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>{editId ? 'Edit Announcement' : 'New Announcement'}</Text>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <TextInput style={s.input} value={name} onChangeText={setName} placeholder="Title" placeholderTextColor={theme.colors.textMuted} />
              <TextInput style={[s.input, s.inputMultiline, { marginTop: 10 }]} value={content} onChangeText={setContent} placeholder="Content" placeholderTextColor={theme.colors.textMuted} multiline />

              <Text style={s.fieldLabel}>Audience</Text>
              <View style={s.audienceRow}>
                {(['all', 'user', 'teacher'] as AnnouncementType[]).map(t => {
                  const active = type === t;
                  return (
                    <TouchableOpacity key={t} style={[s.chip, active && s.chipActive]} onPress={() => setType(t)} activeOpacity={0.8}>
                      <Text style={[s.chipText, active && s.chipTextActive]}>{TYPE_LABEL[t]}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {!!file && (
                <View style={s.fileChip}>
                  <VectorIcon iconSet="Ionicons" iconName="attach" size={14} color={theme.colors.primary} />
                  <Text style={s.fileChipText} numberOfLines={1}>{file.name}</Text>
                  <TouchableOpacity onPress={() => setFile(null)}><VectorIcon iconSet="Ionicons" iconName="close" size={14} color={theme.colors.textMuted} /></TouchableOpacity>
                </View>
              )}
              <View style={s.attachRow}>
                <TouchableOpacity style={s.attachBtn} onPress={() => attach('image')} activeOpacity={0.8}>
                  <VectorIcon iconSet="Ionicons" iconName="image-outline" size={16} color={theme.colors.primary} />
                  <Text style={s.attachText}>Image</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.attachBtn} onPress={() => attach('pdf')} activeOpacity={0.8}>
                  <VectorIcon iconSet="Ionicons" iconName="document-outline" size={16} color={theme.colors.primary} />
                  <Text style={s.attachText}>PDF</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>

            <View style={s.modalActions}>
              <TouchableOpacity style={[s.modalBtn, s.modalBtnGhost]} onPress={() => setModal(false)} activeOpacity={0.85}>
                <Text style={s.modalBtnGhostText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.modalBtn, s.modalBtnPrimary]} onPress={save} activeOpacity={0.9} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.modalBtnPrimaryText}>{editId ? 'Update' : 'Create'}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

export default AdminAnnouncementScreen;

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topbar: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 18, paddingTop: 18, paddingBottom: 14,
    backgroundColor: theme.colors.card, borderBottomWidth: 1, borderBottomColor: theme.colors.border,
  },
  menuBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: theme.colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '900', color: theme.colors.textPrimary, flex: 1 },
  headCount: { fontSize: 13, fontWeight: '800', color: theme.colors.primary },

  filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 12, flexWrap: 'wrap' },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: theme.radius.full, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border },
  chipActive: { backgroundColor: theme.colors.primaryLight, borderColor: theme.colors.primary },
  chipText: { fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary },
  chipTextActive: { color: theme.colors.primary },

  scroll: { paddingHorizontal: 16, paddingTop: 4 },
  empty: { fontSize: 13, color: theme.colors.textMuted, textAlign: 'center', marginTop: 30 },

  card: { backgroundColor: theme.colors.card, borderRadius: 16, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: theme.colors.border },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  typeBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: theme.radius.full },
  typeBadgeText: { fontSize: 10, fontWeight: '800' },
  iconAction: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.background },
  cardTitle: { fontSize: 15, fontWeight: '800', color: theme.colors.textPrimary },
  cardBody: { fontSize: 13, color: theme.colors.textSecondary, marginTop: 4, lineHeight: 19 },
  cardImage: { width: '100%', height: 160, borderRadius: 12, marginTop: 10, resizeMode: 'cover' },
  pdfRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  pdfText: { fontSize: 13, fontWeight: '700', color: '#EF4444' },
  cardMeta: { fontSize: 11, color: theme.colors.textMuted, marginTop: 10 },

  fab: { position: 'absolute', right: 18, bottom: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center', elevation: 5, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  modalCard: { width: '100%', maxWidth: 440, maxHeight: '85%', backgroundColor: theme.colors.card, borderRadius: 18, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: theme.colors.textPrimary, marginBottom: 14, textAlign: 'center' },
  input: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: theme.colors.textPrimary, backgroundColor: theme.colors.background },
  inputMultiline: { minHeight: 90, textAlignVertical: 'top' },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary, marginTop: 14, marginBottom: 8 },
  audienceRow: { flexDirection: 'row', gap: 8 },
  fileChip: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, backgroundColor: theme.colors.background, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1, borderColor: theme.colors.border },
  fileChipText: { flex: 1, fontSize: 12, color: theme.colors.textSecondary },
  attachRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  attachBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: theme.colors.primary, backgroundColor: theme.colors.primaryLight },
  attachText: { fontSize: 13, fontWeight: '700', color: theme.colors.primary },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 16 },
  modalBtn: { flex: 1, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  modalBtnGhost: { backgroundColor: theme.colors.border },
  modalBtnGhostText: { fontSize: 15, fontWeight: '700', color: theme.colors.textPrimary },
  modalBtnPrimary: { backgroundColor: theme.colors.primary },
  modalBtnPrimaryText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
