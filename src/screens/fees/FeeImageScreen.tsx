import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import VectorIcon from '../../components/VectorIcon';
import { DocHeader } from '../more/docUi';
import { theme, onThemeChange } from '../../utils/theme';
import { ZoomImage } from '../chats/ChatMediaScreen';

/**
 * The school's payment QR, or a payment screenshot, full screen — to pinch or
 * double-tap to zoom, or to hold up for another phone to scan.
 *
 * Route params:
 *   uri   – the image's link
 *   title – for the header
 */
const FeeImageScreen = ({ navigation, route }: any) => {
  const uri: string | undefined = route?.params?.uri;
  const title: string = route?.params?.title || 'Image';
  const [failed, setFailed] = useState(!uri);

  return (
    <View style={s.root}>
      <DocHeader title={title} onBackPress={() => navigation.goBack()} />
      {failed ? (
        <View style={s.center}>
          <VectorIcon iconSet="Ionicons" iconName="image-outline" size={32} color={theme.colors.textMuted} />
          <Text style={s.stateText}>Couldn’t open this image.</Text>
        </View>
      ) : (
        <View style={s.stage}>
          <ZoomImage uri={uri!} onError={() => setFailed(true)} />
        </View>
      )}
    </View>
  );
};

export default FeeImageScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  // A QR reads best on white, and so does a screenshot of a white app.
  stage: { flex: 1, backgroundColor: '#FFFFFF', overflow: 'hidden' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24 },
  stateText: { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center', lineHeight: 20 },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
