import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import VectorIcon from '../../components/VectorIcon';
import AppRefreshControl from '../../components/AppRefreshControl';
import { Skeleton } from '../../components/Skeleton';
import { AppAlert, AppDialog } from '../../components/AppDialog';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr, pickImage, takePhoto } from '../../utils/filePickers';
import { updateAdminLogo } from '../../api/adminProfileApi';
import { DocError, DocHeader, docStyles } from '../more/docUi';
import { useSchoolProfile } from './adminProfileUi';

/**
 * Profile — the web panel's Profile, drawn as the student app draws a page. It
 * opens on the school as the panel heads it: the logo (changed from here, by
 * camera or gallery, up to 2 MB), the name, the address, the phone · email and
 * the website; then the panel's two tabs as plain rows, the way the Exams hub
 * lists its pages. A row opens its own page:
 *
 *  • School Details (the panel's School Profile tab) — the school, its bank
 *    details, the account, and Change Password.
 *  • School Profile (the panel's School Info tab) — about, vision, the
 *    school's sections, the management team and documents, with Edit.
 */

const ENTRIES: { route: string; title: string; icon: string; sub: string }[] = [
  {
    route: 'AdminSchoolDetails',
    title: 'School Details',
    icon: 'business-outline',
    sub: 'School, bank and account details',
  },
  {
    route: 'AdminSchoolInfo',
    title: 'School Profile',
    icon: 'information-circle-outline',
    sub: 'About, vision, management and documents',
  },
];

// A school logo needs no more than this on its longest side — it keeps the
// upload inside the panel's 2 MB.
const LOGO_SIDE = 1024;
const TWO_MB = 2 * 1024 * 1024;

const AdminProfileHubScreen = ({ navigation }: any) => {
  const { profile, setProfile, loading, error, load, refreshing, onRefresh } = useSchoolProfile();
  const [askingLogo, setAskingLogo] = useState(false);
  const [logoBusy, setLogoBusy] = useState(false);

  // ── The logo ──
  const changeLogo = async (from: 'camera' | 'gallery') => {
    setAskingLogo(false);
    const f = from === 'camera' ? await takePhoto({ maxSide: LOGO_SIDE }) : await pickImage({ maxSide: LOGO_SIDE });
    if (!f) return;
    if (f.size && f.size > TWO_MB) {
      AppAlert.alert('Logo too large', 'The logo must be 2 MB or smaller.');
      return;
    }
    setLogoBusy(true);
    try {
      const { logo } = await updateAdminLogo(f);
      setProfile(prev =>
        prev ? { ...prev, organization: prev.organization ? { ...prev.organization, logo } : prev.organization } : prev,
      );
    } catch (e) {
      AppAlert.alert('Logo not saved', apiErr(e, 'Could not update logo.'));
    } finally {
      setLogoBusy(false);
    }
  };

  if (loading && !profile) return <ProfileLoading />;
  if (error && !profile) return <DocError title="Profile" message={error} onRetry={load} />;
  if (!profile) return null;

  const org = profile.organization;
  const info = profile.school_info ?? {};

  // As the panel heads the page: the school info's contact, or the school's own.
  const mobile = info.school_mobile || org?.mobile_number;
  const email = info.school_email || org?.email;
  const address = (info.school_address || org?.address || '').trim();
  const contacts = [
    mobile && { key: 'mobile', label: mobile, onPress: () => Linking.openURL(`tel:${mobile}`) },
    email && { key: 'email', label: email, onPress: () => Linking.openURL(`mailto:${email}`) },
  ].filter(Boolean) as { key: string; label: string; onPress: () => void }[];
  const website = (info.website_url || '').trim();

  return (
    <View style={s.root}>
      <DocHeader title="Profile" onBackPress={() => navigation.goBack()} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
        refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* The school: logo, name, address, phone · email, website */}
        <View style={s.hero}>
          <View>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setAskingLogo(true)}
              disabled={logoBusy}
              accessibilityLabel="Change logo"
            >
              <View style={s.logoBox}>
                {org?.logo ? (
                  <Image source={{ uri: org.logo }} style={s.logo} resizeMode="contain" />
                ) : (
                  <VectorIcon iconSet="Ionicons" iconName="school-outline" size={34} color={theme.colors.primary} />
                )}
                {logoBusy && (
                  <View style={s.logoBusy}>
                    <ActivityIndicator color={theme.colors.white} />
                  </View>
                )}
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={s.camera}
              onPress={() => setAskingLogo(true)}
              disabled={logoBusy}
              hitSlop={8}
              accessibilityLabel="Change logo"
            >
              <VectorIcon iconSet="Ionicons" iconName="camera" size={14} color={theme.colors.white} />
            </TouchableOpacity>
          </View>

          <Text style={docStyles.heroName}>{org?.name || 'School Profile'}</Text>
          {/* One run across the width, even when the address was typed on several lines */}
          {!!address && <Text style={docStyles.heroLine}>{address.replace(/\s*\n\s*/g, ', ')}</Text>}
          {contacts.length > 0 && (
            <Text style={docStyles.heroLine}>
              {contacts.map((c, i) => (
                <Text key={c.key}>
                  {i > 0 ? '  ·  ' : ''}
                  <Text style={docStyles.heroLink} onPress={c.onPress}>
                    {c.label}
                  </Text>
                </Text>
              ))}
            </Text>
          )}
          {!!website && (
            <Text style={docStyles.heroLine}>
              <Text
                style={docStyles.heroLink}
                onPress={() => Linking.openURL(/^https?:\/\//i.test(website) ? website : `https://${website}`).catch(() => {})}
              >
                {website.replace(/^https?:\/\//i, '').replace(/\/$/, '')}
              </Text>
            </Text>
          )}
        </View>

        <View style={docStyles.rule} />

        {/* The panel's two tabs, as plain rows */}
        {ENTRIES.map((item, i) => (
          <TouchableOpacity
            key={item.route}
            style={s.row}
            activeOpacity={0.6}
            onPress={() => navigation.navigate(item.route)}
          >
            <View style={s.rowIcon}>
              <VectorIcon iconSet="Ionicons" iconName={item.icon} size={20} color={theme.colors.textSecondary} />
            </View>
            <View style={[s.rowMain, i < ENTRIES.length - 1 && s.rowDivider]}>
              <View style={s.rowText}>
                <Text style={s.rowTitle}>{item.title}</Text>
                <Text style={s.rowSub} numberOfLines={1}>{item.sub}</Text>
              </View>
              <VectorIcon iconSet="Ionicons" iconName="chevron-forward" size={16} color={theme.colors.textMuted} />
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <AppDialog
        visible={askingLogo}
        title="School logo"
        message="Take one now, or pick a picture already on this phone — a square JPG or PNG, up to 2 MB."
        actions={[
          { text: 'Camera', onPress: () => changeLogo('camera') },
          { text: 'Gallery', onPress: () => changeLogo('gallery') },
          { text: 'Cancel', style: 'cancel', onPress: () => setAskingLogo(false) },
        ]}
        onRequestClose={() => setAskingLogo(false)}
      />
    </View>
  );
};

// The page as it will stand: the logo, the name and two lines under it, the
// rule, then the two rows.
const ProfileLoading = () => (
  <View style={s.root}>
    <DocHeader title="Profile" />
    <View style={s.hero}>
      <Skeleton width={88} height={88} radius={16} />
      <View style={s.skName}>
        <Skeleton width="56%" height={18} />
      </View>
      <View style={s.skLine}>
        <Skeleton width="72%" height={11} />
      </View>
      <View style={s.skLine}>
        <Skeleton width="52%" height={11} />
      </View>
    </View>
    <View style={docStyles.rule} />
    {ENTRIES.map((item, i) => (
      <View key={item.route} style={s.row}>
        <View style={s.rowIcon}>
          <Skeleton width={20} height={20} radius={5} />
        </View>
        <View style={[s.rowMain, i < ENTRIES.length - 1 && s.rowDivider]}>
          <View style={s.rowText}>
            <View style={s.skRowTitle}>
              <Skeleton width={110} height={13} />
            </View>
            <View style={s.skRowSub}>
              <Skeleton width={190} height={11} />
            </View>
          </View>
        </View>
      </View>
    ))}
  </View>
);

export default AdminProfileHubScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  scroll: { paddingBottom: 40 },

  // The school
  hero: { alignItems: 'center', paddingTop: 24, paddingBottom: 24, paddingHorizontal: 25 },
  logoBox: {
    width: 88,
    height: 88,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logo: { width: 76, height: 76 },
  logoBusy: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  camera: {
    position: 'absolute',
    right: -6,
    bottom: -6,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: theme.colors.card,
  },

  // The two tabs — plain icon, title and line, with an inset hairline (as the Exams hub)
  row: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingLeft: 20 },
  rowIcon: { width: 22, alignItems: 'center' },
  rowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 15,
    paddingRight: 20,
  },
  rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },
  rowText: { flex: 1 },
  rowTitle: { fontSize: 15, fontWeight: '500', color: theme.colors.textPrimary },
  rowSub: { fontSize: 13, color: theme.colors.textMuted, marginTop: 2 },

  // Loading
  skName: { alignSelf: 'stretch', alignItems: 'center', height: 27, justifyContent: 'center', marginTop: 14 },
  skLine: { alignSelf: 'stretch', alignItems: 'center', height: 19, justifyContent: 'center', marginTop: 6 },
  skRowTitle: { height: 20, justifyContent: 'center' },
  skRowSub: { height: 18, justifyContent: 'center', marginTop: 2 },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
