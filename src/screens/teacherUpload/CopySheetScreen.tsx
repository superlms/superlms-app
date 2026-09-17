import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import moment from 'moment';
import VectorIcon from '../../components/VectorIcon';
import { Skeleton } from '../../components/Skeleton';
import AppRefreshControl from '../../components/AppRefreshControl';
import { AppAlert } from '../../components/AppDialog';
import { useFocusLoad } from '../../hooks/useRefresh';
import { useLastLoaded } from '../../hooks/useLastLoaded';
import { pickPdf } from '../../utils/filePickers';
import { theme, onThemeChange } from '../../utils/theme';
import { DocHeader, DocNoData } from '../more/docUi';
import {
  getCopySheet,
  marksErrorMessage,
  removeCopyPdf,
  uploadCopyPdf,
  MAX_COPY_BYTES,
  MAX_COPY_LABEL,
  type CopyClass,
  type CopySheet,
  type CopyStudent,
} from '../../api/marksApi';
import type { Exam } from '../exam/examData';
import { Words } from '../exam/examUi';
import { marksClassLabel } from './MarksClassesScreen';

/**
 * Upload Copy, step three: one class's students for one exam and subject,
 * laid out as the marks sheet is — roll number, name and what the student was
 * marked, with their copy at the end.
 *
 * A student without a copy gets Upload, which picks a PDF and sends it on its
 * own; one with a copy opens View, Replace or Remove. As in the admin panel a
 * copy only goes up where the subject's marks are saved, a copy is one PDF of
 * up to 5 MB, a new PDF replaces the one there, and removing a copy leaves the
 * marks as they are.
 *
 * A load — the first, a pull to refresh, Try again — draws the page as a
 * skeleton from the sheet it shows: the one on screen, the one this class had
 * last time, or, before that, one as long as the class with as many marks and
 * copies as the class list said.
 */

// 45 → "45", 45.5 → "45.5"
const fmt = (n: number) => String(Number(n.toFixed(2)));

// What the student was marked, beside their name.
const studentMeta = (st: CopyStudent, total: number | null) => {
  if (!st.marked) return 'Marks not added';
  if (st.is_absent) return 'Absent';
  const max = st.max_marks ?? total;
  return [
    `${fmt(st.marks_obtained ?? 0)}${max != null ? ` / ${fmt(max)}` : ''}`,
    st.grade ? `Grade ${st.grade}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
};

// ── A sheet to draw before the class has ever loaded here ────────────────────
const SAMPLE_NAMES = [
  'Aarav Sharma',
  'Ananya Verma',
  'Arjun Singh',
  'Diya Patel',
  'Ishaan Gupta',
  'Kavya Reddy',
  'Krishna Yadav',
  'Meera Joshi',
  'Mohit Kumar',
  'Neha Mishra',
  'Pranav Nair',
  'Riya Chauhan',
  'Rohan Mehta',
  'Saanvi Iyer',
  'Shreya Pandey',
  'Vihaan Rao',
];

const sampleSheet = (exam: Exam, cls: CopyClass): CopySheet => {
  const total = exam.totalMarks > 0 ? exam.totalMarks : 100;
  return {
    exam: { id: Number(exam.id), name: exam.name, total_marks: total },
    has_marks: cls.has_marks,
    max_kb: Math.round(MAX_COPY_BYTES / 1024),
    students: Array.from({ length: cls.students }, (_, i): CopyStudent => {
      const marked = i < cls.marked;
      return {
        student_detail_id: -(i + 1),
        name: SAMPLE_NAMES[i % SAMPLE_NAMES.length],
        roll_no: String(i + 1),
        admission_no: `ADM${1001 + i}`,
        marked,
        is_absent: false,
        marks_obtained: marked ? Math.round(total * (0.45 + ((i * 37) % 50) / 100)) : null,
        max_marks: marked ? total : null,
        grade: marked ? 'A' : null,
        has_copy: i < cls.uploaded,
        pdf_url: null,
        remarks: null,
        uploaded_at: null,
      };
    }),
  };
};

const isSheet = (v: CopySheet | null | undefined): v is CopySheet => !!v && Array.isArray(v.students);

const CopySheetScreen = ({ navigation, route }: any) => {
  const { exam, cls } = route.params as { exam: Exam; cls: CopyClass };
  const key = useMemo(
    () => ({
      exam_id: Number(exam.id),
      standard_id: cls.standard_id,
      section_id: cls.section_id,
      subject_id: cls.subject_id,
    }),
    [exam.id, cls.standard_id, cls.section_id, cls.subject_id],
  );

  const [sheet, setSheet] = useState<CopySheet | null>(null);
  // The skeleton shows on the first load, on a pull to refresh and on "Try
  // again"; a copy going up or coming down updates the list in place.
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // The student whose copy is going up or coming down.
  const [busy, setBusy] = useState<number | null>(null);
  const [last, rememberLast] = useLastLoaded<CopySheet>(
    `copy-sheet:${key.exam_id}:${key.standard_id}:${key.section_id}:${key.subject_id}`,
  );

  const keep = useCallback(
    (next: CopySheet) => {
      setSheet(next);
      // The links in a kept sheet go stale; the copies themselves are what it draws.
      rememberLast({ ...next, students: next.students.map(st => ({ ...st, pdf_url: null })) });
    },
    [rememberLast],
  );

  const load = useCallback(
    async (showSkeleton = false) => {
      if (showSkeleton) setLoading(true);
      setError(null);
      try {
        keep(await getCopySheet(key));
      } catch (e: any) {
        console.log('[getCopySheet] Error:', e?.response?.status, e?.message);
        setError(marksErrorMessage(e));
      } finally {
        setLoading(false);
      }
    },
    [key, keep],
  );

  const reload = useCallback(() => load(true), [load]);

  // The sheet reloads when the marks sheet, or a copy, comes back to it.
  useFocusLoad(() => load());

  // The sheet the page is drawn from: while loading, what it last showed.
  const view: CopySheet | null = loading
    ? sheet ?? (isSheet(last) ? last : null) ?? sampleSheet(exam, cls)
    : sheet;

  const students = view?.students ?? [];
  const total = view?.exam.total_marks ?? (exam.totalMarks || null);
  const uploaded = students.filter(st => st.has_copy).length;
  const marked = students.filter(st => st.marked).length;

  // ── Putting a copy up, and taking it down ──────────────────────────────────
  const upload = async (st: CopyStudent) => {
    const file = await pickPdf();
    if (!file) return;
    if (file.size != null && file.size > MAX_COPY_BYTES) {
      AppAlert.alert('Copy too large', `A copy must be ${MAX_COPY_LABEL} or smaller.`);
      return;
    }
    setBusy(st.student_detail_id);
    try {
      keep(
        await uploadCopyPdf(key, st.student_detail_id, {
          uri: file.uri,
          name: file.name ?? 'copy.pdf',
          type: file.type ?? 'application/pdf',
        }),
      );
    } catch (e: any) {
      console.log('[uploadCopyPdf] Error:', e?.response?.status, e?.message);
      AppAlert.alert('Couldn’t upload the copy', marksErrorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const remove = async (st: CopyStudent) => {
    setBusy(st.student_detail_id);
    try {
      keep(await removeCopyPdf(key, st.student_detail_id));
    } catch (e: any) {
      console.log('[removeCopyPdf] Error:', e?.response?.status, e?.message);
      AppAlert.alert('Couldn’t remove the copy', marksErrorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const confirmRemove = (st: CopyStudent) =>
    AppAlert.alert('Remove this copy?', `${st.name}’s copy comes down. Their marks stay as they are.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => remove(st) },
    ]);

  const openCopy = (st: CopyStudent) => {
    if (!st.pdf_url) {
      AppAlert.alert('Copy unavailable', 'This copy could not be opened. Pull down to refresh and try again.');
      return;
    }
    navigation.navigate('ExamCopyView', { title: st.name, url: st.pdf_url });
  };

  const openCopyMenu = (st: CopyStudent) =>
    AppAlert.alert(
      st.name,
      st.uploaded_at ? `Copy uploaded ${moment(st.uploaded_at).format('D MMM YYYY')}.` : 'This copy is up.',
      [
        { text: 'View copy', onPress: () => openCopy(st) },
        { text: 'Replace', onPress: () => upload(st) },
        { text: 'Remove', style: 'destructive', onPress: () => confirmRemove(st) },
        { text: 'Cancel', style: 'cancel' },
      ],
    );

  // The marks sheet for this very class, so the marks can go in first.
  const openMarks = () =>
    navigation.navigate('MarksSheet', {
      exam,
      cls: { ...cls, saved: cls.marked, absent: 0 },
    });

  // ── The page ───────────────────────────────────────────────────────────────
  // Exam, class and subject, then the totals.
  const renderIntro = (v: CopySheet, skeleton: boolean) => (
    <View style={s.intro}>
      <Words skeleton={skeleton} style={s.introTitle} numberOfLines={1}>
        {cls.subject_name} · {marksClassLabel(cls)}
      </Words>
      <Words skeleton={skeleton} style={s.meta} numberOfLines={1}>
        {v.exam.name}
      </Words>
      <View style={s.totals}>
        <Words skeleton={skeleton} style={s.total}>
          Copies{' '}
          <Text style={[s.totalNum, uploaded > 0 && s.accent]}>
            {uploaded} of {students.length}
          </Text>
        </Words>
        <Words skeleton={skeleton} style={s.total}>
          Marks added <Text style={s.totalNum}>{marked}</Text>
        </Words>
      </View>

      {v.has_marks ? (
        <Words skeleton={skeleton} style={s.hint}>
          Each copy is one PDF of {MAX_COPY_LABEL} or less; a new one replaces the copy there.
        </Words>
      ) : (
        <View style={s.notice}>
          <Words skeleton={skeleton} style={s.noticeText}>
            Copies go up against the marks. Add this subject’s marks for the exam first.
          </Words>
          {skeleton ? (
            <Skeleton width={80} height={14} />
          ) : (
            <TouchableOpacity onPress={openMarks} hitSlop={10}>
              <Text style={s.linkText}>Add marks</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );

  const renderColumns = (skeleton: boolean) => (
    <View style={s.columns}>
      <View style={s.roll}>
        <Words skeleton={skeleton} style={s.column}>
          Roll
        </Words>
      </View>
      <View style={s.body}>
        <Words skeleton={skeleton} style={s.column}>
          Student
        </Words>
      </View>
      <View style={s.action}>
        <Words skeleton={skeleton} style={s.column}>
          Copy
        </Words>
      </View>
    </View>
  );

  const renderAction = (st: CopyStudent, hasMarks: boolean, skeleton: boolean) => {
    if (skeleton) return <Skeleton width={84} height={30} radius={theme.radius.full} />;

    if (busy === st.student_detail_id) {
      return <ActivityIndicator size="small" color={theme.colors.primary} />;
    }

    if (!hasMarks) {
      return <Text style={s.waiting}>—</Text>;
    }

    if (st.has_copy) {
      return (
        <TouchableOpacity
          style={[s.pill, s.pillUp]}
          activeOpacity={0.8}
          disabled={busy !== null}
          onPress={() => openCopyMenu(st)}
        >
          <VectorIcon iconSet="Ionicons" iconName="document-text" size={13} color={theme.colors.primary} />
          <Text style={s.pillUpText}>Copy</Text>
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity
        style={s.pill}
        activeOpacity={0.8}
        disabled={busy !== null}
        onPress={() => upload(st)}
      >
        <VectorIcon
          iconSet="Ionicons"
          iconName="cloud-upload-outline"
          size={13}
          color={theme.colors.textSecondary}
        />
        <Text style={s.pillText}>Upload</Text>
      </TouchableOpacity>
    );
  };

  const renderRow = (st: CopyStudent, i: number, v: CopySheet, skeleton: boolean) => (
    <View key={st.student_detail_id} style={[s.row, i < students.length - 1 && s.rowDivider]}>
      <View style={s.roll}>
        <Words skeleton={skeleton} style={s.rollText} numberOfLines={1}>
          {st.roll_no || '—'}
        </Words>
      </View>
      <View style={s.body}>
        <Words skeleton={skeleton} style={s.name} numberOfLines={1}>
          {st.name}
        </Words>
        <Words skeleton={skeleton} style={s.meta} numberOfLines={1}>
          {studentMeta(st, total)}
        </Words>
      </View>
      <View style={s.action}>{renderAction(st, v.has_marks, skeleton)}</View>
    </View>
  );

  const renderPage = (v: CopySheet, skeleton: boolean) => {
    if (students.length === 0) {
      return (
        <ScrollView
          contentContainerStyle={s.fillGrow}
          refreshControl={<AppRefreshControl refreshing={false} onRefresh={reload} />}
        >
          <DocNoData
            icon="people-outline"
            title="No students"
            subtitle="There are no students in this class yet."
            skeleton={skeleton}
          />
        </ScrollView>
      );
    }

    return (
      <ScrollView
        contentContainerStyle={s.list}
        showsVerticalScrollIndicator={false}
        // The skeleton stands in for the spinner.
        refreshControl={<AppRefreshControl refreshing={false} onRefresh={reload} />}
      >
        {renderIntro(v, skeleton)}
        {renderColumns(skeleton)}
        {students.map((st, i) => renderRow(st, i, v, skeleton))}
      </ScrollView>
    );
  };

  const renderBody = () => {
    if (loading && view) return renderPage(view, true);

    if (!sheet) {
      return (
        <View style={s.centeredBox}>
          <VectorIcon iconSet="Ionicons" iconName="cloud-offline-outline" size={32} color={theme.colors.textMuted} />
          <Text style={s.errorText}>{error ?? 'Something went wrong. Please try again.'}</Text>
          <TouchableOpacity onPress={reload} hitSlop={10}>
            <Text style={s.linkText}>Try again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return renderPage(sheet, false);
  };

  return (
    <View style={s.root}>
      <DocHeader title="Upload Copy" onBackPress={() => navigation.goBack()} />
      <View style={s.fill}>{renderBody()}</View>
    </View>
  );
};

export default CopySheetScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  fill: { flex: 1 },
  fillGrow: { flexGrow: 1 },
  list: { paddingHorizontal: 20, paddingBottom: 40 },

  // Exam, class, totals
  intro: { paddingTop: 16, paddingBottom: 14, gap: 3 },
  introTitle: { fontSize: 15, fontWeight: '500', color: theme.colors.textPrimary },
  totals: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 6 },
  total: { fontSize: 13, color: theme.colors.textSecondary },
  totalNum: { fontWeight: '600', color: theme.colors.textPrimary },
  accent: { color: theme.colors.primary },
  hint: { fontSize: 12, color: theme.colors.textMuted, marginTop: 6, lineHeight: 18 },

  // Marks first
  notice: {
    gap: 6,
    marginTop: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.background,
  },
  noticeText: { fontSize: 13, color: theme.colors.textSecondary, lineHeight: 19 },

  // Column headings
  columns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: theme.colors.border,
  },
  column: { fontSize: 12, fontWeight: '500', color: theme.colors.textMuted },

  // Row
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  roll: { width: 32 },
  rollText: { fontSize: 13, color: theme.colors.textMuted },
  body: { flex: 1, gap: 3 },
  name: { fontSize: 15, fontWeight: '500', color: theme.colors.textPrimary },
  meta: { fontSize: 13, color: theme.colors.textSecondary },

  // The copy itself
  action: { width: 96, alignItems: 'flex-end' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 30,
    paddingHorizontal: 12,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  pillText: { fontSize: 12, fontWeight: '500', color: theme.colors.textSecondary },
  pillUp: { borderColor: theme.colors.primary, backgroundColor: theme.colors.primaryLight },
  pillUpText: { fontSize: 12, fontWeight: '600', color: theme.colors.primary },
  waiting: { fontSize: 13, color: theme.colors.textMuted },

  // Error
  centeredBox: { alignItems: 'center', paddingTop: 72, paddingHorizontal: 24, gap: 10 },
  errorText: { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  linkText: { fontSize: 14, fontWeight: '600', color: theme.colors.primary },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
