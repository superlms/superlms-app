import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  useWindowDimensions,
  Animated,
} from 'react-native';
import React, { useState, useEffect, useRef } from 'react';
import { CommonActions, useNavigation, useRoute } from '@react-navigation/native';
import VectorIcon from '../../components/VectorIcon';
import { theme, onThemeChange } from '../../utils/theme';
import Header from '../../components/Header';
import {
  verifyOtp,
  resendOtp,
  completeLogin,
  type AuthUser,
  type UserRole,
} from '../../api/authApi';

// Six independent boxes so the user can tap any box and retype just that digit.
// Typing auto-advances, backspace on an empty box steps back, and pasting a
// full code from the keyboard fills the row.
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

type Params = {
  email: string;
  userId: string | number;
  pendingToken: string;
  pendingUser: AuthUser;
  pendingRole: UserRole;
};

// School-admin OTP gate. The credentials are already verified and the session
// token is held in the nav params; we only store it (completeLogin) once the
// emailed OTP is confirmed — mirroring the web admin login flow.
const LoginOtpScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { email, userId, pendingToken, pendingUser, pendingRole } =
    route.params as Params;

  const scrollRef = useRef<ScrollView>(null);
  const { width: windowWidth } = useWindowDimensions();

  // Size OTP boxes from the screen width so the row always fits, then center it.
  const otpGap = theme.spacing.xs;
  const otpBoxWidth = Math.min(
    48,
    Math.floor((windowWidth - theme.spacing.lg * 4 - otpGap * 5) / 6),
  );
  const otpRowWidth = otpBoxWidth * 6 + otpGap * 5;

  const [otp, setOtp] = useState('');
  const [timer, setTimer] = useState(120);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const descYRef = useRef(0);
  const scrollFormIntoView = () => {
    setTimeout(
      () =>
        scrollRef.current?.scrollTo({
          y: Math.max(descYRef.current - theme.spacing.sm, 0),
          animated: true,
        }),
      150,
    );
  };

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

  // Resend countdown.
  useEffect(() => {
    if (timer <= 0) return;
    const interval = setInterval(() => setTimer(prev => prev - 1), 1000);
    return () => clearInterval(interval);
  }, [timer]);

  const formatTime = () => {
    const min = Math.floor(timer / 60);
    const sec = timer % 60;
    return `${min}:${sec < 10 ? '0' : ''}${sec}`;
  };

  const handleVerify = async () => {
    setLoading(true);
    setError('');
    try {
      await verifyOtp(otp, userId);
      // OTP good — now store the session and enter the admin dashboard.
      await completeLogin(pendingToken, pendingUser, pendingRole);
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: 'AdminDashboard' }],
        }),
      );
    } catch (e: any) {
      setError(
        e?.response?.data?.message ?? e?.message ?? 'Invalid OTP. Please try again.',
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    try {
      const res = await resendOtp(email, userId);
      if (!res.success) {
        throw new Error(res.message);
      }
      setTimer(120);
      setError('');
    } catch (e: any) {
      const msg =
        e?.response?.data?.message ?? e?.message ?? 'Failed to resend OTP.';
      // The backend throttles OTP requests; sync our countdown to it.
      const waitMatch = String(msg).match(/(\d+)\s*second/i);
      if (waitMatch) {
        setTimer(parseInt(waitMatch[1], 10));
      }
      setError(msg);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
      <View style={styles.safeArea}>
        <StatusBar
          barStyle="dark-content"
          backgroundColor={theme.colors.background}
        />
        <Header
          title="Verify OTP"
          showBack={true}
          onBackPress={() => navigation.goBack()}
        />
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.card}>
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
              <TouchableOpacity onPress={handleResend}>
                <Text style={[styles.timer, { textDecorationLine: 'underline' }]}>
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
              onPress={handleVerify}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Verify & Continue</Text>
              )}
            </TouchableOpacity>
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

export default LoginOtpScreen;

const __mk_styles = () =>
  StyleSheet.create({
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
      padding: theme.spacing.lg,
    },
    heading: {
      fontSize: 24,
      fontWeight: '700',
      textAlign: 'center',
      color: theme.colors.textPrimary,
      marginBottom: theme.spacing.sm,
    },
    iconBadge: {
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: 'center',
      marginBottom: theme.spacing.md,
    },
    logo: {
      width: 100,
      height: 100,
      resizeMode: 'contain',
    },
    desc: {
      color: theme.colors.textSecondary,
      marginBottom: theme.spacing.lg,
      lineHeight: 20,
      textAlign: 'center',
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
onThemeChange(() => {
  styles = __mk_styles();
});
