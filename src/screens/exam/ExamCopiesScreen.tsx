import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import VectorIcon from '../../components/VectorIcon';
import { Skeleton, SkeletonIcon } from '../../components/Skeleton';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useFocusLoad } from '../../hooks/useRefresh';
import { useLastLoaded } from '../../hooks/useLastLoaded';
import { theme, onThemeChange } from '../../utils/theme';
import { DocHeader, DocNoData } from '../more/docUi';
import { SubjectRow } from '../subjects/subjectLists';
import { plural } from '../subjects/subjectsUi';
import {
  getStudentExamCopies,
  marksErrorMessage,
  type ExamCopySubject,
  type StudentExamCopies,
} from '../../api/marksApi';
import type { Exam } from './examData';
import { Words } from './examUi';

/**
 * Exam Copy, step two: one exam's copies, laid out as Performance lays out its
 * result — how many copies are in and what they were marked, then each subject
 * as the Subjects list draws it, with the marks and grade the teacher added,
 * "Absent", or that marks aren't in yet. A subject with a copy opens the sheet
 * itself (ExamCopyView).
 *
 * A load — the first, a pull to refresh, Try again — draws the page as a
 * skeleton from the copies it shows, those this exam had last time, those of
 * the last exam opened, or ordinary ones.
 */

// 45 → "45", 45.5 → "45.5"
const fmt = (n: number) => String(Number(n.toFixed(2)));

// "45 / 80 · Grade A", "Absent", or that the marks aren't in.
const subjectMeta = (sub: ExamCopySubject) => {
  if (!sub.marked) return 'Marks not added yet';
  if (sub.is_absent) return 'Absent';
  return [
    `${fmt(sub.marks_obtained ?? 0)} / ${fmt(sub.max_marks ?? 0)}`,
    sub.grade ? `Grade ${sub.grade}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
};

// ── Copies to draw before any have loaded here ───────────────────────────────
const sampleCopies = (exam: Exam): StudentExamCopies => {
  const total = exam.totalMarks > 0 ? exam.totalMarks : 100;
  const done = exam.status === 'Completed';
  const subjects = ['English', 'Hindi', 'Mathematics', 'Science', 'Social Science'].map(
    (name, i): ExamCopySubject => {
      const obtained = Math.round(total * (0.62 + i * 0.06));
      return {
        subject_id: -(i + 1),
        subject_name: name,
        subject_image: null,
        has_copy: done && i < 3,
        pdf_url: null,
        marked: done,
        is_absent: false,
        marks_obtained: done ? obtained : null,
        max_marks: done ? total : null,
        grade: done ? 'A' : null,
        remarks: null,
        uploaded_at: null,
      };
    },
  );
  return {
    exam: { id: Number(exam.id) || 0, name: exam.name, total_marks: total },
    subjects,
    copies: subjects.filter(x => x.has_copy).length,
  };
};

const isCopies = (v: StudentExamCopies | null | undefined): v is StudentExamCopies =>
  !!v && Array.isArray(v.subjects);

const ExamCopiesScreen = ({ navigation, route }: any) => {
  const exam: Exam = route.params.exam;
  const [copies, setCopies] = useState<StudentExamCopies | null>(null);
  // The skeleton shows on the first load, on a pull to refresh and on "Try
  // again"; coming back from a copy updates the page in place.
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastHere, rememberHere] = useLastLoaded<StudentExamCopies>(`exam-copies:${exam.id}`);
  const [lastAny, rememberAny] = useLastLoaded<StudentExamCopies>('exam-copies');

  const load = useCallback(
    async (showSkeleton = false) => {
      if (showSkeleton) setLoading(true);
      setError(null);
      try {
        const next = await getStudentExamCopies(exam.id);
        setCopies(next);
        rememberHere(next);
        rememberAny(next);
      } catch (e: any) {
        console.log('[getStudentExamCopies] Error:', e?.response?.status, e?.message);
        setError(marksErrorMessage(e));
      } finally {
        setLoading(false);
      }
    },
    [exam.id, rememberHere, rememberAny],
  );

  const reload = useCallback(() => load(true), [load]);

  useFocusLoad(() => load());

  // What the page is drawn from: while loading, what it last showed.
  const view: StudentExamCopies | null = loading
    ? copies ?? (isCopies(lastHere) ? lastHere : isCopies(lastAny) ? lastAny : sampleCopies(exam))
    : copies;

  const openCopy = (sub: ExamCopySubject) => {
    if (!sub.pdf_url) return;
    navigation.navigate('ExamCopyView', {
      title: sub.subject_name || 'Exam Copy',
      url: sub.pdf_url,
    });
  };

  // How many copies are in, what they were marked, and what to do with them.
  const renderTop = (r: StudentExamCopies, skeleton: boolean) => {
    const subjects = r.subjects;
    const scored = subjects.filter(x => x.marked && !x.is_absent);
    const absent = subjects.filter(x => x.marked && x.is_absent).length;
    const obtained = scored.reduce((a, x) => a + (x.marks_obtained ?? 0), 0);
    const max = scored.reduce((a, x) => a + (x.max_marks ?? 0), 0);

    if (r.copies === 0) {
      return (
        <View style={s.notice}>
          {skeleton ? (
            <SkeletonIcon iconName="time-outline" size={18} />
          ) : (
            <VectorIcon iconSet="Ionicons" iconName="time-outline" size={18} color={theme.colors.textMuted} />
          )}
          <View style={s.noticeBody}>
            <Words skeleton={skeleton} style={s.noticeText}>
              No checked copies for this exam yet. Your teachers put them up once the papers are marked.
            </Words>
          </View>
        </View>
      );
    }

    const pct = subjects.length > 0 ? Math.round((r.copies / subjects.length) * 100) : 0;
    const stats = [
      { label: 'Copies', value: String(r.copies) },
      { label: 'Subjects', value: String(subjects.length) },
      ...(max > 0 ? [{ label: 'Marks', value: `${fmt(obtained)}/${fmt(max)}` }] : []),
      ...(absent > 0 ? [{ label: 'Absent', value: String(absent) }] : []),
    ];

    return (
      <View>
        <View style={s.hero}>
          <View style={s.heroText}>
            <Words skeleton={skeleton} style={s.heroCaption}>
              Checked copies
            </Words>
            <Words skeleton={skeleton} style={s.bigCount}>
              {r.copies} of {subjects.length}
            </Words>
            <Words skeleton={skeleton} style={s.heroLabel}>
              Tap a subject to read its copy
            </Words>
          </View>
          {skeleton ? (
            <Skeleton width={68} height={68} radius={34} />
          ) : (
            <View style={s.badge}>
              <VectorIcon
                iconSet="Ionicons"
                iconName="document-text-outline"
                size={26}
                color={theme.colors.primary}
              />
            </View>
          )}
        </View>

        <View style={s.heroBar}>
          {skeleton ? (
            <Skeleton width="100%" height={5} radius={3} />
          ) : (
            <View style={s.barBg}>
              <View style={[s.barFill, { width: `${Math.max(0, Math.min(100, pct))}%` as any }]} />
            </View>
          )}
        </View>

        <View style={s.stats}>
          {stats.map((st, i) => (
            <View key={st.label} style={[s.stat, i > 0 && s.statDivider]}>
              <Words skeleton={skeleton} style={s.statValue}>
                {st.value}
              </Words>
              <Words skeleton={skeleton} style={s.statLabel}>
                {st.label}
              </Words>
            </View>
          ))}
        </View>
      </View>
    );
  };

  const renderPage = (r: StudentExamCopies, skeleton: boolean) => {
    const subjects = r.subjects;
    return (
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.scroll, subjects.length === 0 && s.grow]}
        // The skeleton stands in for the spinner.
        refreshControl={<AppRefreshControl refreshing={false} onRefresh={reload} />}
      >
        {renderTop(r, skeleton)}

        {subjects.length === 0 ? (
          <DocNoData
            icon="documents-outline"
            title="No subjects yet"
            subtitle="No subjects have been assigned to your class."
            skeleton={skeleton}
          />
        ) : (
          <>
            <Words skeleton={skeleton} style={s.count}>
              {plural(subjects.length, 'subject')}
            </Words>
            {subjects.map((sub, i) => (
              <SubjectRow
                key={sub.subject_id}
                image={sub.subject_image}
                title={sub.subject_name}
                meta={subjectMeta(sub)}
                isLast={i === subjects.length - 1}
                skeleton={skeleton}
                onPress={sub.has_copy && !!sub.pdf_url ? () => openCopy(sub) : undefined}
                trailing={
                  <Words skeleton={skeleton} style={[s.trailing, !sub.has_copy && s.trailingOff]}>
                    {sub.has_copy ? 'View' : 'Not uploaded'}
                  </Words>
                }
              />
            ))}
          </>
        )}
      </ScrollView>
    );
  };

  const renderBody = () => {
    if (loading && view) return renderPage(view, true);

    if (!copies) {
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

    return renderPage(copies, false);
  };

  return (
    <View style={s.root}>
      <DocHeader title={exam.name} onBackPress={() => navigation.goBack()} />
      {renderBody()}
    </View>
  );
};

export default ExamCopiesScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  scroll: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 },
  grow: { flexGrow: 1 },

  // How many copies are in
  hero: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  heroText: { flex: 1 },
  heroCaption: { fontSize: 12, fontWeight: '500', color: theme.colors.textMuted },
  bigCount: { fontSize: 36, fontWeight: '700', color: theme.colors.textPrimary, lineHeight: 44 },
  heroLabel: { fontSize: 14, color: theme.colors.textSecondary },
  badge: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroBar: { marginTop: 16 },
  barBg: { height: 5, borderRadius: 3, backgroundColor: theme.colors.border, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3, backgroundColor: theme.colors.primary },

  // Stats
  stats: {
    flexDirection: 'row',
    marginTop: 18,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
  },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  statDivider: { borderLeftWidth: 1, borderLeftColor: theme.colors.border },
  statValue: { fontSize: 16, fontWeight: '600', color: theme.colors.textPrimary },
  statLabel: { fontSize: 12, color: theme.colors.textMuted },

  // Nothing uploaded yet
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.background,
  },
  noticeBody: { flex: 1 },
  noticeText: { fontSize: 13, color: theme.colors.textSecondary, lineHeight: 19 },

  // Subjects
  count: { fontSize: 12, color: theme.colors.textMuted, marginTop: 24, marginBottom: 2 },
  trailing: { fontSize: 13, fontWeight: '600', color: theme.colors.primary },
  trailingOff: { fontWeight: '400', color: theme.colors.textMuted },

  // Error
  centeredBox: { alignItems: 'center', paddingTop: 72, paddingHorizontal: 24, gap: 10 },
  errorText: { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  linkText: { fontSize: 14, fontWeight: '600', color: theme.colors.primary },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
