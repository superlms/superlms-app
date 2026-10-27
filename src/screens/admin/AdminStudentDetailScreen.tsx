import React, { useCallback, useRef, useState } from 'react';
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
import { Skeleton, SkeletonText } from '../../components/Skeleton';
import { useLastLoaded } from '../../hooks/useLastLoaded';
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
import type { PhotoEdit } from '../../components/PhotoEditor';
import PassportPhoto from '../../components/PassportPhoto';
import { PickedFile } from '../../api/adminProfileApi';
import { keepStudentDetail, sampleStudentDetail } from './adminStudentsUi';
import { UploadStatus } from '../../components/TransferToast';

/**
 * Student Detail — one student, as the app shows a person: the photo, the name
 * and the class over what the school keeps about them, each block a heading
 * and plain lines. The photo opens large to look at; it is changed (camera or
 * gallery), set again in its frame (Crop) or removed from here, on its own — a
 * new photo, and Crop, set it in a passport-size frame (35 × 45 mm,
 * PassportPhoto) and the server cuts it to that. Edit and Delete are in the
 * header: Edit opens the student's form, and saved, it comes back here; Delete
 * takes the student and their login away, and asks first.
 *
 * While the student loads, the page is drawn as a skeleton of them — what it
 * showed the last time they were opened on this phone, else what their row in
 * the list said: the photo's circle, the name and class, and every line the
 * page will have, label and value, as bars as long as those words.
 */

interface Line {
  label: string;
  value?: string | null;
}

// A heading and its lines — the ones the school has nothing for are left out,
// and the last line keeps no divider under it. As a skeleton, bars as long as
// the words.
const Block = ({ title, lines, skeleton }: { title: string; lines: Line[]; skeleton?: boolean }) => {
  const shown = lines.filter(l => !!l.value);
  if (shown.length === 0) return null;
  const T = skeleton ? SkeletonText : Text;
  return (
    <View>
      <View style={s.blockTitleWrap}>
        <T style={s.blockTitle}>{title.toUpperCase()}</T>
      </View>
      {shown.map((l, i) => (
        <View key={l.label} style={[s.line, i < shown.length - 1 && s.lineDivider]}>
          <View style={s.lineLabelCol}>
            <T style={s.lineLabel}>{l.label}</T>
          </View>
          <View style={s.lineValueCol}>
            <T style={s.lineValue}>{l.value}</T>
          </View>
        </View>
      ))}
    </View>
  );
};

const cap = (v?: string | null) => (v ? v.charAt(0).toUpperCase() + v.slice(1) : null);

// The page's blocks, from a student — the real one, or one kept for the skeleton.
const Blocks = ({ d, skeleton }: { d: StudentDetail; skeleton?: boolean }) => (
  <>
    <Block
      skeleton={skeleton}
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
      skeleton={skeleton}
      title="Personal"
      lines={[
        { label: 'Email', value: d.email },
        { label: 'Phone', value: d.phone },
        { label: 'Gender', value: cap(d.gender) },
        { label: 'Date of Birth', value: d.dob },
        { label: 'Religion', value: d.religion },
        { label: 'Aadhaar No', value: d.aadhar_no },
        { label: 'Father’s Name', value: d.father_name },
        { label: 'Mother’s Name', value: d.mother_name },
      ]}
    />

    <Block
      skeleton={skeleton}
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
      <Block skeleton={skeleton} title="Transport" lines={[{ label: 'Route', value: d.route_name ?? '—' }]} />
    )}
  </>
);

// "Class 6 · A · Roll 06012"
const subOf = (d: StudentDetail) =>
  [[d.class, d.section].filter(Boolean).join(' · '), d.roll_no ? `Roll ${d.roll_no}` : null].filter(Boolean).join(' · ') || '—';

// A photo is picked no bigger than this on its longest side — it keeps the
// upload under the server's 2 MB; the passport frame cut from it is at most 1024.
const PHOTO_SIDE = 1600;

const AdminStudentDetailScreen = ({ navigation, route }: any) => {
  const id: number = route?.params?.id;
  // The row of the list it was opened from, for a skeleton of this student.
  const row: Partial<StudentDetail> | undefined = route?.params?.row;
  const [d, setD] = useState<StudentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [last, rememberLast] = useLastLoaded<StudentDetail>(id ? `admin-student:${id}` : null);
  // The newest load wins: an older one that answers late is ignored.
  const seq = useRef(0);
  const [deleting, setDeleting] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [asking, setAsking] = useState(false);
  // The photo in the passport frame: one just picked (file), or the saved one (none).
  const [cropping, setCropping] = useState<{ uri: string; file: PickedFile | null } | null>(null);

  const load = useCallback(async () => {
    const mine = ++seq.current;
    try {
      const res = await getStudent(id);
      if (mine !== seq.current) return;
      setD(res);
      rememberLast(keepStudentDetail(res));
    } catch (e) {
      if (mine !== seq.current) return;
      AppAlert.alert('Error', apiErr(e, 'Could not load student.'));
      navigation.goBack();
    } finally {
      if (mine === seq.current) setLoading(false);
    }
  }, [id, navigation, rememberLast]);

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
  // A new one — the camera, or the gallery — is set in the passport frame first.
  const changePhoto = async (from: 'camera' | 'gallery') => {
    setAsking(false);
    const f = from === 'camera' ? await takePhoto({ maxSide: PHOTO_SIDE }) : await pickImage({ maxSide: PHOTO_SIDE });
    if (!f) return;
    setCropping({ uri: f.uri, file: f });
  };

  // Save in the frame: the new photo, or the saved one, goes up cut to it. The
  // frame stays open, saving, until the photo is in; not saved, it stays to try again.
  const savePhoto = async (edit: PhotoEdit) => {
    if (!cropping || photoBusy) return;
    setPhotoBusy(true);
    try {
      const image = await setStudentPhoto(id, cropping.file, edit.crop);
      setD(prev => (prev ? { ...prev, image } : prev));
      setCropping(null);
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
              <HeaderIconButton icon="create-outline" onPress={() => navigation.navigate('AdminStudentForm', { id, row: d })} />
              {deleting ? (
                <ActivityIndicator style={s.headBusy} color={theme.colors.primary} />
              ) : (
                <HeaderIconButton icon="trash-outline" onPress={remove} />
              )}
            </View>
          ) : undefined
        }
      />

      {loading && !d ? (
        <StudentSkeleton d={last ?? sampleStudentDetail(row)} />
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
                {photoBusy && <UploadStatus compact color={theme.colors.white} style={[s.photo, s.photoBusy]} />}
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
                  <TouchableOpacity onPress={() => d.image && setCropping({ uri: d.image, file: null })} disabled={photoBusy} hitSlop={8} activeOpacity={0.6}>
                    <Text style={s.photoLink}>Crop</Text>
                  </TouchableOpacity>
                  <Text style={s.photoDot}>·</Text>
                  <TouchableOpacity onPress={takePhotoOff} disabled={photoBusy} hitSlop={8} activeOpacity={0.6}>
                    <Text style={[s.photoLink, s.photoRemove]}>Remove</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>

            <Text style={s.name}>{d.full_name}</Text>
            <Text style={s.sub}>{subOf(d)}</Text>
            {!d.is_active && <Text style={s.inactive}>Signed out of the app</Text>}
          </View>

          <Blocks d={d} />

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

      <PassportPhoto
        uri={cropping?.uri ?? null}
        title="Student photo"
        doneLabel="Save"
        busy={photoBusy}
        onCancel={() => setCropping(null)}
        onDone={savePhoto}
      />
    </View>
  );
};

// ── The page while the student loads, drawn from what is known of them ─────
const StudentSkeleton = ({ d }: { d: StudentDetail }) => (
  <ScrollView contentContainerStyle={s.scroll} scrollEnabled={false} showsVerticalScrollIndicator={false}>
    <View style={s.hero}>
      <Skeleton width={96} height={96} radius={48} />
      <View style={s.photoLinks}>
        <Skeleton width={84} height={11} radius={5} />
      </View>
      <View style={s.skCenter}>
        <SkeletonText style={s.name}>{d.full_name || 'Student'}</SkeletonText>
      </View>
      <View style={s.skCenter}>
        <SkeletonText style={s.sub}>{subOf(d)}</SkeletonText>
      </View>
    </View>
    <Blocks d={d} skeleton />
    <View style={s.tail} />
  </ScrollView>
);

export default AdminStudentDetailScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
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
  blockTitleWrap: { marginTop: 24, marginBottom: 2, alignSelf: 'flex-start' },
  blockTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 1, color: theme.colors.textMuted },
  line: { flexDirection: 'row', alignItems: 'flex-start', gap: 16, paddingVertical: 12 },
  lineDivider: { borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  lineLabelCol: { flexShrink: 0 },
  lineLabel: { fontSize: 13, color: theme.colors.textSecondary },
  lineValueCol: { flex: 1, alignItems: 'flex-end' },
  lineValue: { fontSize: 14, color: theme.colors.textPrimary, textAlign: 'right' },
  skCenter: { alignItems: 'center' },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
