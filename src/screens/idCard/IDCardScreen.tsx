import React, { useCallback, useRef, useState } from 'react';
import ScreenSkeleton from '../../components/Skeleton';
import {
  Animated,
  Dimensions,
  Image,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Header from '../../components/Header';
import VectorIcon from '../../components/VectorIcon';
import { useFocusLoad } from '../../hooks/useRefresh';
import { theme } from '../../utils/theme';
import {
  getIdCard,
  idCardErrorMessage,
  type IdCardData,
  type IdRole,
} from '../../api/idCardApi';

type DrawerRole = 'student' | 'teacher';

// ── "Executive Navy" palette — identical to the admin ID card design ──────────
const C = {
  navy: '#0e2647',
  navy2: '#15355f',
  navy3: '#0a1c36',
  gold: '#c9a227',
  goldL: '#e6cd7e',
  goldD: '#9e7c14',
  ink: '#1b2840',
  muted: '#7c8aa3',
  faint: '#aeb8c9',
  line: '#e8ecf3',
  paper: '#f7f9fc',
  white: '#ffffff',
};

const NAVY_GRAD = [C.navy2, C.navy, C.navy3];

// Fonts that approximate the admin card's serif / monospace / script faces.
const SERIF = Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' });
const MONO = Platform.select({ ios: 'Courier New', android: 'monospace', default: 'monospace' });
const SCRIPT = Platform.select({ ios: 'Snell Roundhand', android: 'cursive', default: 'serif' });

// CR80 vertical proportions (admin card is 326 × 516).
const { width } = Dimensions.get('window');
const CARD_W = Math.min(width - 40, 340);
const K = CARD_W / 326;
const CARD_H = 516 * K;
const r = (n: number) => n * K;

const initial = (v?: string | null) =>
  (v && v.trim() ? v.trim()[0] : 'S').toUpperCase();

// ── Small building blocks ─────────────────────────────────────────────────────
const Row = ({ label, value }: { label: string; value: string }) => (
  <View style={s.row}>
    <Text style={s.rowK} numberOfLines={1}>
      {label.toUpperCase()}
    </Text>
    <Text style={s.rowV} numberOfLines={2}>
      {value || '—'}
    </Text>
  </View>
);

const ContactItem = ({ icon, text }: { icon: string; text: string }) => (
  <View style={s.ci}>
    <VectorIcon iconSet="Ionicons" iconName={icon} size={r(11)} color={C.goldD} />
    <Text style={s.ciText} numberOfLines={2}>
      {text}
    </Text>
  </View>
);

const IDCardScreen = ({ navigation, route }: any) => {
  const role: DrawerRole =
    route?.params?.userRole === 'teacher' ? 'teacher' : 'student';

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
  const scale = anim.interpolate({ inputRange: [0, 90, 180], outputRange: [1, 0.93, 1] });

  if (loading || !data) {
    return (
      <View style={s.root}>
        <Header title="ID Card" onBackPress={() => navigation.goBack()} />
        {error ? (
          <View style={s.stateBox}>
            <View style={s.errorIconRing}>
              <VectorIcon iconSet="Ionicons" iconName="card-outline" size={32} color={theme.colors.danger} />
            </View>
            <Text style={s.errorTitle}>Couldn’t load ID card</Text>
            <Text style={s.errorSubtitle}>{error}</Text>
            <TouchableOpacity style={s.retryBtn} onPress={load} activeOpacity={0.85}>
              <VectorIcon iconSet="Ionicons" iconName="refresh" size={15} color={theme.colors.primary} />
              <Text style={s.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={s.stateBox}>
            <ScreenSkeleton variant="profile" />
          </View>
        )}
      </View>
    );
  }

  const card = data;
  const school = card.school;
  const mono = initial(school.name);

  return (
    <View style={s.root}>
      <Header title="ID Card" onBackPress={() => navigation.goBack()} />

      <View style={s.content}>
        {/* ── Front / Back toggle ── */}
        <View style={s.toggleRow}>
          {(['Front', 'Back'] as const).map(side => {
            const active = side === 'Back' ? flipped : !flipped;
            return (
              <TouchableOpacity
                key={side}
                style={[s.toggleBtn, active && s.toggleBtnActive]}
                onPress={() => flipTo(side === 'Back')}
                activeOpacity={0.85}
              >
                <Text style={[s.toggleText, active && s.toggleTextActive]}>{side}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Flippable card ── */}
        <TouchableWithoutFeedback onPress={() => flipTo(!flipped)}>
          <Animated.View style={[s.cardStage, { transform: [{ scale }] }]}>
            {/* ═════════ FRONT ═════════ */}
            <Animated.View
              style={[s.cardFace, { transform: [{ perspective: 1200 }, { rotateY: frontRotate }] }]}
            >
              {/* Header band */}
              <LinearGradient colors={NAVY_GRAD} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={s.header}>
                <View style={[s.orb, s.orb1]} />
                <View style={[s.orb, s.orb2]} />
                <View style={s.headInner}>
                  <View style={s.logo}>
                    {school.logo ? (
                      <Image source={{ uri: school.logo }} style={s.logoImg} />
                    ) : (
                      <Text style={s.logoPh}>{mono}</Text>
                    )}
                  </View>
                  <Text style={s.schoolName} numberOfLines={2}>
                    {school.name}
                  </Text>
                  {!!school.address && (
                    <Text style={s.schoolSub} numberOfLines={2}>
                      {school.address}
                    </Text>
                  )}
                </View>
                {/* gold accent + diagonal white cut */}
                <View style={s.goldCut} />
                <View style={s.diagCut} />
              </LinearGradient>

              {/* Photo overlapping the header */}
              <View style={s.photoFrame}>
                <View style={s.photoGold} />
                {card.photo ? (
                  <Image source={{ uri: card.photo }} style={s.photo} />
                ) : (
                  <View style={[s.photo, s.photoPh]}>
                    <Text style={s.photoPhText}>{initial(card.name)}</Text>
                  </View>
                )}
              </View>

              {/* Body */}
              <View style={s.body}>
                <Text style={s.name} numberOfLines={2}>
                  {card.name}
                </Text>
                <View style={s.desig}>
                  <View style={s.desigDot} />
                  <Text style={s.desigText} numberOfLines={1}>
                    {card.subtitle}
                  </Text>
                </View>
                <View style={s.rows}>
                  {card.frontRows.map(f => (
                    <Row key={f.label} label={f.label} value={f.value} />
                  ))}
                </View>
              </View>

              {/* Footer */}
              <LinearGradient colors={[C.navy2, C.navy3]} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={s.foot}>
                <View style={s.footTop} />
                <View style={s.seal}>
                  <Text style={s.sealText}>{mono}</Text>
                </View>
                <View>
                  <Text style={s.footLbl}>Card No.</Text>
                  <Text style={s.footVal}>{card.cardNumber}</Text>
                </View>
                <View style={s.footRight}>
                  <Text style={s.footLbl}>Valid Till</Text>
                  <Text style={s.footVal}>{card.expiryDate}</Text>
                </View>
              </LinearGradient>
            </Animated.View>

            {/* ═════════ BACK ═════════ */}
            <Animated.View
              style={[s.cardFace, { transform: [{ perspective: 1200 }, { rotateY: backRotate }] }]}
            >
              <LinearGradient colors={[C.navy2, C.navy3]} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={s.backbar}>
                <Text style={s.backbarText} numberOfLines={1}>
                  {school.name}
                </Text>
                <View style={s.backbarLine} />
              </LinearGradient>

              <View style={s.back}>
                <Text style={s.notice}>
                  This card is the property of <Text style={s.noticeB}>{school.name}</Text> and is
                  non-transferable. If found, please return it to the school at the address below.
                </Text>

                {/* QR with gold corner ticks */}
                <View style={s.qrZone}>
                  <View style={s.qrTile}>
                    <View style={[s.qrCorner, s.qrTL]} />
                    <View style={[s.qrCorner, s.qrTR]} />
                    <View style={[s.qrCorner, s.qrBL]} />
                    <View style={[s.qrCorner, s.qrBR]} />
                    {card.qrCode ? (
                      <Image source={{ uri: card.qrCode }} style={s.qrImg} resizeMode="contain" />
                    ) : (
                      <View style={s.qrPh}>
                        <Text style={s.qrPhText}>QR</Text>
                      </View>
                    )}
                  </View>
                  <Text style={s.qrLbl}>Scan to verify</Text>
                  <Text style={s.qrNo}>{card.cardNumber}</Text>
                </View>

                {/* Contact */}
                <View style={s.contact}>
                  <View style={s.sec}>
                    <View style={s.secLine} />
                    <Text style={s.secText}>Contact</Text>
                    <View style={s.secLine} />
                  </View>
                  {!!school.phone && <ContactItem icon="call-outline" text={school.phone} />}
                  {!!school.email && <ContactItem icon="mail-outline" text={school.email} />}
                  {!!school.website && <ContactItem icon="globe-outline" text={school.website} />}
                  {!!school.address && <ContactItem icon="location-outline" text={school.address} />}
                </View>

                {/* Principal signature */}
                <View style={s.signature}>
                  <Text style={s.signScript}>Principal</Text>
                  <View style={s.signLine} />
                  <Text style={s.signRole}>Principal</Text>
                  <Text style={s.signSub}>AUTHORISED SIGNATORY</Text>
                </View>

                {/* Back footer */}
                <View style={s.backfoot}>
                  <View>
                    <Text style={s.bfLbl}>Issued</Text>
                    <Text style={s.bfVal}>{card.issueDate}</Text>
                  </View>
                  <View style={[s.statusPill, card.status === 'active' ? s.statusActive : s.statusInactive]}>
                    <Text style={[s.statusText, card.status === 'active' ? s.statusTextActive : s.statusTextInactive]}>
                      {card.status}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={s.bfLbl}>Valid Till</Text>
                    <Text style={s.bfVal}>{card.expiryDate}</Text>
                  </View>
                </View>
              </View>
            </Animated.View>
          </Animated.View>
        </TouchableWithoutFeedback>

        <View style={s.hintRow}>
          <VectorIcon iconSet="Ionicons" iconName="sync-outline" size={13} color={theme.colors.textMuted} />
          <Text style={s.hintText}>Tap the card to flip</Text>
        </View>
      </View>
    </View>
  );
};

export default IDCardScreen;

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  content: { flex: 1, alignItems: 'center', paddingTop: 14 },

  // States
  stateBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 10 },
  errorIconRing: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: '#FEE2E2',
    alignItems: 'center', justifyContent: 'center', marginBottom: 6,
  },
  errorTitle: { fontSize: 16, fontWeight: '800', color: theme.colors.textPrimary },
  errorSubtitle: { fontSize: 13, color: theme.colors.textMuted, textAlign: 'center', lineHeight: 19 },
  retryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1.5,
    borderColor: theme.colors.primary, borderRadius: theme.radius.full,
    paddingHorizontal: 18, paddingVertical: 9, marginTop: 4,
  },
  retryText: { fontSize: 13, fontWeight: '700', color: theme.colors.primary },

  // Toggle
  toggleRow: {
    flexDirection: 'row', backgroundColor: theme.colors.card, borderRadius: theme.radius.full,
    borderWidth: 1, borderColor: theme.colors.border, padding: 4, marginBottom: 18,
  },
  toggleBtn: { paddingHorizontal: 30, paddingVertical: 8, borderRadius: theme.radius.full },
  toggleBtnActive: { backgroundColor: C.navy },
  toggleText: { fontSize: 13, fontWeight: '700', color: theme.colors.textSecondary },
  toggleTextActive: { color: '#fff' },

  // Card stage / faces
  cardStage: { width: CARD_W, height: CARD_H },
  cardFace: {
    position: 'absolute', top: 0, left: 0, width: CARD_W, height: CARD_H,
    backfaceVisibility: 'hidden', backgroundColor: '#fff', borderRadius: r(16),
    overflow: 'hidden', elevation: 8, shadowColor: '#0a1c36',
    shadowOpacity: 0.22, shadowRadius: 16, shadowOffset: { width: 0, height: 12 },
  },

  // ── FRONT — header ──
  header: { position: 'absolute', top: 0, left: 0, right: 0, height: r(168), overflow: 'hidden' },
  orb: { position: 'absolute', borderRadius: 9999, borderWidth: 1, borderColor: 'rgba(230,205,126,0.18)' },
  orb1: { width: r(240), height: r(240), right: r(-90), top: r(-120) },
  orb2: { width: r(320), height: r(320), right: r(-130), top: r(-160), borderColor: 'rgba(230,205,126,0.10)' },
  headInner: { paddingHorizontal: r(18), paddingTop: r(16), alignItems: 'center' },
  logo: {
    width: r(46), height: r(46), borderRadius: r(23), backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center', marginBottom: r(8),
    borderWidth: 2, borderColor: 'rgba(230,205,126,0.55)',
    elevation: 4, shadowColor: '#000', shadowOpacity: 0.28, shadowRadius: 6, shadowOffset: { width: 0, height: 4 },
  },
  logoImg: { width: r(36), height: r(36), borderRadius: r(18), resizeMode: 'contain' },
  logoPh: { fontSize: r(20), fontWeight: '700', color: C.navy, fontFamily: SERIF },
  schoolName: {
    color: '#fff', fontSize: r(16.5), fontWeight: '700', letterSpacing: 0.4,
    textAlign: 'center', fontFamily: SERIF, lineHeight: r(20),
  },
  schoolSub: {
    color: 'rgba(255,255,255,0.75)', fontSize: r(7.5), letterSpacing: 1.1,
    textTransform: 'uppercase', marginTop: r(5), textAlign: 'center', paddingHorizontal: r(10), lineHeight: r(11),
  },
  goldCut: {
    position: 'absolute', left: r(10), right: r(10), bottom: r(24), height: 1.2,
    backgroundColor: C.goldL, opacity: 0.8, transform: [{ rotate: '-1.5deg' }],
  },
  diagCut: {
    position: 'absolute', left: r(-12), right: r(-12), bottom: r(-12), height: r(36),
    backgroundColor: '#fff', transform: [{ rotate: '-2.5deg' }],
  },

  // ── FRONT — photo ──
  photoFrame: {
    position: 'absolute', top: r(116), alignSelf: 'center', width: r(108), height: r(126), zIndex: 6,
  },
  photoGold: {
    position: 'absolute', top: r(-5), left: r(-5), right: r(-5), bottom: r(-5),
    borderRadius: r(14), borderWidth: 1.5, borderColor: C.goldL, transform: [{ rotate: '-2.2deg' }],
  },
  photo: {
    width: '100%', height: '100%', borderRadius: r(12), borderWidth: 3.5, borderColor: '#fff',
    backgroundColor: '#e7ecf3', elevation: 6, shadowColor: '#0a1c36',
    shadowOpacity: 0.28, shadowRadius: 12, shadowOffset: { width: 0, height: 10 },
  },
  photoPh: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#dde4ee' },
  photoPhText: { fontSize: r(40), fontWeight: '700', color: C.navy, fontFamily: SERIF },

  // ── FRONT — body ──
  body: { position: 'absolute', top: r(252), left: 0, right: 0, bottom: r(48), paddingHorizontal: r(26), paddingTop: r(6) },
  name: {
    textAlign: 'center', fontSize: r(17.5), fontWeight: '700', color: C.ink,
    textTransform: 'uppercase', letterSpacing: 0.8, lineHeight: r(20),
  },
  desig: {
    alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: r(6), marginTop: r(7),
    paddingHorizontal: r(12), paddingVertical: r(3.5), borderRadius: 999,
    backgroundColor: '#eef2f8', borderWidth: 1, borderColor: C.line, maxWidth: '92%',
  },
  desigDot: { width: r(4), height: r(4), borderRadius: r(2), backgroundColor: C.gold },
  desigText: { fontSize: r(8), color: C.navy, fontWeight: '600', letterSpacing: 2, textTransform: 'uppercase' },
  rows: { marginTop: r(9) },
  row: {
    flexDirection: 'row', alignItems: 'flex-start', paddingVertical: r(4.5),
    borderBottomWidth: 1, borderBottomColor: C.line,
  },
  rowK: { width: r(92), fontWeight: '600', color: C.muted, textTransform: 'uppercase', fontSize: r(7.5), letterSpacing: 1, lineHeight: r(13) },
  rowV: { flex: 1, fontWeight: '600', color: C.ink, fontSize: r(10), textAlign: 'right', lineHeight: r(13) },

  // ── FRONT — footer ──
  foot: {
    position: 'absolute', left: 0, right: 0, bottom: 0, height: r(48),
    flexDirection: 'row', alignItems: 'center', gap: r(10), paddingHorizontal: r(18),
  },
  footTop: { position: 'absolute', top: 0, left: 0, right: 0, height: 1.5, backgroundColor: C.goldL, opacity: 0.7 },
  seal: {
    width: r(30), height: r(30), borderRadius: r(15), borderWidth: 1, borderColor: 'rgba(230,205,126,0.7)',
    alignItems: 'center', justifyContent: 'center',
  },
  sealText: { fontFamily: SERIF, fontWeight: '700', fontSize: r(13), color: C.goldL },
  footLbl: { fontSize: r(6.5), textTransform: 'uppercase', letterSpacing: 1.2, color: 'rgba(255,255,255,0.65)' },
  footVal: { fontSize: r(10), fontWeight: '700', color: '#fff', fontFamily: MONO, letterSpacing: 0.5 },
  footRight: { marginLeft: 'auto', alignItems: 'flex-end' },

  // ── BACK — bar ──
  backbar: { height: r(30), alignItems: 'center', justifyContent: 'center' },
  backbarText: { color: 'rgba(255,255,255,0.85)', fontSize: r(8), fontWeight: '600', letterSpacing: 2.4, textTransform: 'uppercase', fontFamily: SERIF },
  backbarLine: { position: 'absolute', bottom: -1.5, left: 0, right: 0, height: 1.5, backgroundColor: C.goldL, opacity: 0.7 },

  back: { flex: 1, paddingHorizontal: r(22), paddingTop: r(14) },
  notice: { textAlign: 'center', fontSize: r(7.8), color: C.muted, lineHeight: r(12), paddingHorizontal: r(6) },
  noticeB: { color: C.ink, fontWeight: '700' },

  // ── BACK — QR ──
  qrZone: { alignItems: 'center', marginTop: r(12) },
  qrTile: { width: r(124), height: r(124), backgroundColor: '#fff', padding: r(9) },
  qrCorner: { position: 'absolute', width: r(16), height: r(16), borderColor: C.gold },
  qrTL: { top: 0, left: 0, borderTopWidth: 2, borderLeftWidth: 2 },
  qrTR: { top: 0, right: 0, borderTopWidth: 2, borderRightWidth: 2 },
  qrBL: { bottom: 0, left: 0, borderBottomWidth: 2, borderLeftWidth: 2 },
  qrBR: { bottom: 0, right: 0, borderBottomWidth: 2, borderRightWidth: 2 },
  qrImg: { width: '100%', height: '100%' },
  qrPh: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.paper },
  qrPhText: { color: C.faint, fontSize: r(9), letterSpacing: 1, textTransform: 'uppercase' },
  qrLbl: { marginTop: r(7), fontSize: r(7), fontWeight: '600', color: C.muted, textTransform: 'uppercase', letterSpacing: 2.2 },
  qrNo: { marginTop: r(3), fontFamily: MONO, fontSize: r(10), fontWeight: '700', color: C.ink, letterSpacing: 2 },

  // ── BACK — contact ──
  contact: { marginTop: r(13) },
  sec: { flexDirection: 'row', alignItems: 'center', gap: r(8), marginBottom: r(8) },
  secLine: { flex: 1, height: 1, backgroundColor: C.line },
  secText: { fontSize: r(7.5), fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.6, color: C.navy },
  ci: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: r(7), paddingVertical: r(2.5) },
  ciText: { fontSize: r(9), color: C.ink, fontWeight: '500', textAlign: 'center', lineHeight: r(12), flexShrink: 1 },

  // ── BACK — signature ──
  signature: { marginTop: 'auto', alignItems: 'center', paddingTop: r(4), paddingBottom: r(12) },
  signScript: { fontFamily: SCRIPT, fontSize: r(15), color: C.navy, opacity: 0.85, marginBottom: r(2) },
  signLine: { width: r(128), height: 1, backgroundColor: C.ink, marginBottom: r(5) },
  signRole: { fontSize: r(9.5), fontWeight: '700', color: C.ink, letterSpacing: 0.4 },
  signSub: { fontSize: r(6.5), color: C.muted, textTransform: 'uppercase', letterSpacing: 1.6, marginTop: r(1.5) },

  // ── BACK — footer ──
  backfoot: {
    marginHorizontal: r(-22), backgroundColor: C.paper, borderTopWidth: 1, borderTopColor: C.line,
    paddingHorizontal: r(22), paddingVertical: r(9), flexDirection: 'row',
    alignItems: 'center', justifyContent: 'space-between',
  },
  bfLbl: { fontSize: r(6.5), textTransform: 'uppercase', letterSpacing: 1.2, color: C.muted },
  bfVal: { fontSize: r(9), fontWeight: '700', color: C.ink },
  statusPill: { paddingHorizontal: r(11), paddingVertical: r(3), borderRadius: 999 },
  statusActive: { backgroundColor: '#e3f4e9' },
  statusInactive: { backgroundColor: '#eef0f4' },
  statusText: { fontSize: r(7), fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  statusTextActive: { color: '#1a7f3c' },
  statusTextInactive: { color: '#6b7280' },

  // Hint
  hintRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 16 },
  hintText: { fontSize: 12, color: theme.colors.textMuted, fontWeight: '500' },
});
