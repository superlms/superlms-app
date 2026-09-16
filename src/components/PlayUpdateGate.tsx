import React, { useEffect } from 'react';
import {
  BackHandler,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { startPlayUpdate, usePlayUpdateStatus } from '../utils/playUpdate';
import { theme } from '../utils/theme';

/**
 * Keeps the app behind an "Update required" card while a newer build is on the
 * Play Store and hasn't been installed (see utils/playUpdate). Play's own
 * update screen opens by itself; this card is what's left if it is closed, and
 * "Update now" opens it again. It takes every touch, and Back does nothing, so
 * neither login nor any screen behind can be used until the app is updated.
 */
const PlayUpdateGate = () => {
  const status = usePlayUpdateStatus();
  const required = status === 'required';

  useEffect(() => {
    if (!required) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, [required]);

  if (!required) return null;

  return (
    <View style={s.overlay} onStartShouldSetResponder={() => true}>
      <View style={s.center}>
        <View style={s.card}>
          <View style={s.cardBody}>
            <Text style={s.title}>Update required</Text>
            <Text style={s.desc}>
              A new version of SuperLMS is available on the Play Store. Update
              to keep using the app.
            </Text>
          </View>
          <View style={s.divider} />
          <TouchableOpacity
            style={s.action}
            activeOpacity={0.6}
            onPress={startPlayUpdate}
          >
            <Text style={s.actionText}>Update now</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

export default PlayUpdateGate;

const s = StyleSheet.create({
  // Covers the whole app, status bar strip included.
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
    elevation: 1000,
    backgroundColor: theme.colors.background,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },

  // Same card as the app lock: title and reason, a full-width rule, then the action
  card: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  cardBody: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 20 },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    textAlign: 'center',
  },
  desc: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  divider: { height: 1, backgroundColor: theme.colors.border },
  action: { height: 52, alignItems: 'center', justifyContent: 'center' },
  actionText: { fontSize: 15, fontWeight: '600', color: theme.colors.primary },
});
