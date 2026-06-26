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
import Header from '../../components/Header';
import VectorIcon from '../../components/VectorIcon';
import { theme, onThemeChange } from '../../utils/theme';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useRefresh } from '../../hooks/useRefresh';
import AttachmentPreviewModal from '../announcement/AttachmentPreviewModal';
import type { SyllabusTopic } from '../../api/contentApi';

const ViewContentScreen = ({ navigation, route }: any) => {
  const topic: SyllabusTopic | undefined = route.params?.topic;
  const chapterName: string = route.params?.chapterName ?? '';
  const subjectName: string = route.params?.subjectName ?? '';
  const subjectIcon: string = route.params?.subjectIcon ?? '';
  const subjectColor: string = route.params?.subjectColor ?? theme.colors.primary;
  const subjectImage: string | null = route.params?.subjectImage ?? null;

  const topicName = topic?.name ?? route.params?.topicName ?? '';
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

  const { refreshing, onRefresh } = useRefresh(() => {});

  return (
    <View style={s.root}>
      <Header title="Study Content" onBackPress={() => navigation.goBack()} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
        refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={s.card}>
          <View style={[s.accentStrip, { backgroundColor: subjectColor }]} />

          {/* Subject image banner */}
          {subjectImage ? (
            <Image source={{ uri: subjectImage }} style={s.subjectBanner} resizeMode="cover" />
          ) : null}

          <View style={s.cardInner}>
            {/* Meta row: subject + chapter */}
            <View style={s.metaRow}>
              <View style={[s.tagPill, { backgroundColor: subjectColor + '15' }]}>
                {!!subjectIcon && <Text style={s.tagPillEmoji}>{subjectIcon}</Text>}
                <Text style={[s.tagPillText, { color: subjectColor }]} numberOfLines={1}>{subjectName}</Text>
              </View>
              <View style={s.metaSpacer} />
              {!!chapterName && (
                <View style={s.timeRow}>
                  <VectorIcon iconSet="Feather" iconName="layers" size={12} color={theme.colors.textMuted} />
                  <Text style={s.timeText} numberOfLines={1}>{chapterName}</Text>
                </View>
              )}
            </View>

            <Text style={s.title}>{topicName}</Text>
            {!!chapterName && <Text style={s.chapterText}>Chapter · {chapterName}</Text>}

            <View style={s.divider} />

            {!hasAny ? (
              <View style={s.empty}>
                <VectorIcon iconSet="Ionicons" iconName="folder-open-outline" size={44} color={theme.colors.textMuted} />
                <Text style={s.emptyTitle}>No content yet</Text>
                <Text style={s.emptySubText}>
                  Your teacher hasn't added any study content for this topic yet.
                </Text>
              </View>
            ) : (
              <>
                {/* Topic image */}
                {!!imageUrl && (
                  <>
                    <Text style={s.sectionLabel}>Image</Text>
                    <TouchableOpacity activeOpacity={0.9} onPress={() => setPreviewUrl(imageUrl)}>
                      <Image source={{ uri: imageUrl }} style={s.topicImage} resizeMode="cover" />
                    </TouchableOpacity>
                  </>
                )}

                {/* Content text */}
                {!!content && (
                  <>
                    {!!imageUrl && <View style={s.divider} />}
                    <Text style={s.sectionLabel}>Description</Text>
                    <Text style={s.bodyText}>{content}</Text>
                  </>
                )}

                {/* Link */}
                {!!link && (
                  <>
                    {(content || imageUrl) && <View style={s.divider} />}
                    <Text style={s.sectionLabel}>Link</Text>
                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={() => openUrl(link)}
                      style={[s.attachBtn, { borderColor: subjectColor + '40' }]}
                    >
                      <View style={[s.attachIconBox, { backgroundColor: subjectColor + '15' }]}>
                        <VectorIcon iconSet="Ionicons" iconName="link-outline" size={18} color={subjectColor} />
                      </View>
                      <View style={s.attachTextBox}>
                        <Text style={s.attachTitle}>Open Link</Text>
                        <Text style={s.attachSub} numberOfLines={1}>{link}</Text>
                      </View>
                      <VectorIcon iconSet="Feather" iconName="external-link" size={16} color={theme.colors.textMuted} />
                    </TouchableOpacity>
                  </>
                )}

                {/* PDF attachment */}
                {!!pdfUrl && (
                  <>
                    {(content || imageUrl || link) && <View style={s.divider} />}
                    <Text style={s.sectionLabel}>Attachment</Text>
                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={() => openUrl(pdfUrl)}
                      style={[s.attachBtn, { borderColor: '#EF444440' }]}
                    >
                      <View style={[s.attachIconBox, { backgroundColor: '#FEE2E2' }]}>
                        <VectorIcon iconSet="Feather" iconName="file-text" size={18} color="#EF4444" />
                      </View>
                      <View style={s.attachTextBox}>
                        <Text style={s.attachTitle}>PDF Document</Text>
                        <Text style={s.attachSub} numberOfLines={1}>Tap to open</Text>
                      </View>
                      <VectorIcon iconSet="Ionicons" iconName="open-outline" size={16} color={theme.colors.textMuted} />
                    </TouchableOpacity>
                  </>
                )}
              </>
            )}
          </View>
        </View>
      </ScrollView>

      <AttachmentPreviewModal
        visible={previewUrl !== null}
        accentColor={subjectColor}
        imageUrl={previewUrl || undefined}
        onClose={() => setPreviewUrl(null)}
      />
    </View>
  );
};

export default ViewContentScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  scroll: { padding: 16, paddingBottom: 40 },

  card: {
    backgroundColor: theme.colors.card, borderRadius: theme.radius.lg, overflow: 'hidden',
    shadowColor: theme.colors.shadow, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07, shadowRadius: 12, elevation: 4,
  },
  accentStrip: { height: 5 },
  subjectBanner: { width: '100%', height: 150, backgroundColor: theme.colors.background },
  cardInner: { padding: 18 },

  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  metaSpacer: { flex: 1 },
  tagPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderRadius: theme.radius.full, paddingHorizontal: 11, paddingVertical: 5, maxWidth: '60%',
  },
  tagPillText: { fontSize: 12, fontWeight: '700' },
  tagPillEmoji: { fontSize: 11 },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: '45%' },
  timeText: { fontSize: 12, color: theme.colors.textMuted, fontWeight: '600' },

  title: { fontSize: 20, fontWeight: '800', color: theme.colors.textPrimary, lineHeight: 28, marginBottom: 4 },
  chapterText: { fontSize: 12, color: theme.colors.textMuted, fontWeight: '500' },

  divider: { height: 1, backgroundColor: theme.colors.border, marginVertical: 16 },

  sectionLabel: {
    fontSize: 12, fontWeight: '800', color: theme.colors.textMuted,
    letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 10,
  },

  topicImage: { width: '100%', height: 200, borderRadius: theme.radius.md, backgroundColor: theme.colors.background },
  bodyText: { fontSize: 15, color: theme.colors.textPrimary, lineHeight: 25 },

  attachBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: theme.radius.md, borderWidth: 1.5,
    paddingHorizontal: 12, paddingVertical: 10, backgroundColor: theme.colors.card,
  },
  attachIconBox: { width: 40, height: 40, borderRadius: theme.radius.sm, alignItems: 'center', justifyContent: 'center' },
  attachTextBox: { flex: 1 },
  attachTitle: { fontSize: 14, fontWeight: '700', color: theme.colors.textPrimary, marginBottom: 1 },
  attachSub: { fontSize: 12, color: theme.colors.textMuted },

  empty: { alignItems: 'center', paddingVertical: 28, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: theme.colors.textSecondary },
  emptySubText: { fontSize: 13, color: theme.colors.textMuted, textAlign: 'center', lineHeight: 20, paddingHorizontal: 20 },
});


// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
