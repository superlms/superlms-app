import React, { useState } from 'react';
import {
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import moment from 'moment';
import Header from '../../components/Header';
import VectorIcon from '../../components/VectorIcon';
import { theme, onThemeChange } from '../../utils/theme';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useRefresh } from '../../hooks/useRefresh';
import { STATUS_META } from './queryTypes';
import type { Query } from './queryTypes';
import AttachmentPreviewModal from '../announcement/AttachmentPreviewModal';
import constant from '../../utils/constant';

// Files come from the same host as the API but outside the /api/v1 prefix
const FILE_ORIGIN = constant.API_BASE_URL.replace(/\/api\/v\d+\/?$/, '');

const resolveFileUrl = (url?: string | null): string | undefined => {
  if (!url) return undefined;
  if (/^https?:\/\//i.test(url)) return url;
  return `${FILE_ORIGIN}/${url.replace(/^\/+/, '')}`;
};

const ViewQueryScreen = ({ navigation, route }: any) => {
  const item: Query = route.params?.item;
  const [imageVisible, setImageVisible] = useState(false);

  // TODO: wire to the query-detail API loader once integrated.
  const { refreshing, onRefresh } = useRefresh(() => {});

  if (!item) {
    return (
      <View style={s.root}>
        <Header title="View Query" onBackPress={() => navigation.goBack()} />
        <View style={s.centeredBox}>
          <Text style={s.errorText}>Query not found</Text>
        </View>
      </View>
    );
  }

  const meta = STATUS_META[item.status];
  const timeLabel = item.daysAgo === 0 ? 'Today' : `${item.daysAgo}d ago`;
  const dateLabel = item.created_at
    ? moment(item.created_at).format('DD MMM YYYY, hh:mm A')
    : '';
  const repliedLabel =
    item.admin_reply && item.replied_at
      ? moment(item.replied_at).format('DD MMM YYYY, hh:mm A')
      : '';

  const imageUrl = resolveFileUrl(item.attachmentUrl);
  const pdfUrl = resolveFileUrl(item.pdfUrl);

  const openPdf = async () => {
    if (!pdfUrl) return;
    try {
      await Linking.openURL(pdfUrl);
    } catch {
      Alert.alert('Error', 'Unable to open the PDF on this device.');
    }
  };

  return (
    <View style={s.root}>
      <Header title="View Query" onBackPress={() => navigation.goBack()} />

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
          <View style={[s.accentStrip, { backgroundColor: meta.color }]} />

          <View style={s.cardInner}>
            {/* Meta row: status + time */}
            <View style={s.metaRow}>
              <View style={[s.tagPill, { backgroundColor: meta.bg }]}>
                <View style={[s.statusDot, { backgroundColor: meta.color }]} />
                <Text style={[s.tagPillText, { color: meta.color }]}>
                  {item.status}
                </Text>
              </View>
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
            <Text style={s.title}>{item.subject}</Text>
            {!!dateLabel && <Text style={s.dateText}>{dateLabel}</Text>}

            <View style={s.divider} />

            {/* Your query */}
            <Text style={s.sectionLabel}>Your Query</Text>
            <Text style={s.bodyText}>{item.message}</Text>

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
                      style={[s.attachBtn, { borderColor: meta.color + '40' }]}
                    >
                      <View
                        style={[s.attachIconBox, { backgroundColor: meta.bg }]}
                      >
                        <VectorIcon
                          iconSet="Feather"
                          iconName="image"
                          size={18}
                          color={meta.color}
                        />
                      </View>
                      <View style={s.attachTextBox}>
                        <Text style={s.attachTitle} numberOfLines={1}>
                          {item.attachmentName || 'Image'}
                        </Text>
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
                      style={[s.attachBtn, { borderColor: meta.color + '40' }]}
                    >
                      <View
                        style={[s.attachIconBox, { backgroundColor: meta.bg }]}
                      >
                        <VectorIcon
                          iconSet="Feather"
                          iconName="file-text"
                          size={18}
                          color={meta.color}
                        />
                      </View>
                      <View style={s.attachTextBox}>
                        <Text style={s.attachTitle} numberOfLines={1}>
                          {item.attachmentName || 'PDF Document'}
                        </Text>
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

            {/* School's reply */}
            <View style={s.divider} />
            <Text style={s.sectionLabel}>School's Reply</Text>
            {item.admin_reply ? (
              <View style={s.replyBox}>
                <View style={s.replyHeader}>
                  <View style={[s.replyAvatar, { backgroundColor: meta.bg }]}>
                    <VectorIcon
                      iconSet="Ionicons"
                      iconName="school-outline"
                      size={18}
                      color={meta.color}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.replyName}>School Admin</Text>
                    {!!repliedLabel && (
                      <Text style={s.replyDate}>{repliedLabel}</Text>
                    )}
                  </View>
                </View>
                <Text style={s.replyText}>{item.admin_reply}</Text>
              </View>
            ) : (
              <View style={s.pendingBox}>
                <VectorIcon
                  iconSet="Ionicons"
                  iconName="hourglass-outline"
                  size={18}
                  color="#D97706"
                />
                <Text style={s.pendingText}>
                  No reply yet. The school will get back to you shortly.
                </Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      <AttachmentPreviewModal
        visible={imageVisible}
        accentColor={meta.color}
        imageUrl={imageUrl}
        onClose={() => setImageVisible(false)}
      />
    </View>
  );
};

export default ViewQueryScreen;

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

  // Single card (announcement style)
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
  statusDot: { width: 6, height: 6, borderRadius: 3 },
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

  // Attachments (announcement style)
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

  // Reply
  replyBox: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 14,
    gap: 10,
  },
  replyHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  replyAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  replyName: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  replyDate: {
    fontSize: 11,
    color: theme.colors.textMuted,
    fontWeight: '500',
    marginTop: 1,
  },
  replyText: {
    fontSize: 14,
    color: theme.colors.textPrimary,
    lineHeight: 22,
  },

  // Awaiting reply
  pendingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FEF3C7',
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: '#F59E0B40',
    padding: 14,
  },
  pendingText: {
    flex: 1,
    fontSize: 13,
    color: '#92400E',
    lineHeight: 19,
    fontWeight: '500',
  },
});


// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
