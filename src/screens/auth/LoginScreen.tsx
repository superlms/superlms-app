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
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
      <View style={styles.safeArea}>
        <StatusBar
          barStyle="dark-content"
          backgroundColor={theme.colors.background}
        />

        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.iconBadge}>
            <Image source={{ uri: 'logo' }} style={styles.logo} />
          </View>

          <Text style={styles.title}>Welcome to SuperLMS</Text>
          <Text
            style={styles.subtitle}
            onLayout={e => {
              subtitleYRef.current = e.nativeEvent.layout.y;
            }}
          >
            Students sign in with their admission number, staff with their email —
            we'll take you to the right dashboard.
          </Text>

          <View style={styles.formCard}>
            {/* Identifier */}
            <Text style={styles.label}>Email or Admission Number</Text>
            <TextInput
              placeholder="you@school.com  or  2026DMO650015"
              placeholderTextColor={theme.colors.textMuted}
              style={[
                styles.input,
                (identifierFocused || !!identifier) && styles.inputActive,
              ]}
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
            />

            {/* Password */}
            <Text style={styles.label}>Password</Text>
            <View
              style={[
                styles.passWrap,
                (passwordFocused || !!password) && styles.inputActive,
              ]}
            >
              <TextInput
                placeholder="Enter password"
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
              />
              <TouchableOpacity
                onPress={() => setShowPass(v => !v)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
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
              onPress={() => navigation.navigate('ForgotPassword')}
              activeOpacity={0.8}
            >
              <Text style={styles.forgot}>Forgot Password?</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.button,
                (loading || !identifier.trim() || !password.trim()) &&
                  styles.buttonDisabled,
              ]}
              activeOpacity={0.9}
              onPress={handleLogin}
              disabled={loading || !identifier.trim() || !password.trim()}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.buttonText}>Continue</Text>
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

export default LoginScreen;

const __mk_styles = () => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.colors.card },
  container: {
    flexGrow: 1,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.xl,
  },
  iconBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginTop: theme.spacing.xl,
    marginBottom: theme.spacing.md,
  },
  logo: { width: 150, height: 150, resizeMode: 'contain' },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
    paddingHorizontal: 20,
    marginBottom: theme.spacing.lg,
  },
  formCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
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
  passWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    paddingHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  passInput: {
    flex: 1,
    paddingVertical: theme.spacing.md,
    color: theme.colors.textPrimary,
  },
  forgot: {
    color: theme.colors.primary,
    textAlign: 'right',
    marginBottom: theme.spacing.lg,
    fontWeight: '500',
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
  button: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 12,
    borderRadius: 99,
    alignItems: 'center',
  },
  buttonDisabled: { backgroundColor: '#B0B0B0' },
  buttonText: { color: theme.colors.white, fontWeight: '600', fontSize: 16 },
});


// Themed stylesheets — rebuilt on light/dark toggle.
let styles = __mk_styles();
onThemeChange(() => { styles = __mk_styles(); });
