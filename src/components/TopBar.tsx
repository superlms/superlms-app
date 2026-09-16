import React, { useCallback, useState } from 'react';
import {
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Image,
} from 'react-native';
import {
  DrawerActions,
  useFocusEffect,
  useNavigation,
} from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { theme, onThemeChange } from '../utils/theme';
import VectorIcon from './VectorIcon';
import AccountSwitcherSheet from './AccountSwitcherSheet';
import { getActiveAccount, upsertAccount } from '../utils/accountStore';
import { fetchCurrentSnapshot } from '../api/switchAccountApi';
import { useUnreadCount } from '../notifications';

interface TopBarProps {
  userName?: string;
  onBellPress?: () => void;
  onAvatarPress?: () => void;
  /**
   * Given, a messages icon takes the profile photo's place (the admin's bar:
   * notifications and messages only).
   */
  onMessagePress?: () => void;
  /**
   * Given (the admin's bar), the school's name is shown instead of the
   * person's, in the greeting's size.
   */
  school?: { name?: string } | null;
}

const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
};

/**
 * The dashboard's header: the menu, who is signed in (tap to switch account),
 * notifications and the profile photo — plain icons on white, with a thin line
 * under it like every other header. Without a photo, the profile is a plain
 * outline icon like the bell beside it. The admin's bar shows messages there
 * instead.
 */
const TopBar = ({ userName, onBellPress, onAvatarPress, onMessagePress, school }: TopBarProps) => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const unreadCount = useUnreadCount();
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [displayName, setDisplayName] = useState<string>(userName ?? '');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [avatarBroken, setAvatarBroken] = useState(false);
  const schoolMode = school !== undefined;

  const refreshAccount = useCallback(async () => {
    // Paint instantly from local data: the switcher's active account, or the
    // login session blob when the switcher was never used.
    const acct = await getActiveAccount();
    let name = acct?.name ?? '';
    let image = acct?.image ?? null;
    if (!name) {
      try {
        const raw = await AsyncStorage.getItem('user_data');
        const u = raw ? JSON.parse(raw) : null;
        name = u?.name ?? '';
        image = image ?? u?.image ?? null;
      } catch {}
    }
    setDisplayName(name || userName || '');
    setAvatarUri(image);
    setAvatarBroken(false);

    // Then refresh from the server so profile edits show up immediately.
    try {
      const snap = await fetchCurrentSnapshot();
      if (!snap?.name) return;
      setDisplayName(snap.name);
      setAvatarUri(snap.image ?? null);
      const raw = await AsyncStorage.getItem('user_data');
      if (raw) {
        const u = JSON.parse(raw);
        await AsyncStorage.setItem(
          'user_data',
          JSON.stringify({ ...u, name: snap.name, image: snap.image ?? null }),
        );
      }
      if (acct && acct.user_id === snap.user_id) {
        await upsertAccount({
          ...acct,
          name: snap.name,
          image: snap.image ?? null,
        });
      }
    } catch {}
  }, [userName]);

  // Re-fetch every time the screen regains focus (profile edit, account
  // switch, tab change) so the name is never stale.
  useFocusEffect(
    useCallback(() => {
      refreshAccount();
    }, [refreshAccount]),
  );

  // After the switcher closes the active account might have changed.
  const onSwitcherClose = () => {
    setSwitcherOpen(false);
    refreshAccount();
  };

  const openDrawer = () => {
    const parent = navigation.getParent?.();
    (parent ?? navigation).dispatch(DrawerActions.openDrawer());
  };

  return (
    <View style={styles.container}>
      {/* White status-bar tint with dark icons. */}
      <StatusBar translucent backgroundColor={theme.colors.statusBar} barStyle="dark-content" />
      {/* Paint the safe-area inset (notch / status-bar strip) white. */}
      <View style={[styles.statusBackdrop, { top: -insets.top, height: insets.top }]} />

      <View style={styles.wrap}>
        <TouchableOpacity onPress={openDrawer} activeOpacity={0.6} hitSlop={8} style={styles.iconBtn}>
          <VectorIcon iconSet="Feather" iconName="menu" size={21} color={theme.colors.textPrimary} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.userInfo} activeOpacity={0.6} onPress={() => setSwitcherOpen(true)}>
          <Text style={styles.greeting}>{getGreeting()}</Text>
          <View style={styles.nameRow}>
            <Text style={schoolMode ? styles.schoolName : styles.userName} numberOfLines={1}>
              {schoolMode ? school?.name || 'School' : displayName || 'Account'}
            </Text>
            <VectorIcon iconSet="Feather" iconName="chevron-down" size={17} color={theme.colors.textMuted} />
          </View>
        </TouchableOpacity>

        <TouchableOpacity onPress={onBellPress} activeOpacity={0.6} hitSlop={8} style={styles.iconBtn}>
          <VectorIcon iconSet="Ionicons" iconName="notifications-outline" size={21} color={theme.colors.textPrimary} />
          {unreadCount > 0 && (
            <View style={styles.bellBadge}>
              <Text style={styles.bellBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
            </View>
          )}
        </TouchableOpacity>

        {onMessagePress ? (
          <TouchableOpacity onPress={onMessagePress} activeOpacity={0.6} hitSlop={8} style={styles.iconBtn}>
            <VectorIcon iconSet="Ionicons" iconName="chatbubble-ellipses-outline" size={21} color={theme.colors.textPrimary} />
          </TouchableOpacity>
        ) : avatarUri && !avatarBroken ? (
          <TouchableOpacity onPress={onAvatarPress} activeOpacity={0.7} style={styles.avatar}>
            <Image source={{ uri: avatarUri }} onError={() => setAvatarBroken(true)} style={styles.avatarImg} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={onAvatarPress} activeOpacity={0.6} hitSlop={8} style={styles.iconBtn}>
            <VectorIcon iconSet="Ionicons" iconName="person-circle-outline" size={24} color={theme.colors.textPrimary} />
          </TouchableOpacity>
        )}
      </View>

      <AccountSwitcherSheet visible={switcherOpen} onClose={onSwitcherClose} />
    </View>
  );
};

export default TopBar;

const __mk_styles = () => StyleSheet.create({
  statusBackdrop: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: theme.colors.statusBar,
  },
  container: {
    backgroundColor: theme.colors.card,
    paddingTop: 10,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.divider,
  },
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
  },
  iconBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userInfo: {
    flex: 1,
    justifyContent: 'center',
    paddingLeft: 2,
  },
  greeting: {
    fontSize: 12,
    color: theme.colors.textMuted,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 1,
  },
  userName: {
    fontSize: 17,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    flexShrink: 1,
  },
  schoolName: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    flexShrink: 1,
  },
  bellBadge: {
    position: 'absolute',
    top: 3,
    right: 2,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    borderRadius: 8,
    backgroundColor: theme.colors.danger,
    borderWidth: 1.5,
    borderColor: theme.colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellBadgeText: {
    color: theme.colors.white,
    fontSize: 9,
    fontWeight: '700',
    lineHeight: 11,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginLeft: 4,
    overflow: 'hidden',
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let styles = __mk_styles();
onThemeChange(() => { styles = __mk_styles(); });
