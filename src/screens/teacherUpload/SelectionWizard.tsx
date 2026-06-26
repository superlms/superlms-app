import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import VectorIcon from '../../components/VectorIcon';
import { theme, onThemeChange } from '../../utils/theme';
import {
  ClassOption,
  ExamOption,
  isComplete,
  OptionItem,
  Selection,
  SubjectOption,
} from './uploadData';
import {
  getExams,
  getTeacherClassesSubjects,
  marksErrorMessage,
  type ClassSubject,
} from '../../api/marksApi';

type Step = 'exam' | 'cls' | 'subject';
const STEP_ORDER: Step[] = ['exam', 'cls', 'subject'];
const STEP_LABEL: Record<Step, { label: string; icon: string }> = {
  exam: { label: 'Exam', icon: 'documents-outline' },
  cls: { label: 'Class', icon: 'people-outline' },
  subject: { label: 'Subject', icon: 'book-outline' },
};

interface Props {
  value: Selection;
  onChange: (next: Selection) => void;
}

// Single dropdown that walks Exam → Class → Subject using live teacher data.
const SelectionWizard = ({ value, onChange }: Props) => {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>('exam');
  const [draft, setDraft] = useState<Selection>(value);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [examOptions, setExamOptions] = useState<ExamOption[]>([]);
  const [triples, setTriples] = useState<ClassSubject[]>([]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [exams, cs] = await Promise.all([
        getExams(),
        getTeacherClassesSubjects(),
      ]);
      setExamOptions(
        exams.map(e => ({
          id: String(e.id),
          label: e.academic_year ? `${e.exam_name} (${e.academic_year})` : e.exam_name,
          examId: e.id,
          totalMarks: Number(e.total_marks ?? 100) || 100,
        })),
      );
      setTriples(cs);
    } catch (e: any) {
      setError(marksErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Distinct classes (standard + section) from the teacher's triples
  const classOptions: ClassOption[] = useMemo(() => {
    const map = new Map<string, ClassOption>();
    triples.forEach(t => {
      const id = `${t.standard_id}:${t.section_id}`;
      if (!map.has(id)) {
        map.set(id, {
          id,
          label: `${t.standard_name} · ${t.section_name}`,
          standardId: t.standard_id,
          sectionId: t.section_id,
        });
      }
    });
    return Array.from(map.values());
  }, [triples]);

  // Subjects available for the class currently chosen in the draft
  const subjectOptions: SubjectOption[] = useMemo(() => {
    if (!draft.cls) return [];
    const map = new Map<number, SubjectOption>();
    triples
      .filter(t => t.standard_id === draft.cls!.standardId && t.section_id === draft.cls!.sectionId)
      .forEach(t => {
        if (!map.has(t.subject_id)) {
          map.set(t.subject_id, { id: String(t.subject_id), label: t.subject_name, subjectId: t.subject_id });
        }
      });
    return Array.from(map.values());
  }, [triples, draft.cls]);

  const options: OptionItem[] =
    step === 'exam' ? examOptions : step === 'cls' ? classOptions : subjectOptions;

  const startFlow = () => {
    setDraft({ exam: null, cls: null, subject: null });
    setStep('exam');
    setOpen(true);
  };

  const pick = (option: OptionItem) => {
    if (step === 'exam') {
      setDraft(d => ({ ...d, exam: option as ExamOption, cls: null, subject: null }));
      setStep('cls');
    } else if (step === 'cls') {
      setDraft(d => ({ ...d, cls: option as ClassOption, subject: null }));
      setStep('subject');
    } else {
      onChange({ ...draft, subject: option as SubjectOption });
      setOpen(false);
    }
  };

  const triggerLabel = isComplete(value)
    ? 'Change selection'
    : 'Select Exam → Class → Subject';

  const stepIndex = STEP_ORDER.indexOf(step);
  const meta = STEP_LABEL[step];

  return (
    <View style={s.wrap}>
      <TouchableOpacity
        style={s.trigger}
        activeOpacity={0.85}
        onPress={() => (open ? setOpen(false) : startFlow())}
      >
        <View style={s.triggerIcon}>
          <VectorIcon iconSet="Ionicons" iconName="funnel-outline" size={16} color={theme.colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.triggerLabel}>Selection</Text>
          <Text style={s.triggerValue} numberOfLines={1}>{triggerLabel}</Text>
        </View>
        <VectorIcon iconSet="Ionicons" iconName={open ? 'chevron-up' : 'chevron-down'} size={18} color={theme.colors.textMuted} />
      </TouchableOpacity>

      {open && (
        <View style={s.panel}>
          {/* Breadcrumb */}
          <View style={s.crumbs}>
            {STEP_ORDER.map((st, i) => {
              const done = i < stepIndex;
              const active = st === step;
              const picked =
                st === 'exam' ? draft.exam?.label : st === 'cls' ? draft.cls?.label : draft.subject?.label;
              return (
                <React.Fragment key={st}>
                  {i > 0 && (
                    <VectorIcon iconSet="Ionicons" iconName="chevron-forward" size={12} color={theme.colors.textMuted} />
                  )}
                  <View style={[s.crumb, active && s.crumbActive, done && s.crumbDone]}>
                    {done && <VectorIcon iconSet="Ionicons" iconName="checkmark" size={11} color={theme.colors.success} />}
                    <Text style={[s.crumbText, active && s.crumbTextActive, done && s.crumbTextDone]} numberOfLines={1}>
                      {done && picked ? picked : STEP_LABEL[st].label}
                    </Text>
                  </View>
                </React.Fragment>
              );
            })}
          </View>

          {/* Step hint */}
          <View style={s.hintRow}>
            <VectorIcon iconSet="Ionicons" iconName={meta.icon} size={14} color={theme.colors.primary} />
            <Text style={s.hintText}>Step {stepIndex + 1} of 3 · Choose {meta.label}</Text>
          </View>

          {/* Options / states */}
          {loading ? (
            <View style={s.stateBox}><ActivityIndicator color={theme.colors.primary} /></View>
          ) : error ? (
            <View style={s.stateBox}>
              <Text style={s.stateText}>{error}</Text>
              <TouchableOpacity style={s.retryBtn} onPress={loadData} activeOpacity={0.85}>
                <Text style={s.retryText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : options.length === 0 ? (
            <View style={s.stateBox}>
              <Text style={s.stateText}>
                {step === 'exam'
                  ? 'No exams available.'
                  : step === 'cls'
                  ? 'No classes assigned to you.'
                  : 'No subjects for this class.'}
              </Text>
            </View>
          ) : (
            <View style={s.options}>
              {options.map((o, i) => (
                <TouchableOpacity
                  key={o.id}
                  style={[s.option, i === options.length - 1 && s.optionLast]}
                  activeOpacity={0.7}
                  onPress={() => pick(o)}
                >
                  <Text style={s.optionText}>{o.label}</Text>
                  <VectorIcon iconSet="Ionicons" iconName="chevron-forward" size={16} color={theme.colors.textMuted} />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      )}
    </View>
  );
};

export default SelectionWizard;

const __mk_s = () => StyleSheet.create({
  wrap: { zIndex: 99 },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 12,
    elevation: 2,
  },
  triggerIcon: {
    width: 38,
    height: 38,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  triggerLabel: { fontSize: 11, color: theme.colors.textMuted, fontWeight: '500' },
  triggerValue: { fontSize: 14, fontWeight: '700', color: theme.colors.textPrimary, marginTop: 1 },

  panel: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginTop: 6,
    overflow: 'hidden',
    elevation: 4,
  },
  crumbs: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.md,
  },
  crumb: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    maxWidth: 150,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  crumbActive: { backgroundColor: theme.colors.primaryLight, borderColor: theme.colors.primary },
  crumbDone: { backgroundColor: '#DCFCE7', borderColor: '#BBF7D0' },
  crumbText: { fontSize: 11, fontWeight: '700', color: theme.colors.textSecondary, flexShrink: 1 },
  crumbTextActive: { color: theme.colors.primary },
  crumbTextDone: { color: theme.colors.success },

  hintRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: theme.spacing.md, paddingVertical: 10 },
  hintText: { fontSize: 12, fontWeight: '600', color: theme.colors.textSecondary },

  options: { borderTopWidth: 1, borderTopColor: theme.colors.border },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  optionLast: { borderBottomWidth: 0 },
  optionText: { fontSize: 14, fontWeight: '600', color: theme.colors.textPrimary, flex: 1, paddingRight: 8 },

  stateBox: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 22,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  stateText: { fontSize: 13, color: theme.colors.textSecondary, textAlign: 'center', fontWeight: '500' },
  retryBtn: {
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
    borderRadius: theme.radius.full,
    paddingHorizontal: 20,
    paddingVertical: 7,
  },
  retryText: { fontSize: 13, fontWeight: '700', color: theme.colors.primary },
});


// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
