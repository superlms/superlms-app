import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import VectorIcon from '../../components/VectorIcon';
import Header from '../../components/Header';
import { theme } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { ChipPicker } from './AdminStandardScreen';
import { SyllabusGroup, SyllabusOptions, getSyllabusOptions, saveSyllabus } from '../../api/adminExamApi';

const AdminExamSyllabusFormScreen = ({ navigation, route }: any) => {
  const group: SyllabusGroup | undefined = route.params?.group;

  const [opt, setOpt] = useState<SyllabusOptions | null>(null);
  const [exam, setExam] = useState<number | null>(group?.exam_id ?? null);
  const [std, setStd] = useState<number | null>(group?.standard_id ?? null);
  const [sec, setSec] = useState<number | null>(group?.section_id ?? null);
  const [sub, setSub] = useState<number | null>(group?.subject_id ?? null);
  const [chapters, setChapters] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async (next: { exam?: number | null; std?: number | null; sec?: number | null; sub?: number | null } = {}) => {
    const e = next.exam !== undefined ? next.exam : exam;
    const c = next.std !== undefined ? next.std : std;
    const se = next.sec !== undefined ? next.sec : sec;
    const su = next.sub !== undefined ? next.sub : sub;
    const o = await getSyllabusOptions({ exam_id: e ?? undefined, standard_id: c ?? undefined, section_id: se ?? undefined, subject_id: su ?? undefined });
    setOpt(o);
    if (o.selected_chapter_ids) setChapters(o.selected_chapter_ids);
  }, [exam, std, sec, sub]);

  useEffect(() => { refresh().catch(e => Alert.alert('Error', apiErr(e, 'Could not load options.'))); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onExam = (id: number) => { setExam(id); refresh({ exam: id }); };
  const onStd = (id: number) => { setStd(id); setSec(null); setSub(null); setChapters([]); refresh({ std: id, sec: null, sub: null }); };
  const onSec = (id: number) => { setSec(id); setSub(null); setChapters([]); refresh({ sec: id, sub: null }); };
  const onSub = (id: number) => { setSub(id); setChapters([]); refresh({ sub: id }); };
  const toggleChapter = (id: number) => setChapters(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));

  const save = async () => {
    if (!exam || !std || !sub || chapters.length === 0) {
      return Alert.alert('Required', 'Exam, class, subject and at least one chapter are required.');
    }
    setSaving(true);
    try {
      await saveSyllabus({ exam_id: exam, standard_id: std, section_id: sec, subject_id: sub, chapter_ids: chapters });
      navigation.goBack();
    } catch (e) {
      Alert.alert('Error', apiErr(e, 'Could not save syllabus.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={s.root}>
      <Header title="Map Syllabus" onBackPress={() => navigation.goBack()} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {!opt ? (
          <View style={s.loader}><ActivityIndicator size="large" color={theme.colors.primary} /></View>
        ) : (
          <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
            <Text style={s.label}>Exam</Text>
            <ChipPicker items={opt.exams.map(e => ({ id: e.id, label: e.exam_name }))} selected={exam ? [exam] : []} onToggle={onExam} />
            <Text style={s.label}>Class</Text>
            <ChipPicker items={opt.standards.map(x => ({ id: x.id, label: x.name }))} selected={std ? [std] : []} onToggle={onStd} />
            <Text style={s.label}>Section</Text>
            <ChipPicker items={opt.sections.map(x => ({ id: x.id, label: x.name }))} selected={sec ? [sec] : []} onToggle={onSec} />
            <Text style={s.label}>Subject</Text>
            <ChipPicker items={opt.subjects.map(x => ({ id: x.id, label: x.name }))} selected={sub ? [sub] : []} onToggle={onSub} />
            <Text style={s.label}>Chapters</Text>
            {opt.chapters.length === 0 && <Text style={s.note}>Pick exam, class & subject to list chapters.</Text>}
            {opt.chapters.map(ch => {
              const active = chapters.includes(ch.id);
              const ownedElsewhere = ch.owning_exam_id && ch.owning_exam_id !== exam;
              return (
                <TouchableOpacity key={ch.id} style={[s.chapRow, active && s.chapRowActive]} onPress={() => toggleChapter(ch.id)} activeOpacity={0.8}>
                  <VectorIcon iconSet="Ionicons" iconName={active ? 'checkbox' : 'square-outline'} size={18} color={active ? theme.colors.primary : theme.colors.textMuted} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.chapName}>{ch.name}</Text>
                    {!!ownedElsewhere && <Text style={s.chapOwned}>In: {ch.owning_exam_name}</Text>}
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
        {!!opt && (
          <View style={s.footer}>
            <TouchableOpacity style={s.saveBtn} onPress={save} activeOpacity={0.9} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveText}>Save Syllabus</Text>}
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </View>
  );
};

export default AdminExamSyllabusFormScreen;

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 16 },
  label: { fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary, marginTop: 12, marginBottom: 6 },
  note: { fontSize: 11, color: theme.colors.textMuted, marginTop: 6 },
  chapRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, paddingHorizontal: 10, borderRadius: 10, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.card, marginBottom: 6 },
  chapRowActive: { borderColor: theme.colors.primary, backgroundColor: theme.colors.primaryLight },
  chapName: { fontSize: 13, fontWeight: '600', color: theme.colors.textPrimary },
  chapOwned: { fontSize: 10, color: '#F59E0B', marginTop: 1 },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: theme.colors.border, backgroundColor: theme.colors.card },
  saveBtn: { height: 52, borderRadius: 14, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center' },
  saveText: { fontSize: 16, fontWeight: '800', color: '#fff' },
});
