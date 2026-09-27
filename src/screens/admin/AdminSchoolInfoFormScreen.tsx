import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Image, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated from 'react-native-reanimated';
import VectorIcon from '../../components/VectorIcon';
import { Skeleton } from '../../components/Skeleton';
import { AppAlert } from '../../components/AppDialog';
import { useFocusLoad } from '../../hooks/useRefresh';
import { useKeyboardLiftStyle } from '../../hooks/useKeyboardLift';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import {
  CustomSection,
  ManagementMember,
  SchoolDocument,
  SchoolInfoData,
  deleteDocument,
  deleteMember,
  getAdminProfile,
  updateSchoolInfo,
} from '../../api/adminProfileApi';
import { DocHeader } from '../more/docUi';
import { FormField, FormSection } from '../teacherStudents/studentFormUi';
import { FormError, Hint, SubmitButton, confirmDestructive } from './adminFormUi';
import { schoolInfoErrors, useRevealFocused } from './adminProfileUi';

/**
 * Edit School Profile — the panel's School Info form, drawn as Add Student is:
 * a small heading over each block, then fields that are an outline and
 * nothing else. It holds what the panel's form holds, in its order: About,
 * Vision, Mission, Values and Goals; the school's own sections (Add Section,
 * and a section taken off asks first); the contact (email, mobile, website,
 * address, website description); the management team and the documents.
 * Save All Changes checks what the panel checks and saves the text; a member
 * or a document is saved as soon as it is added, changed or removed (its own
 * page), and the lists here follow without the typing being lost.
 */

// Every box here wears the accent's outline once it holds something.
const Field = (props: any) => <FormField markFilled {...props} />;

const TEXT_KEYS: (keyof SchoolInfoData)[] = [
  'about_school',
  'website_info',
  'website_url',
  'school_email',
  'school_mobile',
  'school_address',
  'school_document_text',
  'usm_vision',
  'usm_mission',
  'usm_values',
  'usm_goals',
];

const AdminSchoolInfoFormScreen = ({ navigation }: any) => {
  const [info, setInfo] = useState<SchoolInfoData>({ custom_sections: [] });
  const [team, setTeam] = useState<ManagementMember[]>([]);
  const [docs, setDocs] = useState<SchoolDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const textLoaded = useRef(false);

  const lift = useKeyboardLiftStyle();
  const { ref: scrollRef, scrollProps } = useRevealFocused();

  // The text once, when the page opens; the team and the documents each time
  // it comes back into view (from a member's or a document's page), so what
  // has been typed stays.
  const load = useCallback(async () => {
    try {
      const p = await getAdminProfile();
      if (!textLoaded.current) {
        const next: SchoolInfoData = { custom_sections: p.school_info?.custom_sections ?? [] };
        TEXT_KEYS.forEach(k => {
          (next as any)[k] = (p.school_info as any)?.[k] ?? '';
        });
        setInfo(next);
        textLoaded.current = true;
      }
      setTeam(p.management_team ?? []);
      setDocs(p.documents ?? []);
    } catch (e) {
      if (!textLoaded.current) {
        AppAlert.alert('Error', apiErr(e, 'Could not load school info.'));
        navigation.goBack();
      }
    } finally {
      setLoading(false);
    }
  }, [navigation]);

  useFocusLoad(load);

  const setField = (k: keyof SchoolInfoData, v: string) => {
    setInfo(prev => ({ ...prev, [k]: v }));
    setError('');
  };

  // ── The school's own sections ──
  const sections = info.custom_sections ?? [];
  const addSection = () =>
    setInfo(prev => ({ ...prev, custom_sections: [...(prev.custom_sections ?? []), { title: '', description: '' }] }));
  const setSection = (i: number, k: keyof CustomSection, v: string) => {
    setInfo(prev => {
      const list = [...(prev.custom_sections ?? [])];
      list[i] = { ...list[i], [k]: v };
      return { ...prev, custom_sections: list };
    });
    setError('');
  };
  const removeSection = (i: number) => {
    const title = sections[i]?.title?.trim();
    confirmDestructive(
      'Remove section?',
      title
        ? `Remove ${title}? Tap "Save All Changes" afterwards to make it permanent.`
        : 'Remove this section? Tap "Save All Changes" afterwards to make it permanent.',
      'Remove',
      () => setInfo(prev => ({ ...prev, custom_sections: (prev.custom_sections ?? []).filter((_, idx) => idx !== i) })),
    );
  };

  // ── Team and documents, saved on their own ──
  const removeMember = (m: ManagementMember) =>
    confirmDestructive('Remove member?', `Remove ${m.name || 'this member'}? Their photo will be deleted.`, 'Remove', async () => {
      setBusyId(`m${m.id}`);
      try {
        await deleteMember(m.id);
        setTeam(prev => prev.filter(x => x.id !== m.id));
      } catch (e) {
        AppAlert.alert('Error', apiErr(e, 'Could not remove member.'));
      } finally {
        setBusyId(null);
      }
    });

  const removeDocument = (d: SchoolDocument) =>
    confirmDestructive('Delete document?', 'The PDF will be permanently removed from the school records.', 'Delete', async () => {
      setBusyId(`d${d.id}`);
      try {
        await deleteDocument(d.id);
        setDocs(prev => prev.filter(x => x.id !== d.id));
      } catch (e) {
        AppAlert.alert('Error', apiErr(e, 'Could not delete document.'));
      } finally {
        setBusyId(null);
      }
    });

  // ── Save All Changes ──
  const save = async () => {
    const errors = schoolInfoErrors(info);
    if (errors.length > 0) {
      setError(errors.join('\n'));
      return;
    }
    setSaving(true);
    try {
      const payload: SchoolInfoData = { custom_sections: [] };
      TEXT_KEYS.forEach(k => {
        (payload as any)[k] = (info as any)[k] ?? '';
      });
      // Sections left wholly empty aren't kept, as on the panel.
      payload.custom_sections = sections.filter(sec => (sec.title ?? '').trim() !== '' || (sec.description ?? '').trim() !== '');
      await updateSchoolInfo(payload);
      navigation.goBack();
    } catch (e) {
      setError(apiErr(e, 'Could not save.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={s.root}>
      <DocHeader title="Edit School Profile" onBackPress={() => navigation.goBack()} />
      {loading ? (
        <View style={s.skeleton}>
          {[0, 1, 2, 3, 4, 5].map(i => (
            <Skeleton key={i} width="100%" height={i < 2 ? 96 : 54} radius={12} />
          ))}
        </View>
      ) : (
        <Animated.View style={[s.flex, lift]}>
          <ScrollView ref={scrollRef} contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} {...scrollProps}>
            <FormSection title="About & Values" first />
            <Field label="About School" value={info.about_school ?? ''} onChangeText={(t: string) => setField('about_school', t)} placeholder="Describe your school…" multiline />
            <Field label="Vision" value={info.usm_vision ?? ''} onChangeText={(t: string) => setField('usm_vision', t)} placeholder="Long-term vision for your school…" multiline />
            <Field label="Mission" value={info.usm_mission ?? ''} onChangeText={(t: string) => setField('usm_mission', t)} placeholder="Mission statement…" multiline />
            <Field label="Values" value={info.usm_values ?? ''} onChangeText={(t: string) => setField('usm_values', t)} placeholder="Core values your school upholds…" multiline />
            <Field label="Goals" value={info.usm_goals ?? ''} onChangeText={(t: string) => setField('usm_goals', t)} placeholder="Key goals and objectives…" multiline />

            <FormSection title="Custom Sections" />
            {sections.map((sec, i) => (
              <View key={i} style={s.section}>
                <View style={s.sectionHead}>
                  <Text style={s.sectionName} numberOfLines={1}>
                    {sec.title?.trim() || 'Custom Section'}
                  </Text>
                  <TouchableOpacity onPress={() => removeSection(i)} hitSlop={10} activeOpacity={0.6} accessibilityLabel="Remove section">
                    <VectorIcon iconSet="Ionicons" iconName="trash-outline" size={17} color={theme.colors.danger} />
                  </TouchableOpacity>
                </View>
                <Field label="Section Title" value={sec.title ?? ''} onChangeText={(t: string) => setSection(i, 'title', t)} placeholder="e.g. Our History" maxLength={255} />
                <Field label="Description" value={sec.description ?? ''} onChangeText={(t: string) => setSection(i, 'description', t)} placeholder="Write the paragraph content for this section…" multiline />
              </View>
            ))}
            <TouchableOpacity style={s.dashed} activeOpacity={0.7} onPress={addSection}>
              <VectorIcon iconSet="Ionicons" iconName="add" size={16} color={theme.colors.primary} />
              <Text style={s.dashedText}>Add Section</Text>
            </TouchableOpacity>

            <FormSection title="Contact Information" />
            <Field label="School Email" value={info.school_email ?? ''} onChangeText={(t: string) => setField('school_email', t.trim())} placeholder="contact@school.edu" keyboardType="email-address" autoCapitalize="none" />
            <Field label="Mobile Number" value={info.school_mobile ?? ''} onChangeText={(t: string) => setField('school_mobile', t.replace(/\s/g, ''))} placeholder="9876543210" keyboardType="number-pad" maxLength={15} />
            <Field label="Website URL" value={info.website_url ?? ''} onChangeText={(t: string) => setField('website_url', t.trim())} placeholder="https://www.yourschool.edu" keyboardType="url" autoCapitalize="none" />
            <Field label="School Address" value={info.school_address ?? ''} onChangeText={(t: string) => setField('school_address', t)} placeholder="Full address with city, state, pin code…" multiline maxLength={255} />
            <Field label="Website Description" value={info.website_info ?? ''} onChangeText={(t: string) => setField('website_info', t)} placeholder="Brief description of your website…" multiline />

            <FormSection title={`Management Team · ${team.length}`} />
            <View style={s.hint}>
              <Hint>A member is saved as soon as they are added, changed or removed.</Hint>
            </View>
            {team.map((m, i) => (
              <TouchableOpacity
                key={m.id}
                style={[s.row, i < team.length - 1 && s.rowDivider]}
                activeOpacity={0.6}
                onPress={() => navigation.navigate('AdminSchoolMemberForm', { member: m })}
              >
                {m.photo_path ? (
                  <Image source={{ uri: m.photo_path }} style={s.avatar} resizeMethod="resize" />
                ) : (
                  <View style={[s.avatar, s.avatarEmpty]}>
                    <Text style={s.initial}>{(m.name || '?').charAt(0).toUpperCase()}</Text>
                  </View>
                )}
                <View style={s.rowBody}>
                  <Text style={s.rowTitle} numberOfLines={1}>{m.name}</Text>
                  {!!m.designation && <Text style={s.rowSub} numberOfLines={1}>{m.designation}</Text>}
                </View>
                {busyId === `m${m.id}` ? (
                  <ActivityIndicator size="small" color={theme.colors.danger} />
                ) : (
                  <TouchableOpacity onPress={() => removeMember(m)} hitSlop={10} activeOpacity={0.6} accessibilityLabel="Remove member">
                    <VectorIcon iconSet="Ionicons" iconName="trash-outline" size={17} color={theme.colors.danger} />
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={s.dashed} activeOpacity={0.7} onPress={() => navigation.navigate('AdminSchoolMemberForm')}>
              <VectorIcon iconSet="Ionicons" iconName="person-add-outline" size={16} color={theme.colors.primary} />
              <Text style={s.dashedText}>Add Member</Text>
            </TouchableOpacity>

            <FormSection title={`School Documents · ${docs.length}`} />
            <View style={s.hint}>
              <Hint>PDF only, up to 2 MB. A document is saved as soon as it is added or deleted.</Hint>
            </View>
            {docs.map((d, i) => (
              <TouchableOpacity
                key={d.id}
                style={[s.row, i < docs.length - 1 && s.rowDivider]}
                activeOpacity={0.6}
                onPress={() => Linking.openURL(d.file_path).catch(() => {})}
              >
                <View style={[s.avatar, s.docIcon]}>
                  <VectorIcon iconSet="Feather" iconName="file-text" size={17} color={theme.colors.textSecondary} />
                </View>
                <View style={s.rowBody}>
                  <Text style={s.rowTitle} numberOfLines={1}>{d.title}</Text>
                  <Text style={s.rowSub} numberOfLines={1}>{d.file_type ? String(d.file_type).toUpperCase() : 'PDF'}</Text>
                </View>
                {busyId === `d${d.id}` ? (
                  <ActivityIndicator size="small" color={theme.colors.danger} />
                ) : (
                  <TouchableOpacity onPress={() => removeDocument(d)} hitSlop={10} activeOpacity={0.6} accessibilityLabel="Delete document">
                    <VectorIcon iconSet="Ionicons" iconName="trash-outline" size={17} color={theme.colors.danger} />
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={s.dashed} activeOpacity={0.7} onPress={() => navigation.navigate('AdminSchoolDocumentForm')}>
              <VectorIcon iconSet="Ionicons" iconName="cloud-upload-outline" size={16} color={theme.colors.primary} />
              <Text style={s.dashedText}>Add Document</Text>
            </TouchableOpacity>

            <View style={s.submit}>
              <FormError>{error}</FormError>
              <SubmitButton label="Save All Changes" busy={saving} onPress={save} />
            </View>

            <View style={s.tail} />
          </ScrollView>
        </Animated.View>
      )}
    </View>
  );
};

export default AdminSchoolInfoFormScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  flex: { flex: 1 },
  skeleton: { paddingHorizontal: 20, paddingTop: 20, gap: 14 },
  scroll: { paddingHorizontal: 20, paddingTop: 8 },
  tail: { height: 48 },

  // A custom section: its name and the bin, then its two fields
  section: { marginTop: 14, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sectionName: { flex: 1, fontSize: 14, fontWeight: '600', color: theme.colors.textPrimary },

  // Add Section / Add Member / Add Document
  dashed: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 44,
    marginTop: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: theme.colors.primary,
  },
  dashedText: { fontSize: 14, fontWeight: '600', color: theme.colors.primary },

  // A member or a document
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: theme.colors.background },
  avatarEmpty: { alignItems: 'center', justifyContent: 'center' },
  initial: { fontSize: 15, fontWeight: '600', color: theme.colors.textSecondary },
  docIcon: { alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  rowBody: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 15, color: theme.colors.textPrimary },
  rowSub: { fontSize: 12, color: theme.colors.textMuted },

  hint: { marginTop: 4, marginBottom: 2 },
  submit: { marginTop: 28, gap: 12 },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
