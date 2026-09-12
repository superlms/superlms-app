import React, { useState } from 'react';
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
import { theme, onThemeChange } from '../../utils/theme';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useRefresh } from '../../hooks/useRefresh';
import { STATUS_META } from './queryTypes';
import type { Query } from './queryTypes';
import AttachmentPreviewModal from '../announcement/AttachmentPreviewModal';
import constant from '../../utils/constant';
import { DocHeader, DocSection, DocBody, docStyles } from '../more/docUi';

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
      <View style={docStyles.root}>
        <DocHeader title="View Query" onBackPress={() => navigation.goBack()} />
        <View style={s.centeredBox}>
          <Text style={s.mutedText}>Query not found</Text>
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
    <View style={docStyles.root}>
      <DocHeader title="View Query" onBackPress={() => navigation.goBack()} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={docStyles.scroll}
        refreshControl={
          <AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Status, subject, date */}
        <View>
          <View style={s.statusRow}>
            <View style={[s.dot, { backgroundColor: meta.color }]} />
            <Text style={[s.statusText, { color: meta.color }]}>{item.status}</Text>
            <Text style={s.timeText}>· {timeLabel}</Text>
          </View>
          <Text style={s.title}>{item.subject}</Text>
          {!!dateLabel && <Text style={s.dateText}>{dateLabel}</Text>}
        </View>

        <DocSection title="Your Query">
          <DocBody>{item.message}</DocBody>
        </DocSection>

        {(imageUrl || pdfUrl) && (
          <DocSection title="Attachments">
            <View style={s.attachList}>
              {/* Image: preview on top, name + action underneath */}
              {!!imageUrl && (
                <TouchableOpacity
                  style={s.attachCard}
                  activeOpacity={0.85}
                  onPress={() => setImageVisible(true)}
                >
                  <Image source={{ uri: imageUrl }} style={s.attachPreview} resizeMode="cover" />
                  <View style={s.attachFooter}>
                    <VectorIcon iconSet="Feather" iconName="image" size={16} color={theme.colors.textSecondary} />
                    <Text style={s.attachFooterName} numberOfLines={1}>
                      {item.attachmentName || 'Image'}
                    </Text>
                    <Text style={s.attachAction}>View</Text>
                  </View>
                </TouchableOpacity>
              )}

              {/* PDF: icon, name + type, open action */}
              {!!pdfUrl && (
                <TouchableOpacity
                  style={[s.attachCard, s.attachFileRow]}
                  activeOpacity={0.85}
                  onPress={openPdf}
                >
                  <View style={s.fileIcon}>
                    <VectorIcon iconSet="Feather" iconName="file-text" size={18} color={theme.colors.primary} />
                  </View>
                  <View style={s.fileText}>
                    <Text style={s.fileName} numberOfLines={1}>
                      {item.attachmentName || 'PDF Document'}
                    </Text>
                    <Text style={s.fileMeta}>PDF document</Text>
                  </View>
                  <Text style={s.attachAction}>Open</Text>
                </TouchableOpacity>
              )}
            </View>
          </DocSection>
        )}

        <DocSection title="School's Reply">
          {item.admin_reply ? (
            <>
              <Text style={s.replyMeta}>
                School Admin{repliedLabel ? ` · ${repliedLabel}` : ''}
              </Text>
              <DocBody>{item.admin_reply}</DocBody>
            </>
          ) : (
            <Text style={s.mutedText}>
              No reply yet. The school will get back to you shortly.
            </Text>
          )}
        </DocSection>
      </ScrollView>

      <AttachmentPreviewModal
        visible={imageVisible}
        accentColor={theme.colors.primary}
        imageUrl={imageUrl}
        onClose={() => setImageVisible(false)}
      />
    </View>
  );
};

export default ViewQueryScreen;

const __mk_s = () => StyleSheet.create({
  centeredBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },

  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: 13, fontWeight: '500' },
  timeText: { fontSize: 12, color: theme.colors.textMuted },

  title: { fontSize: 20, fontWeight: '700', color: theme.colors.textPrimary, lineHeight: 27 },
  dateText: { fontSize: 12, color: theme.colors.textMuted, marginTop: 4 },

  // Attachments
  attachList: { gap: 12 },
  attachCard: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.card,
    overflow: 'hidden',
  },
  attachPreview: { width: '100%', height: 180, backgroundColor: theme.colors.background },
  attachFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  attachFooterName: { flex: 1, fontSize: 14, fontWeight: '500', color: theme.colors.textPrimary },
  attachAction: { fontSize: 13, fontWeight: '600', color: theme.colors.primary },

  attachFileRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  fileIcon: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileText: { flex: 1 },
  fileName: { fontSize: 14, fontWeight: '500', color: theme.colors.textPrimary },
  fileMeta: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },

  replyMeta: { fontSize: 12, color: theme.colors.textMuted, marginBottom: 6 },
  mutedText: { fontSize: 14, color: theme.colors.textMuted, lineHeight: 21 },
});


// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
