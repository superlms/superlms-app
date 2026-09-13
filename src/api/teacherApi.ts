import apiClient from './apiClient';
import type { CropRect } from '../components/PhotoCropper';

// ─── Teacher Profile ──────────────────────────────────────────────────────────
export const getTeacherProfile = async () => {
  const { data } = await apiClient.get('/teacher/profile');
  console.log('[getTeacherProfile] Raw response:', JSON.stringify(data, null, 2));
  return data?.data ?? data;
};

export interface PickedPhoto {
  uri: string;
  type: string;
  name: string;
  /** Upright pixel size, for the cropper. */
  width?: number;
  height?: number;
}

// Adds or replaces the teacher's own photo. The whole photo goes up with the
// square framed in the cropper; the server makes the cut. Returns the
// refreshed profile.
export const updateTeacherPhoto = async (photo: PickedPhoto, crop: CropRect) => {
  const form = new FormData();
  form.append('photo', {
    uri: photo.uri,
    type: photo.type || 'image/jpeg',
    name: photo.name || 'photo.jpg',
  } as any);
  form.append('crop_x', crop.x.toFixed(6));
  form.append('crop_y', crop.y.toFixed(6));
  form.append('crop_w', crop.w.toFixed(6));
  form.append('crop_h', crop.h.toFixed(6));

  const { data } = await apiClient.post('/teacher/profile/photo', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data?.data ?? data;
};
