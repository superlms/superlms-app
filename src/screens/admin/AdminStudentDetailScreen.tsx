import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import VectorIcon from '../../components/VectorIcon';
import { HeaderIconButton } from '../../components/Header';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr, pickImage, takePhoto } from '../../utils/filePickers';
import { DocHeader } from '../more/docUi';
import {
  StudentDetail,
  deleteStudent,
  getStudent,
  removeStudentPhoto,
  setStudentPhoto,
} from '../../api/adminStudentApi';
import { AppAlert, AppDialog } from '../../components/AppDialog';

/**
 * Student Detail — one student, as the app shows a person: the photo, the name
 * and the class over what the school keeps about them, each block a heading
 * and plain lines. The photo opens large to look at; it is changed (camera or
 * gallery) or removed from here, on its own. Edit and Delete are in the
 * header: Edit opens the student's form, and saved, it comes back here; Delete
 * takes the student and their login away, and asks first.
 */

interface Line {
  label: string;
  value?: string | null;
}

// A heading and its lines — the ones the school has nothing for are left out,
// and the last line keeps no divider under it.
const Block = ({ title, lines }: { title: string; lines: Line[] }) => {
  const shown = lines.filter(l => !!l.value);
  if (shown.length === 0) return null;
  return (
    <View>
      <Text style={s.blockTitle}>{title.toUpperCase()}</Text>
      {shown.map((l, i) => (
        <View key={l.label} style={[s.line, i < shown.length - 1 && s.lineDivider]}>
          <Text style={s.lineLabel}>{l.label}</Text>
          <Text style={s.lineValue}>{l.value}</Text>
        </View>
      ))}
    </View>
  );
};

// A profile picture needs no more than this on its longest side — it keeps the
// upload well under the server's 2 MB.
const PHOTO_SIDE = 1024;

const AdminStudentDetailScreen = ({ navigation, route }: any) => {
  const id: number = route?.params?.id;
  const [d, setD] = useState<StudentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [asking, setAsking] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await getStudent(id);
      setD(res);
    } catch (e) {
      AppAlert.alert('Error', apiErr(e, 'Could not load student.'));
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  }, [id, navigation]);

  // Back from Edit, the page shows what was saved.
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const remove = () =>
    AppAlert.alert('Delete this student?', `${d?.full_name || 'This student'} and their login will be deleted. This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setDeleting(true);
          try {
            await deleteStudent(id);
            navigation.goBack();
          } catch (e) {
            AppAlert.alert('Could not delete', apiErr(e, 'Please try again.'));
          } finally {
            setDeleting(false);
          }
        },
      },
    ]);

  // ── The photo ──
  const changePhoto = async (from: 'camera' | 'gallery') => {
    setAsking(false);
    const f = from === 'camera' ? await takePhoto({ maxSide: PHOTO_SIDE }) : await pickImage({ maxSide: PHOTO_SIDE });
    if (!f) return;
    setPhotoBusy(true);
    try {
      const image = await setStudentPhoto(id, f);
      setD(prev => (prev ? { ...prev, image } : prev));
    } catch (e) {
      AppAlert.alert('Photo not saved', apiErr(e, 'Could not save the photo.'));
    } finally {
      setPhotoBusy(false);
    }
  };

  const takePhotoOff = () => {
    setAsking(false);
    AppAlert.alert('Remove the photo?', `${d?.full_name || 'This student'} will show their initial instead.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setPhotoBusy(true);
          try {
            await removeStudentPhoto(id);
            setD(prev => (prev ? { ...prev, image: null } : prev));
          } catch (e) {
            AppAlert.alert('Photo not removed', apiErr(e, 'Please try again.'));
          } finally {
            setPhotoBusy(false);
          }
        },
      },
    ]);
  };

  // A photo opens large; without one, the photo is picked.
  const openPhoto = () => {
    if (d?.image) navigation.navigate('AdminStudentPhoto', { uri: d.image, title: d.full_name });
    else setAsking(true);
  };

  return (
    <View style={s.root}>
      <DocHeader
        title="Student Detail"
        onBackPress={() => navigation.goBack()}
        rightSlot={
          d ? (
            <View style={s.headActions}>
              <HeaderIconButton icon="create-outline" onPress={() => navigation.navigate('AdminStudentForm', { id })} />
              {deleting ? (
                <ActivityIndicator style={s.headBusy} color={theme.colors.primary} />
              ) : (
                <HeaderIconButton icon="trash-outline" onPress={remove} />
              )}
            </View>
          ) : undefined
        }
      />

      {loading ? (
        <View style={s.loader}><ActivityIndicator size="large" color={theme.colors.primary} /></View>
      ) : !d ? null : (
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          {/* Who they are */}
          <View style={s.hero}>
            <View>
              <TouchableOpacity activeOpacity={0.8} onPress={openPhoto} disabled={photoBusy} accessibilityLabel={d.image ? 'View photo' : 'Add a photo'}>
                {d.image ? (
                  <Image source={{ uri: d.image }} style={s.photo} />
                ) : (
                  <View style={[s.photo, s.photoEmpty]}>
                    <Text style={s.initial}>{(d.full_name || '?').charAt(0).toUpperCase()}</Text>
                  </View>
                )}
                {photoBusy && (
                  <View style={[s.photo, s.photoBusy]}>
                    <ActivityIndicator color={theme.colors.white} />
                  </View>
                )}
              </TouchableOpacity>
              <TouchableOpacity style={s.camera} onPress={() => setAsking(true)} disabled={photoBusy} hitSlop={8} accessibilityLabel="Change photo">
                <VectorIcon iconSet="Ionicons" iconName="camera" size={15} color={theme.colors.white} />
              </TouchableOpacity>
            </View>

            <View style={s.photoLinks}>
              <TouchableOpacity onPress={() => setAsking(true)} disabled={photoBusy} hitSlop={8} activeOpacity={0.6}>
                <Text style={s.photoLink}>{d.image ? 'Change photo' : 'Add a photo'}</Text>
              </TouchableOpacity>
              {!!d.image && (
                <>
                  <Text style={s.photoDot}>·</Text>
                  <TouchableOpacity onPress={takePhotoOff} disabled={photoBusy} hitSlop={8} activeOpacity={0.6}>
                    <Text style={[s.photoLink, s.photoRemove]}>Remove</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>

            <Text style={s.name}>{d.full_name}</Text>
            <Text style={s.sub}>
              {[[d.class, d.section].filter(Boolean).join(' · '), d.roll_no ? `Roll ${d.roll_no}` : null]
                .filter(Boolean)
                .join(' · ') || '—'}
            </Text>
            {!d.is_active && <Text style={s.inactive}>Signed out of the app</Text>}
          </View>

          <Block
            title="Academic"
            lines={[
              { label: 'Admission No', value: d.admission_no },
              { label: 'Roll No', value: d.roll_no },
              { label: 'Class', value: d.class },
              { label: 'Section', value: d.section },
              { label: 'Board', value: d.board },
              { label: 'Date of Admission', value: d.date_of_admission },
              { label: 'Registration No', value: d.registration_number },
              { label: 'Apaar ID', value: d.appar_id },
            ]}
          />

          <Block
            title="Personal"
            lines={[
              { label: 'Email', value: d.email },
              { label: 'Phone', value: d.phone },
              { label: 'Gender', value: d.gender ? d.gender.charAt(0).toUpperCase() + d.gender.slice(1) : null },
              { label: 'Date of Birth', value: d.dob },
              { label: 'Religion', value: d.religion },
              { label: 'Aadhaar No', value: d.aadhar_no },
              { label: 'Father’s Name', value: d.father_name },
              { label: 'Mother’s Name', value: d.mother_name },
            ]}
          />

          <Block
            title="Address"
            lines={[
              { label: 'Local Address', value: d.local_address },
              { label: 'Permanent Address', value: d.permanent_address },
              { label: 'City', value: d.city },
              { label: 'State', value: d.state },
              { label: 'Pincode', value: d.pincode },
            ]}
          />

          {d.transportation_required && (
            <Block title="Transport" lines={[{ label: 'Route', value: d.route_name ?? '—' }]} />
          )}

          <View style={s.tail} />
        </ScrollView>
      )}

      <AppDialog
        visible={asking}
        title="Student photo"
        message="Take one now, or pick a picture already on this phone."
        actions={[
          { text: 'Camera', onPress: () => changePhoto('camera') },
          { text: 'Gallery', onPress: () => changePhoto('gallery') },
          ...(d?.image ? [{ text: 'Remove photo', style: 'destructive' as const, onPress: takePhotoOff }] : []),
          { text: 'Cancel', style: 'cancel' as const, onPress: () => setAsking(false) },
        ]}
        onRequestClose={() => setAsking(false)}
      />
    </View>
  );
};

export default AdminStudentDetailScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: 20, paddingTop: 8 },
  tail: { height: 48 },
  headActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  headBusy: { width: 40 },

  // Photo, name, class
  hero: { alignItems: 'center', paddingTop: 12, paddingBottom: 4 },
  photo: { width: 96, height: 96, borderRadius: 48, backgroundColor: theme.colors.background },
  photoEmpty: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.colors.border },
  photoBusy: { position: 'absolute', top: 0, left: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.35)' },
  initial: { fontSize: 32, fontWeight: '600', color: theme.colors.primary },
  camera: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: theme.colors.card,
  },
  photoLinks: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  photoLink: { fontSize: 13, fontWeight: '600', color: theme.colors.primary },
  photoRemove: { color: theme.colors.danger },
  photoDot: { fontSize: 13, color: theme.colors.textMuted },
  name: { fontSize: 18, fontWeight: '600', color: theme.colors.textPrimary, marginTop: 10, textAlign: 'center' },
  sub: { fontSize: 13, color: theme.colors.textSecondary, marginTop: 4, textAlign: 'center' },
  inactive: { fontSize: 12, color: theme.colors.textMuted, marginTop: 6 },

  // Blocks
  blockTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 1, color: theme.colors.textMuted, marginTop: 24, marginBottom: 2 },
  line: { flexDirection: 'row', alignItems: 'flex-start', gap: 16, paddingVertical: 12 },
  lineDivider: { borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  lineLabel: { fontSize: 13, color: theme.colors.textSecondary, flexShrink: 0 },
  lineValue: { fontSize: 14, color: theme.colors.textPrimary, flex: 1, textAlign: 'right' },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
