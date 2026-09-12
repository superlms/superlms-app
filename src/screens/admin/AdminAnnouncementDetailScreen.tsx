import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import VectorIcon from '../../components/VectorIcon';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useRefresh } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import {
  AdminAnnouncement,
  deleteAnnouncement,
  getAdminAnnouncements,
} from '../../api/adminContentApi';
import { DocHeader, DocSection, DocBody, docStyles } from '../more/docUi';
import { TYPE_LABEL, fmtDate } from './AdminAnnouncementScreen';

const TITLE = 'Announcement';

// Attachment as a chip: file-type icon and label only, opened in the device's
// own viewer — the same treatment as the student announcement screen.
const AttachmentChip = ({
  icon,
  label,
  onPress,
}: {
  icon: string;
  label: string;
  onPress: () => void;
}) => (
  <TouchableOpacity style={s.chip} activeOpacity={0.7} onPress={onPress}>
    <VectorIcon iconSet="Feather" iconName={icon} size={14} color={theme.colors.primary} />
    <Text style={s.chipText} numberOfLines={1}>
      {label}
    </Text>
    <VectorIcon iconSet="Feather" iconName="external-link" size={12} color={theme.colors.textMuted} />
  </TouchableOpacity>
);

const AdminAnnouncementDetailScreen = ({ navigation, route }: any) => {
  const [item, setItem] = useState<AdminAnnouncement | null>(route?.params?.item ?? null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // The item passed from the list shows straight away; this refreshes it in
  // place (the list endpoint is the only source for a single announcement).
  const refresh = useCallback(async () => {
    if (!item?.id) return;
    try {
      const res = await getAdminAnnouncements();
      const found = res.announcements.find(a => a.id === item.id);
      if (found) setItem(found);
      else navigation.goBack();
    } catch {
      // keep the passed item
    }
  }, [item?.id, navigation]);

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const { refreshing, onRefresh } = useRefresh(refresh);

  const remove = async () => {
    setDeleting(true);
    try {
      await deleteAnnouncement(item!.id);
      setConfirmOpen(false);
      navigation.goBack();
    } catch (e) {
      setConfirmOpen(false);
      Alert.alert('Error', apiErr(e, 'Could not delete.'));
    } finally {
      setDeleting(false);
    }
  };

  const openFile = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Error', 'Unable to open this file on this device.');
    }
  };

  if (!item) {
    return (
      <View style={docStyles.root}>
        <DocHeader title={TITLE} onBackPress={() => navigation.goBack()} />
        <View style={s.centeredBox}>
          <ActivityIndicator size="small" color={theme.colors.primary} />
        </View>
      </View>
    );
  }

  const dateLabel = fmtDate(item.created_at);

  return (
    <View style={docStyles.root}>
      <DocHeader
        title={TITLE}
        onBackPress={() => navigation.goBack()}
        rightIcon="create-outline"
        onRightPress={() => navigation.navigate('AdminAnnouncementForm', { item })}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={docStyles.scroll}
        refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Audience, title, date */}
        <View>
          <Text style={s.metaText}>{TYPE_LABEL[item.type]}</Text>
          <Text style={s.title}>{item.announcement_name}</Text>
          {!!dateLabel && <Text style={s.dateText}>{dateLabel}</Text>}
        </View>

        {/* Content, with attachments as chips right under it */}
        <DocSection title="Description">
          <DocBody>{item.announcement_content || 'No description added.'}</DocBody>
          {!!(item.image_url || item.pdf_url) && (
            <View style={s.chips}>
              {!!item.image_url && (
                <AttachmentChip icon="image" label="Image" onPress={() => openFile(item.image_url!)} />
              )}
              {!!item.pdf_url && (
                <AttachmentChip icon="file-text" label="PDF" onPress={() => openFile(item.pdf_url!)} />
              )}
            </View>
          )}
        </DocSection>

        {/* Who posted it */}
        <View style={s.divider} />
        <DocSection title="Posted By">
          <Text style={s.postedBy}>{item.creator_name ?? 'Admin'}</Text>
        </DocSection>

        {/* Delete — a quiet text action, never a heavy red block */}
        <TouchableOpacity
          style={s.deleteBtn}
          activeOpacity={0.6}
          onPress={() => setConfirmOpen(true)}
          hitSlop={8}
        >
          <VectorIcon iconSet="Feather" iconName="trash-2" size={15} color={theme.colors.danger} />
          <Text style={s.deleteText}>Delete announcement</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Delete confirmation */}
      <Modal
        transparent
        visible={confirmOpen}
        animationType="fade"
        onRequestClose={() => setConfirmOpen(false)}
      >
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Delete announcement?</Text>
            <Text style={s.modalDesc}>
              “{item.announcement_name}” and its attachment will be removed for everyone. This
              cannot be undone.
            </Text>
            <View style={s.modalActions}>
              <TouchableOpacity
                style={[s.modalBtn, s.modalBtnGhost]}
                activeOpacity={0.7}
                disabled={deleting}
                onPress={() => setConfirmOpen(false)}
              >
                <Text style={s.modalBtnGhostText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.modalBtn, s.modalBtnDanger, deleting && s.modalBtnBusy]}
                activeOpacity={0.85}
                disabled={deleting}
                onPress={remove}
              >
                {deleting ? (
                  <ActivityIndicator size="small" color={theme.colors.white} />
                ) : (
                  <Text style={s.modalBtnDangerText}>Delete</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default AdminAnnouncementDetailScreen;

const __mk_s = () => StyleSheet.create({
  centeredBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },

  // Meta + title
  metaText: { fontSize: 13, color: theme.colors.textMuted, marginBottom: 8 },
  title: { fontSize: 20, fontWeight: '700', color: theme.colors.textPrimary, lineHeight: 27 },
  dateText: { fontSize: 12, color: theme.colors.textMuted, marginTop: 4 },

  // Attachment chips
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: 200,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
  chipText: { flexShrink: 1, fontSize: 13, fontWeight: '500', color: theme.colors.textPrimary },

  // Line between the content and who posted it
  divider: { height: 1, backgroundColor: theme.colors.border },
  postedBy: { fontSize: 15, color: theme.colors.textPrimary },

  // Delete
  deleteBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start' },
  deleteText: { fontSize: 14, fontWeight: '500', color: theme.colors.danger },

  // Confirm modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    padding: 24,
  },
  modalTitle: { fontSize: 17, fontWeight: '600', color: theme.colors.textPrimary },
  modalDesc: {
    marginTop: 8,
    fontSize: 14,
    color: theme.colors.textSecondary,
    lineHeight: 20,
  },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 22 },
  modalBtn: {
    flex: 1,
    height: 46,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtnBusy: { opacity: 0.7 },
  modalBtnGhost: { borderWidth: 1, borderColor: theme.colors.border },
  modalBtnGhostText: { fontSize: 15, fontWeight: '500', color: theme.colors.textPrimary },
  modalBtnDanger: { backgroundColor: theme.colors.danger },
  modalBtnDangerText: { fontSize: 15, fontWeight: '600', color: theme.colors.white },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
