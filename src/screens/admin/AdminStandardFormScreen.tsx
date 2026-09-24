import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppDialog } from '../../components/AppDialog';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import {
  LookupClass,
  createClass,
  createSection,
  createSubject,
  getAcademicLookups,
  updateClass,
  updateSection,
  updateSubject,
} from '../../api/adminStandardApi';
import { DocHeader } from '../more/docUi';
import { SubjectIcon } from '../subjects/subjectIcon';
import { ChipChoices, FieldLabel, FormCard, FormError, Hint, OptionSheet, PickerCard, SubmitButton, SwitchRow } from './adminFormUi';

/**
 * Add or edit a class, a section or a subject — the panel's Academic
 * Structure form, field for field:
 *   Class    its name, its code (the next one suggested; roll numbers start
 *            with its last digit), its display order (blank goes last) and
 *            whether it is active.
 *   Section  its name — once per class — its class, and whether it is active.
 *   Subject  its name, its class and the sections of it that have it (a name
 *            the class already has just gains the sections it lacked), whether
 *            it is mandatory and active; its icon comes from its name. Edited
 *            into another class, it moves out of the one it was opened in.
 */

type StdType = 'class' | 'section' | 'subject';
const TITLES: Record<StdType, string> = { class: 'Class', section: 'Section', subject: 'Subject' };

const AdminStandardFormScreen = ({ navigation, route }: any) => {
  const type: StdType = route?.params?.type ?? 'class';
  const id: number | undefined = route?.params?.id;
  const item = route?.params?.item;
  const presetClassId: number | undefined = route?.params?.presetClassId;
  const presetSectionId: number | undefined = route?.params?.presetSectionId;
  // The class a subject was opened in — the panel's "moves out of this one".
  const fromClassId: number | undefined = route?.params?.fromClassId ?? item?.standard_id ?? undefined;
  const isEdit = !!id;

  const [classes, setClasses] = useState<LookupClass[]>([]);
  const [name, setName] = useState<string>(item?.name ?? '');
  const [code, setCode] = useState<string>(item?.code ?? '');
  const [order, setOrder] = useState<string>(item?.order != null ? String(item.order) : '');
  const [active, setActive] = useState<boolean>(item?.is_active ?? true);
  const [classId, setClassId] = useState<number | null>(
    type === 'subject' ? fromClassId ?? presetClassId ?? null : item?.standard_id ?? presetClassId ?? null,
  );
  const [mandatory, setMandatory] = useState<boolean>(item?.is_mandatory ?? true);
  const [sectionIds, setSectionIds] = useState<number[]>(item?.section_ids ?? (presetSectionId ? [presetSectionId] : []));
  const [classSheet, setClassSheet] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');

  useEffect(() => {
    getAcademicLookups()
      .then(r => {
        setClasses(r.classes ?? []);
        // A new class opens with the next code suggested, as the panel's does.
        if (type === 'class' && !isEdit) setCode(prev => prev || r.next_code || '');
        // A class from before codes existed opens with the next one suggested too.
        if (type === 'class' && isEdit && !item?.code) setCode(prev => prev || r.next_code || '');
      })
      .catch(() => {});
  }, [type, isEdit, item?.code]);

  const cls = classes.find(c => c.id === classId) ?? null;
  const sections = cls?.sections ?? [];
  // Only this class's sections count — ticked ones of another class drop off.
  const picked = sectionIds.filter(sid => sections.some(x => x.id === sid));

  const pickClass = (k: string) => {
    setClassSheet(false);
    setClassId(Number(k));
    setError('');
  };

  const toggleSection = (k: string) => {
    const sid = Number(k);
    setSectionIds(prev => (prev.includes(sid) ? prev.filter(x => x !== sid) : [...prev, sid]));
    setError('');
  };

  // "code 03 gives 301, 302, 303…"
  const rollDigit = (code.replace(/\D/g, '') || '0').slice(-1);

  const save = async () => {
    const n = name.trim();
    if (!n) return setError(`Enter the ${TITLES[type].toLowerCase()} name.`);
    if (type === 'class') {
      if (!code.trim()) return setError('Please enter a class code.');
      if (order.trim() && !/^\d{1,6}$/.test(order.trim())) return setError('Display order must be a whole number.');
    }
    if (type !== 'class' && !classId) return setError('Please select a class.');
    if (type === 'subject' && picked.length === 0) return setError('Please select at least one section.');

    setSaving(true);
    try {
      let res: any;
      if (type === 'class') {
        const p = { name: n, code: code.trim(), order: order.trim() ? Number(order) : undefined, is_active: active };
        res = isEdit ? await updateClass(id!, p) : await createClass(p);
      } else if (type === 'section') {
        const p = { name: n, standard_id: classId!, is_active: active };
        res = isEdit ? await updateSection(id!, p) : await createSection(p);
      } else {
        const p = {
          name: n,
          standard_id: classId!,
          from_standard_id: isEdit ? fromClassId ?? null : null,
          section_ids: picked,
          is_mandatory: mandatory,
          is_active: active,
        };
        res = isEdit ? await updateSubject(id!, p) : await createSubject(p);
      }
      setSavedMsg(
        typeof res?.message === 'string'
          ? res.message
          : `${TITLES[type]} ${isEdit ? 'updated' : type === 'subject' ? 'saved' : 'created'} successfully!`,
      );
    } catch (e) {
      setError(apiErr(e, `Could not save this ${TITLES[type].toLowerCase()}.`));
    } finally {
      setSaving(false);
    }
  };

  const closeSaved = () => {
    setSavedMsg('');
    navigation.goBack();
  };

  const classPicker = (
    <PickerCard label="Class" value={cls?.name ?? null} placeholder="Select class" onPress={() => setClassSheet(true)} />
  );

  return (
    <View style={s.root}>
      <DocHeader
        title={type === 'class' && isEdit ? 'Edit Standard' : `${isEdit ? 'Edit' : 'Add'} ${TITLES[type]}`}
        onBackPress={() => navigation.goBack()}
      />
      <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          {type === 'class' && (
            <>
              <FormCard label="Class name" value={name} onChangeText={v => { setName(v); setError(''); }} placeholder="e.g. Class 10" maxLength={255} />
              <View>
                <FormCard
                  label="Class code"
                  value={code}
                  onChangeText={v => { setCode(v); setError(''); }}
                  placeholder="01"
                  maxLength={10}
                  autoCapitalize="characters"
                />
                <Hint>{`Roll numbers for this class start with the last digit of the code — code ${code.trim() || '—'} gives ${rollDigit}01, ${rollDigit}02, ${rollDigit}03…`}</Hint>
              </View>
              <FormCard
                label="Display order"
                value={order}
                onChangeText={v => { setOrder(v.replace(/[^\d]/g, '')); setError(''); }}
                placeholder="Left blank, it goes last"
                keyboardType="number-pad"
                maxLength={6}
              />
            </>
          )}

          {type === 'section' && (
            <>
              <FormCard label="Section name" value={name} onChangeText={v => { setName(v); setError(''); }} placeholder="e.g. A" maxLength={255} />
              {classPicker}
            </>
          )}

          {type === 'subject' && (
            <>
              <FormCard label="Subject name" value={name} onChangeText={v => { setName(v); setError(''); }} placeholder="e.g. Mathematics" maxLength={255} />
              {classPicker}
              <View style={s.group}>
                <FieldLabel>Sections</FieldLabel>
                {!cls ? (
                  <Hint>Select a class first.</Hint>
                ) : sections.length === 0 ? (
                  <Hint>No sections in this class.</Hint>
                ) : (
                  <ChipChoices
                    options={sections.map(x => ({ key: String(x.id), label: x.name }))}
                    selected={picked.map(String)}
                    onToggle={toggleSection}
                  />
                )}
              </View>
              <View style={s.iconRow}>
                {isEdit && item?.image_url ? <SubjectIcon image={item.image_url} size={36} /> : null}
                <Text style={s.iconText}>The icon is picked from the subject’s name. One it doesn’t recognise gets the plain icon.</Text>
              </View>
              <SwitchRow label="Mandatory subject" value={mandatory} onValueChange={setMandatory} />
            </>
          )}

          <SwitchRow label="Active" value={active} onValueChange={setActive} />

          <FormError>{error}</FormError>
          <SubmitButton label={`${isEdit ? 'Update' : 'Create'} ${TITLES[type].toLowerCase()}`} busy={saving} onPress={save} />
        </ScrollView>
      </KeyboardAvoidingView>

      <OptionSheet
        visible={classSheet}
        title="Class"
        options={classes.map(c => ({ key: String(c.id), label: c.name }))}
        selected={cls ? [String(cls.id)] : []}
        onPick={pickClass}
        onClose={() => setClassSheet(false)}
        emptyText="No classes yet."
      />
      <AppDialog visible={!!savedMsg} title="Saved" message={savedMsg} actions={[{ text: 'Done', onPress: closeSaved }]} onRequestClose={closeSaved} />
    </View>
  );
};

export default AdminStandardFormScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  flex: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 40, gap: 14 },
  group: { gap: 8 },
  iconRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconText: { flex: 1, fontSize: 12, color: theme.colors.textMuted, lineHeight: 17 },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
