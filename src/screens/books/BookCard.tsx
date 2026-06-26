import React, { useState } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import VectorIcon from '../../components/VectorIcon';
import { theme, onThemeChange } from '../../utils/theme';
import constant from '../../utils/constant';
import { subjectMetaFor } from './bookData';
import type { ApiBook } from '../../api/booksApi';

// Subject icon comes from the same host as the API but outside /api/v1.
const FILE_ORIGIN = constant.API_BASE_URL.replace(/\/api\/v\d+\/?$/, '');
const resolveFileUrl = (url?: string | null): string | undefined => {
  if (!url) return undefined;
  if (/^https?:\/\//i.test(url)) return url;
  return `${FILE_ORIGIN}/${url.replace(/^\/+/, '')}`;
};

interface Props {
  item: ApiBook;
  showClass?: boolean; // teacher cards include class · section
  onViewPress: (book: ApiBook) => void;
}

// Subjects-screen style card (accent bar + icon + title + pills + chevron).
const BookCard = ({ item, showClass, onViewPress }: Props) => {
  const subjectName = item.subject?.name ?? '—';
  const meta = subjectMetaFor(subjectName);
  const subjectImage = resolveFileUrl(item.subject?.image);
  const [imgFailed, setImgFailed] = useState(false);
  const showImage = !!subjectImage && !imgFailed;
  const classLine = item.standard?.name
    ? `${item.standard.name}${item.section?.name ? ' · ' + item.section.name : ''}`
    : null;
  const subtitle =
    showClass && classLine ? `${subjectName} · ${classLine}` : subjectName;

  return (
    <TouchableOpacity style={s.card} onPress={() => onViewPress(item)} activeOpacity={0.85}>
      <View style={[s.accentBar, { backgroundColor: meta.color }]} />
      <View style={s.cardInner}>
        <View style={s.cardTop}>
          <View style={[s.iconWrap, { backgroundColor: meta.bg }]}>
            {showImage ? (
              <Image
                source={{ uri: subjectImage }}
                style={s.iconImage}
                resizeMode="contain"
                onError={() => setImgFailed(true)}
              />
            ) : (
              <VectorIcon iconSet="Ionicons" iconName="book" size={22} color={meta.color} />
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.cardTitle} numberOfLines={2}>{item.title}</Text>
            <Text style={s.cardSubtitle} numberOfLines={1}>{subtitle}</Text>
          </View>
          <View style={s.chevronWrap}>
            <VectorIcon iconSet="Ionicons" iconName="chevron-forward" size={16} color={theme.colors.textSecondary} />
          </View>
        </View>

        <View style={s.pillsRow}>
          <View style={[s.pill, { backgroundColor: meta.color + '15' }]}>
            <VectorIcon iconSet="Ionicons" iconName="book-outline" size={12} color={meta.color} />
            <Text style={[s.pillText, { color: meta.color }]} numberOfLines={1}>{subjectName}</Text>
          </View>
          {!!item.pdf_url && (
            <View style={s.pill}>
              <VectorIcon iconSet="Feather" iconName="file-text" size={12} color={theme.colors.primary} />
              <Text style={s.pillText}>PDF</Text>
            </View>
          )}
        </View>

        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => onViewPress(item)}
          style={[s.openBtn, { backgroundColor: meta.color }]}
        >
          <VectorIcon
            iconSet="Ionicons"
            iconName={item.pdf_url ? 'reader-outline' : 'book-outline'}
            size={14}
            color="#fff"
          />
          <Text style={s.openBtnText}>{item.pdf_url ? 'Open PDF' : 'View Book'}</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
};

export default BookCard;

const __mk_s = () => StyleSheet.create({
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
    elevation: 2,
    marginBottom: 14,
  },
  accentBar: { height: 4, width: '100%' },
  cardInner: { padding: theme.spacing.md, gap: 10 },

  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  iconImage: { width: 30, height: 30 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: theme.colors.textPrimary, lineHeight: 20 },
  cardSubtitle: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },
  chevronWrap: {
    width: 30,
    height: 30,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },

  pillsRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: theme.colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.radius.full,
    maxWidth: '70%',
  },
  pillText: { fontSize: 12, fontWeight: '600', color: theme.colors.primary },

  openBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: theme.radius.md,
    paddingVertical: 10,
    marginTop: 2,
  },
  openBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
});


// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
