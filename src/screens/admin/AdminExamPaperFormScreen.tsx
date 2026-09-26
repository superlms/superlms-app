import React, { useCallback, useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { AppAlert } from '../../components/AppDialog';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr, pickPdf } from '../../utils/filePickers';
import { PickedFile } from '../../api/adminProfileApi';
import {
  ExamPaper,
  PAPER_SUBJECT_OTHER,
  PaperOptions,
  createExamPaper,
  getPaperOptions,
  updateExamPaper,
} from '../../api/adminExamApi';
import { DocHeader } from '../more/docUi';
import {
  FileChip,
  FormCard,
  FormError,
  Hint,
  OptionSheet,
  PickerCard,
  SubmitButton,
  isPdfFile,
  withinOneMb,
} from './adminFormUi';

/**
 * Upload a question paper, or edit one, as the panel's form has it: the exam,
 * the class and — if it is for one — a section, then one of the class's
 * subjects or Other for a paper tied to none; a title, the PDF (up to 1 MB;
 * on an edit it may be left to keep the one it has) and a description of up
 * to 3000 characters.
 *
 * Route params: paper – the paper to edit (absent when uploading).
 */

const NO_SECTION = '';
const DESCRIPTION_MAX = 3000;

type Sheet = 'exam' | 'class' | 'section' | 'subject' | null;

// A picked file's name as it reads — pickers may hand it over percent-encoded.
const readable = (name?: string | null) => {
  try {
    return decodeURIComponent(name ?? '');
  } catch {
    return name ?? '';
  }
};

const AdminExamPaperFormScreen = ({ navigation, route }: any) => {
  const editing: ExamPaper | undefined = route.params?.paper;
  const isEdit = !!editing;

  const [opt, setOpt] = useState<PaperOptions | null>(null);
  const [exam, setExam] = useState(editing ? String(editing.exam_id) : '');
  const [std, setStd] = useState(editing ? String(editing.standard_id) : '');
  const [sec, setSec] = useState(editing?.section_id ? String(editing.section_id) : NO_SECTION);
  // A saved paper with no subject was filed under Other.
  const [sub, setSub] = useState(
    editing ? (editing.subject_id ? String(editing.subject_id) : PAPER_SUBJECT_OTHER) : '',
  );
  const [title, setTitle] = useState(editing?.title ?? '');
  const [description, setDescription] = useState(editing?.description ?? '');
  const [file, setFile] = useState<PickedFile | null>(null);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // The pickers' lists: the class's sections, and its (or the section's) subjects.
  const loadOptions = useCallback(async (standardId: string, sectionId: string) => {
    try {
      setOpt(
        await getPaperOptions({
          standard_id: standardId ? Number(standardId) : undefined,
          section_id: sectionId ? Number(sectionId) : undefined,
        }),
      );
    } catch (e) {
      setError(apiErr(e, 'Could not load the choices.'));
    }
  }, []);

  useEffect(() => {
    loadOptions(std, sec);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const pickClass = (k: string) => {
    setStd(k);
    setSec(NO_SECTION);
    setSub('');
    setError('');
    loadOptions(k, NO_SECTION);
  };
  const pickSection = (k: string) => {
    setSec(k);
    setSub('');
    setError('');
    loadOptions(std, k);
  };

  const choosePdf = async () => {
    const f = await pickPdf();
    if (!f) return;
    if (!isPdfFile(f)) {
      AppAlert.alert('Not a PDF', 'The paper must be a PDF file.');
      return;
    }
    if (withinOneMb(f, 'The PDF')) {
      setFile(f);
      setError('');
    }
  };

  const save = async () => {
    if (!exam) return setError('Please select an exam.');
    if (!std) return setError('Please select a class.');
    if (!sub) return setError('Please select a subject (or choose Other).');
    if (!title.trim()) return setError('Please enter a title.');
    if (!isEdit && !file) return setError('Please choose a PDF file.');

    setError('');
    setSaving(true);
    try {
      const payload = {
        exam_id: Number(exam),
        standard_id: Number(std),
        section_id: sec ? Number(sec) : null,
        subject_id: sub === PAPER_SUBJECT_OTHER ? sub : Number(sub),
        title: title.trim(),
        description: description.trim(),
        file,
      };
      if (isEdit) await updateExamPaper(editing!.id, payload);
      else await createExamPaper(payload);
      navigation.goBack();
    } catch (e) {
      setError(apiErr(e, 'Could not save the exam paper.'));
    } finally {
      setSaving(false);
    }
  };

  const examRow = opt?.exams.find(e => String(e.id) === exam);
  const examLabel = examRow ? `${examRow.exam_name} (${examRow.academic_year})` : editing?.exam_name ?? null;
  const className = opt?.standards.find(c => String(c.id) === std)?.name ?? (editing && std === String(editing.standard_id) ? editing.standard_name : null);
  const sectionName = sec
    ? opt?.sections.find(c => String(c.id) === sec)?.name ?? (editing && sec === String(editing.section_id) ? editing.section_name : null)
    : 'All / None';
  const subjectName =
    sub === PAPER_SUBJECT_OTHER
      ? 'Other'
      : opt?.subjects.find(c => String(c.id) === sub)?.name ??
        (editing && sub === String(editing.subject_id) ? editing.subject_name : null);

  const sheetProps =
    sheet === 'exam'
      ? {
          title: 'Exam',
          options: (opt?.exams ?? []).map(e => ({ key: String(e.id), label: e.exam_name, sub: e.academic_year })),
          selected: [exam],
          onPick: (k: string) => {
            setExam(k);
            setError('');
          },
        }
      : sheet === 'class'
      ? {
          title: 'Class',
          options: (opt?.standards ?? []).map(c => ({ key: String(c.id), label: c.name })),
          selected: [std],
          onPick: pickClass,
        }
      : sheet === 'section'
      ? {
          title: 'Section',
          options: [{ key: NO_SECTION, label: 'All / None' }, ...(opt?.sections ?? []).map(c => ({ key: String(c.id), label: c.name }))],
          selected: [sec],
          onPick: pickSection,
        }
      : {
          title: 'Subject',
          options: [...(opt?.subjects ?? []).map(c => ({ key: String(c.id), label: c.name })), { key: PAPER_SUBJECT_OTHER, label: 'Other' }],
          selected: [sub],
          onPick: (k: string) => {
            setSub(k);
            setError('');
          },
        };

  return (
    <View style={s.root}>
      <DocHeader title={isEdit ? 'Edit Exam Paper' : 'Upload Exam Paper'} onBackPress={() => navigation.goBack()} />

      <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <PickerCard label="Exam" value={examLabel} placeholder="Select exam" onPress={() => setSheet('exam')} />

          <View style={s.pair}>
            <PickerCard style={s.half} label="Class" value={className} placeholder="Select class" onPress={() => setSheet('class')} />
            <PickerCard
              style={s.half}
              label="Section"
              value={sectionName}
              disabled={!std}
              onPress={() => setSheet('section')}
            />
          </View>

          <View style={s.group}>
            <PickerCard
              label="Subject"
              value={subjectName}
              placeholder="Select subject"
              disabled={!std}
              onPress={() => setSheet('subject')}
            />
            <Hint>
              {std ? 'Pick Other for a paper that isn’t tied to one of these subjects.' : 'Choose a class first.'}
            </Hint>
          </View>

          <FormCard
            label="Title"
            value={title}
            onChangeText={t => {
              setTitle(t);
              setError('');
            }}
            placeholder="e.g. Mathematics Question Paper"
            maxLength={255}
          />

          <View style={s.group}>
            <PickerCard
              label="PDF File"
              value={file ? readable(file.name) || 'PDF' : isEdit ? 'Current PDF — tap to replace' : null}
              placeholder="Choose a PDF"
              icon="attach"
              onPress={choosePdf}
            />
            {!!file && <FileChip kind="pdf" onRemove={() => setFile(null)} />}
            <Hint>
              PDF only, up to 1 MB{isEdit ? ' — leave it to keep the current file.' : '.'}
            </Hint>
          </View>

          <View style={s.group}>
            <FormCard
              label="Description"
              value={description}
              onChangeText={setDescription}
              placeholder="Optional notes about this paper — instructions, sections covered, marking scheme..."
              multiline
              minHeight={100}
              maxLength={DESCRIPTION_MAX}
            />
            <Hint>
              {description.length}/{DESCRIPTION_MAX}
            </Hint>
          </View>

          <FormError>{error}</FormError>

          <SubmitButton label={isEdit ? 'Update Paper' : 'Upload Paper'} busy={saving} onPress={save} />
        </ScrollView>
      </KeyboardAvoidingView>

      <OptionSheet
        visible={sheet !== null}
        title={sheetProps.title}
        options={sheetProps.options}
        selected={sheetProps.selected}
        onPick={sheetProps.onPick}
        onClose={() => setSheet(null)}
      />
    </View>
  );
};

export default AdminExamPaperFormScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  flex: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40, gap: 14 },
  group: { gap: 8 },
  pair: { flexDirection: 'row', gap: 10 },
  half: { flex: 1 },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
