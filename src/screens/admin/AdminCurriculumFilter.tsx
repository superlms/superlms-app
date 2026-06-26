import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { theme } from '../../utils/theme';
import { getAcademicLookups, LookupClass } from '../../api/adminStandardApi';
import { getCurriculumSubjects, CurriculumSubject } from '../../api/adminCurriculumApi';

export interface CurriculumSelection {
  standardId: number | null;
  sectionId: number | null;
  subjectId: number | null;
}

interface Props {
  onChange: (sel: CurriculumSelection) => void;
}

// Class → Section (optional) → Subject cascading chip filter shared by the
// Syllabus, Content and Quiz screens. Section is optional; picking a class then
// a subject is enough to load a list.
const AdminCurriculumFilter = ({ onChange }: Props) => {
  const [classes, setClasses] = useState<LookupClass[]>([]);
  const [subjects, setSubjects] = useState<CurriculumSubject[]>([]);
  const [standardId, setStandardId] = useState<number | null>(null);
  const [sectionId, setSectionId] = useState<number | null>(null);
  const [subjectId, setSubjectId] = useState<number | null>(null);

  useEffect(() => {
    getAcademicLookups().then(r => setClasses(r.classes)).catch(() => setClasses([]));
  }, []);

  const emit = (s: number | null, sec: number | null, sub: number | null) =>
    onChange({ standardId: s, sectionId: sec, subjectId: sub });

  const loadSubjects = async (s: number, sec: number | null) => {
    try {
      setSubjects(await getCurriculumSubjects(s, sec));
    } catch {
      setSubjects([]);
    }
  };

  const pickClass = async (id: number) => {
    setStandardId(id);
    setSectionId(null);
    setSubjectId(null);
    emit(id, null, null);
    await loadSubjects(id, null);
  };

  const pickSection = async (id: number | null) => {
    setSectionId(id);
    setSubjectId(null);
    emit(standardId, id, null);
    if (standardId) await loadSubjects(standardId, id);
  };

  const pickSubject = (id: number) => {
    setSubjectId(id);
    emit(standardId, sectionId, id);
  };

  const sections = classes.find(c => c.id === standardId)?.sections ?? [];

  const Row = ({ label, children }: any) => (
    <View style={s.row}>
      <Text style={s.label}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
        {children}
      </ScrollView>
    </View>
  );

  const Chip = ({ active, text, onPress }: any) => (
    <TouchableOpacity style={[s.chip, active && s.chipActive]} onPress={onPress} activeOpacity={0.8}>
      <Text style={[s.chipText, active && s.chipTextActive]}>{text}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={s.wrap}>
      <Row label="Class">
        {classes.map(c => <Chip key={c.id} active={standardId === c.id} text={c.name} onPress={() => pickClass(c.id)} />)}
        {classes.length === 0 && <Text style={s.empty}>No classes</Text>}
      </Row>
      {!!standardId && (
        <Row label="Section">
          <Chip active={sectionId === null} text="All" onPress={() => pickSection(null)} />
          {sections.map(sec => <Chip key={sec.id} active={sectionId === sec.id} text={sec.name} onPress={() => pickSection(sec.id)} />)}
        </Row>
      )}
      {!!standardId && (
        <Row label="Subject">
          {subjects.map(sub => <Chip key={sub.id} active={subjectId === sub.id} text={sub.name} onPress={() => pickSubject(sub.id)} />)}
          {subjects.length === 0 && <Text style={s.empty}>No subjects</Text>}
        </Row>
      )}
    </View>
  );
};

export default AdminCurriculumFilter;

const s = StyleSheet.create({
  wrap: { paddingHorizontal: 16, paddingTop: 10, gap: 8 },
  row: { gap: 6 },
  label: { fontSize: 11, fontWeight: '800', color: theme.colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 },
  chips: { gap: 8, paddingRight: 8, alignItems: 'center' },
  chip: { paddingHorizontal: 13, paddingVertical: 6, borderRadius: theme.radius.full, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border },
  chipActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  chipText: { fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary },
  chipTextActive: { color: '#fff' },
  empty: { fontSize: 12, color: theme.colors.textMuted, paddingVertical: 4 },
});
