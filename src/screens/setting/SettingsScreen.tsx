import React, { useCallback, useEffect, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useRefresh } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';
import { Biometrics } from '../../utils/biometrics';
import { DocHeader } from '../more/docUi';
import { MenuRow, MenuRowSkeleton, menuStyles } from '../more/menuUi';
import { AppAlert } from '../../components/AppDialog';
// The same key the notification display checks before showing a banner.
import { NOTIFICATIONS_ENABLED_KEY as NOTIFICATIONS_KEY } from '../../notifications/service';

// The rows in page order, for the skeleton: two switches, then a sub-screen.
const SKELETON_ROWS: ('switch' | 'chevron')[] = ['switch', 'switch', 'chevron'];

/**
 * Settings — a plain list like Exams and the More hub: each entry an icon, its
 * name and a few words on what it does (kept to one line), with a Switch
 * (toggles) or a chevron (sub-screens) on the right.
 */

const SettingsScreen = () => {
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(true);

  // ── Biometric unlock ────────────────────────────────────────────────────────
  const [bioEnabled, setBioEnabled] = useState(false);
  const [bioAvailable, setBioAvailable] = useState(true);
  const [bioBusy, setBioBusy] = useState(false);
  // The position the user just flipped the switch to, held while the system
  // prompt confirms it — so the switch stays where they put it instead of
  // snapping back before the prompt appears. Cleared once it is settled.
  const [bioPending, setBioPending] = useState<boolean | null>(null);

  // ── Notifications (local toggle for now, persisted in AsyncStorage) ─────────
  const [notifEnabled, setNotifEnabled] = useState(true);

  // Read the current settings off the device; the skeleton shows meanwhile, on
  // opening and while pulling to refresh.
  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const [bio, sensor, notif] = await Promise.all([
        Biometrics.isEnabled(),
        Biometrics.check(),
        AsyncStorage.getItem(NOTIFICATIONS_KEY),
      ]);
      setBioEnabled(bio);
      setBioAvailable(sensor.available);
      // Default ON when the user has never toggled it.
      setNotifEnabled(notif === null ? true : notif === '1');
    } catch (e: any) {
      console.log('[Settings] Could not read settings:', e?.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const { refreshing, onRefresh } = useRefresh(loadSettings);

  const onBioToggle = async (next: boolean) => {
    if (bioBusy) return;
    setBioBusy(true);
    setBioPending(next);
    try {
      if (next) {
        const { available } = await Biometrics.check();
        if (!available) {
          setBioAvailable(false);
          AppAlert.alert(
            'Biometric unavailable',
            'No fingerprint, face or screen lock is set up on this device. Add one in your phone settings first.',
          );
          return;
        }
        const success = await Biometrics.authenticate('Confirm to enable biometric unlock');
        if (success) {
          await Biometrics.setEnabled(true);
          setBioEnabled(true);
        }
      } else {
        const success = await Biometrics.authenticate('Confirm to disable biometric unlock');
        if (success) {
          await Biometrics.setEnabled(false);
          setBioEnabled(false);
        }
      }
    } finally {
      // Cancelled or failed: the switch goes back to what is saved.
      setBioPending(null);
      setBioBusy(false);
    }
  };

  const onNotifToggle = async (next: boolean) => {
    setNotifEnabled(next);
    await AsyncStorage.setItem(NOTIFICATIONS_KEY, next ? '1' : '0');
  };

  // One brand tint for every switch.
  const switchColors = {
    trackColor: { false: theme.colors.border, true: theme.colors.primary },
    thumbColor: theme.colors.white,
    ios_backgroundColor: theme.colors.border,
  };

  return (
    <View style={s.root}>
      <DocHeader title="Settings" onBackPress={() => navigation.goBack()} />

      {loading ? (
        <View style={menuStyles.list}>
          {SKELETON_ROWS.map((trailing, i) => (
            <MenuRowSkeleton
              key={i}
              index={i}
              trailing={trailing}
              isLast={i === SKELETON_ROWS.length - 1}
            />
          ))}
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={menuStyles.list}
          refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <MenuRow
            icon="notifications-outline"
            title="Notifications"
            description="Homework & exam alerts"
            trailing={
              <Switch value={notifEnabled} onValueChange={onNotifToggle} {...switchColors} />
            }
          />

          <MenuRow
            icon="finger-print-outline"
            title="Biometric Unlock"
            description={bioAvailable ? 'Fingerprint or face' : 'Not set up on this phone'}
            trailing={
              <Switch
                value={bioPending ?? bioEnabled}
                onValueChange={onBioToggle}
                disabled={!bioAvailable && !bioEnabled}
                {...switchColors}
              />
            }
          />

          <MenuRow
            icon="lock-closed-outline"
            title="Change Password"
            description="Update your password"
            onPress={() => navigation.navigate('ChangePassword')}
            isLast
          />
        </ScrollView>
      )}
    </View>
  );
};

export default SettingsScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
