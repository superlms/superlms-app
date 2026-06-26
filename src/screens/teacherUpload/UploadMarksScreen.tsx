import React, { useCallback, useEffect, useMemo, useState } from 'react';
import ScreenSkeleton from '../../components/Skeleton';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Header from '../../components/Header';
import VectorIcon from '../../components/VectorIcon';
import { theme, onThemeChange } from '../../utils/theme';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useRefresh } from '../../hooks/useRefresh';
import SelectionWizard from './SelectionWizard';
import SelectionCard from './SelectionCard';
import { emptySelection, isComplete, Selection, UploadEntry, UploadStudent } from './uploadData';
import { getMarksStudents, getTeacherMarks, marksErrorMessage } from '../../api/marksApi';

const UploadMarksScreen = ({ navigation }: any) => {
  const [selection, setSelection] = useState<Selection>(emptySelection());
  const [marks, setMarks] = useState<Record<string, string>>({});
  const [serverIds, setServerIds] = useState<Record<string, number>>({});
  const [students, setStudents] = useState<UploadStudent[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [studentsError, setStudentsError] = useState<string | null>(null);

  const ready = isComplete(selection);
  const maxMarks = selection.exam?.totalMarks ?? 100;

  const loadRoster = useCallback(async (sel: Selection) => {
    if (!sel.cls || !sel.exam || !sel.subject) return;
    setLoadingStudents(true);
    setStudentsError(null);
    try {
      const [roster, existing] = await Promise.all([
        getMarksStudents(sel.cls.standardId, sel.cls.sectionId),
        // Pre-fill marks already saved for this exam+class+subject (CRUD: read/update).
        getTeacherMarks({
          exam_id: sel.exam.examId,
          standard_id: sel.cls.standardId,
          section_id: sel.cls.sectionId,
          subject_id: sel.subject.subjectId,
        }).catch(() => ({} as Record<number, any>)),
      ]);
      setStudents(
        roster.map(r => ({
          id: String(r.student_detail_id),
          studentDetailId: r.student_detail_id,
          rollNo: String(r.roll_no ?? ''),
          name: r.name,
        })),
      );
      const prefill: Record<string, string> = {};
      const ids: Record<string, number> = {};
      roster.forEach(r => {
        const row = existing[r.student_detail_id];
        if (row) {
          if (row.marks_obtained != null) prefill[String(r.student_detail_id)] = String(row.marks_obtained);
          ids[String(r.student_detail_id)] = row.id;
        }
      });
      setMarks(prefill);
      setServerIds(ids);
    } catch (e: any) {
      setStudentsError(marksErrorMessage(e));
      setStudents([]);
    } finally {
      setLoadingStudents(false);
    }
  }, []);

  // useRefresh re-pulls the roster + saved marks for the current selection.
  const { refreshing, onRefresh } = useRefresh(() => {
    if (isComplete(selection)) return loadRoster(selection);
  });

  useEffect(() => {
    if (isComplete(selection)) loadRoster(selection);
  }, [selection, loadRoster]);

  const onSelect = (next: Selection) => {
    setSelection(next);
    setMarks({}); // fresh context → start over
    setServerIds({});
    setStudents([]);
  };

  const setMark = (id: string, raw: string) => {
    const digits = raw.replace(/[^0-9]/g, '');
    if (digits === '') {
      setMarks(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      return;
    }
    const clamped = Math.min(parseInt(digits, 10), maxMarks);
    setMarks(prev => ({ ...prev, [id]: String(clamped) }));
  };

  const { enteredCount, average } = useMemo(() => {
    const vals = Object.values(marks)
      .map(v => parseInt(v, 10))
      .filter(n => !isNaN(n));
    const sum = vals.reduce((a, b) => a + b, 0);
    return {
      enteredCount: vals.length,
      average: vals.length ? Math.round(sum / vals.length) : 0,
    };
  }, [marks]);

  const handleManageSave = (entries: UploadEntry[]) => {
    const map: Record<string, string> = {};
    entries.forEach(e => {
      if (e.marks != null) map[e.studentId] = String(e.marks);
    });
    setMarks(map);
  };

  const handleSubmit = () => {
    if (enteredCount === 0) {
      Alert.alert('Nothing to submit', 'Enter marks for at least one student.');
      return;
    }
    const entries: UploadEntry[] = students
      .filter(st => marks[st.id] != null)
      .map(st => ({
        studentId: st.id,
        studentDetailId: st.studentDetailId,
        rollNo: st.rollNo,
        name: st.name,
        marks: parseInt(marks[st.id], 10),
        serverId: serverIds[st.id],
      }));
    navigation.navigate('ManageEntries', {
      mode: 'marks',
      selection,
      maxMarks,
      entries,
      onSave: handleManageSave,
    });
  };

  const renderStudent = ({ item }: { item: UploadStudent }) => {
    const value = marks[item.id] ?? '';
    return (
      <View style={s.row}>
        <View style={s.rowLeft}>
          <Text style={s.rollNo}>{item.rollNo}</Text>
          <View style={s.avatar}>
            <Text style={s.avatarText}>{item.name.charAt(0)}</Text>
          </View>
          <Text style={s.studentName} numberOfLines={1}>
            {item.name}
          </Text>
        </View>

        <TextInput
          style={[s.marksInput, value !== '' && s.marksInputFilled]}
          placeholder="--"
          placeholderTextColor={theme.colors.textMuted}
          keyboardType="number-pad"
          maxLength={4}
          value={value}
          onChangeText={t => setMark(item.id, t)}
        />

        <Text style={s.totalCell}>
          <Text style={s.totalValue}>{value || 0}</Text>
          <Text style={s.totalMax}>/{maxMarks}</Text>
        </Text>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={s.safeArea}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Header title="Upload Marks" onBackPress={() => navigation.goBack()} />

      <FlatList
        data={ready && !loadingStudents && !studentsError ? students : []}
        keyExtractor={i => i.id}
        renderItem={renderStudent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={s.list}
        ListHeaderComponent={
          <>
            <SelectionWizard value={selection} onChange={onSelect} />

            {!ready ? (
              <View style={s.promptBox}>
                <View style={s.promptIconRing}>
                  <VectorIcon
                    iconSet="Ionicons"
                    iconName="funnel-outline"
                    size={30}
                    color={theme.colors.primary}
                  />
                </View>
                <Text style={s.promptTitle}>Select to begin</Text>
                <Text style={s.promptSub}>
                  Choose Exam, Class and Subject to load the student list
                </Text>
              </View>
            ) : loadingStudents ? (
              <View style={s.promptBox}>
                <ScreenSkeleton variant="list" />
              </View>
            ) : studentsError ? (
              <View style={s.promptBox}>
                <Text style={s.promptTitle}>Couldn’t load students</Text>
                <Text style={s.promptSub}>{studentsError}</Text>
                <TouchableOpacity style={s.rosterRetry} onPress={() => loadRoster(selection)} activeOpacity={0.85}>
                  <Text style={s.rosterRetryText}>Retry</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <View style={s.cardWrap}>
                  <SelectionCard selection={selection} />
                </View>

                <View style={s.summaryRow}>
                  <View style={s.summaryChip}>
                    <VectorIcon iconSet="Ionicons" iconName="create" size={14} color={theme.colors.primary} />
                    <Text style={s.summaryText}>
                      {enteredCount} of {students.length} entered
                    </Text>
                  </View>
                  <View style={[s.summaryChip, s.summaryChipAlt]}>
                    <VectorIcon iconSet="Ionicons" iconName="stats-chart" size={14} color={theme.colors.secondary} />
                    <Text style={[s.summaryText, { color: theme.colors.secondary }]}>
                      Avg {average}/{maxMarks}
                    </Text>
                  </View>
                </View>

                <View style={s.listHeader}>
                  <Text style={[s.listHeaderText, { flex: 1 }]}>Student</Text>
                  <Text style={[s.listHeaderText, s.colMarks]}>Marks</Text>
                  <Text style={[s.listHeaderText, s.colTotal]}>Total</Text>
                </View>
              </>
            )}
          </>
        }
        ListFooterComponent={
          ready && !loadingStudents && !studentsError && students.length > 0 ? (
            <TouchableOpacity
              style={s.submitBtn}
              onPress={handleSubmit}
              activeOpacity={0.85}
            >
              <VectorIcon
                iconSet="Ionicons"
                iconName="arrow-forward-circle"
                size={18}
                color="#fff"
              />
              <Text style={s.submitText}>Submit & Manage</Text>
            </TouchableOpacity>
          ) : null
        }
      />
    </KeyboardAvoidingView>
  );
};

export default UploadMarksScreen;

const __mk_s = () => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.colors.background },
  list: { paddingHorizontal: theme.spacing.lg, paddingTop: 14, paddingBottom: 30 },

  cardWrap: { marginTop: theme.spacing.md },

  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.xs,
  },
  summaryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: theme.colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: theme.radius.full,
  },
  summaryChipAlt: { backgroundColor: '#E0F2FE' },
  summaryText: { fontSize: 12, fontWeight: '700', color: theme.colors.primary },

  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    marginBottom: 4,
  },
  listHeaderText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.textMuted,
  },
  colMarks: { width: 64, textAlign: 'center' },
  colTotal: { width: 64, textAlign: 'right' },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  rollNo: { fontSize: 12, color: theme.colors.textMuted, width: 22 },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 14, fontWeight: '700', color: theme.colors.primary },
  studentName: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.textPrimary,
    flex: 1,
  },

  marksInput: {
    width: 56,
    height: 38,
    borderRadius: theme.radius.sm,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    paddingVertical: 0,
    marginRight: 8,
  },
  marksInputFilled: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primaryLight,
  },

  totalCell: { width: 64, textAlign: 'right' },
  totalValue: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.textPrimary,
  },
  totalMax: { fontSize: 12, fontWeight: '600', color: theme.colors.textMuted },

  promptBox: { alignItems: 'center', paddingTop: 50, paddingHorizontal: 30 },
  promptIconRing: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  promptTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.textPrimary,
    marginBottom: 4,
  },
  promptSub: {
    fontSize: 13,
    color: theme.colors.textMuted,
    textAlign: 'center',
    lineHeight: 19,
  },

  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.colors.primary,
    paddingVertical: 15,
    borderRadius: theme.radius.sm,
    marginTop: theme.spacing.lg,
  },
  submitText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  rosterRetry: {
    marginTop: 10,
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
    borderRadius: theme.radius.full,
    paddingHorizontal: 20,
    paddingVertical: 7,
  },
  rosterRetryText: { fontSize: 13, fontWeight: '700', color: theme.colors.primary },
});


// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
