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
  subtitle?: string;
  subtitleIcon?: string;
  onBellPress?: () => void;
  onAvatarPress?: () => void;
}

// White header + status-bar area with dark content.
const HEADER_BG = '#FFFFFF';
const HEADER_TOP = '#FFFFFF';

const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  return 'Good Evening';
};

const TopBar = ({
  userName,
  onBellPress,
  onAvatarPress,
}: TopBarProps) => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const unreadCount = useUnreadCount();
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [displayName, setDisplayName]   = useState<string>(userName ?? '');
  const [avatarUri, setAvatarUri]       = useState<string | null>(null);
  const [avatarBroken, setAvatarBroken] = useState(false);

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
      <StatusBar
        translucent={false}
        backgroundColor={HEADER_TOP}
        barStyle="dark-content"
      />
      {/* Paint the safe-area inset (notch / status-bar strip) white. */}
      <View
        style={[styles.statusBackdrop, { top: -insets.top, height: insets.top }]}
      />

      {/* Row 1: menu · greeting+name · bell · avatar */}
      <View style={styles.wrap}>
        <TouchableOpacity
          onPress={openDrawer}
          activeOpacity={0.7}
          style={styles.menuBtn}
        >
          <VectorIcon iconSet="Feather" iconName="menu" size={20} color={theme.colors.primary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.userInfo}
          activeOpacity={0.7}
          onPress={() => setSwitcherOpen(true)}
        >
          <Text style={styles.greeting}>{getGreeting()} 👋</Text>
          <View style={styles.nameRow}>
            <Text style={styles.userName} numberOfLines={1}>
              {displayName || 'Account'}
            </Text>
            <VectorIcon
              iconSet="Feather"
              iconName="chevron-down"
              size={16}
              color={theme.colors.textSecondary}
            />
          </View>
        </TouchableOpacity>

        <TouchableOpacity onPress={onBellPress} style={styles.iconBtn}>
          <VectorIcon
            iconSet="Ionicons"
            iconName="notifications-outline"
            size={19}
            color={theme.colors.primary}
          />
          {unreadCount > 0 && (
            <View style={styles.bellBadge}>
              <Text style={styles.bellBadgeText}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={onAvatarPress} style={[styles.iconBtn, styles.avatarBtn]}>
          {avatarUri && !avatarBroken ? (
            <Image
              source={{ uri: avatarUri }}
              onError={() => setAvatarBroken(true)}
              style={styles.avatarImg}
            />
          ) : (
            <VectorIcon
              iconSet="Ionicons"
              iconName="person-circle"
              size={26}
              color={theme.colors.primary}
            />
          )}
        </TouchableOpacity>
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
    backgroundColor: HEADER_TOP,
  },
  container: {
    backgroundColor: HEADER_BG,
    paddingTop: theme.spacing.md,
    paddingBottom: 14,
    // Flat header: a 1px divider below the status bar and below the bar itself.
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: theme.colors.border,
  },
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: theme.spacing.lg,
  },
  menuBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  greeting: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.textSecondary,
    letterSpacing: 0.3,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.textPrimary,
    flexShrink: 1,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    borderRadius: 8,
    backgroundColor: '#EF4444',
    borderWidth: 1.5,
    borderColor: HEADER_BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
    lineHeight: 11,
  },
  avatarBtn: {
    backgroundColor: theme.colors.primaryLight,
    overflow: 'hidden',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
    borderRadius: theme.radius.full,
    resizeMode: 'cover',
  },
});


// Themed stylesheets — rebuilt on light/dark toggle.
let styles = __mk_styles();
onThemeChange(() => { styles = __mk_styles(); });
