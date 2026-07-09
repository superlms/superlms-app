import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Header from '../../components/Header';
import Select from '../../components/Select';
import { theme } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { Field, ToggleRow, ChipPicker } from './AdminStandardScreen';
import {
  AdminClass,
  AdminSection,
  createClass,
  createSection,
  createSubject,
  getClasses,
  getSections,
  updateClass,
  updateSection,
  updateSubject,
} from '../../api/adminStandardApi';

type StdType = 'class' | 'section' | 'subject';
const TITLES: Record<StdType, string> = { class: 'Class', section: 'Section', subject: 'Subject' };

const AdminStandardFormScreen = ({ navigation, route }: any) => {
  const type: StdType = route?.params?.type ?? 'class';
  const id: number | undefined = route?.params?.id;
  const item = route?.params?.item;
  const presetClassId: number | undefined = route?.params?.presetClassId;
  const presetSectionId: number | undefined = route?.params?.presetSectionId;
  const isEdit = !!id;

  const [classes, setClasses] = useState<AdminClass[]>([]);
  const [sections, setSections] = useState<AdminSection[]>([]);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState(item?.name ?? '');
  const [code, setCode] = useState(item?.code ?? '');
  const [order, setOrder] = useState(item?.order != null ? String(item.order) : '');
  const [desc, setDesc] = useState(item?.description ?? '');
  const [active, setActive] = useState(item?.is_active ?? true);
  const [classId, setClassId] = useState<number | null>(item?.standard_id ?? presetClassId ?? null);
  const [mandatory, setMandatory] = useState(item?.is_mandatory ?? true);
  const [sectionIds, setSectionIds] = useState<number[]>(
    item?.section_ids ?? (presetSectionId ? [presetSectionId] : []),
  );

  useEffect(() => {
    getClasses().then(r => {
      setClasses(r.standards);
      // Default a class when creating a section/subject with none preset.
      setClassId(prev => prev ?? (type !== 'class' ? r.standards[0]?.id ?? null : null));
    }).catch(() => {});
  }, [type]);

  useEffect(() => {
    if (type === 'subject' && classId) {
      getSections({ standard_id: classId }).then(r => setSections(r.sections)).catch(() => setSections([]));
    }
  }, [type, classId]);

  const onClassChange = (cid: number) => {
    setClassId(cid);
    if (type === 'subject') setSectionIds([]);
  };
  const toggleSection = (sid: number) =>
    setSectionIds(prev => (prev.includes(sid) ? prev.filter(x => x !== sid) : [...prev, sid]));

  const save = async () => {
    if (!name.trim() || !code.trim()) return Alert.alert('Required', 'Name and code are required.');
    if (type !== 'class' && !classId) return Alert.alert('Required', 'Please select a class.');
    if (type === 'subject' && sectionIds.length === 0) return Alert.alert('Required', 'Select at least one section.');

    setSaving(true);
    try {
      if (type === 'class') {
        const p = { name: name.trim(), code: code.trim(), order: order ? Number(order) : undefined, is_active: active };
        isEdit ? await updateClass(id!, p) : await createClass(p);
      } else if (type === 'section') {
        const p = { name: name.trim(), code: code.trim(), description: desc.trim(), standard_id: classId!, is_active: active };
        isEdit ? await updateSection(id!, p) : await createSection(p);
      } else {
        const p = {
          name: name.trim(), code: code.trim(), description: desc.trim(),
          standard_id: classId!, section_ids: sectionIds,
          is_mandatory: mandatory, is_active: active,
        };
        isEdit ? await updateSubject(id!, p) : await createSubject(p);
      }
      Alert.alert('Success', `${TITLES[type]} ${isEdit ? 'updated' : 'created'} successfully.`);
      navigation.goBack();
    } catch (e) {
      Alert.alert('Error', apiErr(e, `Could not save ${type}.`));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={s.root}>
      <Header title={`${isEdit ? 'Edit' : 'New'} ${TITLES[type]}`} onBackPress={() => navigation.goBack()} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          {type !== 'class' && (
            <Select label="Class" placeholder="Select class" value={classId}
              options={classes.map(c => ({ label: c.name, value: c.id }))}
              onChange={(v) => onClassChange(Number(v))} />
          )}

          <Field label={`${TITLES[type]} Name`} value={name} onChangeText={setName}
            placeholder={type === 'class' ? 'e.g. Class 10' : type === 'section' ? 'e.g. A' : 'e.g. Mathematics'} />
          <Field label={`${TITLES[type]} Code`} value={code} onChangeText={setCode}
            placeholder={type === 'class' ? 'e.g. 10' : type === 'section' ? 'e.g. A' : 'e.g. MATH'} />

          {type === 'class' && (
            <Field label="Display Order" value={order} onChangeText={setOrder} placeholder="0" keyboardType="number-pad" />
          )}
          {type !== 'class' && (
            <Field label="Description" value={desc} onChangeText={setDesc} placeholder="Optional" multiline />
          )}

          {type === 'subject' && (
            <>
              <Text style={s.fieldLabel}>Sections (select one or more)</Text>
              <ChipPicker multi items={sections.map(x => ({ id: x.id, label: x.name }))} selected={sectionIds} onToggle={toggleSection} />
              <ToggleRow label="Mandatory" value={mandatory} onValueChange={setMandatory} />
            </>
          )}

          <ToggleRow label="Active" value={active} onValueChange={setActive} />

          <TouchableOpacity style={[s.saveBtn, saving && { opacity: 0.7 }]} onPress={save} disabled={saving} activeOpacity={0.9}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveBtnText}>{isEdit ? `Update ${TITLES[type]}` : `Create ${TITLES[type]}`}</Text>}
          </TouchableOpacity>
          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

export default AdminStandardFormScreen;

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  scroll: { padding: 16 },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary, marginTop: 12, marginBottom: 6 },
  saveBtn: { marginTop: 22, height: 50, borderRadius: 14, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center' },
  saveBtnText: { fontSize: 15, fontWeight: '800', color: '#fff' },
});
