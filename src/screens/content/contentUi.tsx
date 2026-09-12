import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import VectorIcon from '../../components/VectorIcon';
import { theme, onThemeChange } from '../../utils/theme';
import type { SyllabusChapter, SyllabusTopic } from '../../api/contentApi';

/** The pieces the study-content screens share. */

export const hasMaterial = (t: SyllabusTopic) =>
  !!(t.content?.trim() || t.imageUrl || t.pdfUrl || t.link?.trim());

// "3 with material", or "No material yet" — for the summary line.
export const materialSummary = (chapters: SyllabusChapter[]) => {
  const n = chapters.reduce((sum, c) => sum + c.topics.filter(hasMaterial).length, 0);
  return n > 0 ? `${n} with material` : 'No material yet';
};

// What a topic holds, as the icon for each kind: notes, image, link, PDF.
export const MaterialMarks = ({ topic }: { topic: SyllabusTopic }) => {
  const icons = [
    topic.content?.trim() ? 'reader-outline' : null,
    topic.imageUrl ? 'image-outline' : null,
    topic.link?.trim() ? 'link-outline' : null,
    topic.pdfUrl ? 'document-attach-outline' : null,
  ].filter(Boolean) as string[];

  return (
    <View style={s.marks}>
      {icons.map(icon => (
        <VectorIcon key={icon} iconSet="Ionicons" iconName={icon} size={14} color={theme.colors.textMuted} />
      ))}
    </View>
  );
};

// A link or a document that opens outside the app, as a plain row.
export const ResourceRow = ({
  icon,
  title,
  sub,
  onPress,
  isLast,
}: {
  icon: string;
  title: string;
  sub?: string;
  onPress: () => void;
  isLast?: boolean;
}) => (
  <TouchableOpacity style={[s.row, !isLast && s.rowDivider]} activeOpacity={0.6} onPress={onPress}>
    <VectorIcon iconSet="Ionicons" iconName={icon} size={20} color={theme.colors.textSecondary} />
    <View style={s.rowText}>
      <Text style={s.rowTitle}>{title}</Text>
      {!!sub && (
        <Text style={s.rowSub} numberOfLines={1}>
          {sub}
        </Text>
      )}
    </View>
    <VectorIcon iconSet="Ionicons" iconName="open-outline" size={16} color={theme.colors.textMuted} />
  </TouchableOpacity>
);

const __mk_s = () => StyleSheet.create({
  marks: { flexDirection: 'row', alignItems: 'center', gap: 6 },

  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 13 },
  rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },
  rowText: { flex: 1 },
  rowTitle: { fontSize: 15, fontWeight: '500', color: theme.colors.textPrimary },
  rowSub: { fontSize: 13, color: theme.colors.textMuted, marginTop: 2 },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
