import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { CommonActions, useNavigation } from '@react-navigation/native';
import VectorIcon from './VectorIcon';
import { theme, onThemeChange } from '../utils/theme';
import {
  activateAccount,
  bootstrapCurrent,
  getActiveAccountId,
  listAccounts,
  removeAccount,
  upsertAccount,
  type AccountType,
  type StoredAccount,
} from '../utils/accountStore';
import {
  addAccount,
  fetchCurrentSnapshot,
  revokeAccountToken,
} from '../api/switchAccountApi';

type Mode = 'list' | 'add';

interface Props {
  visible: boolean;
  onClose: () => void;
}

/**
 * The account switcher: every account signed in on this device as a plain row
 * — photo, name, and who they are where — with a line between them. Tap one to
 * switch to it; the one in use carries a tick. Adding an account is a short
 * form in the same sheet.
 */

// ─── Helpers ──────────────────────────────────────────────────────────────────
const initialsOf = (name: string) =>
  name.trim().split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase() ?? '').join('') || '?';

// Where each account type lands when it becomes active.
const routeForType = (type: AccountType) => {
  switch (type) {
    case 'admin':
      return { name: 'AdminDashboard', params: undefined as any };
    case 'accounts':
      return { name: 'AccountsDashboard', params: undefined as any };
    default:
      return { name: 'DrawerRoot', params: { userRole: type } };
  }
};

// Human label for the account type.
const labelForType = (type: AccountType) => {
  switch (type) {
    case 'teacher':
      return 'Teacher';
    case 'admin':
      return 'Admin';
    case 'accounts':
      return 'Accounts';
    default:
      return 'Student';
  }
};

// ─── Avatar ───────────────────────────────────────────────────────────────────
const Avatar = ({ uri, name }: { uri?: string | null; name: string }) => {
  const [broken, setBroken] = useState(false);
  if (uri && !broken) {
    return <Image source={{ uri }} onError={() => setBroken(true)} style={s.avatar} />;
  }
  return (
    <View style={[s.avatar, s.avatarFallback]}>
      <Text style={s.avatarInitials}>{initialsOf(name)}</Text>
    </View>
  );
};

// ─── Sheet ────────────────────────────────────────────────────────────────────
const AccountSwitcherSheet = ({ visible, onClose }: Props) => {
  const navigation = useNavigation<any>();

  const [mode, setMode] = useState<Mode>('list');
  const [accounts, setAccounts] = useState<StoredAccount[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [bootstrapping, setBoot] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<StoredAccount | null>(null);

  // Add-account form state (role is auto-detected from the identifier)
  const [identifier, setIdent] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState('');

  const refresh = useCallback(async () => {
    const [list, id] = await Promise.all([listAccounts(), getActiveAccountId()]);
    setAccounts(list);
    setActiveId(id);
    return { list, id };
  }, []);

  // First-time bootstrap: if the active session isn't yet in the local list,
  // pull /switch-account/me and seed it.
  const bootstrap = useCallback(async () => {
    const { list, id } = await refresh();
    if (id != null && list.some(a => a.user_id === id)) return;
    setBoot(true);
    try {
      const snap = await fetchCurrentSnapshot();
      if (snap) {
        await bootstrapCurrent({
          user_id: snap.user_id,
          user_type: snap.user_type,
          name: snap.name,
          email: snap.email,
          image: snap.image,
          organization: snap.organization,
          class_info: snap.class_info,
        });
        await refresh();
      }
    } catch (e: any) {
      console.log('[AccountSwitcher] bootstrap failed:', e?.response?.status ?? e?.message);
    } finally {
      setBoot(false);
    }
  }, [refresh]);

  useEffect(() => {
    if (!visible) return;
    setMode('list');
    setAddError('');
    setRemoveTarget(null);
    bootstrap();
  }, [visible, bootstrap]);

  const sorted = useMemo(() => {
    if (!accounts.length) return [];
    const copy = [...accounts];
    copy.sort((a, b) => {
      if (a.user_id === activeId) return -1;
      if (b.user_id === activeId) return 1;
      return b.added_at - a.added_at;
    });
    return copy;
  }, [accounts, activeId]);

  // ─── Switch ────────────────────────────────────────────────────────────────
  const onSwitch = async (acct: StoredAccount) => {
    if (acct.user_id === activeId) return;
    setBusyId(acct.user_id);
    try {
      await activateAccount(acct.user_id);
      onClose();
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [routeForType(acct.user_type)],
        }),
      );
    } finally {
      setBusyId(null);
    }
  };

  // ─── Remove ────────────────────────────────────────────────────────────────
  const onRemove = (acct: StoredAccount) => setRemoveTarget(acct);

  const doRemove = async () => {
    const acct = removeTarget;
    if (!acct) return;
    setRemoveTarget(null);
    setBusyId(acct.user_id);
    try {
      await revokeAccountToken(acct.token); // best-effort
      const remaining = await removeAccount(acct.user_id);
      setAccounts(remaining);

      // After any removal, land on the dashboard of the account that is
      // (or becomes) active. Only fall back to select-user when nothing
      // remains.
      const next =
        acct.user_id === activeId
          ? remaining[0]
          : remaining.find(a => a.user_id === activeId) ?? remaining[0];

      if (next) {
        await activateAccount(next.user_id);
        setActiveId(next.user_id);
        onClose();
        navigation.dispatch(
          CommonActions.reset({
            index: 0,
            routes: [routeForType(next.user_type)],
          }),
        );
      } else {
        onClose();
        navigation.dispatch(
          CommonActions.reset({ index: 0, routes: [{ name: 'Login' }] }),
        );
      }
    } finally {
      setBusyId(null);
    }
  };

  // ─── Add account ───────────────────────────────────────────────────────────
  const resetAddForm = () => {
    setIdent('');
    setPassword('');
    setShowPass(false);
    setAddError('');
  };

  const onSubmitAdd = async () => {
    const id = identifier.trim();
    if (!id) {
      setAddError('Please enter your email or admission number.');
      return;
    }
    if (!password) {
      setAddError('Please enter your password.');
      return;
    }
    setAddError('');
    setAdding(true);
    try {
      // No login_type — the backend auto-detects the role from the identifier.
      const { account, token } = await addAccount({ identifier: id, password });

      // Don't allow adding the same account twice — just refresh its token.
      await upsertAccount({
        user_id: account.user_id,
        user_type: account.user_type,
        name: account.name,
        email: account.email,
        image: account.image,
        organization: account.organization,
        class_info: account.class_info,
        token,
        added_at: Date.now(),
      });

      resetAddForm();
      setMode('list');
      await refresh();
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ??
        err?.response?.data?.error ??
        err?.message ??
        'Could not add the account. Please check your credentials.';
      setAddError(msg);
    } finally {
      setAdding(false);
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.backdrop}>
        {/* Tap outside to close */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <KeyboardAvoidingView behavior="padding">
          <View style={s.sheet}>
            <View style={s.handle} />

            {/* Header */}
            <View style={s.header}>
              {mode === 'add' && (
                <TouchableOpacity
                  onPress={() => {
                    resetAddForm();
                    setMode('list');
                  }}
                  hitSlop={10}
                  activeOpacity={0.6}
                  style={s.back}
                >
                  <VectorIcon iconSet="Ionicons" iconName="chevron-back" size={22} color={theme.colors.textPrimary} />
                </TouchableOpacity>
              )}
              <Text style={s.title}>{mode === 'add' ? 'Add account' : 'Switch account'}</Text>
              <TouchableOpacity onPress={onClose} hitSlop={10} activeOpacity={0.6}>
                <VectorIcon iconSet="Ionicons" iconName="close" size={22} color={theme.colors.textMuted} />
              </TouchableOpacity>
            </View>

            {mode === 'list' ? (
              <ListBody
                bootstrapping={bootstrapping}
                accounts={sorted}
                activeId={activeId}
                busyId={busyId}
                onSwitch={onSwitch}
                onRemove={onRemove}
                onAdd={() => {
                  resetAddForm();
                  setMode('add');
                }}
              />
            ) : (
              <AddBody
                identifier={identifier}
                setIdentifier={t => {
                  setIdent(t);
                  setAddError('');
                }}
                password={password}
                setPassword={t => {
                  setPassword(t);
                  setAddError('');
                }}
                showPass={showPass}
                toggleShowPass={() => setShowPass(v => !v)}
                error={addError}
                loading={adding}
                onSubmit={onSubmitAdd}
              />
            )}
          </View>
        </KeyboardAvoidingView>
      </View>

      {/* Remove confirmation, the same plain dialog as everywhere else */}
      <Modal
        transparent
        visible={!!removeTarget}
        animationType="fade"
        onRequestClose={() => setRemoveTarget(null)}
      >
        <View style={s.confirmOverlay}>
          <View style={s.confirmCard}>
            <Text style={s.confirmTitle}>Remove account?</Text>
            <Text style={s.confirmDesc}>
              {removeTarget?.name} will be signed out on this device. You can add the account again
              any time.
            </Text>

            <View style={s.confirmActions}>
              <TouchableOpacity
                style={[s.confirmBtn, s.confirmBtnGhost]}
                activeOpacity={0.7}
                onPress={() => setRemoveTarget(null)}
              >
                <Text style={s.confirmBtnGhostText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[s.confirmBtn, s.confirmBtnDanger]} activeOpacity={0.85} onPress={doRemove}>
                <Text style={s.confirmBtnDangerText}>Remove</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </Modal>
  );
};

export default AccountSwitcherSheet;

// ─── List body ────────────────────────────────────────────────────────────────
interface ListBodyProps {
  bootstrapping: boolean;
  accounts: StoredAccount[];
  activeId: number | null;
  busyId: number | null;
  onSwitch: (a: StoredAccount) => void;
  onRemove: (a: StoredAccount) => void;
  onAdd: () => void;
}

//   (photo)  Amit Dagur                                   ✓
//            Student · Delhi Model School
const ListBody = ({ bootstrapping, accounts, activeId, busyId, onSwitch, onRemove, onAdd }: ListBodyProps) => {
  if (bootstrapping && accounts.length === 0) {
    return (
      <View style={s.loadingBox}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.listContent}>
      {accounts.map(acct => {
        const isActive = acct.user_id === activeId;
        const isBusy = acct.user_id === busyId;
        const meta = [labelForType(acct.user_type), acct.organization?.name || acct.email]
          .filter(Boolean)
          .join(' · ');

        return (
          <View key={acct.user_id}>
            <TouchableOpacity
              activeOpacity={0.6}
              onPress={() => onSwitch(acct)}
              disabled={isActive || isBusy}
              style={s.row}
            >
              <Avatar uri={acct.image} name={acct.name} />
              <View style={s.rowMain}>
                <Text style={[s.rowName, isActive && s.rowNameActive]} numberOfLines={1}>
                  {acct.name}
                </Text>
                <Text style={s.rowMeta} numberOfLines={1}>
                  {isActive ? `${meta} · In use` : meta}
                </Text>
              </View>

              {isBusy ? (
                <ActivityIndicator color={theme.colors.primary} />
              ) : isActive ? (
                <VectorIcon iconSet="Ionicons" iconName="checkmark-circle" size={22} color={theme.colors.primary} />
              ) : (
                <TouchableOpacity onPress={() => onRemove(acct)} hitSlop={10} activeOpacity={0.6}>
                  <Text style={s.removeText}>Remove</Text>
                </TouchableOpacity>
              )}
            </TouchableOpacity>
            <View style={s.rowDivider} />
          </View>
        );
      })}

      <TouchableOpacity activeOpacity={0.6} onPress={onAdd} style={s.row}>
        <View style={[s.avatar, s.addIcon]}>
          <VectorIcon iconSet="Ionicons" iconName="add" size={22} color={theme.colors.primary} />
        </View>
        <View style={s.rowMain}>
          <Text style={s.addText}>Add account</Text>
          <Text style={s.rowMeta}>Stay signed in to more than one account</Text>
        </View>
      </TouchableOpacity>
    </ScrollView>
  );
};

// ─── Add body ─────────────────────────────────────────────────────────────────
interface AddBodyProps {
  identifier: string;
  setIdentifier: (t: string) => void;
  password: string;
  setPassword: (t: string) => void;
  showPass: boolean;
  toggleShowPass: () => void;
  error: string;
  loading: boolean;
  onSubmit: () => void;
}

const AddBody = (p: AddBodyProps) => (
  <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.addContent} showsVerticalScrollIndicator={false}>
    {/* Identifier — role is auto-detected (admission number = student, email = staff) */}
    <Text style={s.label}>Email or admission number</Text>
    <TextInput
      placeholder="you@school.com or 2026DMO650015"
      placeholderTextColor={theme.colors.textMuted}
      value={p.identifier}
      onChangeText={p.setIdentifier}
      autoCapitalize="none"
      autoCorrect={false}
      style={s.field}
    />

    <Text style={[s.label, s.labelGap]}>Password</Text>
    <View style={[s.field, s.passField]}>
      <TextInput
        placeholder="Enter password"
        placeholderTextColor={theme.colors.textMuted}
        secureTextEntry={!p.showPass}
        value={p.password}
        onChangeText={p.setPassword}
        style={s.passInput}
      />
      <TouchableOpacity onPress={p.toggleShowPass} hitSlop={10} activeOpacity={0.6}>
        <VectorIcon
          iconSet="Ionicons"
          iconName={p.showPass ? 'eye-off-outline' : 'eye-outline'}
          size={20}
          color={theme.colors.textMuted}
        />
      </TouchableOpacity>
    </View>

    {!!p.error && <Text style={s.errorText}>{p.error}</Text>}

    <TouchableOpacity
      activeOpacity={0.85}
      onPress={p.onSubmit}
      disabled={p.loading}
      style={[s.saveBtn, p.loading && s.saveBtnBusy]}
    >
      {p.loading ? (
        <ActivityIndicator color={theme.colors.white} />
      ) : (
        <Text style={s.saveBtnText}>Add account</Text>
      )}
    </TouchableOpacity>

    <Text style={s.hint}>Your current account stays signed in. You can switch any time from here.</Text>
  </ScrollView>
);

// ─── Styles ──────────────────────────────────────────────────────────────────
const __mk_s = () => StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: theme.colors.card,
    borderTopLeftRadius: theme.radius.lg,
    borderTopRightRadius: theme.radius.lg,
    paddingBottom: 16,
    maxHeight: Dimensions.get('window').height * 0.85,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.border,
    marginTop: 10,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.divider,
  },
  back: { marginLeft: -4 },
  title: { flex: 1, fontSize: 17, fontWeight: '600', color: theme.colors.textPrimary },

  loadingBox: { paddingVertical: 48, alignItems: 'center' },

  // ─── List ──
  listContent: { paddingTop: 4, paddingBottom: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  rowDivider: { height: 1, backgroundColor: theme.colors.border, marginHorizontal: 20 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.background,
  },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarInitials: { fontSize: 14, fontWeight: '600', color: theme.colors.textSecondary },
  rowMain: { flex: 1, gap: 2 },
  rowName: { fontSize: 15, fontWeight: '500', color: theme.colors.textPrimary },
  rowNameActive: { fontWeight: '600' },
  rowMeta: { fontSize: 12, color: theme.colors.textMuted },
  removeText: { fontSize: 13, fontWeight: '500', color: theme.colors.textMuted },

  addIcon: { alignItems: 'center', justifyContent: 'center' },
  addText: { fontSize: 15, fontWeight: '600', color: theme.colors.primary },

  // ─── Remove confirmation ──
  confirmOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  confirmCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    padding: 24,
  },
  confirmTitle: { fontSize: 17, fontWeight: '600', color: theme.colors.textPrimary },
  confirmDesc: { marginTop: 8, fontSize: 14, color: theme.colors.textSecondary, lineHeight: 20 },
  confirmActions: { flexDirection: 'row', gap: 10, marginTop: 22 },
  confirmBtn: {
    flex: 1,
    height: 46,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnGhost: { borderWidth: 1, borderColor: theme.colors.border },
  confirmBtnGhostText: { fontSize: 15, fontWeight: '500', color: theme.colors.textPrimary },
  confirmBtnDanger: { backgroundColor: theme.colors.danger },
  confirmBtnDangerText: { fontSize: 15, fontWeight: '600', color: theme.colors.white },

  // ─── Add form ──
  addContent: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 8 },
  label: { fontSize: 13, fontWeight: '600', color: theme.colors.textSecondary, marginBottom: 8 },
  labelGap: { marginTop: 18 },
  field: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: theme.colors.textPrimary,
  },
  passField: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 0 },
  passInput: { flex: 1, paddingVertical: 12, fontSize: 15, color: theme.colors.textPrimary },

  errorText: { fontSize: 13, color: theme.colors.danger, lineHeight: 19, marginTop: 12 },

  saveBtn: {
    height: 48,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 22,
  },
  saveBtnBusy: { opacity: 0.7 },
  saveBtnText: { fontSize: 15, fontWeight: '600', color: theme.colors.white },

  hint: { fontSize: 12, color: theme.colors.textMuted, textAlign: 'center', lineHeight: 18, marginTop: 14 },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
