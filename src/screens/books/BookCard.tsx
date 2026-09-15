import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import VectorIcon from '../../components/VectorIcon';
import { theme, onThemeChange } from '../../utils/theme';
import { SubjectIcon } from '../subjects/subjectIcon';
import type { ApiBook } from '../../api/booksApi';

interface Props {
  item: ApiBook;
  showClass?: boolean; // teacher rows include class · section
  isLast?: boolean;
  onViewPress: (book: ApiBook) => void;
}

/**
 * One book as a plain row: its subject's icon in front, as on Subjects, then the
 * title, and under it the subject's name exactly as the school saved it — and
 * for a teacher the class it is for — with an arrow. Every row opens: the
 * book's PDF, or a line saying none has been added yet.
 */
const BookCard = ({ item, showClass, isLast, onViewPress }: Props) => {
  const classLine = item.standard?.name
    ? `${item.standard.name}${item.section?.name ? ' · ' + item.section.name : ''}`
    : null;

  const meta = [item.subject?.name || null, showClass ? classLine : null].filter(Boolean).join(' · ');

  return (
    <TouchableOpacity
      style={[s.row, !isLast && s.rowDivider]}
      onPress={() => onViewPress(item)}
      activeOpacity={0.6}
    >
      <SubjectIcon image={item.subject?.image} size={30} />

      <View style={s.body}>
        <Text style={s.title} numberOfLines={2}>
          {item.title}
        </Text>
        {!!meta && (
          <Text style={s.meta} numberOfLines={1}>
            {meta}
          </Text>
        )}
      </View>

      <VectorIcon iconSet="Ionicons" iconName="chevron-forward" size={13} color={theme.colors.textMuted} />
    </TouchableOpacity>
  );
};

export default BookCard;

const __mk_s = () => StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 13 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  body: { flex: 1, gap: 3 },
  title: { fontSize: 15, fontWeight: '500', color: theme.colors.textPrimary, lineHeight: 20 },
  meta: { fontSize: 13, color: theme.colors.textSecondary },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
