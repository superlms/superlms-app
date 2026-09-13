import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import VectorIcon from '../../components/VectorIcon';
import { Skeleton } from '../../components/Skeleton';
import { theme, onThemeChange } from '../../utils/theme';
import { quietCaps } from '../../utils/quietCaps';
import { DocHeader, DocNoData } from '../more/docUi';
import { getTeacherClassesSubjects, marksErrorMessage, type ClassSubject } from '../../api/marksApi';
import {
  createHomework,
  updateHomework,
  homeworkErrorMessage,
  type HomeworkItem,
} from '../../api/homeworkApi';
import { ErrorBox } from './homeworkUi';

interface PickedFile {
  uri: string;
  name: string;
  type?: string;
}

// The class of homework being edited, as a picker option — used when it is no
// longer in the teacher's timetable, so the form can still show and keep it.
const ownTriple = (hw: HomeworkItem): ClassSubject => ({
  standard_id: hw.standard_id ?? 0,
  standard_name: hw.standard ?? '',
  section_id: hw.section_id ?? 0,
  section_name: hw.section ?? '',
  subject_id: hw.subject?.id ?? 0,
  subject_name: hw.subject?.name ?? '',
  label: [hw.subject?.name, hw.standard, hw.section].filter(Boolean).join(' · '),
});

// The attachment already on the homework, as a chip: its file name from the URL.
const savedFile = (url: string): PickedFile => {
  const last = url.split('?')[0].split('/').pop() ?? '';
  let name = last;
  try {
    name = decodeURIComponent(last);
  } catch {
    // A stray "%" in the name — show it as it is.
  }
  return { uri: url, name: name || 'attachment' };
};

// "Mathematics · 10th A"
const tripleLabel = (t: ClassSubject) => {
  const cls = [t.standard_name, t.section_name].filter(Boolean).join(' ');
  return t.subject_name ? [quietCaps(t.subject_name), cls].filter(Boolean).join(' · ') : t.label;
};

const sameTriple = (a: ClassSubject | null, b: ClassSubject) =>
  !!a && a.standard_id === b.standard_id && a.section_id === b.section_id && a.subject_id === b.subject_id;

// Short type for the attachment chip: the extension ("JPG", "MP4"), or the
// kind of media when the name has no usable one.
const fileType = (f: PickedFile) => {
  const ext = f.name.includes('.') ? f.name.split('.').pop() ?? '' : '';
  if (ext && ext.length <= 4) return ext.toUpperCase();
  return (f.type?.split('/')[0] || 'file').toUpperCase();
};

// Opened with `{ homework }` it edits that homework; without, it adds a new one.
const AddHomeworkScreen = ({ navigation, route }: any) => {
  const editing: HomeworkItem | undefined = route?.params?.homework;

  const [triples, setTriples] = useState<ClassSubject[]>([]);
  const [loadingTriples, setLoadingTriples] = useState(true);
  const [triplesError, setTriplesError] = useState<string | null>(null);

  const [selected, setSelected] = useState<ClassSubject | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  // Where the class field sits in the form, so its menu can open over it.
  const [pickerY, setPickerY] = useState(0);
  const [pickerFieldY, setPickerFieldY] = useState(0);
  const [title, setTitle] = useState(editing?.title ?? '');
  const [desc, setDesc] = useState(editing?.description ?? '');
  const [file, setFile] = useState<PickedFile | null>(null);
  // The attachment the homework already has, until it is removed or replaced.
  const [keptFile, setKeptFile] = useState<PickedFile | null>(
    editing?.file_url ? savedFile(editing.file_url) : null,
  );
  const [submitting, setSubmitting] = useState(false);

  const loadTriples = useCallback(async () => {
    setLoadingTriples(true);
    setTriplesError(null);
    try {
      const list = await getTeacherClassesSubjects();
      if (!editing) {
        setTriples(list);
        return;
      }
      const own = ownTriple(editing);
      const match = list.find(t => sameTriple(own, t));
      setTriples(match ? list : [own, ...list]);
      setSelected(match ?? own);
    } catch (e: any) {
      setTriplesError(marksErrorMessage(e));
    } finally {
      setLoadingTriples(false);
    }
  }, [editing]);

  useEffect(() => {
    loadTriples();
  }, [loadTriples]);

  const pickFile = () => {
    launchImageLibrary({ mediaType: 'mixed', quality: 0.8 }, res => {
      if (res.didCancel || res.errorCode) return;
      const asset = res.assets?.[0];
      if (!asset?.uri) return;
      setFile({
        uri: asset.uri,
        name: asset.fileName ?? `attachment.${(asset.type ?? 'image/jpeg').split('/')[1]}`,
        type: asset.type,
      });
    });
  };

  const handleSubmit = async () => {
    if (!selected) return Alert.alert('Select a class', 'Please choose a class & subject.');
    if (!title.trim()) return Alert.alert('Missing title', 'Please enter a homework title.');

    const payload = {
      standard_id: selected.standard_id,
      section_id: selected.section_id,
      subject_id: selected.subject_id,
      title: title.trim(),
      description: desc.trim() || undefined,
    };

    setSubmitting(true);
    try {
      if (editing) {
        await updateHomework(editing.id, payload, file, !!editing.file_url && !keptFile);
        Alert.alert('Homework updated', 'Your changes were saved.', [
          { text: 'Done', onPress: () => navigation.goBack() },
        ]);
      } else {
        await createHomework(payload, file);
        Alert.alert('Homework added', 'The homework was posted successfully.', [
          { text: 'Done', onPress: () => navigation.goBack() },
        ]);
      }
    } catch (e: any) {
      Alert.alert(editing ? 'Could not save homework' : 'Could not add homework', homeworkErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  const formReady = !loadingTriples && !triplesError && triples.length > 0;
  const shownFile = file ?? keptFile;

  const renderBody = () => {
    if (loadingTriples) {
      return (
        <View style={s.loading}>
          {[0, 1, 2].map(i => (
            <View key={i} style={s.loadingField}>
              <Skeleton width="30%" height={12} />
              <Skeleton width="100%" height={46} radius={theme.radius.md} />
            </View>
          ))}
        </View>
      );
    }
    if (triplesError) return <ErrorBox message={triplesError} onRetry={loadTriples} />;
    if (triples.length === 0) {
      return (
        <DocNoData
          icon="book-outline"
          title="No subject assigned"
          subtitle="No classes or subjects are assigned to you in the timetable yet."
        />
      );
    }

    return (
      <>
        <ScrollView
          style={s.fill}
          contentContainerStyle={s.form}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Class and subject */}
          <View onLayout={e => setPickerY(e.nativeEvent.layout.y)}>
            <Text style={s.label}>Class and subject</Text>
            <TouchableOpacity
              style={[s.field, s.picker]}
              activeOpacity={0.7}
              onLayout={e => setPickerFieldY(e.nativeEvent.layout.y)}
              onPress={() => setPickerOpen(true)}
            >
              <Text style={[s.pickerText, !selected && s.placeholder]} numberOfLines={1}>
                {selected ? tripleLabel(selected) : 'Choose a class and subject'}
              </Text>
              <VectorIcon iconSet="Ionicons" iconName="chevron-down" size={16} color={theme.colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Title */}
          <View>
            <Text style={s.label}>Title</Text>
            <TextInput
              style={s.field}
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. Chapter 3 Exercise"
              placeholderTextColor={theme.colors.textMuted}
            />
          </View>

          {/* Description */}
          <View>
            <Text style={s.label}>Description</Text>
            <TextInput
              style={[s.field, s.fieldMulti]}
              value={desc}
              onChangeText={setDesc}
              placeholder="What should the class do?"
              placeholderTextColor={theme.colors.textMuted}
              multiline
              textAlignVertical="top"
            />
          </View>

          {/* Attachment — added from the header; shown here as a chip. A new
              file stands in for the one the homework already has. */}
          {!!shownFile && (
            <View>
              <Text style={s.label}>Attachment</Text>
              <View style={s.chip}>
                <View style={s.chipType}>
                  <Text style={s.chipTypeText}>{fileType(shownFile)}</Text>
                </View>
                <Text style={s.chipName} numberOfLines={1} ellipsizeMode="middle">
                  {shownFile.name}
                </Text>
                <TouchableOpacity
                  onPress={() => (file ? setFile(null) : setKeptFile(null))}
                  hitSlop={10}
                  activeOpacity={0.6}
                >
                  <VectorIcon iconSet="Ionicons" iconName="close" size={16} color={theme.colors.textMuted} />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Class menu: opens over the field, starting at its top line. It
              lives at the form level (not inside the field's box) so Android
              still takes taps on the part that hangs below the field. */}
          {pickerOpen && (
            <>
              <Pressable style={s.backdrop} onPress={() => setPickerOpen(false)} />
              <View style={[s.menu, { top: pickerY + pickerFieldY }]}>
                <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                  {triples.map((t, i) => {
                    const active = sameTriple(selected, t);
                    return (
                      <TouchableOpacity
                        key={`${t.standard_id}:${t.section_id}:${t.subject_id}`}
                        style={[s.option, i < triples.length - 1 && s.optionDivider]}
                        activeOpacity={0.6}
                        onPress={() => {
                          setSelected(t);
                          setPickerOpen(false);
                        }}
                      >
                        <Text style={[s.optionText, active && s.optionTextActive]}>{tripleLabel(t)}</Text>
                        {active && (
                          <VectorIcon iconSet="Ionicons" iconName="checkmark" size={16} color={theme.colors.primary} />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            </>
          )}
        </ScrollView>

        {/* Post */}
        <View style={s.bar}>
          <TouchableOpacity
            style={[s.postBtn, submitting && s.postBtnBusy]}
            activeOpacity={0.85}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator size="small" color={theme.colors.white} />
            ) : (
              <Text style={s.postText}>{editing ? 'Save changes' : 'Post homework'}</Text>
            )}
          </TouchableOpacity>
        </View>
      </>
    );
  };

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <DocHeader
        title={editing ? 'Edit Homework' : 'New Homework'}
        onBackPress={() => navigation.goBack()}
        rightIcon={formReady ? 'attach-outline' : undefined}
        onRightPress={formReady ? pickFile : undefined}
      />
      {renderBody()}
    </KeyboardAvoidingView>
  );
};

export default AddHomeworkScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  fill: { flex: 1 },

  // Form — grows to the full height so the class menu's backdrop covers it.
  form: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 28, gap: 22 },
  label: { fontSize: 13, fontWeight: '600', color: theme.colors.textSecondary, marginBottom: 8 },
  // White field with a light grey outline.
  field: {
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: theme.colors.textPrimary,
  },
  fieldMulti: { minHeight: 120, lineHeight: 22 },

  // Class picker
  picker: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14 },
  pickerText: { flex: 1, fontSize: 15, color: theme.colors.textPrimary },
  placeholder: { color: theme.colors.textMuted },

  // Class menu, over the field
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  menu: {
    position: 'absolute',
    left: 20,
    right: 20,
    maxHeight: 320,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.background,
    paddingHorizontal: 14,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  option: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 13 },
  optionDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },
  optionText: { flex: 1, fontSize: 15, color: theme.colors.textPrimary },
  optionTextActive: { color: theme.colors.primary, fontWeight: '500' },

  // Attachment chip: file type, then the name
  chip: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: theme.colors.background,
    borderRadius: theme.radius.full,
    paddingLeft: 6,
    paddingRight: 12,
    paddingVertical: 6,
  },
  chipType: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.radius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  chipTypeText: { fontSize: 11, fontWeight: '700', color: theme.colors.textSecondary, letterSpacing: 0.3 },
  chipName: { flexShrink: 1, fontSize: 14, color: theme.colors.textPrimary },

  // Post
  bar: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.card,
  },
  postBtn: {
    height: 48,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  postBtnBusy: { opacity: 0.7 },
  postText: { fontSize: 15, fontWeight: '600', color: theme.colors.white },

  // Loading
  loading: { paddingHorizontal: 20, paddingTop: 20, gap: 22 },
  loadingField: { gap: 8 },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
