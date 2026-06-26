import React, { useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  Dimensions,
  ListRenderItem,
  NativeScrollEvent,
  NativeSyntheticEvent,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { theme, onThemeChange } from '../../utils/theme';
import { useNavigation } from '@react-navigation/native';
import LottieView from 'lottie-react-native';
import { Storage } from '../../utils/storage';

const { width } = Dimensions.get('window');

type Slide = {
  id: string;
  title: string;
  desc: string;
  lottie: any;
};

const DATA: Slide[] = [
  {
    id: '1',
    title: 'Communication & Administration',
    desc: 'Manage announcements, policies, and communications from one platform, ensuring clear information flow, easy access to essential details, and improved engagement among students, teachers, and administrators across your institution.',
    lottie: require('../../assets/lottiefiles/onboard1.json'),
  },
  {
    id: '2',
    title: 'All-in-One Academic Hub',
    desc: 'Streamline learning and assessments with smart tools for homework, exams, results, attendance, and more—bringing everything together in one intuitive platform designed for efficiency, clarity, and better academic outcomes',
    lottie: require('../../assets/lottiefiles/onboard2.json'),
  },
  {
    id: '3',
    title: 'Student & Teacher Management',
    desc: 'Efficiently manage students and teachers with tools for attendance, fees, homework, and records etc, while tracking performance and simplifying daily administrative tasks for smoother academic operations',
    lottie: require('../../assets/lottiefiles/onboard3.json'),
  },
  {
    id: '4',
    title: 'Unified Dashboard',
    desc: 'Access all essential tools, updates, analytics, and settings in one centralized dashboard, enabling students, teachers, and administrators to stay connected, organized, and productive throughout their daily activities.',
    lottie: require('../../assets/lottiefiles/onboard4.json'),
  },
];

const OnboardingScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const flatListRef = useRef<FlatList<Slide>>(null);
  const [index, setIndex] = useState<number>(0);

  // Sync index on manual swipe
  const onMomentumScrollEnd = (
    event: NativeSyntheticEvent<NativeScrollEvent>,
  ) => {
    const newIndex = Math.round(event.nativeEvent.contentOffset.x / width);
    setIndex(newIndex);
  };

  const goToSlide = (target: number) => {
    flatListRef.current?.scrollToIndex({ index: target, animated: true });
    setIndex(target);
  };

  const onNext = () => {
    if (index === DATA.length - 1) {
      Storage.setOnboardingSeen();
      navigation.replace('Login');
      return;
    }
    goToSlide(index + 1);
  };

  useEffect(() => {
    const interval = setInterval(() => {
      if (index < DATA.length - 1) {
        goToSlide(index + 1);
      } else {
        goToSlide(0);
        // clearInterval(interval);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [index]);

  const renderItem: ListRenderItem<Slide> = ({ item }) => (
    <View style={styles.slide}>
      <View style={styles.illustrationWrap}>
        <LottieView
          source={item.lottie}
          autoPlay
          loop
          style={styles.illustration}
        />
      </View>
      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.desc}>{item.desc}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View>
        <FlatList
          ref={flatListRef}
          data={DATA}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          onMomentumScrollEnd={onMomentumScrollEnd}
        />
      </View>

      <View style={styles.dotContainer}>
        {DATA.map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              {
                backgroundColor:
                  i === index ? theme.colors.primary : theme.colors.border,
                width: i === index ? 20 : 8,
              },
            ]}
          />
        ))}
      </View>

      <View style={styles.bottomActions}>
        <TouchableOpacity
          style={styles.nextButton}
          activeOpacity={0.9}
          onPress={async () => {
            await Storage.setOnboardingSeen();
            navigation.replace('Login');
          }}
        >
          <Text style={styles.nextText}>Continue</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default OnboardingScreen;

const __mk_styles = () => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.card,
  },
  slide: {
    width: width,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: theme.spacing.lg,
    height: '50%',
    paddingTop: 70,
  },
  illustrationWrap: {
    width: width,
    height: 280,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  illustration: {
    width: width * 0.64,
    height: 240,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.primary,
    marginBottom: 10,
    textAlign: 'center',
  },
  desc: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 300,
  },
  dotContainer: {
    paddingTop: 50,
    flexDirection: 'row',
    alignSelf: 'center',
  },
  dot: {
    height: 8,
    borderRadius: 5,
    marginHorizontal: 4,
  },
  bottomActions: {
    position: 'absolute',
    left: theme.spacing.lg,
    right: theme.spacing.lg,
    bottom: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipText: {
    color: theme.colors.textSecondary,
    fontSize: 16,
    fontWeight: '600',
  },
  nextButton: {
    backgroundColor: theme.colors.primary,
    width: '90%',
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: theme.radius.full,
  },
  nextText: {
    color: theme.colors.white,
    fontWeight: '700',
    fontSize: 15,
  },
});


// Themed stylesheets — rebuilt on light/dark toggle.
let styles = __mk_styles();
onThemeChange(() => { styles = __mk_styles(); });
