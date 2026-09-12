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
import { theme, onThemeChange } from '../../utils/theme';
import { quietCaps } from '../../utils/quietCaps';
import { DocHeader, DocNoData } from '../more/docUi';
import AttachmentPreviewModal from '../announcement/AttachmentPreviewModal';
import type { SyllabusTopic } from '../../api/contentApi';
import { ResourceRow } from './contentUi';

const TITLE = 'Topic';

/**
 * A topic's study material, read as a document: where it sits, its name, then
 * the image, the notes, and any link or PDF as plain rows underneath.
 */
const ViewContentScreen = ({ navigation, route }: any) => {
  const topic: SyllabusTopic | undefined = route.params?.topic;
  const chapterName = quietCaps(route.params?.chapterName);
  const subjectName = quietCaps(route.params?.subjectName);
  const topicName = quietCaps(topic?.name ?? route.params?.topicName);

  const content = topic?.content?.trim() ?? '';
  const imageUrl = topic?.imageUrl ?? null;
  const pdfUrl = topic?.pdfUrl ?? null;
  const link = topic?.link?.trim() ?? '';
  const hasAny = !!(content || imageUrl || pdfUrl || link);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const openUrl = async (url: string) => {
    if (!url) return;
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Error', 'Unable to open the link on this device.');
    }
  };

  const kicker = [subjectName, chapterName].filter(Boolean).join(' · ');

  return (
    <View style={s.root}>
      <DocHeader title={TITLE} onBackPress={() => navigation.goBack()} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.scroll, !hasAny && s.grow]}
      >
        {/* Where it sits, and what it is */}
        <View style={s.head}>
          {!!kicker && <Text style={s.kicker}>{kicker.toUpperCase()}</Text>}
          <Text style={s.title}>{topicName}</Text>
        </View>
        <View style={s.divider} />

        {!hasAny ? (
          <DocNoData
            icon="reader-outline"
            title="Nothing here yet"
            subtitle="Your teacher hasn't added study material for this topic yet."
          />
        ) : (
          <View style={s.body}>
            {!!imageUrl && (
              <TouchableOpacity activeOpacity={0.9} onPress={() => setPreviewUrl(imageUrl)}>
                <Image source={{ uri: imageUrl }} style={s.image} resizeMode="cover" />
              </TouchableOpacity>
            )}

            {!!content && <Text style={s.paragraph}>{content}</Text>}

            {(!!link || !!pdfUrl) && (
              <View>
                <Text style={s.sectionTitle}>Resources</Text>
                {!!link && (
                  <ResourceRow
                    icon="link-outline"
                    title="Open link"
                    sub={link}
                    onPress={() => openUrl(link)}
                    isLast={!pdfUrl}
                  />
                )}
                {!!pdfUrl && (
                  <ResourceRow
                    icon="document-attach-outline"
                    title="PDF document"
                    sub="Opens outside the app"
                    onPress={() => openUrl(pdfUrl)}
                    isLast
                  />
                )}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      <AttachmentPreviewModal
        visible={previewUrl !== null}
        accentColor={theme.colors.primary}
        imageUrl={previewUrl || undefined}
        onClose={() => setPreviewUrl(null)}
      />
    </View>
  );
};

export default ViewContentScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  scroll: { paddingBottom: 40 },
  grow: { flexGrow: 1 },

  // Head
  head: { paddingHorizontal: 20, paddingTop: 22, paddingBottom: 20 },
  kicker: { fontSize: 11, fontWeight: '600', letterSpacing: 0.8, color: theme.colors.textMuted },
  title: { fontSize: 22, fontWeight: '700', lineHeight: 29, color: theme.colors.textPrimary, marginTop: 6 },

  divider: { height: 1, backgroundColor: theme.colors.divider },

  // Material
  body: { paddingHorizontal: 20, paddingTop: 20, gap: 22 },
  image: { width: '100%', height: 200, borderRadius: theme.radius.md, backgroundColor: theme.colors.background },
  paragraph: { fontSize: 15, lineHeight: 24, color: theme.colors.textPrimary },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: theme.colors.textSecondary, marginBottom: 2 },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
