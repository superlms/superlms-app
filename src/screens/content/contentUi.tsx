import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import VectorIcon from '../../components/VectorIcon';
import { SkeletonIcon } from '../../components/Skeleton';
import { theme, onThemeChange } from '../../utils/theme';
import type { SyllabusChapter, SyllabusTopic } from '../../api/contentApi';
import type { KeptSubject } from '../subjects/subjectLists';

/** The pieces the study-content screens share. */

export const hasMaterial = (t: SyllabusTopic) =>
  !!(t.content?.trim() || t.imageUrl || t.pdfUrl || t.link?.trim());

// "3 with material", or "No material yet" — for the summary line.
export const materialSummary = (chapters: SyllabusChapter[]) => {
  const n = chapters.reduce((sum, c) => sum + c.topics.filter(hasMaterial).length, 0);
  return n > 0 ? `${n} with material` : 'No material yet';
};

// What a topic holds, as the icon for each kind: notes, image, link, PDF —
// grey boxes the size of those icons in a skeleton.
export const MaterialMarks = ({ topic, skeleton }: { topic: SyllabusTopic; skeleton?: boolean }) => {
  const icons = [
    topic.content?.trim() ? 'reader-outline' : null,
    topic.imageUrl ? 'image-outline' : null,
    topic.link?.trim() ? 'link-outline' : null,
    topic.pdfUrl ? 'document-attach-outline' : null,
  ].filter(Boolean) as string[];

  return (
    <View style={s.marks}>
      {icons.map(icon =>
        skeleton ? (
          <SkeletonIcon key={icon} iconName={icon} size={14} />
        ) : (
          <VectorIcon key={icon} iconSet="Ionicons" iconName={icon} size={14} color={theme.colors.textMuted} />
        ),
      )}
    </View>
  );
};

// ── What the screens draw while loading before their first load ─────────────
// Ordinary subjects, as the Study Content lists write them.
export const SAMPLE_STUDENT_SUBJECTS: KeptSubject[] = [
  { key: 's1', title: 'Mathematics', meta: '6 of 18 topics with material' },
  { key: 's2', title: 'Science', meta: '4 of 15 topics with material' },
  { key: 's3', title: 'English', meta: '3 of 12 topics with material' },
  { key: 's4', title: 'Hindi', meta: 'No material yet' },
  { key: 's5', title: 'Social Science', meta: '2 of 14 topics with material' },
];

export const SAMPLE_TEACHER_SUBJECTS: KeptSubject[] = [
  { key: 't1', title: 'Mathematics', meta: '10 A' },
  { key: 't2', title: 'Mathematics', meta: '9 B' },
  { key: 't3', title: 'Science', meta: '8 A' },
  { key: 't4', title: 'Science', meta: '8 B' },
];

// An ordinary subject's chapters, each with a few topics, some with material.
const sampleTopic = (id: number, name: string, material: boolean) => ({
  id,
  name,
  order: id,
  content: material ? '·' : null,
  imageUrl: null,
  pdfUrl: material && id % 2 === 0 ? '·' : null,
  link: null,
});

export const SAMPLE_CHAPTERS: SyllabusChapter[] = [
  ['Introduction', ['Overview', 'Key terms', 'Examples']],
  ['Basic Concepts', ['Definitions', 'Properties', 'Practice questions']],
  ['Applications', ['Everyday uses', 'Worked problems']],
  ['Revision', ['Summary', 'Important questions']],
].map(([name, topics], i) => ({
  id: -(i + 1),
  name: name as string,
  description: null,
  order: i + 1,
  topics: (topics as string[]).map((t, j) => sampleTopic(-(i * 10 + j + 1), t, j === 0)),
}));

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
