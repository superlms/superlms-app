import React, { useCallback, useEffect, useState } from 'react';
import {
  Linking,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import moment from 'moment';
import VectorIcon from '../../components/VectorIcon';
import { Skeleton, SkeletonText } from '../../components/Skeleton';
import { theme, onThemeChange } from '../../utils/theme';
import AppRefreshControl from '../../components/AppRefreshControl';
import { STATUS_META } from './queryTypes';
import type { Query } from './queryTypes';
import { fetchQueries } from './queryData';
import constant from '../../utils/constant';
import { DocHeader, DocSection, DocBody, docStyles } from '../more/docUi';
import { AppAlert } from '../../components/AppDialog';

// Files come from the same host as the API but outside the /api/v1 prefix
const FILE_ORIGIN = constant.API_BASE_URL.replace(/\/api\/v\d+\/?$/, '');

const resolveFileUrl = (url?: string | null): string | undefined => {
  if (!url) return undefined;
  if (/^https?:\/\//i.test(url)) return url;
  return `${FILE_ORIGIN}/${url.replace(/^\/+/, '')}`;
};

// Text, or its skeleton.
const Words = ({
  skeleton,
  style,
  children,
}: {
  skeleton?: boolean;
  style: StyleProp<TextStyle>;
  children: React.ReactNode;
}) =>
  skeleton ? <SkeletonText style={style}>{children}</SkeletonText> : <Text style={style}>{children}</Text>;

// Tappable attachment chip — file-type icon + label only (no file name); opens
// the file straight away, no preview screen. As a skeleton, a grey pill the
// chip's size.
const AttachmentChip = ({
  icon,
  label,
  onPress,
  skeleton,
}: {
  icon: string;
  label: string;
  onPress: () => void;
  skeleton?: boolean;
}) => {
  const chip = (
    <TouchableOpacity
      style={[s.chip, skeleton && s.unseenBox]}
      activeOpacity={0.7}
      onPress={onPress}
      disabled={skeleton}
    >
      <VectorIcon iconSet="Feather" iconName={icon} size={14} color={skeleton ? 'transparent' : theme.colors.primary} />
      <Text style={[s.chipText, skeleton && s.unseen]} numberOfLines={1}>
        {label}
      </Text>
      <VectorIcon
        iconSet="Feather"
        iconName="external-link"
        size={12}
        color={skeleton ? 'transparent' : theme.colors.textMuted}
      />
    </TouchableOpacity>
  );
  if (!skeleton) return chip;
  return (
    <View>
      {chip}
      <Skeleton radius={theme.radius.full} style={s.skFill} />
    </View>
  );
};

const ViewQueryScreen = ({ navigation, route }: any) => {
  const opened: Query | undefined = route.params?.item;
  const [item, setItem] = useState<Query | undefined>(opened);
  // The query loads again on opening and on a pull to refresh, and meanwhile
  // the page is drawn as a skeleton from the query as it was.
  const [loading, setLoading] = useState(!!opened);

  const load = useCallback(async () => {
    if (!opened) return;
    setLoading(true);
    try {
      const role = (await AsyncStorage.getItem('user_role')) || 'student';
      const found = (await fetchQueries(role)).find(q => String(q.id) === String(opened.id));
      if (found) setItem(found);
    } catch (err: any) {
      // The query as it was opened stays on screen.
      console.log('[ViewQueryScreen] Fetch error:', err?.message);
    } finally {
      setLoading(false);
    }
  }, [opened]);

  useEffect(() => {
    load();
  }, [load]);

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

  // Open attachments directly in the device's viewer / browser.
  const openFile = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      AppAlert.alert('Error', 'Unable to open this file on this device.');
    }
  };

  const page = (q: Query, skeleton: boolean) => {
    const meta = STATUS_META[q.status];
    const dateLabel = q.created_at ? moment(q.created_at).format('DD MMM YYYY, hh:mm A') : '';
    const repliedLabel =
      q.admin_reply && q.replied_at ? moment(q.replied_at).format('DD MMM YYYY, hh:mm A') : '';
    const imageUrl = resolveFileUrl(q.attachmentUrl);
    const pdfUrl = resolveFileUrl(q.pdfUrl);

    return (
      <>
        {/* When it was raised and where it stands, then the subject */}
        <View>
          <View style={s.metaLine}>
            {!!dateLabel && <Words skeleton={skeleton} style={s.dateText}>{dateLabel}</Words>}
            <View style={s.status}>
              {skeleton ? (
                <Skeleton width={7} height={7} radius={4} />
              ) : (
                <View style={[s.dot, { backgroundColor: meta.color }]} />
              )}
              <Words skeleton={skeleton} style={[s.statusText, { color: meta.color }]}>{q.status}</Words>
            </View>
          </View>
          <Words skeleton={skeleton} style={s.title}>{q.subject}</Words>
        </View>

        {/* The query, with its attachments as chips right under it */}
        <DocSection title="Your Query" skeleton={skeleton}>
          <DocBody skeleton={skeleton}>{q.message}</DocBody>
          {(imageUrl || pdfUrl) && (
            <View style={s.chips}>
              {!!imageUrl && (
                <AttachmentChip icon="image" label="Image" onPress={() => openFile(imageUrl)} skeleton={skeleton} />
              )}
              {!!pdfUrl && (
                <AttachmentChip icon="file-text" label="PDF" onPress={() => openFile(pdfUrl)} skeleton={skeleton} />
              )}
            </View>
          )}
        </DocSection>

        <View style={s.divider} />

        <DocSection title="School's Reply" skeleton={skeleton}>
          {q.admin_reply ? (
            <>
              <Words skeleton={skeleton} style={s.replyMeta}>
                School Admin{repliedLabel ? ` · ${repliedLabel}` : ''}
              </Words>
              <DocBody skeleton={skeleton}>{q.admin_reply}</DocBody>
            </>
          ) : (
            <Words skeleton={skeleton} style={s.mutedText}>
              No reply yet. The school will get back to you shortly.
            </Words>
          )}
        </DocSection>
      </>
    );
  };

  return (
    <View style={docStyles.root}>
      <DocHeader title="View Query" onBackPress={() => navigation.goBack()} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={docStyles.scroll}
        // The skeleton stands in for the spinner.
        refreshControl={<AppRefreshControl refreshing={false} onRefresh={load} />}
      >
        {page(item, loading)}
      </ScrollView>
    </View>
  );
};

export default ViewQueryScreen;

const __mk_s = () => StyleSheet.create({
  centeredBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },

  // The date and time with the status right after it, over the subject
  metaLine: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 12, rowGap: 4, marginBottom: 8 },
  dateText: { fontSize: 13, color: theme.colors.textMuted },
  status: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: 13, fontWeight: '500' },

  title: { fontSize: 20, fontWeight: '700', color: theme.colors.textPrimary, lineHeight: 27 },

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

  // A chip as a skeleton: laid out unseen, under a grey pill
  // Hidden by opacity: on Android a transparent colour draws text and borders black.
  unseen: { opacity: 0 },
  unseenBox: { opacity: 0 },
  skFill: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },

  // Line between the query and the school's reply
  divider: { height: 1, backgroundColor: theme.colors.border },

  replyMeta: { fontSize: 12, color: theme.colors.textMuted, marginBottom: 6 },
  mutedText: { fontSize: 14, color: theme.colors.textMuted, lineHeight: 21 },
});


// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
