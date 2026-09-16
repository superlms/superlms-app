import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  Image,
  KeyboardAvoidingView,
  ActivityIndicator,
  Animated,
} from 'react-native';
import React, { useEffect, useRef, useState } from 'react';
import { CommonActions, useNavigation } from '@react-navigation/native';
import { theme, onThemeChange } from '../../utils/theme';
import VectorIcon from '../../components/VectorIcon';
import { login, type UserRole } from '../../api/authApi';

// Where each role lands after a successful login.
const destinationFor = (role: UserRole) => {
  switch (role) {
    case 'admin':
      return { name: 'AdminDashboard' as const, params: undefined };
    case 'accounts':
      return { name: 'AccountsDashboard' as const, params: undefined };
    default:
      // student & teacher share the main drawer app.
      return { name: 'DrawerRoot' as const, params: { userRole: role } };
  }
};

const LoginScreen = () => {
  const navigation = useNavigation<any>();
  const scrollRef = useRef<ScrollView>(null);
  const passwordRef = useRef<TextInput>(null);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [identifierFocused, setIdentifierFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
    const timer = setTimeout(() => {
      Animated.timing(errorAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => setError(''));
    }, 4000);
    return () => clearTimeout(timer);
  }, [error, errorAnim]);

  // Edge-to-edge Android ignores adjustResize, so scroll the form above the
  // keyboard ourselves once the keyboard animation has started.
  const subtitleYRef = useRef(0);
  const scrollFormIntoView = () => {
    setTimeout(
      () =>
        scrollRef.current?.scrollTo({
          y: Math.max(subtitleYRef.current - theme.spacing.sm, 0),
          animated: true,
        }),
      150,
    );
  };

  const canSubmit = !loading && !!identifier.trim() && !!password.trim();

  const handleLogin = async () => {
    if (!identifier.trim()) {
      setError('Please enter your email or admission number.');
      return;
    }
    if (!password.trim()) {
      setError('Please enter your password.');
      return;
    }

    setError('');
    setLoading(true);
    try {
      const res = await login(identifier.trim(), password);

      // A school admin is signed in only after the code the server has just
      // mailed them (the web admin login's rule); the OTP screen finishes it.
      if ('otpRequired' in res) {
        navigation.navigate('LoginOtp', {
          email: res.email,
          userId: res.userId,
          otpToken: res.otpToken,
          resendIn: res.resendIn,
        });
        return;
      }
      console.log('[Login] Success:', JSON.stringify({ role: res.role }, null, 2));

      const dest = destinationFor(res.role);
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: dest.name, params: dest.params }],
        }),
      );
    } catch (err: any) {
      console.log('[Login] Error status:', err?.response?.status);
      console.log('[Login] Error data:', JSON.stringify(err?.response?.data, null, 2));

      const msg =
        err?.response?.data?.message ??
        err?.response?.data?.error ??
        'Login failed. Please check your credentials.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior="padding">
      <View style={styles.safeArea}>
        <StatusBar
          barStyle="dark-content"
          backgroundColor={theme.colors.statusBar}
        />

        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Image source={require('../../assets/logo.png')} style={styles.logo} />

          <Text style={styles.title}>Welcome back</Text>
          <Text
            style={styles.subtitle}
            onLayout={e => {
              subtitleYRef.current = e.nativeEvent.layout.y;
            }}
          >
            Students sign in with their admission number, staff with their email.
          </Text>

          {/* Identifier */}
          <Text style={styles.label}>Email or Admission Number</Text>
          <TextInput
            placeholder="you@school.com or 2026DMO650015"
            placeholderTextColor={theme.colors.textMuted}
            style={[styles.input, (identifierFocused || !!identifier) && styles.inputActive]}
            value={identifier}
            onChangeText={t => {
              setIdentifier(t);
              setError('');
            }}
            onFocus={() => {
              setIdentifierFocused(true);
              scrollFormIntoView();
            }}
            onBlur={() => setIdentifierFocused(false)}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
            blurOnSubmit={false}
            onSubmitEditing={() => passwordRef.current?.focus()}
          />

          {/* Password */}
          <Text style={styles.label}>Password</Text>
          <View style={[styles.input, styles.passWrap, (passwordFocused || !!password) && styles.inputActive]}>
            <TextInput
              ref={passwordRef}
              placeholder="Enter your password"
              placeholderTextColor={theme.colors.textMuted}
              style={styles.passInput}
              secureTextEntry={!showPass}
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
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="go"
              onSubmitEditing={() => {
                if (canSubmit) handleLogin();
              }}
            />
            <TouchableOpacity
              onPress={() => setShowPass(v => !v)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <VectorIcon
                iconSet="Ionicons"
                iconName={showPass ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color={theme.colors.textMuted}
              />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.forgotWrap}
            onPress={() => navigation.navigate('ForgotPassword')}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.forgot}>Forgot password?</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, !canSubmit && styles.buttonDisabled]}
            activeOpacity={0.85}
            onPress={handleLogin}
            disabled={!canSubmit}
          >
            {loading ? (
              <ActivityIndicator color={theme.colors.white} size="small" />
            ) : (
              <Text style={styles.buttonText}>Continue</Text>
            )}
          </TouchableOpacity>

          <View style={styles.keyboardSpace} />
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

export default LoginScreen;

const __mk_styles = () => StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: theme.colors.card },
  container: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 56,
  },

  // Logo, title, subtitle — centred, as on Forgot Password
  logo: { width: 112, height: 112, resizeMode: 'contain', alignSelf: 'center' },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    textAlign: 'center',
    marginTop: 20,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 32,
    paddingHorizontal: 12,
  },

  // Fields — the Forgot Password screen's
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.xs,
  },
  input: {
    height: 50,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 0,
    marginBottom: theme.spacing.md,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    fontSize: 15,
    color: theme.colors.textPrimary,
  },
  inputActive: { borderColor: '#5B7FFF' },
  passWrap: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  passInput: {
    flex: 1,
    height: '100%',
    paddingVertical: 0,
    fontSize: 15,
    color: theme.colors.textPrimary,
  },
  forgotWrap: { alignSelf: 'flex-end', marginTop: -4, marginBottom: theme.spacing.lg },
  forgot: { fontSize: 14, fontWeight: '600', color: theme.colors.primary },

  // Continue — the Forgot Password screen's pill button
  button: {
    height: 48,
    borderRadius: 99,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
  },
  buttonDisabled: { backgroundColor: '#B0B0B0' },
  buttonText: { color: theme.colors.white, fontWeight: '600', fontSize: 16 },

  keyboardSpace: { height: 100 },

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
