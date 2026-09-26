import React, { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { HeaderIconButton } from '../../components/Header';
import AppRefreshControl from '../../components/AppRefreshControl';
import { AppAlert } from '../../components/AppDialog';
import { useFocusLoad } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { AdminExam, ExamOptions, deleteExam, getExam, toggleExamPublish } from '../../api/adminExamApi';
import { DocHeader } from '../more/docUi';
import { confirmDestructive } from './adminFormUi';
import { STATUS_LABEL, examRange, examWhen, longDay, stamp, statusOf, typeLabel } from './adminExamUi';

/**
 * One exam, as the student's Exam Detail draws it — its type, name, dates and
 * where it stands, then its details on hairlines and what it is about — with
 * what the panel's view adds: its marks or grading, status, who created it and
 * when it last changed. The switch publishes or withdraws it, as the panel's
 * status badge does; the pencil opens it to edit, and the bin deletes it with
 * its syllabus.
 *
 * Route params: exam – the exam from the list; options – the form's choices.
 */

const TITLE = 'Exam Detail';

const InfoRow = ({ label, value, last }: { label: string; value: string; last?: boolean }) => (
  <View style={[s.infoRow, !last && s.rowDivider]}>
    <Text style={s.infoLabel}>{label}</Text>
    <Text style={s.infoValue}>{value}</Text>
  </View>
);

const AdminExamDetailScreen = ({ navigation, route }: any) => {
  const passed: AdminExam | undefined = route.params?.exam;
  const options: ExamOptions | undefined = route.params?.options;
  const id: number | undefined = passed?.id ?? route.params?.examId;

  const [exam, setExam] = useState<AdminExam | null>(passed ?? null);
  const [refreshing, setRefreshing] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setExam(await getExam(id));
    } catch {
      // What the list passed stays on screen.
    }
  }, [id]);

  // Coming back from Edit shows the exam as saved.
  useFocusLoad(load);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const togglePublish = async () => {
    if (!exam) return;
    setToggling(true);
    try {
      const res = await toggleExamPublish(exam.id);
      setExam({ ...exam, is_published: res.is_published });
      // Its status follows from publishing and the dates.
      await load();
    } catch (e) {
      AppAlert.alert('Could not update', apiErr(e, 'Please try again.'));
    } finally {
      setToggling(false);
    }
  };

  const remove = () =>
    confirmDestructive(
      'Delete exam?',
      'This will permanently delete the exam and remove all its syllabus mappings.',
      'Delete',
      async () => {
        setDeleting(true);
        try {
          await deleteExam(exam!.id);
          navigation.goBack();
        } catch (e) {
          AppAlert.alert('Could not delete', apiErr(e, 'Please try again.'));
          setDeleting(false);
        }
      },
    );

  if (!exam) {
    return (
      <View style={s.root}>
        <DocHeader title={TITLE} onBackPress={() => navigation.goBack()} />
        <View style={s.center}>
          <Text style={s.muted}>Exam not found.</Text>
        </View>
      </View>
    );
  }

  const st = statusOf(exam);
  const live = st === 'active';
  const standing = [STATUS_LABEL[st], examWhen(exam)].filter(Boolean).join(' · ');
  const grading = exam.uses_grading_system;

  const rows = [
    ['Academic Year', exam.academic_year],
    ['Term', exam.term ?? ''],
    ['Exam Type', typeLabel(exam)],
    ['Starts', longDay(exam.start_date) || 'Not set'],
    ['Ends', longDay(exam.end_date) || 'Not set'],
    ['Total Marks', grading ? 'N/A (Grading)' : exam.total_marks != null ? String(Number(exam.total_marks)) : ''],
    ['Passing Marks', grading ? 'N/A (Grading)' : exam.passing_marks != null ? String(Number(exam.passing_marks)) : ''],
    ['Status', STATUS_LABEL[st]],
    ['Created By', exam.created_by ?? ''],
    ['Created', stamp(exam.created_at)],
    ['Last Updated', stamp(exam.updated_at)],
  ].filter(([, v]) => !!v) as [string, string][];

  return (
    <View style={s.root}>
      <DocHeader
        title={TITLE}
        onBackPress={() => navigation.goBack()}
        rightSlot={
          <View style={s.headActions}>
            <HeaderIconButton icon="create-outline" onPress={() => navigation.navigate('AdminExamForm', { exam, options })} />
            {deleting ? (
              <ActivityIndicator style={s.headBusy} color={theme.colors.primary} />
            ) : (
              <HeaderIconButton icon="trash-outline" onPress={remove} />
            )}
          </View>
        }
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
        refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* What it is, when, and where it stands */}
        <View style={s.head}>
          <Text style={s.kicker}>{typeLabel(exam).toUpperCase()}</Text>
          <Text style={s.title}>{exam.exam_name}</Text>
          <Text style={s.range}>{examRange(exam)}</Text>
          <Text style={[s.standing, live && s.standingLive]}>{standing}</Text>
        </View>

        {/* Published — as the panel's status badge, a tap publishes or withdraws it */}
        <View style={s.divider} />
        <View style={s.publishRow}>
          <View style={s.publishText}>
            <Text style={s.publishLabel}>Published</Text>
            <Text style={s.publishSub}>
              {exam.is_published ? 'Turn off to take it back to a draft.' : 'It is a draft until it is published.'}
            </Text>
          </View>
          {toggling ? (
            <ActivityIndicator color={theme.colors.primary} />
          ) : (
            <Switch
              value={exam.is_published}
              onValueChange={togglePublish}
              trackColor={{ true: theme.colors.primary, false: theme.colors.border }}
              thumbColor={theme.colors.white}
            />
          )}
        </View>

        <View style={s.divider} />
        <View style={s.body}>
          {rows.map(([label, value], i) => (
            <InfoRow key={label} label={label} value={value} last={i === rows.length - 1} />
          ))}
        </View>

        {!!exam.description && (
          <>
            <View style={s.divider} />
            <View style={s.section}>
              <Text style={s.sectionTitle}>About</Text>
              <Text style={s.paragraph}>{exam.description}</Text>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
};

export default AdminExamDetailScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  scroll: { paddingBottom: 40 },
  headActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  headBusy: { width: 36 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  muted: { fontSize: 14, color: theme.colors.textMuted },

  // Head
  head: { paddingHorizontal: 20, paddingTop: 22, paddingBottom: 20 },
  kicker: { fontSize: 11, fontWeight: '600', letterSpacing: 0.8, color: theme.colors.textMuted },
  title: { fontSize: 22, fontWeight: '700', color: theme.colors.textPrimary, lineHeight: 29, marginTop: 6 },
  range: { fontSize: 14, color: theme.colors.textSecondary, marginTop: 4 },
  standing: { fontSize: 13, fontWeight: '500', color: theme.colors.textSecondary, marginTop: 10 },
  standingLive: { color: theme.colors.primary },

  // Full-width lines between the blocks
  divider: { height: 1, backgroundColor: theme.colors.divider },

  // Published
  publishRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 14 },
  publishText: { flex: 1 },
  publishLabel: { fontSize: 15, fontWeight: '500', color: theme.colors.textPrimary },
  publishSub: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },

  // Label / value rows
  body: { paddingHorizontal: 20, paddingTop: 2 },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 14 },
  rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },
  infoLabel: { width: '40%', paddingRight: 12, fontSize: 14, color: theme.colors.textSecondary },
  infoValue: { flex: 1, fontSize: 14, fontWeight: '500', color: theme.colors.textPrimary },

  // About
  section: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8 },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: theme.colors.textSecondary, marginBottom: 4 },
  paragraph: { fontSize: 14, lineHeight: 22, color: theme.colors.textPrimary, marginTop: 6, marginBottom: 10 },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
