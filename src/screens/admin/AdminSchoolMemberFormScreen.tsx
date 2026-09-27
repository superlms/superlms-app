import React, { useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated from 'react-native-reanimated';
import VectorIcon from '../../components/VectorIcon';
import { AppDialog } from '../../components/AppDialog';
import { useKeyboardLiftStyle } from '../../hooks/useKeyboardLift';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr, pickImage, takePhoto } from '../../utils/filePickers';
import { ManagementMember, PickedFile, addMember, deleteMember, updateMember } from '../../api/adminProfileApi';
import { DocHeader } from '../more/docUi';
import { FormField, FormSection } from '../teacherStudents/studentFormUi';
import { FormError, QuietAction, SubmitButton, confirmDestructive } from './adminFormUi';
import { useRevealFocused } from './adminProfileUi';

/**
 * Add or edit someone on the school's management team — the panel's member
 * panel, drawn as Add Employee is: the photo at the top (camera or gallery, up
 * to 2 MB, optional), then Name and Designation, both needed. It is saved at
 * once. Editing, Remove at the foot takes them off (and their photo) and asks
 * first.
 *
 * Route params: member – the member to edit; none to add one.
 */

// A member's photo needs no more than this on its longest side — it keeps the
// upload inside the panel's 2 MB.
const PHOTO_SIDE = 1024;
const TWO_MB = 2 * 1024 * 1024;

const Field = (props: any) => <FormField markFilled {...props} />;

const AdminSchoolMemberFormScreen = ({ navigation, route }: any) => {
  const member: ManagementMember | undefined = route?.params?.member;
  const [name, setName] = useState(member?.name ?? '');
  const [designation, setDesignation] = useState(member?.designation ?? '');
  const [photo, setPhoto] = useState<PickedFile | null>(null);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);

  const lift = useKeyboardLiftStyle();
  const { ref: scrollRef, scrollProps } = useRevealFocused();

  const photoUri = photo?.uri ?? member?.photo_path ?? null;

  const choose = async (from: 'camera' | 'gallery') => {
    setAsking(false);
    const f = from === 'camera' ? await takePhoto({ maxSide: PHOTO_SIDE }) : await pickImage({ maxSide: PHOTO_SIDE });
    if (!f) return;
    if (f.size && f.size > TWO_MB) {
      setError('Photo must not exceed 2 MB.');
      return;
    }
    setPhoto(f);
    setError('');
  };

  const save = async () => {
    if (!name.trim()) return setError('Member name is required.');
    if (!designation.trim()) return setError('Designation is required.');
    setSaving(true);
    try {
      const body = { name: name.trim(), designation: designation.trim(), photo };
      if (member) await updateMember(member.id, body);
      else await addMember(body);
      navigation.goBack();
    } catch (e) {
      setError(apiErr(e, 'Could not save member.'));
    } finally {
      setSaving(false);
    }
  };

  const remove = () =>
    confirmDestructive('Remove member?', `Remove ${member?.name || 'this member'}? Their photo will be deleted.`, 'Remove', async () => {
      if (!member) return;
      setRemoving(true);
      try {
        await deleteMember(member.id);
        navigation.goBack();
      } catch (e) {
        setError(apiErr(e, 'Could not remove member.'));
      } finally {
        setRemoving(false);
      }
    });

  return (
    <View style={s.root}>
      <DocHeader title={member ? 'Edit Member' : 'Add Member'} onBackPress={() => navigation.goBack()} />
      <Animated.View style={[s.flex, lift]}>
        <ScrollView ref={scrollRef} contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} {...scrollProps}>
          {/* The photo */}
          <View style={s.photoBlock}>
            <TouchableOpacity activeOpacity={0.8} onPress={() => setAsking(true)}>
              {photoUri ? (
                <Image source={{ uri: photoUri }} style={s.photo} resizeMethod="resize" />
              ) : (
                <View style={[s.photo, s.photoEmpty]}>
                  <VectorIcon iconSet="Ionicons" iconName="person" size={34} color={theme.colors.textMuted} />
                </View>
              )}
              <View style={s.camera}>
                <VectorIcon iconSet="Ionicons" iconName="camera" size={15} color={theme.colors.white} />
              </View>
            </TouchableOpacity>
            <View style={s.photoLinks}>
              <TouchableOpacity onPress={() => setAsking(true)} hitSlop={8} activeOpacity={0.6}>
                <Text style={s.photoText}>{photoUri ? 'Change photo' : 'Add a photo'}</Text>
              </TouchableOpacity>
              {!!photo && (
                <>
                  <Text style={s.photoDot}>·</Text>
                  <TouchableOpacity onPress={() => setPhoto(null)} hitSlop={8} activeOpacity={0.6}>
                    <Text style={[s.photoText, s.photoRemove]}>Remove selected photo</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>

          <FormSection title="Member" first />
          <Field label="Name" value={name} onChangeText={(t: string) => { setName(t); setError(''); }} placeholder="e.g. Mr. Sharma" maxLength={255} autoCapitalize="words" />
          <Field label="Designation" value={designation} onChangeText={(t: string) => { setDesignation(t); setError(''); }} placeholder="e.g. Principal" maxLength={255} />

          <View style={s.submit}>
            <FormError>{error}</FormError>
            <SubmitButton label={member ? 'Update Member' : 'Add Member'} busy={saving} onPress={save} />
          </View>

          {!!member && (
            <View style={s.foot}>
              <QuietAction icon="trash-2" label="Remove member" danger busy={removing} onPress={remove} />
            </View>
          )}

          <View style={s.tail} />
        </ScrollView>
      </Animated.View>

      <AppDialog
        visible={asking}
        title="Member photo"
        message="Take one now, or pick a picture already on this phone (up to 2 MB)."
        actions={[
          { text: 'Camera', onPress: () => choose('camera') },
          { text: 'Gallery', onPress: () => choose('gallery') },
          { text: 'Cancel', style: 'cancel', onPress: () => setAsking(false) },
        ]}
        onRequestClose={() => setAsking(false)}
      />
    </View>
  );
};

export default AdminSchoolMemberFormScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  flex: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 8 },
  tail: { height: 48 },

  // Photo
  photoBlock: { alignItems: 'center', paddingTop: 12, paddingBottom: 4 },
  photo: { width: 88, height: 88, borderRadius: 44, backgroundColor: theme.colors.background },
  photoEmpty: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.colors.border },
  camera: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: theme.colors.card,
  },
  photoLinks: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  photoText: { fontSize: 13, fontWeight: '600', color: theme.colors.primary },
  photoRemove: { color: theme.colors.danger },
  photoDot: { fontSize: 13, color: theme.colors.textMuted },

  submit: { marginTop: 28, gap: 12 },
  foot: { marginTop: 22 },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
