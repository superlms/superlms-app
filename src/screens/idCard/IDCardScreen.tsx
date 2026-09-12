import React, { useCallback, useRef, useState } from 'react';
import {
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import VectorIcon from '../../components/VectorIcon';
import { Skeleton } from '../../components/Skeleton';
import { useFocusLoad } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';
import { DocHeader } from '../more/docUi';
import {
  CARD_H,
  CARD_W,
  IdCardBack,
  IdCardFront,
  type IdCardFaceData,
} from './IdCardFaces';
import {
  getIdCard,
  idCardErrorMessage,
  type IdCardData,
  type IdRole,
} from '../../api/idCardApi';

const TITLE = 'ID Card';

type DrawerRole = 'student' | 'teacher';

// The API's card → what the two faces draw.
const toFaceData = (c: IdCardData): IdCardFaceData => ({
  school: c.school,
  photo: c.photo,
  name: c.name,
  subtitle: c.subtitle,
  rows: c.frontRows,
  cardNumber: c.cardNumber,
  issueDate: c.issueDate,
  expiryDate: c.expiryDate,
  status: c.status,
  qrCode: c.qrCode,
});

const IDCardScreen = ({ navigation, route }: any) => {
  const role: DrawerRole = route?.params?.userRole === 'teacher' ? 'teacher' : 'student';

  const [data, setData] = useState<IdCardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await getIdCard(role as IdRole));
    } catch (e: any) {
      console.log('[getIdCard] Error:', e?.response?.status, e?.message);
      setError(idCardErrorMessage(e));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [role]);

  useFocusLoad(load);

  const [flipped, setFlipped] = useState(false);
  const anim = useRef(new Animated.Value(0)).current;

  const flipTo = (toBack: boolean) => {
    if (toBack === flipped) return;
    setFlipped(toBack);
    Animated.spring(anim, {
      toValue: toBack ? 180 : 0,
      friction: 8,
      tension: 14,
      useNativeDriver: true,
    }).start();
  };

  const frontRotate = anim.interpolate({ inputRange: [0, 180], outputRange: ['0deg', '180deg'] });
  const backRotate = anim.interpolate({ inputRange: [0, 180], outputRange: ['180deg', '360deg'] });

  if (loading || !data) {
    return (
      <View style={s.root}>
        <DocHeader title={TITLE} onBackPress={() => navigation.goBack()} />
        {error ? (
          <View style={s.stateBox}>
            <VectorIcon iconSet="Ionicons" iconName="card-outline" size={32} color={theme.colors.textMuted} />
            <Text style={s.errorText}>{error}</Text>
            <TouchableOpacity onPress={load} hitSlop={10}>
              <Text style={s.linkText}>Try again</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={s.loading}>
            <Skeleton width={CARD_W} height={CARD_H} radius={12} />
          </View>
        )}
      </View>
    );
  }

  const face = toFaceData(data);

  return (
    <View style={s.root}>
      <DocHeader title={TITLE} onBackPress={() => navigation.goBack()} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        {/* Front / Back — a plain tab strip */}
        <View style={s.tabs}>
          {(['Front', 'Back'] as const).map(side => {
            const active = side === 'Back' ? flipped : !flipped;
            return (
              <TouchableOpacity
                key={side}
                style={[s.tab, active && s.tabActive]}
                onPress={() => flipTo(side === 'Back')}
                activeOpacity={0.6}
              >
                <Text style={[s.tabText, active && s.tabTextActive]}>{side}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* The card itself — tap to flip */}
        <TouchableWithoutFeedback onPress={() => flipTo(!flipped)}>
          <View style={s.stage}>
            <Animated.View
              style={[s.face, { transform: [{ perspective: 1200 }, { rotateY: frontRotate }] }]}
            >
              <IdCardFront data={face} />
            </Animated.View>
            <Animated.View
              style={[s.face, { transform: [{ perspective: 1200 }, { rotateY: backRotate }] }]}
            >
              <IdCardBack data={face} />
            </Animated.View>
          </View>
        </TouchableWithoutFeedback>

        <Text style={s.hint}>Tap the card to turn it over.</Text>
      </ScrollView>
    </View>
  );
};

export default IDCardScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  scroll: { alignItems: 'center', paddingTop: 4, paddingBottom: 40 },

  // Front / Back tabs
  tabs: { flexDirection: 'row', gap: 22, paddingBottom: 18 },
  tab: { paddingTop: 12, paddingBottom: 10, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: theme.colors.primary },
  tabText: { fontSize: 13, fontWeight: '500', color: theme.colors.textSecondary },
  tabTextActive: { color: theme.colors.primary, fontWeight: '600' },

  // Card stage — both faces sit on top of each other and turn
  stage: { width: CARD_W, height: CARD_H },
  face: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: CARD_W,
    height: CARD_H,
    backfaceVisibility: 'hidden',
  },

  hint: { fontSize: 12, color: theme.colors.textMuted, marginTop: 18 },

  // States
  loading: { alignItems: 'center', paddingTop: 30 },
  stateBox: { alignItems: 'center', paddingTop: 72, paddingHorizontal: 24, gap: 10 },
  errorText: { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  linkText: { fontSize: 14, fontWeight: '600', color: theme.colors.primary },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
