import React, { useEffect, useState } from 'react';
import { Image, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import VectorIcon from '../../components/VectorIcon';
import { AppAlert } from '../../components/AppDialog';
import { PhotoEditorView, type PhotoEdit } from '../../components/PhotoEditor';
import { PhotoCircleView } from '../../components/PhotoCircle';
import type { CropRect } from '../../components/PhotoCropper';
import { apiErr } from '../../utils/filePickers';
import { StudentRow, cropStudentPhoto, setStudentPhotoCircle } from '../../api/teacherStudentApi';

/**
 * A student's photo from the list, shown large and whole — as the web panel's
 * Students list does it. Crop turns the same screen into the photo editor
 * (cropped from any side — crop only); Save cuts the saved photo there and
 * then, and the large photo and the list take the new one. Profile sets the
 * round circle the list shows of the photo (moved and zoomed under it,
 * PhotoCircle); the photo itself is left as it is.
 */
const StudentPhotoModal = ({
  student,
  onClose,
  onSaved,
  onCircleSaved,
}: {
  student: StudentRow | null;
  onClose: () => void;
  /** The student's new photo, once saved. */
  onSaved: (id: number, image: string) => void;
  /** The circle the list shows of the photo, once set with Profile. */
  onCircleSaved?: (id: number, circle: CropRect | null) => void;
}) => {
  const insets = useSafeAreaInsets();
  const [image, setImage] = useState<string | null>(null);
  const [cropping, setCropping] = useState(false);
  const [saving, setSaving] = useState(false);
  const [circling, setCircling] = useState(false);
  const [circle, setCircle] = useState<CropRect | null>(null);

  useEffect(() => {
    setImage(student?.image ?? null);
    setCropping(false);
    setCircling(false);
    setCircle(student?.photo_circle ?? null);
  }, [student]);

  const save = async (edit: PhotoEdit) => {
    if (!student || saving) return;
    setSaving(true);
    try {
      const url = await cropStudentPhoto(student.id, edit.crop);
      if (url) {
        setImage(url);
        // A circle set on the uncut photo is not this one's.
        setCircle(null);
        onSaved(student.id, url);
      }
      setCropping(false);
    } catch (e) {
      AppAlert.alert('Not saved', apiErr(e, 'Could not save the cropped photo.'));
    } finally {
      setSaving(false);
    }
  };

  const saveCircle = async (picked: CropRect) => {
    if (!student || saving) return;
    setSaving(true);
    try {
      const saved = (await setStudentPhotoCircle(student.id, picked)) ?? picked;
      setCircle(saved);
      onCircleSaved?.(student.id, saved);
      setCircling(false);
    } catch (e) {
      AppAlert.alert('Not saved', apiErr(e, 'Could not set the profile photo.'));
    } finally {
      setSaving(false);
    }
  };

  const back = () => {
    if (saving) return;
    if (cropping) setCropping(false);
    else if (circling) setCircling(false);
    else onClose();
  };

  return (
    <Modal visible={!!student} animationType="fade" statusBarTranslucent onRequestClose={back}>
      {!!student && !!image && cropping ? (
        <PhotoEditorView uri={image} doneLabel="Save" busy={saving} showCircle={false} onCancel={back} onDone={save} />
      ) : !!student && !!image && circling ? (
        <PhotoCircleView uri={image} circle={circle} doneLabel="Save" busy={saving} onCancel={back} onDone={saveCircle} />
      ) : (
        <View style={[s.root, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 }]}>
          <View style={s.top}>
            <Text style={s.name} numberOfLines={1}>
              {student?.full_name ?? ''}
            </Text>
            {!!image && (
              <TouchableOpacity style={s.btn} onPress={() => setCropping(true)} hitSlop={8} activeOpacity={0.7}>
                <VectorIcon iconSet="Ionicons" iconName="crop-outline" size={20} color="#fff" />
              </TouchableOpacity>
            )}
            {!!image && (
              <TouchableOpacity
                style={s.btn}
                onPress={() => setCircling(true)}
                hitSlop={8}
                activeOpacity={0.7}
                accessibilityLabel="Profile photo"
              >
                <VectorIcon iconSet="Ionicons" iconName="person-circle-outline" size={22} color="#fff" />
              </TouchableOpacity>
            )}
            <TouchableOpacity style={s.btn} onPress={onClose} hitSlop={8} activeOpacity={0.7}>
              <VectorIcon iconSet="Ionicons" iconName="close" size={22} color="#fff" />
            </TouchableOpacity>
          </View>

          <View style={s.stage}>
            {!!image && <Image source={{ uri: image }} style={s.photo} resizeMode="contain" />}
          </View>
        </View>
      )}
    </Modal>
  );
};

export default StudentPhotoModal;

// Always dark, as the photo editor.
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  top: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingBottom: 8 },
  name: { flex: 1, fontSize: 16, fontWeight: '600', color: '#fff' },
  btn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 12 },
  photo: { width: '100%', height: '100%' },
});
