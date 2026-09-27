import React, { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { AppAlert } from '../../components/AppDialog';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr, pickImage, pickPdf } from '../../utils/filePickers';
import { DocHeader } from '../more/docUi';
import { PickedFile } from '../../api/adminProfileApi';
import {
  BookClass,
  BookRow,
  createBook,
  deleteBook,
  getBookOptions,
  getBookOverview,
  updateBook,
} from '../../api/adminBookApi';
import { subjectLabel } from '../books/bookData';
import {
  FileChip,
  FormCard,
  FormError,
  Hint,
  OptionSheet,
  PickerCard,
  QuietAction,
  SubmitButton,
  SwitchRow,
  confirmDestructive,
  isPdfFile,
  withinOneMb,
} from './adminFormUi';
import { BookCtx, readable } from './adminBookUi';

/**
 * A book added, or edited, as the panel's form has it: its title (up to 100
 * characters, one per title in a class and section), the class, a section or
 * the whole class, the subject (the section's, or the class's), an optional
 * cover of up to 1 MB, the PDF — needed on every book, up to 20 MB, kept on an
 * edit unless replaced — and whether it is active. Choosing the class clears
 * the section and subject; choosing the section clears the subject. An edit
 * can delete the book, with its cover and PDF.
 *
 * Route params: ctx — the class, section and subject it was opened from; book —
 * the book to edit.
 */

const PDF_MAX = 20 * 1024 * 1024;
type Ref = { id: number; name: string };
type Sheet = 'class' | 'section' | 'subject' | null;

const AdminBookEditorScreen = ({ navigation, route }: any) => {
  const ctx: BookCtx | undefined = route?.params?.ctx;
  const editing: BookRow | undefined = route?.params?.book ?? undefined;
  const isEdit = !!editing;

  const [classes, setClasses] = useState<BookClass[]>([]);
  const [std, setStd] = useState<Ref | null>(
    editing
      ? { id: editing.standard_id, name: editing.class ?? '' }
      : ctx
      ? { id: ctx.classId, name: ctx.className }
      : null,
  );
  const [sec, setSec] = useState<Ref | null>(
    editing
      ? editing.section_id
        ? { id: editing.section_id, name: editing.section ?? '' }
        : null
      : ctx?.sectionId
      ? { id: ctx.sectionId, name: ctx.sectionName ?? '' }
      : null,
  );
  const [subject, setSubject] = useState<Ref | null>(
    editing
      ? { id: editing.subject_id, name: subjectLabel(editing.subject ?? '') }
      : ctx
      ? { id: ctx.subjectId, name: ctx.subjectName }
      : null,
  );
  const [subjects, setSubjects] = useState<Ref[]>([]);
  const [title, setTitle] = useState(editing?.title ?? ctx?.subjectName ?? '');
  const [active, setActive] = useState(editing ? editing.is_active : true);
  const [cover, setCover] = useState<PickedFile | null>(null);
  const [pdf, setPdf] = useState<PickedFile | null>(null);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    getBookOverview().then(r => setClasses(r.classes)).catch(() => {});
  }, []);

  // The subjects the panel offers: the section's, or the class's without one.
  const optSeq = useRef(0);
  useEffect(() => {
    const mine = ++optSeq.current;
    if (!std) {
      setSubjects([]);
      return;
    }
    getBookOptions(std.id, sec?.id ?? null)
      .then(r => {
        if (mine === optSeq.current) setSubjects(r.subjects.map(x => ({ id: x.id, name: subjectLabel(x.name) })));
      })
      .catch(() => {
        if (mine === optSeq.current) setSubjects([]);
      });
  }, [std, sec]);

  const sections = classes.find(c => c.id === std?.id)?.sections ?? [];
  const needsPdf = !isEdit || !editing?.pdf_file;

  const touch = () => setError('');

  const chooseCover = async () => {
    const f = await pickImage();
    if (f && withinOneMb(f, 'Cover image')) {
      setCover(f);
      touch();
    }
  };

  const choosePdf = async () => {
    const f = await pickPdf();
    if (!f) return;
    if (!isPdfFile(f)) {
      AppAlert.alert('Not a PDF', 'The book file must be a PDF.');
      return;
    }
    if (f.size && f.size > PDF_MAX) {
      AppAlert.alert('File too large', 'PDF must be 20 MB or smaller.');
      return;
    }
    setPdf(f);
    touch();
  };

  const save = async () => {
    const t = title.trim();
    if (!t) return setError('Enter the book title.');
    if (t.length > 100) return setError('Book title may not be longer than 100 characters.');
    if (!std) return setError('Please select a class.');
    if (!subject) return setError('Please select a subject.');
    if (needsPdf && !pdf) return setError('The book PDF is required.');

    setError('');
    setSaving(true);
    try {
      const payload = {
        title: t,
        standard_id: std.id,
        section_id: sec?.id ?? null,
        subject_id: subject.id,
        is_active: active,
        book_logo: cover,
        pdf_file: pdf,
      };
      const saved = isEdit ? await updateBook(editing!.id, payload) : await createBook(payload);
      const nextCtx: BookCtx = {
        classId: saved?.standard_id ?? std.id,
        className: saved?.class ?? std.name,
        sectionId: saved?.section_id || null,
        sectionName: saved?.section_id ? saved?.section ?? sec?.name ?? null : null,
        subjectId: saved?.subject_id ?? subject.id,
        subjectName: subjectLabel(saved?.subject ?? subject.name),
      };
      navigation.popTo('AdminBookView', { ctx: nextCtx, book: saved });
    } catch (e) {
      setError(apiErr(e, 'Could not save the book.'));
    } finally {
      setSaving(false);
    }
  };

  const remove = () =>
    confirmDestructive('Delete Book', `Delete "${editing?.title}"? Its cover and PDF are removed too.`, 'Delete', async () => {
      setDeleting(true);
      try {
        await deleteBook(editing!.id);
        // Past the book's page, back to where it was opened from.
        navigation.pop(2);
      } catch (e) {
        AppAlert.alert('Could not delete', apiErr(e, 'Please try again.'));
        setDeleting(false);
      }
    });

  const sheetProps =
    sheet === 'class'
      ? {
          title: 'Class',
          options: classes.map(c => ({ key: String(c.id), label: c.name })),
          selected: [String(std?.id ?? '')],
          onPick: (k: string) => {
            const c = classes.find(x => String(x.id) === k);
            if (!c || c.id === std?.id) return;
            setStd({ id: c.id, name: c.name });
            setSec(null);
            setSubject(null);
            touch();
          },
        }
      : sheet === 'section'
      ? {
          title: 'Section',
          options: [{ key: '', label: 'Whole class' }, ...sections.map(x => ({ key: String(x.id), label: `Section ${x.name}` }))],
          selected: [String(sec?.id ?? '')],
          onPick: (k: string) => {
            const x = sections.find(y => String(y.id) === k) ?? null;
            if ((x?.id ?? null) === (sec?.id ?? null)) return;
            setSec(x ? { id: x.id, name: x.name } : null);
            setSubject(null);
            touch();
          },
        }
      : {
          title: 'Subject',
          options: subjects.map(x => ({ key: String(x.id), label: x.name })),
          selected: [String(subject?.id ?? '')],
          onPick: (k: string) => {
            const x = subjects.find(y => String(y.id) === k);
            if (x) setSubject(x);
            touch();
          },
        };

  return (
    <View style={s.root}>
      <DocHeader title={isEdit ? 'Edit Book' : 'Add Book'} onBackPress={() => navigation.goBack()} />

      <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <FormCard
            label="Book Title *"
            value={title}
            onChangeText={v => {
              setTitle(v);
              touch();
            }}
            placeholder="e.g. NCERT Mathematics"
            maxLength={100}
          />

          <View style={s.pair}>
            <PickerCard style={s.half} label="Class *" value={std?.name} placeholder="Select Class" onPress={() => setSheet('class')} />
            <PickerCard
              style={s.half}
              label="Section"
              value={sec ? `Section ${sec.name}` : 'Whole class'}
              disabled={!std}
              onPress={() => setSheet('section')}
            />
          </View>

          <PickerCard
            label="Subject *"
            value={subject?.name}
            placeholder={std ? 'Select Subject' : 'Select a class first'}
            disabled={!std}
            onPress={() => setSheet('subject')}
          />

          <View style={s.group}>
            <PickerCard
              label={needsPdf ? 'Book PDF *' : 'Book PDF'}
              value={pdf ? readable(pdf.name) || 'PDF' : !needsPdf ? 'Current PDF — tap to replace' : null}
              placeholder="Choose a PDF"
              icon="attach"
              onPress={choosePdf}
            />
            {!!pdf && <FileChip kind="pdf" onRemove={() => setPdf(null)} />}
            <Hint>PDF only, up to 20 MB{!needsPdf ? ' — leave it to keep the current file.' : '.'}</Hint>
          </View>

          <View style={s.group}>
            <PickerCard
              label="Cover Image"
              value={cover ? readable(cover.name) || 'Image' : editing?.book_logo ? 'Current cover — tap to replace' : null}
              placeholder="Optional"
              icon="image-outline"
              onPress={chooseCover}
            />
            {!!cover && <FileChip kind="image" onRemove={() => setCover(null)} />}
            <Hint>An image up to 1 MB.</Hint>
          </View>

          <SwitchRow label="Active" value={active} onValueChange={setActive} />

          <FormError>{error}</FormError>

          <SubmitButton label={isEdit ? 'Update Book' : 'Add Book'} busy={saving} onPress={save} />

          {isEdit && (
            <View style={s.foot}>
              <QuietAction icon="trash-2" label="Delete book" danger busy={deleting} onPress={remove} />
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <OptionSheet
        visible={sheet !== null}
        title={sheetProps.title}
        options={sheetProps.options}
        selected={sheetProps.selected}
        onPick={sheetProps.onPick}
        onClose={() => setSheet(null)}
        emptyText={sheet === 'subject' ? 'No subjects mapped here. Map them under Standards first.' : undefined}
      />
    </View>
  );
};

export default AdminBookEditorScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  flex: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40, gap: 14 },
  pair: { flexDirection: 'row', gap: 10 },
  half: { flex: 1 },
  group: { gap: 8 },
  foot: { paddingTop: 8 },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
