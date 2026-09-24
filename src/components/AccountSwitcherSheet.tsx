import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { CommonActions, useNavigation } from '@react-navigation/native';
import { initialWindowMetrics, useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import VectorIcon from './VectorIcon';
import { useKeyboardHeight } from '../hooks/useKeyboardLift';
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
  verifyAddAccountOtp,
  type AddAccountOtp,
  type AddAccountResult,
} from '../api/switchAccountApi';
import { resendLoginOtp } from '../api/authApi';

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
  // Inside the popup the screen's insets can come through as zero — the
  // navigators nest their own providers within the app's safe area — which left
  // the status bar dimmed and slid the sheet under the navigation bar. The
  // window's own insets, measured at launch, fill in.
  const contextInsets = useSafeAreaInsets();
  const insets = {
    top: Math.max(contextInsets.top, initialWindowMetrics?.insets.top ?? 0),
    bottom: Math.max(contextInsets.bottom, initialWindowMetrics?.insets.bottom ?? 0),
  };

  // The sheet rides up with the keyboard as it opens, instead of jumping.
  const keyboardHeight = useKeyboardHeight();
  const liftStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -Math.max(0, keyboardHeight.value - insets.bottom) }],
  }));

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
  // The last try failed on the password itself — offer to reset it.
  const [wrongPassword, setWrongPassword] = useState(false);
  // A school admin's account waits on the code mailed to them.
  const [otpStep, setOtpStep] = useState<AddAccountOtp | null>(null);
  const [otp, setOtp] = useState('');
  // Bumped when a code is refused, so the six boxes start empty again.
  const [otpRound, setOtpRound] = useState(0);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn(v => v - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

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
    setWrongPassword(false);
    setOtpStep(null);
    setOtp('');
    setResendIn(0);
  };

  // Saves an added account and goes back to the list.
  const saveAdded = async ({ account, token }: AddAccountResult) => {
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
  };

  const messageOf = (err: any, fallback: string) =>
    err?.response?.data?.message ?? err?.response?.data?.error ?? err?.message ?? fallback;

  const onSubmitAdd = async () => {
    const id = identifier.trim();
    if (!id) {
      setAddError('Please enter your admission number or username.');
      return;
    }
    if (!password) {
      setAddError('Please enter your password.');
      return;
    }
    setAddError('');
    setWrongPassword(false);
    setAdding(true);
    try {
      // No login_type — the backend auto-detects the role from the identifier.
      const res = await addAccount({ identifier: id, password, otpSupported: true });
      if ('otpRequired' in res) {
        // A school admin: the code the server has just mailed comes next.
        setOtpStep(res);
        setOtp('');
        setResendIn(res.resendIn);
        return;
      }
      await saveAdded(res);
    } catch (err: any) {
      const msg = messageOf(err, 'Could not add the account. Please check your credentials.');
      setAddError(msg);
      // A wrong admission number, username or email gets no reset offer — only a wrong
      // password ("The provided password is incorrect."), whatever the status.
      setWrongPassword(/password/i.test(String(msg)) && /incorrect|invalid|wrong/i.test(String(msg)));
    } finally {
      setAdding(false);
    }
  };

  const onSubmitOtp = async () => {
    if (!otpStep) return;
    if (!/^\d{6}$/.test(otp)) {
      setAddError('Please enter the 6-digit code.');
      return;
    }
    setAddError('');
    setAdding(true);
    try {
      await saveAdded(await verifyAddAccountOtp(otpStep.userId, otpStep.otpToken, otp));
    } catch (err: any) {
      setOtp('');
      setOtpRound(n => n + 1);
      setAddError(messageOf(err, 'Could not verify the code. Please try again.'));
    } finally {
      setAdding(false);
    }
  };

  const onResendOtp = async () => {
    if (!otpStep || resendIn > 0) return;
    setAddError('');
    try {
      const { resendIn: wait } = await resendLoginOtp(otpStep.userId, otpStep.otpToken, 'switch');
      setResendIn(wait);
    } catch (err: any) {
      const msg = messageOf(err, 'Could not send a new code.');
      const waitMatch = String(msg).match(/(\d+)\s*second/i);
      if (waitMatch) setResendIn(parseInt(waitMatch[1], 10));
      setAddError(msg);
    }
  };

  // Reset the password on the Forgot Password screen; once it is changed there,
  // that screen adds this account with the new password.
  const onForgot = () => {
    const id = identifier.trim();
    resetAddForm();
    setMode('list');
    onClose();
    navigation.navigate('ForgotPassword', {
      addAccountIdentifier: id,
      // The reset takes the same identifier, so whatever was typed carries over.
      identifier: id || undefined,
    });
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    // Drawn under the status and navigation bars, so Android does not recolour
    // them for the popup's own window; a strip in the status bar's colour keeps
    // it exactly as it is on every screen.
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <View style={s.backdrop}>
        {/* Tap outside to close */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[s.statusStrip, { height: insets.top }]} />
        <Animated.View style={liftStyle}>
          <View style={[s.sheet, { paddingBottom: insets.bottom + 16 }]}>
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
              otpStep ? (
                <OtpBody
                  email={otpStep.email}
                  round={otpRound}
                  setOtp={t => {
                    setOtp(t.replace(/\D/g, '').slice(0, 6));
                    setAddError('');
                  }}
                  error={addError}
                  resendIn={resendIn}
                  onResend={onResendOtp}
                  loading={adding}
                  onSubmit={onSubmitOtp}
                />
              ) : (
              <AddBody
                identifier={identifier}
                setIdentifier={t => {
                  setIdent(t);
                  setAddError('');
                  setWrongPassword(false);
                }}
                password={password}
                setPassword={t => {
                  setPassword(t);
                  setAddError('');
                }}
                showPass={showPass}
                toggleShowPass={() => setShowPass(v => !v)}
                error={addError}
                showForgot={wrongPassword}
                onForgot={onForgot}
                loading={adding}
                onSubmit={onSubmitAdd}
              />
              )
            )}
          </View>
        </Animated.View>
      </View>

      {/* Remove confirmation, the same plain dialog as everywhere else */}
      <Modal
        transparent
        statusBarTranslucent
        visible={!!removeTarget}
        animationType="fade"
        onRequestClose={() => setRemoveTarget(null)}
      >
        <View style={s.confirmOverlay}>
          <View style={[s.statusStrip, { height: insets.top }]} />
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
        // An admin or accounts login has no photo of its own: it wears the school's logo.
        const isOrgAccount = acct.user_type === 'admin' || acct.user_type === 'accounts';
        const photo = acct.image || (isOrgAccount ? acct.organization?.logo : null);

        return (
          <View key={acct.user_id}>
            <TouchableOpacity
              activeOpacity={0.6}
              onPress={() => onSwitch(acct)}
              disabled={isActive || isBusy}
              style={s.row}
            >
              <Avatar uri={photo} name={acct.name} />
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
                <TouchableOpacity
                  onPress={() => onRemove(acct)}
                  hitSlop={10}
                  activeOpacity={0.6}
                  accessibilityLabel={`Remove ${acct.name}`}
                >
                  <VectorIcon iconSet="Ionicons" iconName="trash-outline" size={20} color={theme.colors.textMuted} />
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
  /** The password was wrong — offer to reset it. */
  showForgot: boolean;
  onForgot: () => void;
  loading: boolean;
  onSubmit: () => void;
}

const AddBody = (p: AddBodyProps) => {
  // The field being typed in wears the blue outline.
  const [focused, setFocused] = useState<'identifier' | 'password' | null>(null);

  return (
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.addContent} showsVerticalScrollIndicator={false}>
      {/* Identifier — the role is worked out from it: admission number for a
          student, username for a teacher, email for the school's own staff */}
      <Text style={s.label}>Admission number or username</Text>
      <TextInput
        placeholder="2026DMO650015 or meera@tds"
        placeholderTextColor={theme.colors.textMuted}
        value={p.identifier}
        onChangeText={p.setIdentifier}
        onFocus={() => setFocused('identifier')}
        onBlur={() => setFocused(null)}
        autoCapitalize="none"
        autoCorrect={false}
        style={[s.field, focused === 'identifier' && s.fieldFocused]}
      />

      <Text style={[s.label, s.labelGap]}>Password</Text>
      <View style={[s.field, s.passField, focused === 'password' && s.fieldFocused]}>
        <TextInput
          placeholder="Enter password"
          placeholderTextColor={theme.colors.textMuted}
          secureTextEntry={!p.showPass}
          value={p.password}
          onChangeText={p.setPassword}
          onFocus={() => setFocused('password')}
          onBlur={() => setFocused(null)}
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

      {p.showForgot && (
        <TouchableOpacity onPress={p.onForgot} hitSlop={8} activeOpacity={0.6} style={s.forgotBtn}>
          <Text style={s.forgotText}>Forgot password?</Text>
        </TouchableOpacity>
      )}

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
};

// ─── Code boxes ───────────────────────────────────────────────────────────────
// The Verify OTP screen's six boxes: tap any box and retype just that digit.
// Typing auto-advances, backspace on an empty box steps back, and pasting a
// full code from the keyboard fills the row.
const OtpBoxes = ({
  boxWidth,
  rowWidth,
  onChange,
}: {
  boxWidth: number;
  rowWidth: number;
  onChange: (code: string) => void;
}) => {
  const refs = useRef<(TextInput | null)[]>([]);
  const [digits, setDigits] = useState<string[]>(Array(6).fill(''));
  const [focusedIndex, setFocusedIndex] = useState(-1);

  const update = (next: string[]) => {
    setDigits(next);
    onChange(next.join(''));
  };

  const handleChange = (index: number, text: string) => {
    const typed = text.replace(/\D/g, '');
    const next = [...digits];
    if (!typed) {
      next[index] = '';
      update(next);
      return;
    }
    if (typed.length > 2) {
      let i = index;
      for (const char of typed) {
        if (i > 5) break;
        next[i] = char;
        i += 1;
      }
      update(next);
      refs.current[Math.min(i, 5)]?.focus();
      return;
    }
    next[index] = typed[typed.length - 1];
    update(next);
    if (index < 5) {
      refs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (index: number, key: string) => {
    if (key === 'Backspace' && !digits[index] && index > 0) {
      const next = [...digits];
      next[index - 1] = '';
      update(next);
      refs.current[index - 1]?.focus();
    }
  };

  return (
    <View style={[s.otpContainer, { width: rowWidth }]}>
      {digits.map((digit, index) => (
        <TextInput
          key={index}
          ref={r => {
            refs.current[index] = r;
          }}
          style={[
            s.otpBox,
            { width: boxWidth },
            (focusedIndex === index || !!digit) && s.otpBoxActive,
          ]}
          value={digit}
          onChangeText={t => handleChange(index, t)}
          onKeyPress={e => handleKeyPress(index, e.nativeEvent.key)}
          onFocus={() => setFocusedIndex(index)}
          onBlur={() => setFocusedIndex(-1)}
          keyboardType="number-pad"
          maxLength={6}
          selectTextOnFocus
          textContentType="oneTimeCode"
          autoComplete="sms-otp"
          autoFocus={index === 0}
        />
      ))}
    </View>
  );
};

// ─── Code body (a school admin's account) ─────────────────────────────────────
interface OtpBodyProps {
  email: string;
  /** Changes when a code is refused, which empties the boxes. */
  round: number;
  setOtp: (t: string) => void;
  error: string;
  resendIn: number;
  onResend: () => void;
  loading: boolean;
  onSubmit: () => void;
}

const OtpBody = (p: OtpBodyProps) => {
  // Boxes sized as on the Verify OTP screen, so the row always fits.
  const { width: windowWidth } = useWindowDimensions();
  const otpGap = theme.spacing.xs;
  const otpBoxWidth = Math.min(48, Math.floor((windowWidth - theme.spacing.lg * 4 - otpGap * 5) / 6));
  const otpRowWidth = otpBoxWidth * 6 + otpGap * 5;

  return (
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.addContent} showsVerticalScrollIndicator={false}>
      <Text style={s.label}>Enter the 6-digit code sent to {p.email}</Text>
      <OtpBoxes key={p.round} boxWidth={otpBoxWidth} rowWidth={otpRowWidth} onChange={p.setOtp} />

      {!!p.error && <Text style={s.errorText}>{p.error}</Text>}

      {p.resendIn > 0 ? (
        <Text style={s.resendWait}>
          Resend code in {Math.floor(p.resendIn / 60)}:{String(p.resendIn % 60).padStart(2, '0')}
        </Text>
      ) : (
        <TouchableOpacity onPress={p.onResend} hitSlop={8} activeOpacity={0.6} style={s.forgotBtn}>
          <Text style={s.forgotText}>Resend code</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        activeOpacity={0.85}
        onPress={p.onSubmit}
        disabled={p.loading}
        style={[s.saveBtn, p.loading && s.saveBtnBusy]}
      >
        {p.loading ? (
          <ActivityIndicator color={theme.colors.white} />
        ) : (
          <Text style={s.saveBtnText}>Verify & add</Text>
        )}
      </TouchableOpacity>

      <Text style={s.hint}>School admin accounts are added once the emailed code is confirmed.</Text>
    </ScrollView>
  );
};

// ─── Styles ──────────────────────────────────────────────────────────────────
const __mk_s = () => StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  // The status bar's own colour over the dimmed backdrop.
  statusStrip: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: theme.colors.statusBar,
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
  // No fill: the outline takes the grey the fill used to be, and turns blue
  // while typing.
  field: {
    borderWidth: 1,
    borderColor: theme.colors.background,
    borderRadius: theme.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: theme.colors.textPrimary,
  },
  passField: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 0 },
  passInput: { flex: 1, paddingVertical: 12, fontSize: 15, color: theme.colors.textPrimary },
  fieldFocused: { borderColor: theme.colors.primary },
  // The Verify OTP screen's boxes.
  otpContainer: { flexDirection: 'row', justifyContent: 'space-between', alignSelf: 'center', marginTop: 10 },
  otpBox: {
    width: 44,
    height: 50,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    textAlign: 'center',
    fontSize: 18,
    padding: 0,
    backgroundColor: theme.colors.surface,
    color: theme.colors.textPrimary,
  },
  otpBoxActive: { borderColor: '#5B7FFF' },
  resendWait: { fontSize: 13, color: theme.colors.textMuted, marginTop: 8 },

  errorText: { fontSize: 13, color: theme.colors.danger, lineHeight: 19, marginTop: 12 },
  forgotBtn: { alignSelf: 'flex-start', marginTop: 8 },
  forgotText: { fontSize: 13, fontWeight: '600', color: theme.colors.primary },

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
