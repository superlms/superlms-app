import React, { useState, useEffect } from 'react';
import ScreenSkeleton from '../../components/Skeleton';
import {
  Alert,
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import moment from 'moment';
import Header from '../../components/Header';
import VectorIcon from '../../components/VectorIcon';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useRefresh } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';
import { TAG_META } from './announcementData';
import type { Announcement } from './announcementData';
import AttachmentPreviewModal from './AttachmentPreviewModal';
import apiClient from '../../api/apiClient';
import constant from '../../utils/constant';

// Files come from the same host as the API but outside the /api/v1 prefix
const FILE_ORIGIN = constant.API_BASE_URL.replace(/\/api\/v\d+\/?$/, '');

const resolveFileUrl = (url?: string): string | undefined => {
  if (!url) return undefined;
  if (/^https?:\/\//i.test(url)) return url;
  return `${FILE_ORIGIN}/${url.replace(/^\/+/, '')}`;
};

const ViewAnnouncementScreen = ({ navigation, route }: any) => {
  const initialItem: Announcement = route.params?.item;
  const [item, setItem] = useState<Announcement>(initialItem);
  const [loading, setLoading] = useState(false);
  const [imageVisible, setImageVisible] = useState(false);

  const tag = TAG_META[item?.tag || 'All'];
  const timeLabel = item?.daysAgo === 0 ? 'Today' : `${item?.daysAgo || 0}d ago`;
  const dateLabel = item?.date
    ? moment(item.date).format('DD MMM YYYY, hh:mm A')
    : '';

  const imageUrl = resolveFileUrl(item?.imageUrl);
  const pdfUrl = resolveFileUrl(item?.pdfUrl);
  const creatorAvatar = resolveFileUrl(item?.creatorAvatar);

  // Fetch full announcement details by ID
  const fetchAnnouncementDetails = async () => {
    if (!item?.id) return;

    setLoading(true);

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
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnnouncementDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialItem?.id]);

  const { refreshing, onRefresh } = useRefresh(fetchAnnouncementDetails);

  const openPdf = async () => {
    if (!pdfUrl) return;
    try {
      await Linking.openURL(pdfUrl);
    } catch {
      Alert.alert('Error', 'Unable to open the PDF on this device.');
    }
  };

  if (!item) {
    return (
      <View style={s.root}>
        <Header title="View Announcement" onBackPress={() => navigation.goBack()} />
        <View style={s.centeredBox}>
          <Text style={s.errorText}>Announcement not found</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={s.root}>
      <Header
        title="View Announcement"
        onBackPress={() => navigation.goBack()}
      />

      {loading ? (
        <View style={s.centeredBox}>
          <ScreenSkeleton variant="detail" />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.scroll}
          refreshControl={
            <AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {/* ── Single detail card ── */}
          <View style={s.card}>
            {/* Top accent strip */}
            <View style={[s.accentStrip, { backgroundColor: tag.color }]} />

            <View style={s.cardInner}>
              {/* Meta row: tag + new + time */}
              <View style={s.metaRow}>
                <View style={[s.tagPill, { backgroundColor: tag.bgColor }]}>
                  <VectorIcon
                    iconSet="Feather"
                    iconName="tag"
                    size={11}
                    color={tag.color}
                  />
                  <Text style={[s.tagPillText, { color: tag.color }]}>
                    {item.tag}
                  </Text>
                </View>
                {item.isNew && (
                  <View style={[s.tagPill, { backgroundColor: '#DCFCE7' }]}>
                    <View style={s.newDot} />
                    <Text style={[s.tagPillText, { color: theme.colors.success }]}>
                      New
                    </Text>
                  </View>
                )}
                <View style={s.metaSpacer} />
                <View style={s.timeRow}>
                  <VectorIcon
                    iconSet="Feather"
                    iconName="clock"
                    size={12}
                    color={theme.colors.textMuted}
                  />
                  <Text style={s.timeText}>{timeLabel}</Text>
                </View>
              </View>

              {/* Title */}
              <Text style={s.title}>{item.title}</Text>
              {!!dateLabel && <Text style={s.dateText}>{dateLabel}</Text>}

              <View style={s.divider} />

              {/* Description */}
              <Text style={s.sectionLabel}>Description</Text>
              <Text style={s.bodyText}>
                {item.content || 'No description available'}
              </Text>

              {/* Attachments */}
              {(imageUrl || pdfUrl) && (
                <>
                  <View style={s.divider} />
                  <Text style={s.sectionLabel}>Attachments</Text>
                  <View style={s.attachList}>
                    {!!imageUrl && (
                      <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={() => setImageVisible(true)}
                        style={[s.attachBtn, { borderColor: tag.color + '40' }]}
                      >
                        <View
                          style={[s.attachIconBox, { backgroundColor: tag.bgColor }]}
                        >
                          <VectorIcon
                            iconSet="Feather"
                            iconName="image"
                            size={18}
                            color={tag.color}
                          />
                        </View>
                        <View style={s.attachTextBox}>
                          <Text style={s.attachTitle}>Image</Text>
                          <Text style={s.attachSub}>Tap to view full image</Text>
                        </View>
                        <VectorIcon
                          iconSet="Ionicons"
                          iconName="chevron-forward"
                          size={16}
                          color={theme.colors.textMuted}
                        />
                      </TouchableOpacity>
                    )}

                    {!!pdfUrl && (
                      <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={openPdf}
                        style={[s.attachBtn, { borderColor: tag.color + '40' }]}
                      >
                        <View
                          style={[s.attachIconBox, { backgroundColor: tag.bgColor }]}
                        >
                          <VectorIcon
                            iconSet="Feather"
                            iconName="file-text"
                            size={18}
                            color={tag.color}
                          />
                        </View>
                        <View style={s.attachTextBox}>
                          <Text style={s.attachTitle}>PDF Document</Text>
                          <Text style={s.attachSub}>Tap to open PDF</Text>
                        </View>
                        <VectorIcon
                          iconSet="Feather"
                          iconName="external-link"
                          size={16}
                          color={theme.colors.textMuted}
                        />
                      </TouchableOpacity>
                    )}
                  </View>
                </>
              )}

              {/* Posted by */}
              {!!item.creatorName && (
                <>
                  <View style={s.divider} />
                  <Text style={s.sectionLabel}>Posted By</Text>
                  <View style={s.creatorRow}>
                    {creatorAvatar ? (
                      <Image
                        source={{ uri: creatorAvatar }}
                        style={s.creatorAvatar}
                      />
                    ) : (
                      <View style={[s.creatorAvatar, { backgroundColor: tag.bgColor }]}>
                        <Text style={[s.creatorInitial, { color: tag.color }]}>
                          {item.creatorName.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <View style={s.creatorInfo}>
                      <Text style={s.creatorName}>{item.creatorName}</Text>
                      {!!item.creatorEmail && (
                        <Text style={s.creatorEmail}>{item.creatorEmail}</Text>
                      )}
                    </View>
                  </View>
                </>
              )}
            </View>
          </View>
        </ScrollView>
      )}

      <AttachmentPreviewModal
        visible={imageVisible}
        accentColor={tag.color}
        imageUrl={imageUrl}
        onClose={() => setImageVisible(false)}
      />
    </View>
  );
};

export default ViewAnnouncementScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  scroll: { padding: 16, paddingBottom: 40 },
  centeredBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  errorText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },

  // Single card
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    overflow: 'hidden',
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 4,
  },
  accentStrip: { height: 5 },
  cardInner: { padding: 18 },

  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  metaSpacer: { flex: 1 },
  tagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: theme.radius.full,
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  tagPillText: { fontSize: 12, fontWeight: '700' },
  newDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.success,
  },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  timeText: {
    fontSize: 12,
    color: theme.colors.textMuted,
    fontWeight: '600',
  },

  title: {
    fontSize: 20,
    fontWeight: '800',
    color: theme.colors.textPrimary,
    lineHeight: 28,
    marginBottom: 4,
  },
  dateText: {
    fontSize: 12,
    color: theme.colors.textMuted,
    fontWeight: '500',
  },

  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: 16,
  },

  sectionLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.colors.textMuted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  bodyText: {
    fontSize: 15,
    color: theme.colors.textPrimary,
    lineHeight: 25,
  },

  // Attachments
  attachList: { gap: 10 },
  attachBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: theme.radius.md,
    borderWidth: 1.5,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: theme.colors.card,
  },
  attachIconBox: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachTextBox: { flex: 1 },
  attachTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: 1,
  },
  attachSub: { fontSize: 12, color: theme.colors.textMuted },

  // Creator
  creatorRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  creatorAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  creatorInitial: { fontSize: 17, fontWeight: '800' },
  creatorInfo: { flex: 1 },
  creatorName: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: 2,
  },
  creatorEmail: { fontSize: 13, color: theme.colors.textSecondary },
});


// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
