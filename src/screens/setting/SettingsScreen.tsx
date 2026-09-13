import React, { useEffect, useState } from 'react';
import {
  Alert,
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
import { MenuRow, menuStyles } from '../more/menuUi';

const NOTIFICATIONS_KEY = 'notifications_enabled';

/**
 * Settings — a plain list like Exams and the More hub: each entry an icon, its
 * name and a line on what it does, with a Switch (toggles) or a chevron
 * (sub-screens) on the right.
 */

const SettingsScreen = () => {
  const navigation = useNavigation<any>();

  // ── Biometric unlock ────────────────────────────────────────────────────────
  const [bioEnabled, setBioEnabled] = useState(false);
  const [bioAvailable, setBioAvailable] = useState(true);
  const [bioBusy, setBioBusy] = useState(false);

  // ── Notifications (local toggle for now, persisted in AsyncStorage) ─────────
  const [notifEnabled, setNotifEnabled] = useState(true);

  useEffect(() => {
    (async () => {
      const [bio, sensor, notif] = await Promise.all([
        Biometrics.isEnabled(),
        Biometrics.check(),
        AsyncStorage.getItem(NOTIFICATIONS_KEY),
      ]);
      setBioEnabled(bio);
      setBioAvailable(sensor.available);
      // Default ON when the user has never toggled it.
      setNotifEnabled(notif === null ? true : notif === '1');
    })();
  }, []);

  const { refreshing, onRefresh } = useRefresh(() => {});

  const onBioToggle = async (next: boolean) => {
    if (bioBusy) return;
    setBioBusy(true);
    try {
      if (next) {
        const { available } = await Biometrics.check();
        if (!available) {
          setBioAvailable(false);
          Alert.alert(
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
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={menuStyles.list}
        refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <MenuRow
          icon="notifications-outline"
          title="Notifications"
          description="Alerts for homework, exams, fees and announcements"
          trailing={
            <Switch value={notifEnabled} onValueChange={onNotifToggle} {...switchColors} />
          }
        />

        <MenuRow
          icon="finger-print-outline"
          title="Biometric Unlock"
          description={
            bioAvailable
              ? 'Open the app with your fingerprint or face'
              : 'Not set up on this device'
          }
          trailing={
            <Switch
              value={bioEnabled}
              onValueChange={onBioToggle}
              disabled={bioBusy || (!bioAvailable && !bioEnabled)}
              {...switchColors}
            />
          }
        />

        <MenuRow
          icon="lock-closed-outline"
          title="Change Password"
          description="Update the password you sign in with"
          onPress={() => navigation.navigate('ChangePassword')}
          isLast
        />
      </ScrollView>
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
