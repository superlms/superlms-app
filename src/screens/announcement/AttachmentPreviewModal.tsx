import React, { useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import VectorIcon from '../../components/VectorIcon';
import { theme, onThemeChange } from '../../utils/theme';

const { width, height } = Dimensions.get('window');

interface Props {
  visible: boolean;
  accentColor: string;
  imageUrl?: string;
  onClose: () => void;
}

const AttachmentPreviewModal = ({
  visible,
  accentColor,
  imageUrl,
  onClose,
}: Props) => {
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={s.overlay}>
        {/* Header bar */}
        <View style={s.topBar}>
          <TouchableOpacity
            onPress={onClose}
            style={s.closeBtn}
            activeOpacity={0.8}
          >
            <VectorIcon
              iconSet="Ionicons"
              iconName="close"
              size={20}
              color="#fff"
            />
          </TouchableOpacity>
          <Text style={s.topTitle}>Image Preview</Text>
          <View style={{ width: 36 }} />
        </View>

        {/* Content */}
        <View style={s.content}>
          <View style={s.imageContainer}>
            {imageUrl && !failed ? (
              <>
                <Image
                  source={{ uri: imageUrl }}
                  style={s.image}
                  resizeMode="contain"
                  onLoadStart={() => setLoading(true)}
                  onLoadEnd={() => setLoading(false)}
                  onError={() => {
                    setLoading(false);
                    setFailed(true);
                  }}
                />
                {loading && (
                  <View style={s.loaderOverlay}>
                    <ActivityIndicator size="large" color={accentColor} />
                  </View>
                )}
              </>
            ) : (
              <View style={s.placeholderBox}>
                <View
                  style={[
                    s.iconRing,
                    {
                      backgroundColor: accentColor + '20',
                      borderColor: accentColor + '40',
                    },
                  ]}
                >
                  <VectorIcon
                    iconSet="Ionicons"
                    iconName="image-outline"
                    size={48}
                    color={accentColor}
                  />
                </View>
                <Text style={s.placeholderLabel}>
                  {failed ? 'Failed to load image' : 'No image available'}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Bottom action */}
        <View style={s.bottomBar}>
          <TouchableOpacity
            onPress={onClose}
            style={[s.doneBtn, { backgroundColor: accentColor }]}
            activeOpacity={0.85}
          >
            <Text style={s.doneBtnText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

export default AttachmentPreviewModal;

const __mk_s = () => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: '#000000EE',
    justifyContent: 'space-between',
  },

  // Top bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 52,
    paddingBottom: 16,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ffffff20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },

  // Content
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  imageContainer: {
    width: width - 32,
    height: height * 0.6,
    borderRadius: theme.radius.lg,
    overflow: 'hidden',
    backgroundColor: '#111',
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  loaderOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Placeholder
  placeholderBox: { alignItems: 'center', gap: 16, paddingHorizontal: 24 },
  iconRing: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
  },

  // Bottom
  bottomBar: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 16,
  },
  doneBtn: {
    borderRadius: theme.radius.full,
    paddingVertical: 14,
    alignItems: 'center',
  },
  doneBtnText: { fontSize: 15, fontWeight: '800', color: '#fff' },
});


// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
