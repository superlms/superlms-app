import React from 'react';
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
import VectorIcon from '../../components/VectorIcon';
import { theme, onThemeChange } from '../../utils/theme';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useRefresh } from '../../hooks/useRefresh';
import { STATUS_META } from './queryTypes';
import type { Query } from './queryTypes';
import constant from '../../utils/constant';
import { DocHeader, DocSection, DocBody, docStyles } from '../more/docUi';

// Files come from the same host as the API but outside the /api/v1 prefix
const FILE_ORIGIN = constant.API_BASE_URL.replace(/\/api\/v\d+\/?$/, '');

const resolveFileUrl = (url?: string | null): string | undefined => {
  if (!url) return undefined;
  if (/^https?:\/\//i.test(url)) return url;
  return `${FILE_ORIGIN}/${url.replace(/^\/+/, '')}`;
};

// Tappable attachment chip — opens the file straight away, no preview screen.
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
    <Text style={s.chipText} numberOfLines={1} ellipsizeMode="middle">
      {label}
    </Text>
    <VectorIcon iconSet="Feather" iconName="external-link" size={12} color={theme.colors.textMuted} />
  </TouchableOpacity>
);

const ViewQueryScreen = ({ navigation, route }: any) => {
  const item: Query = route.params?.item;

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

  // Open attachments directly in the device's viewer / browser.
  const openFile = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Error', 'Unable to open this file on this device.');
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

        {/* The query, with its attachments as chips right under it */}
        <DocSection title="Your Query">
          <DocBody>{item.message}</DocBody>
          {(imageUrl || pdfUrl) && (
            <View style={s.chips}>
              {!!imageUrl && (
                <AttachmentChip
                  icon="image"
                  label={item.attachmentName || 'Image'}
                  onPress={() => openFile(imageUrl)}
                />
              )}
              {!!pdfUrl && (
                <AttachmentChip
                  icon="file-text"
                  label={item.attachmentName || 'PDF Document'}
                  onPress={() => openFile(pdfUrl)}
                />
              )}
            </View>
          )}
        </DocSection>

        <View style={s.divider} />

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

  // Line between the query and the school's reply
  divider: { height: 1, backgroundColor: theme.colors.border },

  replyMeta: { fontSize: 12, color: theme.colors.textMuted, marginBottom: 6 },
  mutedText: { fontSize: 14, color: theme.colors.textMuted, lineHeight: 21 },
});


// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
