import React, { useEffect, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import VectorIcon from '../../components/VectorIcon';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useRefresh } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';
import { Biometrics } from '../../utils/biometrics';
import { DocHeader } from '../more/docUi';

const NOTIFICATIONS_KEY = 'notifications_enabled';

/**
 * Settings — one plain list on a white page, in the same minimal language as
 * the More hub: plain icons, inset hairline separators, and either an inline
 * Switch (toggles) or a chevron (sub-screens).
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
        contentContainerStyle={s.scroll}
        refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <SettingRow
          icon="notifications-outline"
          title="Notifications"
          trailing={
            <Switch value={notifEnabled} onValueChange={onNotifToggle} {...switchColors} />
          }
        />

        <SettingRow
          icon="finger-print-outline"
          title="Biometric Unlock"
          sub={bioAvailable ? undefined : 'Not set up on this device'}
          trailing={
            <Switch
              value={bioEnabled}
              onValueChange={onBioToggle}
              disabled={bioBusy || (!bioAvailable && !bioEnabled)}
              {...switchColors}
            />
          }
        />

        <SettingRow
          icon="lock-closed-outline"
          title="Change Password"
          onPress={() => navigation.navigate('ChangePassword')}
          trailing={
            <VectorIcon iconSet="Ionicons" iconName="chevron-forward" size={16} color={theme.colors.textMuted} />
          }
          isLast
        />
      </ScrollView>
    </View>
  );
};

const SettingRow = ({
  icon,
  title,
  sub,
  trailing,
  onPress,
  isLast,
}: {
  icon: string;
  title: string;
  sub?: string;
  trailing?: React.ReactNode;
  onPress?: () => void;
  isLast?: boolean;
}) => {
  const Container: any = onPress ? TouchableOpacity : View;
  const containerProps = onPress ? { activeOpacity: 0.6, onPress } : {};
  return (
    <Container {...containerProps} style={s.row}>
      <View style={s.icon}>
        <VectorIcon iconSet="Ionicons" iconName={icon} size={20} color={theme.colors.textSecondary} />
      </View>
      <View style={[s.rowMain, !isLast && s.rowBorder]}>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>{title}</Text>
          {!!sub && <Text style={s.sub}>{sub}</Text>}
        </View>
        {trailing}
      </View>
    </Container>
  );
};

export default SettingsScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  scroll: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 32 },

  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  icon: { width: 24, alignItems: 'center' },
  rowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 56,
    paddingVertical: 8,
  },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },
  title: { fontSize: 15, color: theme.colors.textPrimary },
  sub: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
});


// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
