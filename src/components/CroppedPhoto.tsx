import React from 'react';
import { Image, View } from 'react-native';
import type { CropRect } from './PhotoCropper';

/**
 * A photo showing only the square framed in PhotoCropper, before the server
 * has cut it — the form's preview of what will be saved. `style` gives the
 * box its shape (a circle, say); the box is `size` square.
 */
const CroppedPhoto = ({ uri, crop, size, style }: { uri: string; crop: CropRect; size: number; style?: any }) => {
  // The whole photo drawn so that the framed square fills the box.
  const width = size / crop.w;
  const height = size / crop.h;
  return (
    <View style={[style, { width: size, height: size, overflow: 'hidden' }]}>
      <Image
        source={{ uri }}
        resizeMethod="resize"
        style={{ position: 'absolute', width, height, left: -crop.x * width, top: -crop.y * height }}
      />
    </View>
  );
};

export default CroppedPhoto;
