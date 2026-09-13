import React, { useState, useEffect } from 'react';
import {
  Alert,
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import moment from 'moment';
import VectorIcon from '../../components/VectorIcon';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useRefresh } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';
import type { Announcement } from './announcementData';
import { markAnnouncementRead } from './announcementReads';
import apiClient from '../../api/apiClient';
import constant from '../../utils/constant';
import { DocHeader, DocSection, DocBody, docStyles } from '../more/docUi';
import { INK, QUIET } from '../notification/inboxUi';

// Files come from the same host as the API but outside the /api/v1 prefix
const FILE_ORIGIN = constant.API_BASE_URL.replace(/\/api\/v\d+\/?$/, '');

const resolveFileUrl = (url?: string): string | undefined => {
  if (!url) return undefined;
  if (/^https?:\/\//i.test(url)) return url;
  return `${FILE_ORIGIN}/${url.replace(/^\/+/, '')}`;
};

// Tappable attachment chip — file-type icon + label only; opens the file
// straight away, no preview screen.
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

const ViewAnnouncementScreen = ({ navigation, route }: any) => {
  const initialItem: Announcement = route.params?.item;
  const [item, setItem] = useState<Announcement>(initialItem);

  const dateLabel = item?.date
    ? moment(item.date).format('DD MMM YYYY, hh:mm A')
    : '';

  const imageUrl = resolveFileUrl(item?.imageUrl);
  const pdfUrl = resolveFileUrl(item?.pdfUrl);
  const creatorAvatar = resolveFileUrl(item?.creatorAvatar);

  // Fetch full announcement details by ID. The item passed from the list is
  // shown straight away; this just refreshes it in place.
  const fetchAnnouncementDetails = async () => {
    if (!item?.id) return;

    try {
      const response = await apiClient.get(`/announcement/${item.id}`);
      const announcementData = response.data?.data || response.data;

      if (announcementData && announcementData.id) {
        setItem(prev => ({
          ...prev,
          title: announcementData.announcement_name || prev.title,
          content: announcementData.announcement_content || prev.content,
          date: announcementData.created_at || prev.date,
          imageUrl: announcementData.announcement_image || prev.imageUrl,
          pdfUrl: announcementData.announcement_pdf || prev.pdfUrl,
          hasImage: !!(announcementData.announcement_image || prev.imageUrl),
          hasPdf: !!(announcementData.announcement_pdf || prev.pdfUrl),
          creatorName: announcementData.creator_name || prev.creatorName,
          creatorEmail: announcementData.creator_email || prev.creatorEmail,
          creatorAvatar: announcementData.creator_avatar || prev.creatorAvatar,
        }));
      }
    } catch (err: any) {
      // Silently fall back to the item passed via navigation
      console.log(
        '[ViewAnnouncement] Fetch failed, using passed item:',
        err?.response?.status ?? err?.message,
      );
    }
  };

  useEffect(() => {
    // Opening it is reading it: the green dot in the list goes.
    if (initialItem?.id) markAnnouncementRead(initialItem.id);
    fetchAnnouncementDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialItem?.id]);

  const { refreshing, onRefresh } = useRefresh(fetchAnnouncementDetails);

  // Open attachments directly in the device's viewer / browser.
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
        <DocHeader title="View Announcement" onBackPress={() => navigation.goBack()} />
        <View style={s.centeredBox}>
          <Text style={s.mutedText}>Announcement not found</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={docStyles.root}>
      <DocHeader title="View Announcement" onBackPress={() => navigation.goBack()} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={docStyles.scroll}
        refreshControl={
          <AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* When it was posted, then the title */}
        <View>
          {!!dateLabel && <Text style={s.dateText}>{dateLabel}</Text>}
          <Text style={s.title}>{item.title}</Text>
        </View>

        {/* Description, with any attachments right under it */}
        <DocSection title="Description">
          <DocBody>{item.content || 'No description available'}</DocBody>
          {(imageUrl || pdfUrl) && (
            <View style={s.chips}>
              {!!imageUrl && (
                <AttachmentChip icon="image" label="Image" onPress={() => openFile(imageUrl)} />
              )}
              {!!pdfUrl && (
                <AttachmentChip icon="file-text" label="PDF" onPress={() => openFile(pdfUrl)} />
              )}
            </View>
          )}
        </DocSection>

        {/* Posted by — the school's admin, by role rather than the school name
            the admin account carries */}
        {!!item.creatorName && (
          <>
            <View style={s.divider} />
            <DocSection title="Posted By">
              <View style={s.creatorRow}>
                {creatorAvatar ? (
                  <Image source={{ uri: creatorAvatar }} style={s.creatorAvatar} />
                ) : (
                  <View style={[s.creatorAvatar, s.creatorAvatarFallback]}>
                    <Text style={s.creatorInitial}>A</Text>
                  </View>
                )}
                <View style={s.creatorInfo}>
                  <Text style={s.creatorName}>Admin</Text>
                  {!!item.creatorEmail && (
                    <Text style={s.creatorEmail}>{item.creatorEmail}</Text>
                  )}
                </View>
              </View>
            </DocSection>
          </>
        )}
      </ScrollView>
    </View>
  );
};

export default ViewAnnouncementScreen;

const __mk_s = () => StyleSheet.create({
  centeredBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  mutedText: { fontSize: 14, color: theme.colors.textMuted },

  // Date + title
  dateText: { fontSize: 12, color: QUIET, marginBottom: 6 },
  title: { fontSize: 20, fontWeight: '700', color: INK, lineHeight: 27 },

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

  // Line between the description and who posted it
  divider: { height: 1, backgroundColor: theme.colors.border },

  // Creator
  creatorRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  creatorAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: theme.colors.background },
  creatorAvatarFallback: { alignItems: 'center', justifyContent: 'center' },
  creatorInitial: { fontSize: 15, fontWeight: '600', color: theme.colors.textSecondary },
  creatorInfo: { flex: 1 },
  creatorName: { fontSize: 15, fontWeight: '500', color: INK },
  creatorEmail: { fontSize: 13, color: QUIET, marginTop: 2 },
});


// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
