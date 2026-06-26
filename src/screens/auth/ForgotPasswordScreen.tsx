import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Image,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  useWindowDimensions,
  Animated,
} from 'react-native';
import React, { useState, useEffect, useRef } from 'react';
import VectorIcon from '../../components/VectorIcon';
import { theme, onThemeChange } from '../../utils/theme';
import { useNavigation } from '@react-navigation/native';
import Header from '../../components/Header';
import {
  forgotPassword,
  verifyOtp,
  resendOtp,
  changePassword,
} from '../../api/authApi';

// Six independent boxes so the user can tap any box and retype just that
// digit (selectTextOnFocus replaces the old one). Typing auto-advances,
// backspace on an empty box steps back, and pasting a full code from the
// keyboard fills the row.
const OtpBoxes = ({
  boxWidth,
  rowWidth,
  onChange,
  onBoxFocus,
}: {
  boxWidth: number;
  rowWidth: number;
  onChange: (code: string) => void;
  onBoxFocus?: () => void;
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
      // Pasted code: fill boxes from this one onwards.
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
    // Keep the newest digit so typing on a filled box replaces it.
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
    <View
      style={[styles.otpContainer, { width: rowWidth, alignSelf: 'center' }]}
    >
      {digits.map((digit, index) => (
        <TextInput
          key={index}
          ref={r => {
            refs.current[index] = r;
          }}
          style={[
            styles.otpBox,
            { width: boxWidth },
            (focusedIndex === index || !!digit) && styles.otpBoxActive,
          ]}
          value={digit}
          onChangeText={t => handleChange(index, t)}
          onKeyPress={e => handleKeyPress(index, e.nativeEvent.key)}
          onFocus={() => {
            setFocusedIndex(index);
            onBoxFocus?.();
          }}
          onBlur={() => setFocusedIndex(-1)}
          keyboardType="number-pad"
          maxLength={6}
          selectTextOnFocus
          textContentType="oneTimeCode"
          autoComplete="sms-otp"
        />
      ))}
    </View>
  );
};

// Mirrors the backend change-password validation rules so the checklist
// and the API accept exactly the same passwords.
const passwordRules: { label: string; test: (p: string) => boolean }[] = [
  { label: 'At least 8 characters', test: p => p.length >= 8 },
  { label: 'One lowercase letter (a-z)', test: p => /[a-z]/.test(p) },
  { label: 'One uppercase letter (A-Z)', test: p => /[A-Z]/.test(p) },
  { label: 'One number (0-9)', test: p => /[0-9]/.test(p) },
  {
    label: 'One special character (@ $ ! % * # ? &)',
    test: p => /[@$!%*#?&]/.test(p),
  },
];

const ForgotPasswordScreen = () => {
  const navigation = useNavigation<any>();
  const scrollRef = useRef<ScrollView>(null);
  const [step, setStep] = useState(1);
  const { width: windowWidth } = useWindowDimensions();

  // Size OTP boxes from the screen width (minus screen + card padding and
  // the gaps) so the row always fits, and center the fixed-width row.
  const otpGap = theme.spacing.xs;
  const otpBoxWidth = Math.min(
    48,
    Math.floor((windowWidth - theme.spacing.lg * 4 - otpGap * 5) / 6),
  );
  const otpRowWidth = otpBoxWidth * 6 + otpGap * 5;

  // Edge-to-edge Android ignores adjustResize, so scroll the form above the
  // keyboard ourselves once the keyboard animation has started. Scroll only
  // up to the description so the view shows description → submit button.
  // The desc lives inside the card, so its scroll offset is cardY + descY.
  const cardYRef = useRef(0);
  const descYRef = useRef(0);
  const scrollFormIntoView = () => {
    setTimeout(
      () =>
        scrollRef.current?.scrollTo({
          y: Math.max(
            cardYRef.current + descYRef.current - theme.spacing.sm,
            0,
          ),
          animated: true,
        }),
      150,
    );
  };

  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [userId, setUserId] = useState<string | number>('');
  const [timer, setTimer] = useState(120);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [confirmFocused, setConfirmFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Error popup: slide up from the bottom, auto-dismiss after a few seconds.
  const errorAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!error) {
      errorAnim.setValue(0);
      return;
    }
    Animated.timing(errorAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
    const popupTimer = setTimeout(() => {
      Animated.timing(errorAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => setError(''));
    }, 4000);
    return () => clearTimeout(popupTimer);
  }, [error, errorAnim]);

  const handleBackPress = () => {
    if (step === 1) {
      navigation.goBack();
    } else {
      setStep(step - 1);
    }
  };

  // Timer for OTP
  useEffect(() => {
    if (step === 2 && timer > 0) {
      const interval = setInterval(() => {
        setTimer(prev => prev - 1);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [step, timer]);

  const formatTime = () => {
    const min = Math.floor(timer / 60);
    const sec = timer % 60;
    return `${min}:${sec < 10 ? '0' : ''}${sec}`;
  };
  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <>
            <View style={styles.iconBadge}>
              <Image source={{ uri: 'logo' }} style={styles.logo} />
            </View>
            <Text style={styles.heading}>Reset Password</Text>
            <Text
              style={styles.desc}
              onLayout={e => {
                descYRef.current = e.nativeEvent.layout.y;
              }}
            >
              Enter your registered email address to reset your account
              password.
            </Text>
            <Text style={styles.label}>Email Address</Text>
            <TextInput
              placeholder="name@school.com"
              placeholderTextColor={theme.colors.textMuted}
              style={[
                styles.input,
                (emailFocused || !!email) && styles.inputActive,
              ]}
              value={email}
              onChangeText={t => {
                setEmail(t);
                setError('');
              }}
              onFocus={() => {
                setEmailFocused(true);
                scrollFormIntoView();
              }}
              onBlur={() => setEmailFocused(false)}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <TouchableOpacity
              style={[
                styles.button,
                (loading || !email.trim()) && styles.buttonDisabled,
              ]}
              disabled={loading || !email.trim()}
              onPress={async () => {
                setLoading(true);
                setError('');
                try {
                  console.log('[ForgotPassword] ➡️ Request:', {
                    email: email.trim(),
                  });
                  const res = await forgotPassword(email.trim());
                  console.log(
                    '[ForgotPassword] ✅ Response:',
                    JSON.stringify(res, null, 2),
                  );
                  setUserId(res.user_id);
                  setTimer(120);
                  setStep(2);
                } catch (e: any) {
                  console.log(
                    '[ForgotPassword] ❌ Error:',
                    JSON.stringify(e?.response?.data, null, 2),
                  );
                  setError(
                    e?.response?.data?.message ??
                      e?.message ??
                      'Failed to send OTP. Please try again.',
                  );
                } finally {
                  setLoading(false);
                }
              }}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Get OTP</Text>
              )}
            </TouchableOpacity>
          </>
        );
      case 2:
        return (
          <>
            <View style={styles.iconBadge}>
              <Image source={{ uri: 'logo' }} style={styles.logo} />
            </View>
            <Text style={styles.heading}>Enter OTP</Text>
            <Text
              style={styles.desc}
              onLayout={e => {
                descYRef.current = e.nativeEvent.layout.y;
              }}
            >
              Enter the 6-digit code sent to {email || 'your registered email'}.
            </Text>
            <OtpBoxes
              boxWidth={otpBoxWidth}
              rowWidth={otpRowWidth}
              onChange={text => {
                setOtp(text);
                setError('');
              }}
              onBoxFocus={scrollFormIntoView}
            />
            <Text style={styles.infoText}>OTP sent to your email address</Text>
            {timer > 0 ? (
              <Text style={styles.timer}>Resend OTP in {formatTime()}</Text>
            ) : (
              <TouchableOpacity
                onPress={async () => {
                  try {
                    console.log('[ResendOTP] ➡️ Request:', {
                      email,
                      user_id: userId,
                    });
                    // If the user_id was lost (e.g. after a reload), request
                    // a fresh OTP through forgot-password instead of letting
                    // resend-otp fail with "user id field is required".
                    if (!userId) {
                      const res = await forgotPassword(email.trim());
                      setUserId(res.user_id);
                    } else {
                      const res = await resendOtp(email.trim(), userId);
                      if (!res.success) {
                        throw new Error(res.message);
                      }
                    }
                    console.log('[ResendOTP] ✅ OTP resent');
                    setTimer(120);
                    setError('');
                  } catch (e: any) {
                    console.log(
                      '[ResendOTP] ❌ Error:',
                      JSON.stringify(e?.response?.data, null, 2),
                    );
                    const msg =
                      e?.response?.data?.message ??
                      e?.message ??
                      'Failed to resend OTP.';
                    // The backend throttles OTP requests ("Please wait N
                    // seconds before requesting a new OTP."). Sync our
                    // countdown to it so Resend hides until it will succeed.
                    const waitMatch = String(msg).match(/(\d+)\s*second/i);
                    if (waitMatch) {
                      setTimer(parseInt(waitMatch[1], 10));
                    }
                    setError(msg);
                  }
                }}
              >
                <Text
                  style={[styles.timer, { textDecorationLine: 'underline' }]}
                >
                  Resend OTP
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[
                styles.button,
                (loading || otp.length !== 6) && styles.buttonDisabled,
              ]}
              disabled={loading || otp.length !== 6}
              onPress={async () => {
                setLoading(true);
                setError('');
                try {
                  await verifyOtp(otp, userId);
                  setStep(3);
                } catch (e: any) {
                  setError(
                    e?.response?.data?.message ??
                      'Invalid OTP. Please try again.',
                  );
                } finally {
                  setLoading(false);
                }
              }}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Verify OTP</Text>
              )}
            </TouchableOpacity>
          </>
        );
      case 3:
        return (
          <>
            <View style={styles.iconBadge}>
              <Image source={{ uri: 'logo' }} style={styles.logo} />
            </View>
            <Text style={styles.heading}>Set New Password</Text>
            <Text
              style={styles.desc}
              onLayout={e => {
                descYRef.current = e.nativeEvent.layout.y;
              }}
            >
              Create a new password for your account
            </Text>

            <Text style={styles.label}>New Password</Text>
            <View style={styles.passwordWrap}>
              <TextInput
                placeholder="Enter new password"
                placeholderTextColor={theme.colors.textMuted}
                style={[
                  styles.input,
                  styles.inputWithIcon,
                  (passwordFocused || !!password) && styles.inputActive,
                ]}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                value={password}
                onChangeText={t => {
                  setPassword(t);
                  setError('');
                }}
                onFocus={() => {
                  setPasswordFocused(true);
                  scrollFormIntoView();
                }}
                onBlur={() => setPasswordFocused(false)}
              />
              <TouchableOpacity
                style={styles.eyeBtn}
                onPress={() => setShowPassword(v => !v)}
              >
                <VectorIcon
                  iconSet="Ionicons"
                  iconName={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={theme.colors.textMuted}
                />
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Confirm Password</Text>
            <View style={styles.passwordWrap}>
              <TextInput
                placeholder="Confirm new password"
                placeholderTextColor={theme.colors.textMuted}
                style={[
                  styles.input,
                  styles.inputWithIcon,
                  (confirmFocused || !!confirmPassword) && styles.inputActive,
                ]}
                secureTextEntry={!showConfirm}
                autoCapitalize="none"
                value={confirmPassword}
                onChangeText={t => {
                  setConfirmPassword(t);
                  setError('');
                }}
                onFocus={() => {
                  setConfirmFocused(true);
                  scrollFormIntoView();
                }}
                onBlur={() => setConfirmFocused(false)}
              />
              <TouchableOpacity
                style={styles.eyeBtn}
                onPress={() => setShowConfirm(v => !v)}
              >
                <VectorIcon
                  iconSet="Ionicons"
                  iconName={showConfirm ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={theme.colors.textMuted}
                />
              </TouchableOpacity>
            </View>

            <View style={styles.ruleList}>
              {passwordRules.map(rule => {
                const met = rule.test(password);
                return (
                  <View key={rule.label} style={styles.ruleRow}>
                    <VectorIcon
                      iconSet="Ionicons"
                      iconName={met ? 'checkmark-circle' : 'ellipse-outline'}
                      size={15}
                      color={met ? theme.colors.success : theme.colors.textMuted}
                    />
                    <Text style={[styles.ruleText, met && styles.ruleTextMet]}>
                      {rule.label}
                    </Text>
                  </View>
                );
              })}
              {!!confirmPassword && (
                <View style={styles.ruleRow}>
                  <VectorIcon
                    iconSet="Ionicons"
                    iconName={
                      password === confirmPassword
                        ? 'checkmark-circle'
                        : 'close-circle'
                    }
                    size={15}
                    color={
                      password === confirmPassword
                        ? theme.colors.success
                        : theme.colors.danger
                    }
                  />
                  <Text
                    style={[
                      styles.ruleText,
                      password === confirmPassword
                        ? styles.ruleTextMet
                        : styles.ruleTextFail,
                    ]}
                  >
                    Passwords match
                  </Text>
                </View>
              )}
            </View>

            <TouchableOpacity
              style={[
                styles.button,
                (loading || !password.trim() || !confirmPassword.trim()) &&
                  styles.buttonDisabled,
              ]}
              disabled={loading || !password.trim() || !confirmPassword.trim()}
              onPress={async () => {
                const unmet = passwordRules.find(r => !r.test(password));
                if (unmet) {
                  setError(`Password needs: ${unmet.label.toLowerCase()}.`);
                  return;
                }
                if (password !== confirmPassword) {
                  setError('Passwords do not match.');
                  return;
                }

                setLoading(true);
                setError('');
                try {
                  console.log('[ChangePassword] ➡️ Request:', {
                    user_id: userId,
                  });
                  const res = await changePassword(
                    password,
                    confirmPassword,
                    userId,
                  );
                  console.log(
                    '[ChangePassword] ✅ Response:',
                    JSON.stringify(res, null, 2),
                  );
                  navigation.replace('Login');
                } catch (e: any) {
                  console.log(
                    '[ChangePassword] ❌ Error:',
                    JSON.stringify(e?.response?.data, null, 2),
                  );
                  setError(
                    e?.response?.data?.message ??
                      e?.message ??
                      'Failed to change password. Please try again.',
                  );
                } finally {
                  setLoading(false);
                }
              }}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Submit</Text>
              )}
            </TouchableOpacity>
          </>
        );
      default:
        return null;
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
      <View style={styles.safeArea}>
        <Header
          title="Forgot Password"
          showBack={true}
          onBackPress={handleBackPress}
        />
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View
            style={styles.card}
            onLayout={e => {
              cardYRef.current = e.nativeEvent.layout.y;
            }}
          >
            {renderStep()}
          </View>
          <View style={{ height: 100 }} />
        </ScrollView>

        {/* Error popup pinned to the bottom of the screen */}
        {!!error && (
          <Animated.View
            style={[
              styles.errorToast,
              {
                opacity: errorAnim,
                transform: [
                  {
                    translateY: errorAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [24, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <VectorIcon
              iconSet="Ionicons"
              iconName="alert-circle-outline"
              size={18}
              color={theme.colors.white}
            />
            <Text style={styles.errorToastText}>{error}</Text>
          </Animated.View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
};

export default ForgotPasswordScreen;

const __mk_styles = () => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.card,
  },
  container: {
    flexGrow: 1,
    backgroundColor: theme.colors.card,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.xl,
  },
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    // borderWidth: 1,
    // borderColor: theme.colors.border,
    padding: theme.spacing.lg,
  },
  back: {
    color: theme.colors.primary,
    marginBottom: theme.spacing.md,
    fontWeight: '600',
  },
  heading: {
    fontSize: 24,
    fontWeight: '700',
    justifyContent: 'center',
    textAlign: 'center',
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.sm,
  },
  iconBadge: {
    width: 76,
    height: 76,
    borderRadius: theme.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 42,
  },
  logo: {
    width: 140,
    height: 140,
    resizeMode: 'contain',
  },
  desc: {
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.lg,
    lineHeight: 20,
    textAlign: 'center',
  },
  label: {
    color: theme.colors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: theme.spacing.xs,
  },
  input: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    color: theme.colors.textPrimary,
  },
  inputActive: {
    borderColor: '#5B7FFF',
  },
  passwordWrap: {
    marginBottom: theme.spacing.md,
  },
  inputWithIcon: {
    marginBottom: 0,
    paddingRight: 44,
  },
  eyeBtn: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.md,
  },
  ruleList: {
    marginTop: theme.spacing.xs,
    marginBottom: theme.spacing.md,
    gap: 5,
  },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ruleText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    lineHeight: 18,
  },
  ruleTextMet: {
    color: theme.colors.success,
  },
  ruleTextFail: {
    color: theme.colors.danger,
  },
  button: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 12,
    borderRadius: 99,
    alignItems: 'center',
    marginTop: theme.spacing.sm,
  },
  buttonDisabled: { backgroundColor: '#B0B0B0' },
  buttonText: {
    color: theme.colors.white,
    fontWeight: '600',
    fontSize: 16,
  },

  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
  },
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
  otpBoxActive: {
    borderColor: '#5B7FFF',
  },

  infoText: {
    textAlign: 'center',
    color: theme.colors.textSecondary,
  },
  timer: {
    textAlign: 'center',
    marginVertical: theme.spacing.md,
    color: theme.colors.primary,
  },
  errorToast: {
    position: 'absolute',
    left: theme.spacing.lg,
    right: theme.spacing.lg,
    bottom: theme.spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.colors.danger,
    borderRadius: theme.radius.md,
    paddingVertical: 12,
    paddingHorizontal: theme.spacing.md,
    elevation: 6,
    shadowColor: theme.colors.shadow,
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  errorToastText: {
    flex: 1,
    fontSize: 13,
    color: theme.colors.white,
    fontWeight: '500',
  },
});


// Themed stylesheets — rebuilt on light/dark toggle.
let styles = __mk_styles();
onThemeChange(() => { styles = __mk_styles(); });
