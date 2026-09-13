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
import { Skeleton } from '../../components/Skeleton';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useRefresh } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';
import { mapApiItem, type Announcement } from './announcementData';
import { markAnnouncementRead } from './announcementReads';
import apiClient from '../../api/apiClient';
import constant from '../../utils/constant';
import { DocHeader, DocSection, DocBody, docStyles } from '../more/docUi';
import { INK, QUIET } from '../notification/inboxUi';

const TITLE = 'View Announcement';

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

// ── Loading ──────────────────────────────────────────────────────────────────
// The page line for line: the date, the title, the Description heading and its
// text, the rule, then Posted By with its avatar row — each box at the height of
// the text it stands in for, so nothing moves when the announcement arrives.
const BODY_W = ['100%', '94%', '97%', '58%'];

const DetailSkeleton = () => (
  <View style={docStyles.scroll}>
    <View>
      <View style={[s.skLine, s.skDate]}>
        <Skeleton width={132} height={10} />
      </View>
      <View style={[s.skLine, s.skTitle]}>
        <Skeleton width="72%" height={18} />
      </View>
    </View>

    <View>
      <View style={[s.skLine, s.skSection]}>
        <Skeleton width={100} height={14} />
      </View>
      {BODY_W.map((w, i) => (
        <View key={i} style={[s.skLine, s.skBody]}>
          <Skeleton width={w} height={12} />
        </View>
      ))}
    </View>

    <View style={s.divider} />

    <View>
      <View style={[s.skLine, s.skSection]}>
        <Skeleton width={84} height={14} />
      </View>
      <View style={s.creatorRow}>
        <Skeleton width={40} height={40} radius={20} />
        <View style={s.creatorInfo}>
          <View style={[s.skLine, s.skName]}>
            <Skeleton width={56} height={12} />
          </View>
          <View style={[s.skLine, s.skEmail]}>
            <Skeleton width={150} height={10} />
          </View>
        </View>
      </View>
    </View>
  </View>
);

const ViewAnnouncementScreen = ({ navigation, route }: any) => {
  // From the list the announcement arrives whole and shows at once. Opened by
  // id alone (a notification, a link) it is fetched, with the skeleton meanwhile.
  const passed: Announcement | undefined = route.params?.item;
  const rawId = passed?.id ?? route.params?.id ?? route.params?.announcement_id;
  const id: string | undefined = rawId != null ? String(rawId) : undefined;

  const [item, setItem] = useState<Announcement | undefined>(passed?.title ? passed : undefined);
  const [loading, setLoading] = useState(!passed?.title && !!id);

  const dateLabel = item?.date
    ? moment(item.date).format('DD MMM YYYY, hh:mm A')
    : '';

  const imageUrl = resolveFileUrl(item?.imageUrl);
  const pdfUrl = resolveFileUrl(item?.pdfUrl);
  const creatorAvatar = resolveFileUrl(item?.creatorAvatar);

  // Fetch the full announcement by id; whatever was passed in is kept for any
  // field the server leaves out.
  const fetchAnnouncementDetails = async () => {
    if (!id) return;

    try {
      const response = await apiClient.get(`/announcement/${id}`);
      const d = response.data?.data || response.data;

      if (d && d.id) {
        setItem(prev =>
          prev
            ? {
                ...prev,
                title: d.announcement_name || prev.title,
                content: d.announcement_content || prev.content,
                date: d.created_at || prev.date,
                imageUrl: d.announcement_image || prev.imageUrl,
                pdfUrl: d.announcement_pdf || prev.pdfUrl,
                hasImage: !!(d.announcement_image || prev.imageUrl),
                hasPdf: !!(d.announcement_pdf || prev.pdfUrl),
                creatorName: d.creator_name || prev.creatorName,
                creatorEmail: d.creator_email || prev.creatorEmail,
                creatorAvatar: d.creator_avatar || prev.creatorAvatar,
              }
            : mapApiItem(d),
        );
      }
    } catch (err: any) {
      // Fall back to the item passed via navigation, if any
      console.log('[ViewAnnouncement] Fetch failed:', err?.response?.status ?? err?.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Opening it is reading it: the green dot in the list goes.
    if (id) markAnnouncementRead(id);
    fetchAnnouncementDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const { refreshing, onRefresh } = useRefresh(fetchAnnouncementDetails);

  // Open attachments directly in the device's viewer / browser.
  const openFile = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Error', 'Unable to open this file on this device.');
    }
  };

  if (loading) {
    return (
      <View style={docStyles.root}>
        <DocHeader title={TITLE} onBackPress={() => navigation.goBack()} />
        <DetailSkeleton />
      </View>
    );
  }

  if (!item) {
    return (
      <View style={docStyles.root}>
        <DocHeader title={TITLE} onBackPress={() => navigation.goBack()} />
        <View style={s.centeredBox}>
          <Text style={s.mutedText}>Announcement not found</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={docStyles.root}>
      <DocHeader title={TITLE} onBackPress={() => navigation.goBack()} />

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

  // Skeleton boxes, at the heights of the real lines: date 12px, title 20/27,
  // section heading 17px, body 15/24, name 15px, email 13px.
  skLine: { justifyContent: 'center' },
  skDate: { height: 16, marginBottom: 6 },
  skTitle: { height: 27 },
  skSection: { height: 23, marginBottom: 8 },
  skBody: { height: 24 },
  skName: { height: 20 },
  skEmail: { height: 18, marginTop: 2 },
});


// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
