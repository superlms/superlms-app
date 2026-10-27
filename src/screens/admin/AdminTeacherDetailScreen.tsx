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
import moment from 'moment';
import VectorIcon from '../../components/VectorIcon';
import { HeaderIconButton } from '../../components/Header';
import { Skeleton, SkeletonText } from '../../components/Skeleton';
import { UploadStatus } from '../../components/TransferToast';
import { useLastLoaded } from '../../hooks/useLastLoaded';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr, pickImage, takePhoto } from '../../utils/filePickers';
import { DocHeader } from '../more/docUi';
import {
  TeacherDetail,
  deleteTeacher,
  getTeacher,
  removeTeacherPhoto,
  setTeacherPhoto,
} from '../../api/adminTeacherApi';
import { AppAlert, AppDialog } from '../../components/AppDialog';
import type { PhotoEdit } from '../../components/PhotoEditor';
import PassportPhoto from '../../components/PassportPhoto';
import { PickedFile } from '../../api/adminProfileApi';
import { withinOneMb } from './adminFormUi';
import { keepTeacherDetail, sampleTeacherDetail } from './adminTeachersUi';

/**
 * Teacher Detail — the panel's View Teacher, as the app shows a person (and as
 * Student Detail is drawn): the photo, the name and what they sign in with,
 * over what the school keeps about them, each block a heading and plain
 * lines, with the class they are class teacher of. As on the panel, the photo
 * opens large, and is changed (camera or gallery), set again in its frame
 * (Crop) or taken off from here, on its own — a new photo, and Crop, set it in
 * a passport-size frame (35 × 45 mm, PassportPhoto) and the server cuts it to
 * that. Edit and Delete are in the header: Edit opens the form, and saved,
 * it comes back here; Delete takes the teacher, their login, their class
 * assignments and their photo away, and asks first.
 *
 * While the teacher loads, the page is drawn as a skeleton of them — what it
 * showed the last time they were opened on this phone, else what their row in
 * the list said — every line it will have, as bars as long as those words.
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

// A profile picture needs no more than this on its longest side — it keeps the
// upload inside the panel's 1 MB.
const PHOTO_SIDE = 1024;

/** "12 Sep 2024" from the server's YYYY-MM-DD. */
const day = (v?: string | null) => {
  const m = moment(v ?? '', 'YYYY-MM-DD', true);
  return m.isValid() ? m.format('D MMM YYYY') : v || null;
};

// "Class 5 · A, Class 6"
const dutiesOf = (d: TeacherDetail) =>
  (d.assignments ?? [])
    .filter(a => a.class || a.section)
    .map(a => [a.class, a.section].filter(Boolean).join(' · '))
    .join(', ');

// The page's blocks, from a teacher — the real one, or one kept for the skeleton.
const Blocks = ({ d, skeleton }: { d: TeacherDetail; skeleton?: boolean }) => (
  <>
    <Block
      skeleton={skeleton}
      title="Account"
      lines={[
        { label: 'Username', value: d.username },
        { label: 'Employee ID', value: d.employee_id },
        { label: 'Mobile', value: d.phone },
      ]}
    />
    <Block
      skeleton={skeleton}
      title="Personal"
      lines={[
        { label: 'Gender', value: d.gender ? d.gender.charAt(0).toUpperCase() + d.gender.slice(1) : null },
        { label: 'Date of Birth', value: day(d.dob) },
        { label: 'Emergency Contact', value: d.emergency_contact },
      ]}
    />
    <Block
      skeleton={skeleton}
      title="School"
      lines={[
        { label: 'Date of Joining', value: day(d.date_of_joining) },
        { label: 'Qualification', value: d.qualification },
        { label: 'Class Teacher Of', value: dutiesOf(d) || null },
      ]}
    />
    <Block
      skeleton={skeleton}
      title="Address"
      lines={[
        { label: 'Address', value: d.address },
        { label: 'City', value: d.city },
        { label: 'State', value: d.state },
        { label: 'Pincode', value: d.pincode },
      ]}
    />
  </>
);

// As the panel's View heads it: the email, and whether they can sign in.
const subOf = (d: TeacherDetail) => [d.email, d.is_active ? 'Active' : 'Inactive'].filter(Boolean).join(' · ');

const AdminTeacherDetailScreen = ({ navigation, route }: any) => {
  const id: number = route?.params?.id;
  // The row of the list it was opened from, for a skeleton of this teacher.
  const row: Partial<TeacherDetail> | undefined = route?.params?.row;
  const [d, setD] = useState<TeacherDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [last, rememberLast] = useLastLoaded<TeacherDetail>(id ? `admin-teacher:${id}` : null);
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
      const res = await getTeacher(id);
      if (mine !== seq.current) return;
      setD(res);
      rememberLast(keepTeacherDetail(res));
    } catch (e) {
      if (mine !== seq.current) return;
      AppAlert.alert('Error', apiErr(e, 'Could not load teacher.'));
      navigation.goBack();
    } finally {
      if (mine === seq.current) setLoading(false);
    }
  }, [id, navigation, rememberLast]);

  // Back from Edit, the page shows what was saved.
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const remove = () =>
    AppAlert.alert(
      'Delete teacher?',
      `This will permanently delete ${d?.name || 'the teacher'}’s account, profile, class assignments and uploaded photo. This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Teacher',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await deleteTeacher(id);
              navigation.goBack();
            } catch (e) {
              AppAlert.alert('Could not delete', apiErr(e, 'Please try again.'));
            } finally {
              setDeleting(false);
            }
          },
        },
      ],
    );

  // ── The photo ──
  // A new one — the camera, or the gallery — is set in the passport frame first.
  const changePhoto = async (from: 'camera' | 'gallery') => {
    setAsking(false);
    const f = from === 'camera' ? await takePhoto({ maxSide: PHOTO_SIDE }) : await pickImage({ maxSide: PHOTO_SIDE });
    if (!f || !withinOneMb(f, 'The photo')) return;
    setCropping({ uri: f.uri, file: f });
  };

  // Save in the frame: the new photo, or the saved one, goes up cut to it. The
  // frame stays open, saving, until the photo is in; not saved, it stays to try again.
  const savePhoto = async (edit: PhotoEdit) => {
    if (!cropping || photoBusy) return;
    setPhotoBusy(true);
    try {
      const image = await setTeacherPhoto(id, cropping.file, edit.crop);
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
    AppAlert.alert('Remove this photo?', `${d?.name || 'This teacher'} will show their initial instead.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setPhotoBusy(true);
          try {
            await removeTeacherPhoto(id);
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
    if (d?.image) navigation.navigate('AdminTeacherPhoto', { uri: d.image, title: d.name });
    else setAsking(true);
  };

  return (
    <View style={s.root}>
      <DocHeader
        title="Teacher Detail"
        onBackPress={() => navigation.goBack()}
        rightSlot={
          d ? (
            <View style={s.headActions}>
              <HeaderIconButton icon="create-outline" onPress={() => navigation.navigate('AdminTeacherForm', { id, row: d })} />
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
        <TeacherSkeleton d={last ?? sampleTeacherDetail(row)} />
      ) : !d ? null : (
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          {/* Who they are */}
          <View style={s.hero}>
            <View>
              <TouchableOpacity activeOpacity={0.8} onPress={openPhoto} disabled={photoBusy} accessibilityLabel={d.image ? 'View photo' : 'Add a photo'}>
                {d.image ? (
                  <Image source={{ uri: d.image }} style={s.photo} resizeMethod="resize" />
                ) : (
                  <View style={[s.photo, s.photoEmpty]}>
                    <Text style={s.initial}>{(d.name || '?').charAt(0).toUpperCase()}</Text>
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

            <Text style={s.name}>{d.name}</Text>
            <Text style={s.sub}>{subOf(d)}</Text>
          </View>

          <Blocks d={d} />

          <View style={s.tail} />
        </ScrollView>
      )}

      <AppDialog
        visible={asking}
        title="Teacher photo"
        message="Take one now, or pick a picture already on this phone (up to 1 MB)."
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
        title="Teacher photo"
        doneLabel="Save"
        busy={photoBusy}
        onCancel={() => setCropping(null)}
        onDone={savePhoto}
      />
    </View>
  );
};

// ── The page while the teacher loads, drawn from what is known of them ─────
const TeacherSkeleton = ({ d }: { d: TeacherDetail }) => (
  <ScrollView contentContainerStyle={s.scroll} scrollEnabled={false} showsVerticalScrollIndicator={false}>
    <View style={s.hero}>
      <Skeleton width={96} height={96} radius={48} />
      <View style={s.photoLinks}>
        <Skeleton width={84} height={11} radius={5} />
      </View>
      <View style={s.skCenter}>
        <SkeletonText style={s.name}>{d.name || 'Teacher'}</SkeletonText>
      </View>
      <View style={s.skCenter}>
        <SkeletonText style={s.sub}>{subOf(d)}</SkeletonText>
      </View>
    </View>
    <Blocks d={d} skeleton />
    <View style={s.tail} />
  </ScrollView>
);

export default AdminTeacherDetailScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  scroll: { paddingHorizontal: 20, paddingTop: 8 },
  tail: { height: 48 },
  headActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  headBusy: { width: 40 },

  // Photo, name, email
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
