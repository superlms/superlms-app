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
import Header from '../../components/Header';
import VectorIcon from '../../components/VectorIcon';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useRefresh } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';
import { Biometrics } from '../../utils/biometrics';

const NOTIFICATIONS_KEY = 'notifications_enabled';

/**
 * Settings — announcement-card style hub, mirrors MoreScreen.
 * Each row is a card with an accent strip + tinted icon + title + subtitle,
 * and either an inline Switch (toggles) or a chevron (sub-screens).
 */

type IconSet = 'Ionicons' | 'Feather' | 'MaterialCommunityIcons';

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

  return (
    <View style={s.root}>
      <Header title="Settings" onBackPress={() => navigation.goBack()} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
        refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Text style={s.sectionTitle}>Preferences</Text>
        <Text style={s.sectionDesc}>
          Manage how the app notifies you and how you unlock it.
        </Text>

        {/* Notifications toggle */}
        <SettingCard
          accent="#F59E0B"
          icon="notifications"
          iconSet="Ionicons"
          title="Notifications"
          subtitle={notifEnabled ? 'You will receive app notifications' : 'App notifications are turned off'}
          trailing={
            <Switch
              value={notifEnabled}
              onValueChange={onNotifToggle}
              trackColor={{ false: theme.colors.border, true: '#FDE68A' }}
              thumbColor={notifEnabled ? '#F59E0B' : '#f4f3f4'}
            />
          }
        />

        {/* Biometric toggle */}
        <SettingCard
          accent="#10B981"
          icon="finger-print"
          iconSet="Ionicons"
          title="Biometric Unlock"
          subtitle={
            bioAvailable
              ? 'Unlock the app with fingerprint, face or PIN'
              : 'No fingerprint, face or screen lock set up'
          }
          trailing={
            <Switch
              value={bioEnabled}
              onValueChange={onBioToggle}
              disabled={bioBusy || (!bioAvailable && !bioEnabled)}
              trackColor={{ false: theme.colors.border, true: '#A7F3D0' }}
              thumbColor={bioEnabled ? '#10B981' : '#f4f3f4'}
            />
          }
        />

        <Text style={[s.sectionTitle, { marginTop: 8 }]}>Account</Text>
        <Text style={s.sectionDesc}>Security options for your account.</Text>

        {/* Change Password */}
        <SettingCard
          accent="#6366F1"
          icon="lock-closed"
          iconSet="Ionicons"
          title="Change Password"
          subtitle="Update your account password"
          onPress={() => navigation.navigate('ChangePassword')}
          trailing={
            <View style={s.chevron}>
              <VectorIcon iconSet="Ionicons" iconName="chevron-forward" size={16} color={theme.colors.textSecondary} />
            </View>
          }
        />
      </ScrollView>
    </View>
  );
};

const SettingCard = ({
  accent,
  icon,
  iconSet,
  title,
  subtitle,
  trailing,
  onPress,
}: {
  accent: string;
  icon: string;
  iconSet: IconSet;
  title: string;
  subtitle?: string;
  trailing?: React.ReactNode;
  onPress?: () => void;
}) => {
  const Container: any = onPress ? TouchableOpacity : View;
  const containerProps = onPress ? { activeOpacity: 0.85, onPress } : {};
  return (
    <Container {...containerProps} style={s.card}>
      <View style={[s.accentStrip, { backgroundColor: accent }]} />
      <View style={s.cardInner}>
        <View style={[s.iconWrap, { backgroundColor: accent + '18' }]}>
          <VectorIcon iconSet={iconSet as any} iconName={icon} size={22} color={accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>{title}</Text>
          {!!subtitle && (
            <Text style={s.subtitle} numberOfLines={2}>{subtitle}</Text>
          )}
        </View>
        {!!trailing && <View>{trailing}</View>}
      </View>
    </Container>
  );
};

export default SettingsScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  scroll: { padding: 16, paddingBottom: 32 },

  sectionTitle: { fontSize: 16, fontWeight: '800', color: theme.colors.textPrimary, marginBottom: 4 },
  sectionDesc: { fontSize: 13, color: theme.colors.textSecondary, lineHeight: 19, marginBottom: 16 },

  card: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    overflow: 'hidden',
    marginBottom: 12,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 3,
  },
  accentStrip: { height: 4, width: '100%' },
  cardInner: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  iconWrap: {
    width: 46,
    height: 46,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 15, fontWeight: '800', color: theme.colors.textPrimary, marginBottom: 2 },
  subtitle: { fontSize: 12, color: theme.colors.textMuted, fontWeight: '500', lineHeight: 17 },
  chevron: {
    width: 30,
    height: 30,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});


// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
