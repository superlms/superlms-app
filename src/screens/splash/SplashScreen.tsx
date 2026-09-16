import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { Storage } from '../../utils/storage';
import { startPlayUpdateChecks } from '../../utils/playUpdate';

/**
 * The logo on a white page, "Made with ❤️ in India" at the foot.
 *
 * Every step eases in and out of the next, with nothing popping or snapping:
 * the page brightens from the phone's launch grey to white, the logo rises
 * and settles into place over a soft violet glow, breathes once as a thin
 * ring drifts out from behind it, then the logo, glow and footer lift away
 * together into plain white for the next screen to come in on. The motion
 * waits for the logo image, so it never starts on a blank frame, and where
 * the app opens is worked out while it plays.
 */

// The mark sits inside a 500px square with wide clear margins, so the image is
// drawn larger than the mark it shows.
const LOGO = 200;
// The glow and the ring behind the mark.
const DISC = 136;
const VIOLET = '124, 77, 255';
// Android's launch window, under the app until the first screen draws.
const LAUNCH_GREY = '#FAFAFA';

// A long, soft ease-out: quick to start, a gentle glide into place.
const GLIDE = Easing.bezier(0.16, 1, 0.3, 1);
const SMOOTH = Easing.bezier(0.4, 0, 0.2, 1);

type Route = [name: string, params?: object];

const nextRoute = async (): Promise<Route> => {
  const [onboardingSeen, token, role] = await Promise.all([
    Storage.isOnboardingSeen(),
    Storage.getToken(),
    Storage.getRole(),
  ]);

  if (!onboardingSeen) return ['Onboarding'];
  if (token && role === 'admin') return ['AdminDashboard'];
  if (token && role === 'accounts') return ['AccountsDashboard'];
  if (token && role) return ['DrawerRoot', { userRole: role }];
  return ['Login'];
};

const timing = (value: Animated.Value, toValue: number, duration: number, easing = SMOOTH, delay = 0) =>
  Animated.timing(value, { toValue, duration, easing, delay, useNativeDriver: true });

const SplashScreen = ({ navigation }: any) => {
  const paper = useRef(new Animated.Value(0)).current; // launch grey brightening to white
  const enter = useRef(new Animated.Value(0)).current; // the logo rising into place
  const glow = useRef(new Animated.Value(0)).current; // the glow opening behind it
  const ring = useRef(new Animated.Value(0)).current; // the ring drifting out
  const breath = useRef(new Animated.Value(0)).current; // one slow breath once it has landed
  const footer = useRef(new Animated.Value(0)).current; // the footer line
  const exit = useRef(new Animated.Value(0)).current; // everything lifting away

  const route = useRef<Promise<Route> | null>(null);
  const animation = useRef<Animated.CompositeAnimation | null>(null);

  const play = () => {
    if (animation.current) return;

    animation.current = Animated.parallel([
      timing(paper, 1, 500),
      timing(glow, 1, 1000, GLIDE),
      timing(enter, 1, 1000, GLIDE),
      timing(footer, 1, 600, SMOOTH, 350),
      timing(ring, 1, 1200, Easing.out(Easing.cubic), 550),
      Animated.sequence([
        Animated.delay(700),
        timing(breath, 1, 450, Easing.inOut(Easing.sin)),
        timing(breath, 0, 550, Easing.inOut(Easing.sin)),
      ]),
    ]);

    animation.current.start(async ({ finished }) => {
      if (!finished) return;
      // The logo stays until the next screen is known — and any Play Store
      // update has been looked for — then lifts away.
      const [name, params] = await (route.current ?? nextRoute());
      animation.current = timing(exit, 1, 450, SMOOTH);
      animation.current.start(({ finished: exited }) => {
        if (exited) navigation.replace(name, params);
      });
    });
  };

  useEffect(() => {
    // A newer Play Store build is looked for before the app opens past here;
    // if there is one, Play's update screen opens over the splash.
    route.current = Promise.all([
      nextRoute().catch((): Route => ['Login']),
      startPlayUpdateChecks(),
    ]).then(([next]) => next);
    // The logo normally reports it has loaded at once; this only covers a
    // phone where that report never comes.
    const fallback = setTimeout(play, 400);

    return () => {
      clearTimeout(fallback);
      animation.current?.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const away = exit.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });

  const logoStyle = {
    opacity: Animated.multiply(
      enter.interpolate({ inputRange: [0, 0.5], outputRange: [0, 1], extrapolate: 'clamp' }),
      away,
    ),
    transform: [
      { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) },
      { rotate: enter.interpolate({ inputRange: [0, 1], outputRange: ['-8deg', '0deg'] }) },
      {
        scale: Animated.multiply(
          Animated.multiply(
            enter.interpolate({ inputRange: [0, 1], outputRange: [0.82, 1] }),
            breath.interpolate({ inputRange: [0, 1], outputRange: [1, 1.035] }),
          ),
          exit.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }),
        ),
      },
    ],
  };

  const glowStyle = {
    opacity: Animated.multiply(glow, away),
    transform: [
      {
        scale: Animated.multiply(
          glow.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }),
          exit.interpolate({ inputRange: [0, 1], outputRange: [1, 1.25] }),
        ),
      },
    ],
  };

  const ringStyle = {
    opacity: ring.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 1, 0] }),
    transform: [{ scale: ring.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.8] }) }],
  };

  const footerStyle = {
    opacity: Animated.multiply(footer, away),
    transform: [{ translateY: footer.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) }],
  };

  return (
    <View style={styles.container}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.paper, { opacity: paper }]} />

      <View style={styles.stage}>
        <Animated.View style={[styles.disc, styles.glow, glowStyle]} />
        <Animated.View style={[styles.disc, styles.ring, ringStyle]} />
        <Animated.Image
          source={require('../../assets/logo.png')}
          style={[styles.logo, logoStyle]}
          onLoadEnd={play}
        />
      </View>

      <Animated.View style={[styles.bottom, footerStyle]}>
        <Text style={styles.footer}>Made with ❤️ in India</Text>
      </Animated.View>
    </View>
  );
};

export default SplashScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: LAUNCH_GREY,
  },
  paper: { backgroundColor: '#FFFFFF' },

  // The logo, with the glow and the ring centred behind it
  stage: { width: LOGO, height: LOGO, alignItems: 'center', justifyContent: 'center' },
  logo: { width: LOGO, height: LOGO, resizeMode: 'contain' },
  disc: {
    position: 'absolute',
    top: (LOGO - DISC) / 2,
    left: (LOGO - DISC) / 2,
    width: DISC,
    height: DISC,
    borderRadius: DISC / 2,
  },
  glow: { backgroundColor: `rgba(${VIOLET}, 0.08)` },
  ring: { borderWidth: 1.5, borderColor: `rgba(${VIOLET}, 0.3)` },

  bottom: {
    position: 'absolute',
    bottom: 32,
    width: '100%',
    alignItems: 'center',
  },
  footer: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
});
