import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import VectorIcon from '../../components/VectorIcon';
import AppHeader from '../../components/Header';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useRefresh } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';
import {
  AdminProfile,
  CustomSection,
  ManagementMember,
  PickedFile,
  SchoolInfoData,
  addDocument,
  addMember,
  deleteDocument,
  deleteMember,
  getAdminProfile,
  updateAdminLogo,
  updateAdminPassword,
  updateMember,
  updateSchoolInfo,
} from '../../api/adminProfileApi';

// Document picker is a native module added for this screen; require it lazily so
// the bundle still loads on builds that haven't been rebuilt with it yet.
let DocPicker: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  DocPicker = require('@react-native-documents/picker');
} catch {
  DocPicker = null;
}

const errMsg = (e: any, fallback: string) =>
  e?.response?.data?.message || e?.message || fallback;

const pickImage = (): Promise<PickedFile | null> =>
  new Promise(resolve => {
    launchImageLibrary({ mediaType: 'photo', quality: 0.8 }, res => {
      if (res.didCancel || res.errorCode) return resolve(null);
      const a = res.assets?.[0];
      if (!a?.uri) return resolve(null);
      resolve({ uri: a.uri, type: a.type ?? 'image/jpeg', name: a.fileName ?? 'photo.jpg' });
    });
  });

const pickPdf = async (): Promise<PickedFile | null> => {
  if (!DocPicker?.pick) {
    Alert.alert('Picker unavailable', 'Rebuild the app to enable PDF uploads.');
    return null;
  }
  try {
    const results = await DocPicker.pick({
      type: [DocPicker.types?.pdf ?? 'application/pdf'],
      allowMultiSelection: false,
    });
    const f = Array.isArray(results) ? results[0] : results;
    if (!f?.uri) return null;
    return { uri: f.uri, type: f.type ?? 'application/pdf', name: f.name ?? 'document.pdf' };
  } catch (e: any) {
    if (String(e?.code ?? e?.message ?? '').toLowerCase().includes('cancel')) return null;
    Alert.alert('Could not pick file', errMsg(e, 'Please try again.'));
    return null;
  }
};

// ─── Presentational helpers (defined outside so TextInputs keep focus) ─────────
const val = (v?: string | null) => (v && v.trim() ? v.trim() : '—');

const InfoRow = ({ label, value, last }: { label: string; value?: string | null; last?: boolean }) => (
  <View style={[s.infoRow, !last && s.infoRowBorder]}>
    <Text style={s.infoLabel}>{label}</Text>
    <Text style={s.infoValue}>{val(value)}</Text>
  </View>
);

const SectionCard = ({
  title, editing, onToggle, saving, children,
}: {
  title: string;
  editing?: boolean;
  onToggle?: () => void;
  saving?: boolean;
  children: React.ReactNode;
}) => (
  <View style={s.card}>
    <View style={[s.accentStrip, { backgroundColor: theme.colors.primary }]} />
    <View style={s.cardInner}>
      <View style={s.cardHead}>
        <Text style={s.sectionLabel}>{title}</Text>
        {!!onToggle && (
          <TouchableOpacity style={s.editBtn} onPress={onToggle} activeOpacity={0.8} disabled={saving}>
            {saving ? (
              <ActivityIndicator size="small" color={theme.colors.primary} />
            ) : (
              <>
                <VectorIcon iconSet="Ionicons" iconName={editing ? 'checkmark' : 'create-outline'} size={13} color={theme.colors.primary} />
                <Text style={s.editBtnText}>{editing ? 'Save' : 'Edit'}</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
      {children}
    </View>
  </View>
);

const AdminProfileScreen = ({ navigation }: any) => {
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [info, setInfo] = useState<SchoolInfoData>({});

  const [editDetails, setEditDetails] = useState(false);
  const [editUsm, setEditUsm] = useState(false);
  const [editSections, setEditSections] = useState(false);
  const [savingInfo, setSavingInfo] = useState(false);

  const [memberModal, setMemberModal] = useState(false);
  const [memberEditId, setMemberEditId] = useState<number | null>(null);
  const [mName, setMName] = useState('');
  const [mDesig, setMDesig] = useState('');
  const [mPhoto, setMPhoto] = useState<PickedFile | null>(null);
  const [mExistingPhoto, setMExistingPhoto] = useState<string | null>(null);
  const [savingMember, setSavingMember] = useState(false);

  const [docModal, setDocModal] = useState(false);
  const [docTitle, setDocTitle] = useState('');
  const [docFile, setDocFile] = useState<PickedFile | null>(null);
  const [savingDoc, setSavingDoc] = useState(false);

  const [curPw, setCurPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confPw, setConfPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [savingPw, setSavingPw] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = await getAdminProfile();
      setProfile(p);
      setInfo({ ...p.school_info, custom_sections: p.school_info.custom_sections ?? [] });
    } catch (e) {
      Alert.alert('Error', errMsg(e, 'Could not load profile.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  const { refreshing, onRefresh } = useRefresh(load);

  const setField = (k: keyof SchoolInfoData, v: string) => setInfo(prev => ({ ...prev, [k]: v }));

  const saveInfo = async (after: () => void) => {
    setSavingInfo(true);
    try {
      const p = await updateSchoolInfo(info);
      setProfile(p);
      setInfo({ ...p.school_info, custom_sections: p.school_info.custom_sections ?? [] });
      after();
    } catch (e) {
      Alert.alert('Error', errMsg(e, 'Could not save.'));
    } finally {
      setSavingInfo(false);
    }
  };

  const changeLogo = async () => {
    const photo = await pickImage();
    if (!photo) return;
    try {
      const { logo } = await updateAdminLogo(photo);
      setProfile(prev => (prev ? { ...prev, organization: prev.organization ? { ...prev.organization, logo } : prev.organization } : prev));
    } catch (e) {
      Alert.alert('Error', errMsg(e, 'Could not update logo.'));
    }
  };

  const addSectionRow = () =>
    setInfo(prev => ({ ...prev, custom_sections: [...(prev.custom_sections ?? []), { title: '', description: '' }] }));
  const setSection = (i: number, k: keyof CustomSection, v: string) =>
    setInfo(prev => {
      const list = [...(prev.custom_sections ?? [])];
      list[i] = { ...list[i], [k]: v };
      return { ...prev, custom_sections: list };
    });
  const removeSectionRow = (i: number) =>
    setInfo(prev => ({ ...prev, custom_sections: (prev.custom_sections ?? []).filter((_, idx) => idx !== i) }));

  const openMember = (m?: ManagementMember) => {
    setMemberEditId(m?.id ?? null);
    setMName(m?.name ?? '');
    setMDesig(m?.designation ?? '');
    setMPhoto(null);
    setMExistingPhoto(m?.photo_path ?? null);
    setMemberModal(true);
  };
  const saveMember = async () => {
    if (!mName.trim() || !mDesig.trim()) {
      Alert.alert('Required', 'Name and designation are required.');
      return;
    }
    setSavingMember(true);
    try {
      if (memberEditId) await updateMember(memberEditId, { name: mName.trim(), designation: mDesig.trim(), photo: mPhoto });
      else await addMember({ name: mName.trim(), designation: mDesig.trim(), photo: mPhoto });
      setMemberModal(false);
      await load();
    } catch (e) {
      Alert.alert('Error', errMsg(e, 'Could not save member.'));
    } finally {
      setSavingMember(false);
    }
  };
  const confirmDeleteMember = (m: ManagementMember) =>
    Alert.alert('Remove member', `Remove ${m.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        try { await deleteMember(m.id); await load(); }
        catch (e) { Alert.alert('Error', errMsg(e, 'Could not remove member.')); }
      } },
    ]);

  const openDoc = async () => {
    const file = await pickPdf();
    if (!file) return;
    setDocFile(file);
    setDocTitle(file.name?.replace(/\.pdf$/i, '') ?? '');
    setDocModal(true);
  };
  const saveDoc = async () => {
    if (!docFile) return;
    setSavingDoc(true);
    try {
      await addDocument({ title: docTitle.trim() || docFile.name || 'Document', file: docFile });
      setDocModal(false);
      setDocFile(null);
      setDocTitle('');
      await load();
    } catch (e) {
      Alert.alert('Error', errMsg(e, 'Could not upload document.'));
    } finally {
      setSavingDoc(false);
    }
  };
  const confirmDeleteDoc = (id: number, title: string) =>
    Alert.alert('Delete document', `Delete "${title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await deleteDocument(id); await load(); }
        catch (e) { Alert.alert('Error', errMsg(e, 'Could not delete document.')); }
      } },
    ]);

  const savePassword = async () => {
    if (!curPw || !newPw || !confPw) { Alert.alert('Required', 'Fill all password fields.'); return; }
    if (newPw !== confPw) { Alert.alert('Mismatch', 'New password and confirmation do not match.'); return; }
    setSavingPw(true);
    try {
      await updateAdminPassword({ current_password: curPw, new_password: newPw, new_password_confirmation: confPw });
      setCurPw(''); setNewPw(''); setConfPw('');
      Alert.alert('Done', 'Password updated.');
    } catch (e) {
      Alert.alert('Error', errMsg(e, 'Could not update password.'));
    } finally {
      setSavingPw(false);
    }
  };

  if (loading && !refreshing) {
    return (
      <View style={s.root}>
        <StatusBar barStyle="dark-content" backgroundColor={theme.colors.card} />
        <AppHeader title="Profile" onBackPress={() => navigation.goBack()} />
        <View style={s.loader}><ActivityIndicator size="large" color={theme.colors.primary} /></View>
      </View>
    );
  }

  const org = profile?.organization;
  const user = profile?.user;
  const sections = info.custom_sections ?? [];

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor={theme.colors.card} />
      <AppHeader title="Profile" onBackPress={() => navigation.goBack()} />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          keyboardShouldPersistTaps="handled"
        >
          {/* Identity — student profile header style */}
          <View style={s.card}>
            <View style={[s.accentStrip, { backgroundColor: theme.colors.primary }]} />
            <View style={s.cardInner}>
              <View style={s.profileHead}>
                <TouchableOpacity style={s.avatarWrap} onPress={changeLogo} activeOpacity={0.85}>
                  {org?.logo ? (
                    <Image source={{ uri: org.logo }} style={s.avatar} />
                  ) : (
                    <View style={[s.avatar, s.avatarFallback]}>
                      <VectorIcon iconSet="Ionicons" iconName="school" size={28} color={theme.colors.primary} />
                    </View>
                  )}
                  <View style={s.logoEdit}><VectorIcon iconSet="Ionicons" iconName="camera" size={12} color="#fff" /></View>
                </TouchableOpacity>
                <View style={s.headInfo}>
                  <Text style={s.name} numberOfLines={2}>{org?.name ?? 'School'}</Text>
                  <View style={s.roleRow}>
                    <View style={s.rolePill}><Text style={s.rolePillText}>{(user?.role ?? 'admin').toUpperCase()}</Text></View>
                    {!!org?.school_code && <Text style={s.roleSub}>Code {org.school_code}</Text>}
                  </View>
                  {!!user && <Text style={s.headSub} numberOfLines={1}>{user.name}{user.email ? ` · ${user.email}` : ''}</Text>}
                </View>
              </View>
            </View>
          </View>

          {/* School Details */}
          <SectionCard
            title="School Details"
            editing={editDetails}
            saving={savingInfo && editDetails}
            onToggle={() => (editDetails ? saveInfo(() => setEditDetails(false)) : setEditDetails(true))}
          >
            {editDetails ? (
              <>
                <EditField label="About School" value={info.about_school} onChange={(v: string) => setField('about_school', v)} multiline />
                <EditField label="Website Info" value={info.website_info} onChange={(v: string) => setField('website_info', v)} multiline />
                <EditField label="Website URL" value={info.website_url} onChange={(v: string) => setField('website_url', v)} keyboardType="url" />
                <EditField label="Email" value={info.school_email} onChange={(v: string) => setField('school_email', v)} keyboardType="email-address" />
                <EditField label="Mobile" value={info.school_mobile} onChange={(v: string) => setField('school_mobile', v)} keyboardType="phone-pad" />
                <EditField label="Address" value={info.school_address} onChange={(v: string) => setField('school_address', v)} multiline />
              </>
            ) : (
              <>
                <InfoRow label="About" value={info.about_school} />
                <InfoRow label="Website Info" value={info.website_info} />
                <InfoRow label="Website URL" value={info.website_url} />
                <InfoRow label="Email" value={info.school_email} />
                <InfoRow label="Mobile" value={info.school_mobile} />
                <InfoRow label="Address" value={info.school_address} last />
              </>
            )}
          </SectionCard>

          {/* Vision / Mission */}
          <SectionCard
            title="Vision · Mission · Values · Goals"
            editing={editUsm}
            saving={savingInfo && editUsm}
            onToggle={() => (editUsm ? saveInfo(() => setEditUsm(false)) : setEditUsm(true))}
          >
            {editUsm ? (
              <>
                <EditField label="Vision" value={info.usm_vision} onChange={(v: string) => setField('usm_vision', v)} multiline />
                <EditField label="Mission" value={info.usm_mission} onChange={(v: string) => setField('usm_mission', v)} multiline />
                <EditField label="Values" value={info.usm_values} onChange={(v: string) => setField('usm_values', v)} multiline />
                <EditField label="Goals" value={info.usm_goals} onChange={(v: string) => setField('usm_goals', v)} multiline />
              </>
            ) : (
              <>
                <InfoRow label="Vision" value={info.usm_vision} />
                <InfoRow label="Mission" value={info.usm_mission} />
                <InfoRow label="Values" value={info.usm_values} />
                <InfoRow label="Goals" value={info.usm_goals} last />
              </>
            )}
          </SectionCard>

          {/* Custom sections */}
          <SectionCard
            title="Custom Sections"
            editing={editSections}
            saving={savingInfo && editSections}
            onToggle={() => (editSections ? saveInfo(() => setEditSections(false)) : setEditSections(true))}
          >
            {sections.length === 0 && !editSections && <Text style={s.empty}>No custom sections.</Text>}
            {sections.map((sec, i) =>
              editSections ? (
                <View key={i} style={s.sectionEdit}>
                  <View style={s.sectionEditHead}>
                    <Text style={s.fieldLabel}>Section {i + 1}</Text>
                    <TouchableOpacity onPress={() => removeSectionRow(i)} activeOpacity={0.8}>
                      <VectorIcon iconSet="Ionicons" iconName="trash-outline" size={16} color={theme.colors.danger} />
                    </TouchableOpacity>
                  </View>
                  <TextInput style={s.input} value={sec.title} onChangeText={v => setSection(i, 'title', v)} placeholder="Title" placeholderTextColor={theme.colors.textMuted} />
                  <TextInput style={[s.input, s.inputMultiline, { marginTop: 8 }]} value={sec.description} onChangeText={v => setSection(i, 'description', v)} placeholder="Description" placeholderTextColor={theme.colors.textMuted} multiline />
                </View>
              ) : (
                <InfoRow key={i} label={sec.title || '—'} value={sec.description} last={i === sections.length - 1} />
              ),
            )}
            {editSections && (
              <TouchableOpacity style={s.addRow} onPress={addSectionRow} activeOpacity={0.8}>
                <VectorIcon iconSet="Ionicons" iconName="add-circle-outline" size={18} color={theme.colors.primary} />
                <Text style={s.addRowText}>Add section</Text>
              </TouchableOpacity>
            )}
          </SectionCard>

          {/* Management team */}
          <SectionCard title="Management Team">
            {(profile?.management_team ?? []).length === 0 && <Text style={s.empty}>No members yet.</Text>}
            {(profile?.management_team ?? []).map(m => (
              <View key={m.id} style={s.memberRow}>
                {m.photo_path ? (
                  <Image source={{ uri: m.photo_path }} style={s.memberPhoto} />
                ) : (
                  <View style={[s.memberPhoto, s.memberPhotoEmpty]}>
                    <VectorIcon iconSet="Ionicons" iconName="person" size={20} color={theme.colors.textMuted} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={s.memberName} numberOfLines={1}>{m.name}</Text>
                  <Text style={s.memberDesig} numberOfLines={1}>{m.designation}</Text>
                </View>
                <TouchableOpacity style={s.iconAction} onPress={() => openMember(m)} activeOpacity={0.8}>
                  <VectorIcon iconSet="Ionicons" iconName="create-outline" size={18} color={theme.colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity style={s.iconAction} onPress={() => confirmDeleteMember(m)} activeOpacity={0.8}>
                  <VectorIcon iconSet="Ionicons" iconName="trash-outline" size={18} color={theme.colors.danger} />
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity style={s.addRow} onPress={() => openMember()} activeOpacity={0.8}>
              <VectorIcon iconSet="Ionicons" iconName="person-add-outline" size={18} color={theme.colors.primary} />
              <Text style={s.addRowText}>Add member</Text>
            </TouchableOpacity>
          </SectionCard>

          {/* Documents */}
          <SectionCard title="Documents">
            {(profile?.documents ?? []).length === 0 && <Text style={s.empty}>No documents.</Text>}
            {(profile?.documents ?? []).map(d => (
              <View key={d.id} style={s.memberRow}>
                <View style={[s.memberPhoto, s.memberPhotoEmpty]}>
                  <VectorIcon iconSet="Ionicons" iconName="document" size={20} color="#EF4444" />
                </View>
                <TouchableOpacity style={{ flex: 1 }} onPress={() => Linking.openURL(d.file_path)} activeOpacity={0.7}>
                  <Text style={s.memberName} numberOfLines={1}>{d.title}</Text>
                  <Text style={s.memberDesig}>Tap to open</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.iconAction} onPress={() => confirmDeleteDoc(d.id, d.title)} activeOpacity={0.8}>
                  <VectorIcon iconSet="Ionicons" iconName="trash-outline" size={18} color={theme.colors.danger} />
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity style={s.addRow} onPress={openDoc} activeOpacity={0.8}>
              <VectorIcon iconSet="Ionicons" iconName="cloud-upload-outline" size={18} color={theme.colors.primary} />
              <Text style={s.addRowText}>Upload PDF</Text>
            </TouchableOpacity>
          </SectionCard>

          {/* Password */}
          <SectionCard title="Change Password">
            <View style={s.pwField}>
              <TextInput style={s.pwInput} value={curPw} onChangeText={setCurPw} placeholder="Current password" placeholderTextColor={theme.colors.textMuted} secureTextEntry={!showPw} />
            </View>
            <View style={s.pwField}>
              <TextInput style={s.pwInput} value={newPw} onChangeText={setNewPw} placeholder="New password" placeholderTextColor={theme.colors.textMuted} secureTextEntry={!showPw} />
            </View>
            <View style={s.pwField}>
              <TextInput style={s.pwInput} value={confPw} onChangeText={setConfPw} placeholder="Confirm new password" placeholderTextColor={theme.colors.textMuted} secureTextEntry={!showPw} />
              <TouchableOpacity onPress={() => setShowPw(v => !v)} activeOpacity={0.7}>
                <VectorIcon iconSet="Ionicons" iconName={showPw ? 'eye-off-outline' : 'eye-outline'} size={18} color={theme.colors.textMuted} />
              </TouchableOpacity>
            </View>
            <Text style={s.pwHint}>Min 8 chars with upper & lower case, a number and a symbol.</Text>
            <TouchableOpacity style={s.primaryBtn} onPress={savePassword} activeOpacity={0.9} disabled={savingPw}>
              {savingPw ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryBtnText}>Update Password</Text>}
            </TouchableOpacity>
          </SectionCard>

          <View style={{ height: 30 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Member modal */}
      <Modal transparent visible={memberModal} animationType="fade" onRequestClose={() => setMemberModal(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>{memberEditId ? 'Edit Member' : 'Add Member'}</Text>
            <TouchableOpacity style={s.memberPhotoPick} onPress={async () => { const p = await pickImage(); if (p) setMPhoto(p); }} activeOpacity={0.85}>
              {mPhoto?.uri || mExistingPhoto ? (
                <Image source={{ uri: mPhoto?.uri ?? mExistingPhoto ?? undefined }} style={s.memberPhotoLg} />
              ) : (
                <View style={[s.memberPhotoLg, s.memberPhotoEmpty]}>
                  <VectorIcon iconSet="Ionicons" iconName="camera" size={22} color={theme.colors.textMuted} />
                </View>
              )}
              <Text style={s.memberPhotoPickText}>Choose photo</Text>
            </TouchableOpacity>
            <TextInput style={s.input} value={mName} onChangeText={setMName} placeholder="Name" placeholderTextColor={theme.colors.textMuted} />
            <TextInput style={[s.input, { marginTop: 8 }]} value={mDesig} onChangeText={setMDesig} placeholder="Designation" placeholderTextColor={theme.colors.textMuted} />
            <View style={s.modalActions}>
              <TouchableOpacity style={[s.modalBtn, s.modalBtnGhost]} onPress={() => setMemberModal(false)} activeOpacity={0.85}>
                <Text style={s.modalBtnGhostText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.modalBtn, s.modalBtnPrimary]} onPress={saveMember} activeOpacity={0.9} disabled={savingMember}>
                {savingMember ? <ActivityIndicator color="#fff" /> : <Text style={s.modalBtnPrimaryText}>Save</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Document title modal */}
      <Modal transparent visible={docModal} animationType="fade" onRequestClose={() => setDocModal(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Upload Document</Text>
            <Text style={s.docFileName} numberOfLines={1}>{docFile?.name ?? 'Selected PDF'}</Text>
            <TextInput style={s.input} value={docTitle} onChangeText={setDocTitle} placeholder="Document title" placeholderTextColor={theme.colors.textMuted} />
            <View style={s.modalActions}>
              <TouchableOpacity style={[s.modalBtn, s.modalBtnGhost]} onPress={() => setDocModal(false)} activeOpacity={0.85}>
                <Text style={s.modalBtnGhostText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.modalBtn, s.modalBtnPrimary]} onPress={saveDoc} activeOpacity={0.9} disabled={savingDoc}>
                {savingDoc ? <ActivityIndicator color="#fff" /> : <Text style={s.modalBtnPrimaryText}>Upload</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

// Inline edit field (kept a plain function, not a component, so re-renders don't
// remount the TextInput and drop the keyboard).
const EditField = ({ label, value, onChange, multiline, keyboardType }: any) => (
  <View style={s.field}>
    <Text style={s.fieldLabel}>{label}</Text>
    <TextInput
      style={[s.input, multiline && s.inputMultiline]}
      value={value ?? ''}
      onChangeText={onChange}
      placeholder={label}
      placeholderTextColor={theme.colors.textMuted}
      multiline={multiline}
      keyboardType={keyboardType}
    />
  </View>
);

export default AdminProfileScreen;

const __mk = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 16, paddingBottom: 40, gap: 14 },

  // student-style card
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    overflow: 'hidden',
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 3,
  },
  accentStrip: { height: 5 },
  cardInner: { padding: 18 },

  // identity header (student style)
  profileHead: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatarWrap: { width: 58, height: 58 },
  avatar: { width: 58, height: 58, borderRadius: 29, resizeMode: 'cover' },
  avatarFallback: { backgroundColor: theme.colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  logoEdit: { position: 'absolute', right: -2, bottom: -2, width: 24, height: 24, borderRadius: 12, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: theme.colors.card },
  headInfo: { flex: 1 },
  name: { fontSize: 19, fontWeight: '800', color: theme.colors.textPrimary, lineHeight: 24 },
  roleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  rolePill: { backgroundColor: theme.colors.primaryLight, borderRadius: theme.radius.full, paddingHorizontal: 10, paddingVertical: 3 },
  rolePillText: { fontSize: 10, fontWeight: '800', color: theme.colors.primary, letterSpacing: 0.5 },
  roleSub: { fontSize: 12, fontWeight: '600', color: theme.colors.textMuted },
  headSub: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 6 },

  // section head
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sectionLabel: { flex: 1, fontSize: 12, fontWeight: '800', color: theme.colors.textMuted, letterSpacing: 0.8, textTransform: 'uppercase' },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: theme.radius.full, backgroundColor: theme.colors.primaryLight },
  editBtnText: { fontSize: 12, fontWeight: '700', color: theme.colors.primary },

  // info rows (student style)
  infoRow: { paddingVertical: 10 },
  infoRowBorder: { borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  infoLabel: { fontSize: 11, fontWeight: '700', color: theme.colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.3 },
  infoValue: { fontSize: 14, color: theme.colors.textPrimary, fontWeight: '600', marginTop: 3, lineHeight: 20 },

  // edit fields
  field: { marginBottom: 12 },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: theme.colors.textPrimary, backgroundColor: theme.colors.background },
  inputMultiline: { minHeight: 70, textAlignVertical: 'top' },

  empty: { fontSize: 13, color: theme.colors.textMuted, paddingVertical: 4 },

  sectionEdit: { marginBottom: 12, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, padding: 10 },
  sectionEditHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },

  addRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, marginTop: 4 },
  addRowText: { fontSize: 13, fontWeight: '700', color: theme.colors.primary },

  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  memberPhoto: { width: 42, height: 42, borderRadius: 21, resizeMode: 'cover' },
  memberPhotoEmpty: { backgroundColor: theme.colors.background, alignItems: 'center', justifyContent: 'center' },
  memberName: { fontSize: 14, fontWeight: '700', color: theme.colors.textPrimary },
  memberDesig: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 1 },
  iconAction: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.background },

  pwField: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, paddingHorizontal: 12, marginBottom: 10, backgroundColor: theme.colors.background },
  pwInput: { flex: 1, paddingVertical: 11, fontSize: 14, color: theme.colors.textPrimary },
  pwHint: { fontSize: 11, color: theme.colors.textMuted, marginBottom: 12 },
  primaryBtn: { backgroundColor: theme.colors.primary, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  modalCard: { width: '100%', maxWidth: 420, backgroundColor: theme.colors.card, borderRadius: 18, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: theme.colors.textPrimary, marginBottom: 14, textAlign: 'center' },
  memberPhotoPick: { alignItems: 'center', gap: 6, marginBottom: 14 },
  memberPhotoLg: { width: 80, height: 80, borderRadius: 40, resizeMode: 'cover' },
  memberPhotoPickText: { fontSize: 12, fontWeight: '700', color: theme.colors.primary },
  docFileName: { fontSize: 13, color: theme.colors.textSecondary, textAlign: 'center', marginBottom: 12 },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 16 },
  modalBtn: { flex: 1, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  modalBtnGhost: { backgroundColor: theme.colors.border },
  modalBtnGhostText: { fontSize: 15, fontWeight: '700', color: theme.colors.textPrimary },
  modalBtnPrimary: { backgroundColor: theme.colors.primary },
  modalBtnPrimaryText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});

let s = __mk();
onThemeChange(() => { s = __mk(); });
