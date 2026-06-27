import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Image,
  StyleSheet,
  Text,
  View,
  Easing,
} from 'react-native';
import { theme } from '../../utils/theme';
import { Storage } from '../../utils/storage';

const SplashScreen = ({ navigation }: any) => {
  const scale = useRef(new Animated.Value(3)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const shimmerX = useRef(new Animated.Value(-200)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(scale, {
          toValue: 1,
          duration: 1200,
          easing: Easing.bezier(0.4, 0, 0.2, 1),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 800,
          easing: Easing.bezier(0.4, 0, 0.2, 1),
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(shimmerX, {
        toValue: 200,
        duration: 700,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
      Animated.delay(500),
    ]).start(async () => {
      const [onboardingSeen, token, role] = await Promise.all([
        Storage.isOnboardingSeen(),
        Storage.getToken(),
        Storage.getRole(),
      ]);

      if (!onboardingSeen) {
        navigation.replace('Onboarding');
      } else if (token && role === 'admin') {
        navigation.replace('AdminDashboard');
      } else if (token && role === 'accounts') {
        navigation.replace('AccountsDashboard');
      } else if (token && role) {
        navigation.replace('DrawerRoot', { userRole: role });
      } else {
        navigation.replace('Login');
      }
    });
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.center}>
        <Animated.View
          style={[
            styles.logoWrap,
            {
              opacity,
              transform: [{ scale }],
            },
          ]}
        >
          <Image source={{ uri: 'logo' }} style={styles.logo} />

          <Animated.View
            style={[
              styles.shimmer,
              {
                transform: [{ translateX: shimmerX }, { rotate: '20deg' }],
              },
            ]}
          />
          {/* <Text style={styles.brand}>SuperLMS</Text> */}
        </Animated.View>
      </View>

      <View style={styles.bottom}>
        <Text style={styles.footer}>Made with ❤️ in India</Text>
      </View>
    </View>
  );
};

export default SplashScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoWrap: {
    alignItems: 'center',
    overflow: 'hidden',
  },
  logo: {
    width: 160,
    height: 160,
    resizeMode: 'contain',
  },
  brand: {
    // marginTop: 16,
    fontSize: 24,
    fontWeight: '800',
    color: '#000',
    letterSpacing: 1,
  },
  shimmer: {
    position: 'absolute',
    width: 80,
    height: 200,
    backgroundColor: 'rgba(255,255,255,0.25)',
    top: -20,
  },
  bottom: {
    position: 'absolute',
    bottom: 30,
    width: '100%',
    alignItems: 'center',
  },
  footer: {
    color: '#000',
    fontSize: 13,
    fontWeight: '600',
  },
});