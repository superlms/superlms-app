import AsyncStorage from '@react-native-async-storage/async-storage';
import { CommonActions } from '@react-navigation/native';
import { logout } from '../api/authApi';
import { revokeAccountToken } from '../api/switchAccountApi';
import {
  AccountType,
  activateAccount,
  clearAllAccounts,
  getActiveAccountId,
  listAccounts,
  removeAccount,
} from './accountStore';

// Where each account type lands when it becomes active — as the switcher does.
const routeForType = (type: AccountType) => {
  switch (type) {
    case 'admin':
      return { name: 'AdminDashboard' };
    case 'accounts':
      return { name: 'AccountsDashboard' };
    default:
      return { name: 'DrawerRoot', params: { userRole: type } };
  }
};

/** The signed-in user's id: the switcher's active account, else user_data. */
const currentUserId = async (): Promise<number | null> => {
  const id = await getActiveAccountId();
  if (id != null) return id;
  try {
    const n = Number(JSON.parse((await AsyncStorage.getItem('user_data')) ?? 'null')?.id);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
};

/**
 * Log out only the account in use. When the switcher still holds other
 * signed-in accounts — a student, a teacher, an admin on the same phone — the
 * next one opens on its own dashboard, as the student and teacher Log out
 * does; only when none is left does the Login screen come up.
 *
 * `rootNav` is the navigator the app's stack is reset on.
 */
export const logoutCurrentAccount = async (rootNav: any): Promise<void> => {
  try {
    const me = await currentUserId();
    const others = (await listAccounts()).filter(a => a.user_id !== me);

    if (others.length) {
      const token = await AsyncStorage.getItem('auth_token');
      if (token) {
        try {
          await revokeAccountToken(token); // best-effort
        } catch (e) {
          console.log('[Logout] Token revoke failed:', e);
        }
      }
      if (me != null) await removeAccount(me);

      const next = others[0];
      await activateAccount(next.user_id);
      console.log('[Logout] Switched to account:', next.user_id);
      rootNav.dispatch(CommonActions.reset({ index: 0, routes: [routeForType(next.user_type)] }));
      return;
    }

    // Nobody else is signed in here: the full logout, as before.
    try {
      await logout();
    } finally {
      await clearAllAccounts();
    }
  } catch (e) {
    console.log('[Logout] Error:', e);
  }

  rootNav.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'Login' }] }));
};
