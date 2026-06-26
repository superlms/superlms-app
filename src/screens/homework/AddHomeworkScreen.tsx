import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import Header from '../../components/Header';
import VectorIcon from '../../components/VectorIcon';
import { theme, onThemeChange } from '../../utils/theme';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useRefresh } from '../../hooks/useRefresh';
import { getTeacherClassesSubjects, marksErrorMessage, type ClassSubject } from '../../api/marksApi';
import { createHomework, homeworkErrorMessage } from '../../api/homeworkApi';

interface PickedFile {
  uri: string;
  name: string;
  type?: string;
}

const AddHomeworkScreen = ({ navigation }: any) => {
  const [triples, setTriples] = useState<ClassSubject[]>([]);
  const [loadingTriples, setLoadingTriples] = useState(true);
  const [triplesError, setTriplesError] = useState<string | null>(null);

  const [selected, setSelected] = useState<ClassSubject | null>(null);
  const [dropOpen, setDropOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [file, setFile] = useState<PickedFile | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadTriples = useCallback(async () => {
    setLoadingTriples(true);
    setTriplesError(null);
    try {
      setTriples(await getTeacherClassesSubjects());
    } catch (e: any) {
      setTriplesError(marksErrorMessage(e));
    } finally {
      setLoadingTriples(false);
    }
  }, []);

  useEffect(() => {
    loadTriples();
  }, [loadTriples]);

  const { refreshing, onRefresh } = useRefresh(loadTriples);

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

    setSubmitting(true);
    try {
      await createHomework(
        {
          standard_id: selected.standard_id,
          section_id: selected.section_id,
          subject_id: selected.subject_id,
          title: title.trim(),
          description: desc.trim() || undefined,
        },
        file,
      );
      Alert.alert('Homework added', 'The homework was posted successfully.', [
        { text: 'Done', onPress: () => navigation.goBack() },
      ]);
    } catch (e: any) {
      Alert.alert('Could not add homework', homeworkErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Header title="Add Homework" onBackPress={() => navigation.goBack()} />

      <ScrollView
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={s.card}>
          <View style={[s.accentBar, { backgroundColor: theme.colors.primary }]} />
          <View style={s.cardInner}>
            <View style={s.cardTop}>
              <View style={s.iconWrap}>
                <VectorIcon iconSet="Ionicons" iconName="create-outline" size={20} color={theme.colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.cardTitle}>New Homework</Text>
                <Text style={s.cardSubtitle}>Assign to one of your classes</Text>
              </View>
            </View>

            {/* Class & Subject picker */}
            <Text style={s.label}>Class & Subject</Text>
            {loadingTriples ? (
              <View style={s.inlineLoad}>
                <ActivityIndicator color={theme.colors.primary} />
              </View>
            ) : triplesError ? (
              <View style={s.inlineError}>
                <Text style={s.inlineErrorText}>{triplesError}</Text>
                <TouchableOpacity onPress={loadTriples} style={s.retryBtn} activeOpacity={0.85}>
                  <Text style={s.retryText}>Retry</Text>
                </TouchableOpacity>
              </View>
            ) : triples.length === 0 ? (
              <View style={s.emptyBox}>
                <View style={s.emptyIconRing}>
                  <VectorIcon iconSet="Ionicons" iconName="book-outline" size={34} color={theme.colors.primary} />
                </View>
                <Text style={s.emptyTitle}>No subject assigned</Text>
                <Text style={s.emptySubtitle}>
                  No classes or subjects are assigned to you in the timetable yet.
                </Text>
              </View>
            ) : (
              <View style={dropOpen ? { zIndex: 30 } : undefined}>
                <TouchableOpacity style={s.dropBtn} activeOpacity={0.8} onPress={() => setDropOpen(o => !o)}>
                  <Text style={[s.dropValue, !selected && { color: theme.colors.textMuted }]} numberOfLines={1}>
                    {selected ? selected.label : 'Choose class · section · subject'}
                  </Text>
                  <VectorIcon iconSet="Ionicons" iconName={dropOpen ? 'chevron-up' : 'chevron-down'} size={18} color={theme.colors.primary} />
                </TouchableOpacity>
                {dropOpen && (
                  <View style={s.dropList}>
                    {triples.map((t, i) => {
                      const active =
                        selected?.standard_id === t.standard_id &&
                        selected?.section_id === t.section_id &&
                        selected?.subject_id === t.subject_id;
                      return (
                        <TouchableOpacity
                          key={`${t.standard_id}:${t.section_id}:${t.subject_id}`}
                          style={[s.dropItem, i === triples.length - 1 && { borderBottomWidth: 0 }, active && s.dropItemActive]}
                          activeOpacity={0.7}
                          onPress={() => {
                            setSelected(t);
                            setDropOpen(false);
                          }}
                        >
                          <Text style={[s.dropItemText, active && s.dropItemTextActive]}>{t.label}</Text>
                          {active && <VectorIcon iconSet="Ionicons" iconName="checkmark" size={16} color={theme.colors.primary} />}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>
            )}

            {triples.length > 0 && (
            <>
            <Text style={s.label}>Title</Text>
            <TextInput
              style={s.input}
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. Chapter 3 Exercise"
              placeholderTextColor={theme.colors.textMuted}
            />

            <Text style={s.label}>Description</Text>
            <TextInput
              style={[s.input, s.inputMulti]}
              value={desc}
              onChangeText={setDesc}
              placeholder="Describe the homework task..."
              placeholderTextColor={theme.colors.textMuted}
              multiline
              textAlignVertical="top"
            />

            <Text style={s.label}>Attachment (optional)</Text>
            {file ? (
              <View style={s.filePreview}>
                <View style={s.fileIconBox}>
                  <VectorIcon iconSet="Feather" iconName="paperclip" size={14} color={theme.colors.primary} />
                </View>
                <Text style={s.fileName} numberOfLines={1}>{file.name}</Text>
                <TouchableOpacity onPress={() => setFile(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <VectorIcon iconSet="Ionicons" iconName="close-circle" size={20} color={theme.colors.danger} />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={s.attachBtn} onPress={pickFile} activeOpacity={0.8}>
                <VectorIcon iconSet="Ionicons" iconName="attach" size={16} color={theme.colors.primary} />
                <Text style={s.attachBtnText}>Attach a document</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[s.submitBtn, submitting && { opacity: 0.6 }]}
              activeOpacity={0.85}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <VectorIcon iconSet="Ionicons" iconName="send" size={15} color="#fff" />
              )}
              <Text style={s.submitText}>{submitting ? 'Posting…' : 'Post Homework'}</Text>
            </TouchableOpacity>
            </>
            )}
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default AddHomeworkScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  scroll: { padding: theme.spacing.lg, paddingBottom: 40 },

  card: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
    elevation: 2,
  },
  accentBar: { height: 4, width: '100%' },
  cardInner: { padding: theme.spacing.md },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: theme.colors.textPrimary },
  cardSubtitle: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },

  label: { fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary, marginBottom: 6, marginTop: 8 },
  input: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: theme.colors.textPrimary,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  inputMulti: { minHeight: 100 },
  helpText: { fontSize: 13, color: theme.colors.textMuted, paddingVertical: 8 },

  // Books-style empty state (no assigned subjects)
  emptyBox: { alignItems: 'center', paddingTop: 24, paddingBottom: 12, paddingHorizontal: 12 },
  emptyIconRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: theme.colors.textPrimary, marginBottom: 4 },
  emptySubtitle: { fontSize: 13, color: theme.colors.textMuted, textAlign: 'center', lineHeight: 19 },

  inlineLoad: { paddingVertical: 16, alignItems: 'center' },
  inlineError: { gap: 8, paddingVertical: 10, alignItems: 'flex-start' },
  inlineErrorText: { fontSize: 13, color: theme.colors.textSecondary },
  retryBtn: {
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
    borderRadius: theme.radius.full,
    paddingHorizontal: 18,
    paddingVertical: 6,
  },
  retryText: { fontSize: 13, fontWeight: '700', color: theme.colors.primary },

  dropBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.background,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  dropValue: { flex: 1, fontSize: 14, fontWeight: '600', color: theme.colors.textPrimary, paddingRight: 8 },
  dropList: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginTop: 6,
    overflow: 'hidden',
    elevation: 4,
  },
  dropItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  dropItemActive: { backgroundColor: theme.colors.primaryLight },
  dropItemText: { fontSize: 14, color: theme.colors.textSecondary, fontWeight: '600', flex: 1, paddingRight: 8 },
  dropItemTextActive: { color: theme.colors.primary, fontWeight: '700' },

  attachBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderStyle: 'dashed',
    borderRadius: theme.radius.sm,
    paddingVertical: 12,
  },
  attachBtnText: { fontSize: 13, fontWeight: '600', color: theme.colors.primary },
  filePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: theme.colors.primaryLight,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: `${theme.colors.primary}30`,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  fileIconBox: {
    width: 30,
    height: 30,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileName: { flex: 1, fontSize: 13, fontWeight: '600', color: theme.colors.textPrimary },

  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.sm,
    paddingVertical: 14,
    marginTop: 18,
  },
  submitText: { fontSize: 14, fontWeight: '800', color: '#fff' },
});


// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
