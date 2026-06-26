import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Types ────────────────────────────────────────────────────────────────────

export type AccountType = 'student' | 'teacher' | 'admin' | 'accounts';

export interface OrgRef {
  id:   number;
  name: string;
  logo?: string | null;
}

export interface StoredAccount {
  user_id:      number;
  user_type:    AccountType;
  name:         string;
  email?:       string;
  image?:       string | null;
  organization?: OrgRef | null;
  class_info?:  Record<string, any> | null;
  token:        string;
  added_at:     number;
}

// ─── Keys ─────────────────────────────────────────────────────────────────────

const K_LIST   = 'switch_accounts';
const K_ACTIVE = 'switch_active_user_id';

// Active session keys (already used elsewhere in the app)
const K_TOKEN  = 'auth_token';
const K_USER   = 'user_data';
const K_ROLE   = 'user_role';

// ─── Internals ────────────────────────────────────────────────────────────────

const readList = async (): Promise<StoredAccount[]> => {
  const raw = await AsyncStorage.getItem(K_LIST);
  if (!raw) return [];
  try { return JSON.parse(raw) as StoredAccount[]; } catch { return []; }
};

const writeList = (list: StoredAccount[]) =>
  AsyncStorage.setItem(K_LIST, JSON.stringify(list));

// ─── Public API ───────────────────────────────────────────────────────────────

export const listAccounts = readList;

export const getActiveAccountId = async (): Promise<number | null> => {
  const raw = await AsyncStorage.getItem(K_ACTIVE);
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) ? n : null;
};

export const getActiveAccount = async (): Promise<StoredAccount | null> => {
  const [id, list] = await Promise.all([getActiveAccountId(), readList()]);
  if (id == null) return null;
  return list.find(a => a.user_id === id) ?? null;
};

/**
 * Insert or refresh an account by user_id. Does NOT change the active account.
 */
export const upsertAccount = async (acct: StoredAccount): Promise<StoredAccount[]> => {
  const list = await readList();
  const idx  = list.findIndex(a => a.user_id === acct.user_id);
  if (idx >= 0) list[idx] = { ...list[idx], ...acct };
  else          list.push(acct);
  await writeList(list);
  return list;
};

/**
 * Remove an account from the local list. If it was the active one, the caller
 * is responsible for picking a new active or sending the user back to login.
 */
export const removeAccount = async (user_id: number): Promise<StoredAccount[]> => {
  const list = (await readList()).filter(a => a.user_id !== user_id);
  await writeList(list);
  const activeId = await getActiveAccountId();
  if (activeId === user_id) await AsyncStorage.removeItem(K_ACTIVE);
  return list;
};

/**
 * Make `user_id` the active account: copies its token, role, and a minimal
 * `user_data` blob into the keys that the rest of the app (apiClient, drawer)
 * already reads. Returns the activated account.
 */
export const activateAccount = async (user_id: number): Promise<StoredAccount | null> => {
  const list = await readList();
  const acct = list.find(a => a.user_id === user_id);
  if (!acct) return null;

  await AsyncStorage.multiSet([
    [K_TOKEN,  acct.token],
    [K_ROLE,   acct.user_type],
    [K_USER,   JSON.stringify({
      id:    acct.user_id,
      name:  acct.name,
      email: acct.email ?? '',
      role:  acct.user_type,
      image: acct.image ?? null,
    })],
    [K_ACTIVE, String(acct.user_id)],
  ]);

  return acct;
};

/**
 * One-shot bootstrap: ensure the currently-authenticated user (whose token
 * lives at `auth_token`) is represented in the account list and marked active.
 * Called the first time the switcher opens after a fresh login.
 */
export const bootstrapCurrent = async (snapshot: {
  user_id:      number;
  user_type:    AccountType;
  name:         string;
  email?:       string;
  image?:       string | null;
  organization?: OrgRef | null;
  class_info?:  Record<string, any> | null;
}): Promise<StoredAccount | null> => {
  const token = await AsyncStorage.getItem(K_TOKEN);
  if (!token) return null;

  const acct: StoredAccount = {
    ...snapshot,
    token,
    added_at: Date.now(),
  };
  await upsertAccount(acct);
  await AsyncStorage.setItem(K_ACTIVE, String(snapshot.user_id));
  return acct;
};

/**
 * Wipe the entire switcher state (used on hard logout).
 */
export const clearAllAccounts = () =>
  AsyncStorage.multiRemove([K_LIST, K_ACTIVE]);
