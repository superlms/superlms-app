import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import moment from 'moment';
import VectorIcon from '../../components/VectorIcon';
import { theme, onThemeChange } from '../../utils/theme';
import type { HomeworkItem as AdminHomeworkItem } from '../../api/adminHomeworkApi';
import type { HomeworkItem as RowItem } from '../../api/homeworkApi';
import type { PickedFile } from '../../api/adminProfileApi';

/**
 * The pieces the admin app's Homework pages share. A homework is drawn as the
 * student's and teacher's lists draw one (screens/homework/homeworkUi), so the
 * school's homework is mapped onto that row's shape; the Status register marks
 * a homework green when the student ticked it done in the app and red when
 * they did not, as the panel's chips do.
 */

// Homework older than this is purged nightly, so the pages go no further back.
export const WINDOW_DAYS = 30;
// The register's recent window when no single day is picked (the panel's 14).
export const STATUS_DAYS = 14;

// ── Files ────────────────────────────────────────────────────────────────────
// What the panel accepts as an attachment, up to 1 MB.
const FILE_EXTS = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'jpg', 'jpeg', 'png'];
const ONE_MB = 1024 * 1024;

const extOf = (s?: string | null) => {
  const m = (s ?? '').split('?')[0].match(/\.([a-z0-9]{1,5})$/i);
  return m ? m[1].toLowerCase() : '';
};

/** What kind of file a homework carries, from its link. */
export const fileTypeOf = (url?: string | null): RowItem['file_type'] => {
  if (!url) return null;
  const ext = extOf(url);
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return 'image';
  if (ext === 'pdf') return 'pdf';
  return 'doc';
};

/** Why a picked attachment can't go, in the panel's words — or null when it can. */
export const fileProblem = (f: PickedFile, subject?: string) => {
  const ext = extOf(f.name);
  const isImage = (f.type || '').startsWith('image/');
  if (!isImage && ext && !FILE_EXTS.includes(ext)) {
    return 'Allowed: PDF, Word, Excel, PowerPoint, Text, Images.';
  }
  if (f.size && f.size > ONE_MB) {
    return subject
      ? `${subject}: attachment must be 1 MB (1024 KB) or smaller.`
      : 'Attachment must be 1 MB (1024 KB) or smaller.';
  }
  return null;
};

/** A picked or saved file's name, as a person reads it. */
export const fileNameOf = (f?: { name?: string | null; uri?: string | null } | null) => {
  const raw = f?.name || f?.uri?.split('?')[0].split('/').pop() || 'Attachment';
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
};

// ── Who set it ───────────────────────────────────────────────────────────────
/** The panel's "Set by": "Teacher · Ms. Patel", or "Admin". */
export const setByLabel = (h: AdminHomeworkItem) => {
  if (h.set_by_role === 'teacher') return h.set_by ? `Teacher · ${h.set_by}` : 'Teacher';
  if (h.set_by_role) return 'Admin';
  // An older server says only whose name it is.
  return h.teacher && h.teacher !== '—' ? h.teacher : '—';
};

/** "Ms. Patel" for a teacher's homework, "Admin" for the school's own. */
const setByShort = (h: AdminHomeworkItem) =>
  h.set_by_role === 'teacher' ? h.set_by || 'Teacher' : h.set_by_role ? 'Admin' : h.teacher && h.teacher !== '—' ? h.teacher : null;

/** The subject, or the panel's "All Subjects" for homework set for the whole class. */
export const subjectLabel = (h: AdminHomeworkItem) => (h.subject_id ? h.subject : 'All Subjects');

/** "Class 6 – A", or the class alone. */
export const classOf = (h: AdminHomeworkItem) => [h.standard, h.section].filter(Boolean).join(' – ');

/** The row's heading: "Mathematics · Ms. Patel". */
export const rowHeading = (h: AdminHomeworkItem) => [subjectLabel(h), setByShort(h)].filter(Boolean).join(' · ');

/** A school homework in the student row's shape. */
export const asRowItem = (h: AdminHomeworkItem): RowItem => ({
  id: h.id,
  title: h.title,
  description: h.description,
  subject: h.subject_id ? { id: h.subject_id, name: h.subject, code: null } : null,
  standard: h.standard,
  standard_id: h.standard_id,
  section: h.section,
  section_id: h.section_id,
  assigned_by: h.set_by || h.teacher,
  assigned_date: h.created_at ? moment(h.created_at).format('YYYY-MM-DD') : null,
  assigned_time: null,
  days_ago: null,
  file_url: h.file,
  file_type: fileTypeOf(h.file),
  period_start: null,
  period_end: null,
});

/** A day of ordinary homework, for the page drawn as a skeleton. */
export const SAMPLE_ROWS: AdminHomeworkItem[] = [
  ['Mathematics', 'Chapter 3 exercise', 'Solve questions 1 to 10 from the exercise, showing every step of your working.'],
  ['English', 'Reading comprehension', 'Read pages 42 to 48 and answer the questions at the end of the lesson.'],
  ['Science', 'The water cycle', 'Write a short note on the water cycle with a labelled diagram.'],
].map(([subject, title, description], i) => ({
  id: -1 - i,
  title,
  description,
  file: i === 0 ? 'file.jpg' : null,
  standard_id: 0,
  section_id: null,
  subject_id: i + 1,
  standard: '',
  section: null,
  subject,
  teacher: 'Class teacher',
  created_at: null,
  created_label: null,
  set_by: 'Class teacher',
  set_by_role: 'teacher',
}));

// ── Days ─────────────────────────────────────────────────────────────────────
/** "Today, 27 Sep", "Yesterday, 26 Sep", "Fri, 25 Sep 2026". */
export const shortDay = (key: string) => {
  const d = moment(key, 'YYYY-MM-DD');
  const diff = moment().startOf('day').diff(d, 'days');
  if (diff === 0) return `Today, ${d.format('D MMM')}`;
  if (diff === 1) return `Yesterday, ${d.format('D MMM')}`;
  return d.format('ddd, D MMM YYYY');
};

/** Today and the 30 days before it, newest first (YYYY-MM-DD). */
export const windowDays = () =>
  Array.from({ length: WINDOW_DAYS + 1 }, (_, i) => moment().startOf('day').subtract(i, 'days').format('YYYY-MM-DD'));

// ── Done or not ──────────────────────────────────────────────────────────────
// Present's green on Mark Attendance, and the app's red.
export const DONE_GREEN = '#16A34A';

/** A homework in the register: the tick or the cross, then what it is. */
export const StatusLine = ({ complete, text }: { complete: boolean; text: string }) => (
  <View style={s.line}>
    <VectorIcon
      iconSet="Ionicons"
      iconName={complete ? 'checkmark-circle' : 'close-circle'}
      size={16}
      color={complete ? DONE_GREEN : theme.colors.danger}
    />
    <Text style={s.lineText} numberOfLines={2}>
      {text}
    </Text>
  </View>
);

/** A homework as a small outlined chip, green or red. */
export const StatusChip = ({ complete, text }: { complete: boolean; text: string }) => (
  <View style={[s.chip, { borderColor: complete ? DONE_GREEN : theme.colors.danger }]}>
    <VectorIcon
      iconSet="Ionicons"
      iconName={complete ? 'checkmark' : 'close'}
      size={11}
      color={complete ? DONE_GREEN : theme.colors.danger}
    />
    <Text style={[s.chipText, { color: complete ? DONE_GREEN : theme.colors.danger }]} numberOfLines={1}>
      {text}
    </Text>
  </View>
);

/** The panel's legend: what green and red mean. */
export const StatusLegend = () => (
  <View style={s.legend}>
    <View style={s.legendItem}>
      <View style={[s.legendDot, { backgroundColor: DONE_GREEN }]} />
      <Text style={s.legendText}>Completed (marked in app)</Text>
    </View>
    <View style={s.legendItem}>
      <View style={[s.legendDot, { backgroundColor: theme.colors.danger }]} />
      <Text style={s.legendText}>Not completed</Text>
    </View>
  </View>
);

const __mk_s = () => StyleSheet.create({
  line: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingVertical: 3 },
  lineText: { flex: 1, fontSize: 13, lineHeight: 18, color: theme.colors.textPrimary },

  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    maxWidth: '100%',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: theme.radius.full,
    borderWidth: 1,
  },
  chipText: { fontSize: 11, fontWeight: '500', flexShrink: 1 },

  legend: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 16, rowGap: 4, marginTop: 6 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 12, color: theme.colors.textMuted },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
