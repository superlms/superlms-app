import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import moment from 'moment';
import VectorIcon from '../../components/VectorIcon';
import { HeaderIconButton } from '../../components/Header';
import AppRefreshControl from '../../components/AppRefreshControl';
import { AppAlert } from '../../components/AppDialog';
import { useFocusLoad } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { downloadFile } from '../../api/pdfDownload';
import { ExamPaper, deleteExamPaper, getExamPaperFile, getExamPapers } from '../../api/adminExamApi';
import { DocHeader, DocSection, DocBody, docStyles } from '../more/docUi';
import { DetailRow } from '../calendar/calendarUi';
import { confirmDestructive } from './adminFormUi';

/**
 * One question paper, as a student's View Announcement page draws a notice —
 * when it was uploaded, its title, its description with the PDF as a chip —
 * then what the panel's list shows of it: the exam, class, section and
 * subject. The chip downloads the PDF, as the panel's Download does; the
 * pencil opens it to edit and the bin deletes it with its PDF.
 *
 * Route params: paper – the paper from the list.
 */

const TITLE = 'Exam Paper';

const AdminExamPaperDetailScreen = ({ navigation, route }: any) => {
  const [paper, setPaper] = useState<ExamPaper | null>(route.params?.paper ?? null);
  const [refreshing, setRefreshing] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const id = paper?.id;

  // The list is the one source for a paper; coming back from Edit refreshes it.
  const load = useCallback(async () => {
    if (!id) return;
    try {
      const res = await getExamPapers();
      const found = res.papers.find(p => p.id === id);
      if (found) setPaper(found);
    } catch {
      // keep what was passed
    }
  }, [id]);

  useFocusLoad(load);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const download = async () => {
    if (!paper || downloading) return;
    setDownloading(true);
    try {
      const { url, file_name } = await getExamPaperFile(paper.id);
      await downloadFile(url, file_name);
      if (Platform.OS === 'android') AppAlert.alert('Downloaded', `${file_name} is saved in Downloads.`);
    } catch (e) {
      AppAlert.alert('Could not download', apiErr(e, 'Please check your connection and try again.'));
    } finally {
      setDownloading(false);
    }
  };

  const remove = () =>
    confirmDestructive('Delete exam paper?', 'The PDF will be permanently removed from storage.', 'Delete', async () => {
      setDeleting(true);
      try {
        await deleteExamPaper(paper!.id);
        navigation.goBack();
      } catch (e) {
        AppAlert.alert('Could not delete', apiErr(e, 'Please try again.'));
        setDeleting(false);
      }
    });

  if (!paper) {
    return (
      <View style={docStyles.root}>
        <DocHeader title={TITLE} onBackPress={() => navigation.goBack()} />
        <View style={s.center}>
          <Text style={s.muted}>Exam paper not found</Text>
        </View>
      </View>
    );
  }

  const uploaded = paper.created_at ? moment(paper.created_at).format('DD MMM YYYY, hh:mm A') : '';

  return (
    <View style={docStyles.root}>
      <DocHeader
        title={TITLE}
        onBackPress={() => navigation.goBack()}
        rightSlot={
          <View style={s.headActions}>
            <HeaderIconButton icon="create-outline" onPress={() => navigation.navigate('AdminExamPaperForm', { paper })} />
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
        contentContainerStyle={docStyles.scroll}
        refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* When it was uploaded, then the title */}
        <View>
          {!!uploaded && <Text style={s.dateText}>Uploaded {uploaded}</Text>}
          <Text style={s.title}>{paper.title}</Text>
        </View>

        {/* Its description, with the PDF right under it */}
        <DocSection title="Description">
          <DocBody>{paper.description || 'No description added.'}</DocBody>
          {paper.has_file && (
            <View style={s.chips}>
              <TouchableOpacity style={s.chip} activeOpacity={0.7} disabled={downloading} onPress={download}>
                <VectorIcon iconSet="Feather" iconName="file-text" size={14} color={theme.colors.primary} />
                <Text style={s.chipText}>PDF</Text>
                {downloading ? (
                  <ActivityIndicator size="small" color={theme.colors.textMuted} style={s.chipSpinner} />
                ) : (
                  <VectorIcon iconSet="Feather" iconName="download" size={12} color={theme.colors.textMuted} />
                )}
              </TouchableOpacity>
            </View>
          )}
        </DocSection>

        {/* What it is for */}
        <DocSection title="Paper For">
          <DetailRow label="Exam" value={paper.exam_name || '—'} />
          <DetailRow label="Academic Year" value={paper.academic_year} />
          <DetailRow label="Class" value={paper.standard_name || '—'} />
          <DetailRow label="Section" value={paper.section_name || 'All / None'} />
          <DetailRow label="Subject" value={paper.subject_name} last />
        </DocSection>
      </ScrollView>
    </View>
  );
};

export default AdminExamPaperDetailScreen;

const __mk_s = () => StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  muted: { fontSize: 14, color: theme.colors.textMuted },
  headActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  headBusy: { width: 36 },

  dateText: { fontSize: 12, color: theme.colors.textMuted, marginBottom: 6 },
  title: { fontSize: 20, fontWeight: '700', color: theme.colors.textPrimary, lineHeight: 27 },

  // The PDF chip, as on a notice
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
  chipText: { fontSize: 13, fontWeight: '500', color: theme.colors.textPrimary },
  chipSpinner: { width: 12, height: 12, transform: [{ scale: 0.6 }] },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
