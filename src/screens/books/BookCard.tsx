import React, { useState } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import VectorIcon from '../../components/VectorIcon';
import { theme, onThemeChange } from '../../utils/theme';
import { resolveFileUrl, subjectLabel } from './bookData';
import type { ApiBook } from '../../api/booksApi';

interface Props {
  item: ApiBook;
  showClass?: boolean; // teacher rows include class · section
  isLast?: boolean;
  onViewPress: (book: ApiBook) => void;
}

/**
 * One book as a plain row: its cover, the title, and the line that places it —
 * subject, and for a teacher the class it is for.
 *
 * With no cover, the slot holds the subject's own icon, and failing that a book
 * glyph, on the page's quiet grey — so the column stays even whatever the shelf
 * holds. A book with no PDF has nothing to open: it says so, and does not
 * pretend to be tappable.
 */
const BookCard = ({ item, showClass, isLast, onViewPress }: Props) => {
  const [coverFailed, setCoverFailed] = useState(false);
  const [iconFailed, setIconFailed] = useState(false);

  const hasPdf = !!item.pdf_url;
  const cover = resolveFileUrl(item.cover_url ?? item.logo_url);
  const icon = resolveFileUrl(item.subject?.image);

  const classLine = item.standard?.name
    ? `${item.standard.name}${item.section?.name ? ' · ' + item.section.name : ''}`
    : null;

  const meta = [
    subjectLabel(item.subject?.name) || null,
    showClass ? classLine : null,
    hasPdf ? null : 'No PDF yet',
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <TouchableOpacity
      style={[s.row, !isLast && s.rowDivider]}
      onPress={() => onViewPress(item)}
      activeOpacity={0.6}
      disabled={!hasPdf}
    >
      {cover && !coverFailed ? (
        <Image
          source={{ uri: cover }}
          style={s.cover}
          resizeMode="cover"
          onError={() => setCoverFailed(true)}
        />
      ) : (
        <View style={[s.cover, s.coverFallback]}>
          {icon && !iconFailed ? (
            <Image
              source={{ uri: icon }}
              style={s.subjectIcon}
              resizeMode="contain"
              onError={() => setIconFailed(true)}
            />
          ) : (
            <VectorIcon iconSet="Ionicons" iconName="book-outline" size={18} color={theme.colors.textMuted} />
          )}
        </View>
      )}

      <View style={s.body}>
        <Text style={[s.title, !hasPdf && s.titleIdle]} numberOfLines={2}>
          {item.title}
        </Text>
        {!!meta && (
          <Text style={s.meta} numberOfLines={1}>
            {meta}
          </Text>
        )}
      </View>

      {hasPdf && (
        <VectorIcon iconSet="Ionicons" iconName="chevron-forward" size={16} color={theme.colors.textMuted} />
      )}
    </TouchableOpacity>
  );
};

export default BookCard;

const __mk_s = () => StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 13 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  cover: {
    width: 38,
    height: 50,
    borderRadius: 4,
    backgroundColor: theme.colors.background,
  },
  coverFallback: { alignItems: 'center', justifyContent: 'center' },
  subjectIcon: { width: 24, height: 24 },
  body: { flex: 1, gap: 3 },
  title: { fontSize: 15, fontWeight: '500', color: theme.colors.textPrimary, lineHeight: 20 },
  titleIdle: { color: theme.colors.textSecondary },
  meta: { fontSize: 13, color: theme.colors.textSecondary },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
