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
import moment from 'moment';
import VectorIcon from '../../components/VectorIcon';
import { HeaderIconButton } from '../../components/Header';
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
import { withinOneMb } from './adminFormUi';

/**
 * Teacher Detail — the panel's View Teacher, as the app shows a person (and as
 * Student Detail is drawn): the photo, the name and what they sign in with,
 * over what the school keeps about them, each block a heading and plain
 * lines, with the class they are class teacher of. As on the panel, the photo
 * opens large, and is changed (camera or gallery) or taken off from here, on
 * its own. Edit and Delete are in the header: Edit opens the form, and saved,
 * it comes back here; Delete takes the teacher, their login, their class
 * assignments and their photo away, and asks first.
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
// upload inside the panel's 1 MB.
const PHOTO_SIDE = 1024;

/** "12 Sep 2024" from the server's YYYY-MM-DD. */
const day = (v?: string | null) => {
  const m = moment(v ?? '', 'YYYY-MM-DD', true);
  return m.isValid() ? m.format('D MMM YYYY') : v || null;
};

const AdminTeacherDetailScreen = ({ navigation, route }: any) => {
  const id: number = route?.params?.id;
  const [d, setD] = useState<TeacherDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [asking, setAsking] = useState(false);

  const load = useCallback(async () => {
    try {
      setD(await getTeacher(id));
    } catch (e) {
      AppAlert.alert('Error', apiErr(e, 'Could not load teacher.'));
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  }, [id, navigation]);

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
  const changePhoto = async (from: 'camera' | 'gallery') => {
    setAsking(false);
    const f = from === 'camera' ? await takePhoto({ maxSide: PHOTO_SIDE }) : await pickImage({ maxSide: PHOTO_SIDE });
    if (!f || !withinOneMb(f, 'The photo')) return;
    setPhotoBusy(true);
    try {
      const image = await setTeacherPhoto(id, f);
      setD(prev => (prev ? { ...prev, image } : prev));
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

  const duties = (d?.assignments ?? [])
    .filter(a => a.class || a.section)
    .map(a => [a.class, a.section].filter(Boolean).join(' · '))
    .join(', ');

  return (
    <View style={s.root}>
      <DocHeader
        title="Teacher Detail"
        onBackPress={() => navigation.goBack()}
        rightSlot={
          d ? (
            <View style={s.headActions}>
              <HeaderIconButton icon="create-outline" onPress={() => navigation.navigate('AdminTeacherForm', { id })} />
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
                  <Image source={{ uri: d.image }} style={s.photo} resizeMethod="resize" />
                ) : (
                  <View style={[s.photo, s.photoEmpty]}>
                    <Text style={s.initial}>{(d.name || '?').charAt(0).toUpperCase()}</Text>
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

            <Text style={s.name}>{d.name}</Text>
            {/* As the panel's View heads it: the email, and whether they can sign in. */}
            <Text style={s.sub}>{[d.email, d.is_active ? 'Active' : 'Inactive'].filter(Boolean).join(' · ')}</Text>
          </View>

          <Block
            title="Account"
            lines={[
              { label: 'Username', value: d.username },
              { label: 'Employee ID', value: d.employee_id },
              { label: 'Mobile', value: d.phone },
            ]}
          />

          <Block
            title="Personal"
            lines={[
              { label: 'Gender', value: d.gender ? d.gender.charAt(0).toUpperCase() + d.gender.slice(1) : null },
              { label: 'Date of Birth', value: day(d.dob) },
              { label: 'Emergency Contact', value: d.emergency_contact },
            ]}
          />

          <Block
            title="School"
            lines={[
              { label: 'Date of Joining', value: day(d.date_of_joining) },
              { label: 'Qualification', value: d.qualification },
              { label: 'Class Teacher Of', value: duties || null },
            ]}
          />

          <Block
            title="Address"
            lines={[
              { label: 'Address', value: d.address },
              { label: 'City', value: d.city },
              { label: 'State', value: d.state },
              { label: 'Pincode', value: d.pincode },
            ]}
          />

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
    </View>
  );
};

export default AdminTeacherDetailScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
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
  blockTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 1, color: theme.colors.textMuted, marginTop: 24, marginBottom: 2 },
  line: { flexDirection: 'row', alignItems: 'flex-start', gap: 16, paddingVertical: 12 },
  lineDivider: { borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  lineLabel: { fontSize: 13, color: theme.colors.textSecondary, flexShrink: 0 },
  lineValue: { fontSize: 14, color: theme.colors.textPrimary, flex: 1, textAlign: 'right' },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
