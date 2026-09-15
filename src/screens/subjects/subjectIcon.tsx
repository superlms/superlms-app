import React, { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import VectorIcon from '../../components/VectorIcon';
import { theme, onThemeChange } from '../../utils/theme';
import { resolveFileUrl } from './subjectsUi';

/**
 * A subject's icon exactly as the server has it: the API sends each subject's
 * built-in icon (App\Support\SubjectIcons) as a picture link, and that picture
 * is shown as it is. Only while there is none, or it fails to load, does a
 * plain grey tile stand in.
 */
export const SubjectIcon = ({ image, size = 40 }: { image?: string | null; size?: number }) => {
  const [failed, setFailed] = useState(false);
  const uri = resolveFileUrl(image);
  const box = { width: size, height: size, borderRadius: Math.round(size * 0.2) };

  if (uri && !failed) {
    return <Image source={{ uri }} style={box} resizeMode="contain" onError={() => setFailed(true)} />;
  }

  return (
    <View style={[s.fallback, box]}>
      <VectorIcon
        iconSet="Ionicons"
        iconName="book-outline"
        size={Math.round(size * 0.55)}
        color={theme.colors.textMuted}
      />
    </View>
  );
};

const __mk_s = () => StyleSheet.create({
  fallback: {
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
