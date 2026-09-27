import React, { useCallback, useRef, useState } from 'react';
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
import { HeaderIconButton } from '../../components/Header';
import AppRefreshControl from '../../components/AppRefreshControl';
import { Skeleton } from '../../components/Skeleton';
import { AppAlert, AppDialog } from '../../components/AppDialog';
import { useFocusLoad, useRefresh } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr, pickImage, takePhoto } from '../../utils/filePickers';
import { AdminProfile, getAdminProfile, updateAdminLogo } from '../../api/adminProfileApi';
import {
  DocBody,
  DocError,
  DocHeader,
  DocList,
  DocPeople,
  DocRow,
  DocSection,
  docStyles,
} from '../more/docUi';
import { PlainRow, UnderlineTabs } from './adminExamUi';
import { Block, BlockTitle, day, stampOf } from './adminProfileUi';

/**
 * Profile — the web panel's Profile, drawn as the student app draws a page. It
 * opens on the school as the panel heads it: the logo (changed from here, by
 * camera or gallery, up to 2 MB), the name, the address and the phone · email;
 * then the panel's two tabs.
 *
 *  • School Details (the panel's School Profile tab): every field the
 *    super-admin set when adding the school, its bank details, and the
 *    signed-in account — for a sub-admin, their own details and the screens
 *    granted to them, as the panel's sub-admin card has them — with Change
 *    Password at the foot.
 *  • School Profile (the panel's School Info tab): About, Vision, Mission,
 *    Values, Goals and the school's own sections as headed paragraphs, the
 *    management team and the documents, and when it was last saved. The pencil
 *    in the header opens the form (the panel's Edit); with nothing added yet,
 *    Add School Info does.
 */

type Tab = 'details' | 'profile';

const TABS: { key: Tab; label: string }[] = [
  { key: 'details', label: 'School Details' },
  { key: 'profile', label: 'School Profile' },
];

// A school logo needs no more than this on its longest side — it keeps the
// upload inside the panel's 2 MB.
const LOGO_SIDE = 1024;
const TWO_MB = 2 * 1024 * 1024;

const cap = (v?: string | null) => (v ? v.charAt(0).toUpperCase() + v.slice(1) : v);

const AdminSchoolProfileScreen = ({ navigation, route }: any) => {
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>(route?.params?.tab ?? 'details');
  const [askingLogo, setAskingLogo] = useState(false);
  const [logoBusy, setLogoBusy] = useState(false);
  const loaded = useRef(false);

  // The skeleton only before the first answer; after that, back from a form
  // or pulled down, the page stays as it is until the fresh one arrives.
  const load = useCallback(async () => {
    if (!loaded.current) setLoading(true);
    try {
      setProfile(await getAdminProfile());
      loaded.current = true;
      setError('');
    } catch (e) {
      if (!loaded.current) setError(apiErr(e, 'Could not load profile.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusLoad(load);
  const { refreshing, onRefresh } = useRefresh(load);

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

  const openForm = () => navigation.navigate('AdminSchoolInfoForm');

  if (loading && !profile) return <ProfileLoading />;
  if (error && !profile) return <DocError title="Profile" message={error} onRetry={load} />;
  if (!profile) return null;

  const org = profile.organization;
  const user = profile.user;
  const info = profile.school_info ?? {};
  const team = profile.management_team ?? [];
  const docs = profile.documents ?? [];
  const isSubAdmin = user?.role === 'sub-admin';

  // As the panel heads the page: the school info's contact, or the school's own.
  const mobile = info.school_mobile || org?.mobile_number;
  const email = info.school_email || org?.email;
  const address = (info.school_address || org?.address || '').trim();
  const contacts = [
    mobile && { key: 'mobile', label: mobile, onPress: () => Linking.openURL(`tel:${mobile}`) },
    email && { key: 'email', label: email, onPress: () => Linking.openURL(`mailto:${email}`) },
  ].filter(Boolean) as { key: string; label: string; onPress: () => void }[];
  const website = (info.website_url || '').trim();

  // The panel's paragraph cards: About and the four values, then the school's
  // own sections — each only when it has something.
  const paragraphs = [
    { title: 'About Our School', body: info.about_school },
    { title: 'Vision', body: info.usm_vision },
    { title: 'Mission', body: info.usm_mission },
    { title: 'Values', body: info.usm_values },
    { title: 'Goals', body: info.usm_goals },
  ].filter(p => !!p.body?.trim());
  (info.custom_sections ?? []).forEach(cs => {
    if (cs?.title?.trim() || cs?.description?.trim()) paragraphs.push({ title: cs.title ?? '', body: cs.description ?? '' });
  });
  const websiteInfo = (info.website_info || '').trim();

  const hasAnyInfo = paragraphs.length > 0 || team.length > 0 || docs.length > 0 || !!websiteInfo;
  const updated = stampOf(info.updated_at);

  return (
    <View style={s.root}>
      <DocHeader
        title="Profile"
        onBackPress={() => navigation.goBack()}
        rightSlot={
          tab === 'profile' && hasAnyInfo ? <HeaderIconButton icon="create-outline" onPress={openForm} /> : undefined
        }
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[1]}
        refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* The school: logo, name, address, phone · email */}
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

        {/* The panel's two tabs, held at the top as the page scrolls */}
        <View style={s.tabsWrap}>
          <UnderlineTabs tabs={TABS} active={tab} onChange={setTab} />
        </View>

        {tab === 'details' ? (
          <View style={s.body}>
            <Block
              first
              title="School Details"
              lines={[
                { label: 'School Name', value: org?.name },
                { label: 'Email', value: org?.email },
                { label: 'Mobile Number', value: org?.mobile_number },
                { label: 'State', value: org?.state },
                { label: 'Education Board', value: org?.education_board },
                { label: 'School Code', value: org?.school_code },
                { label: 'Affiliation Number', value: org?.affiliation_no },
                { label: 'UDISE Number', value: org?.udise_number },
                { label: 'Serial Number', value: org?.serial_number },
                { label: 'Address', value: org?.address },
              ]}
            />

            <Block
              title="Bank Details"
              lines={[
                { label: 'Bank Name', value: org?.bank_name },
                { label: 'Account Number', value: org?.bank_account_no },
                { label: 'IFSC Code', value: org?.bank_ifsc },
                { label: 'Branch', value: org?.bank_branch },
                { label: 'Account Holder', value: org?.bank_holder_name },
              ]}
            />

            <Block
              title="Account"
              lines={[
                { label: 'Name', value: user?.name },
                { label: 'Email', value: user?.email },
                { label: 'Role', value: isSubAdmin ? 'Sub-admin' : cap(user?.role) || 'Admin' },
                ...(isSubAdmin
                  ? [
                      { label: 'Mobile', value: user?.mobile_number },
                      { label: 'Alt. Mobile', value: user?.alternative_mobile },
                      { label: 'Gender', value: cap(user?.gender) },
                      { label: 'Date of Birth', value: day(user?.dob) },
                      { label: 'Date of Joining', value: day(user?.date_of_joining) },
                    ]
                  : []),
              ]}
            />

            {isSubAdmin && (
              <>
                <BlockTitle>Granted Access</BlockTitle>
                {(user?.granted_access ?? []).length > 0 ? (
                  <View style={s.chips}>
                    {(user?.granted_access ?? []).map(p => (
                      <View key={p} style={s.chip}>
                        <Text style={s.chipText}>{p}</Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={s.muted}>No functionalities granted.</Text>
                )}
              </>
            )}

            <View style={s.passwordRow}>
              <PlainRow
                icon="lock-closed-outline"
                title="Change Password"
                lines={['Set a new strong password for the admin login']}
                isLast
                onPress={() => navigation.navigate('AdminChangePassword')}
              />
            </View>
          </View>
        ) : !hasAnyInfo ? (
          // The panel's "no information" state, with its Add button.
          <View style={s.empty}>
            <View style={s.emptyIcon}>
              <VectorIcon iconSet="Ionicons" iconName="information-circle-outline" size={34} color={theme.colors.textMuted} />
            </View>
            <Text style={s.emptyTitle}>No School Info Yet</Text>
            <Text style={s.emptySub}>
              Add your school's about, vision, management team and documents to bring this profile to life.
            </Text>
            <TouchableOpacity style={s.addBtn} activeOpacity={0.85} onPress={openForm}>
              <VectorIcon iconSet="Ionicons" iconName="add" size={16} color={theme.colors.white} />
              <Text style={s.addBtnText}>Add School Info</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={docStyles.scroll}>
            {paragraphs.map((p, i) => (
              <DocSection key={i} title={p.title?.trim() || undefined}>
                {!!p.body?.trim() && <DocBody>{p.body.trim()}</DocBody>}
              </DocSection>
            ))}

            {!!websiteInfo && (
              <DocSection title="Website">
                <DocBody>{websiteInfo}</DocBody>
              </DocSection>
            )}

            {team.length > 0 && (
              <DocSection title="Management Team">
                <DocList>
                  <DocPeople
                    people={team.map(m => ({ id: m.id, name: m.name, designation: m.designation, photo_url: m.photo_path ?? null }))}
                  />
                </DocList>
              </DocSection>
            )}

            {docs.length > 0 && (
              <DocSection title="School Documents">
                <DocList>
                  {docs.map((d, i) => (
                    <DocRow
                      key={d.id}
                      icon="file-text"
                      title={d.title}
                      sub={d.file_type ? String(d.file_type).toUpperCase() : undefined}
                      trailingIcon="open-outline"
                      onPress={() => Linking.openURL(d.file_path).catch(() => {})}
                      isLast={i === docs.length - 1}
                    />
                  ))}
                </DocList>
              </DocSection>
            )}

            {!!updated && <Text style={docStyles.footnote}>Last updated {updated}</Text>}
          </View>
        )}
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
// tabs, then the School Details lines.
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
    <View style={s.skTabs}>
      <Skeleton width={96} height={12} />
      <Skeleton width={96} height={12} />
    </View>
    <View style={s.skDivider} />
    <View style={s.body}>
      <View style={s.skTitle}>
        <Skeleton width={110} height={10} />
      </View>
      {['58%', '44%', '36%', '30%', '50%', '26%'].map((w, i) => (
        <View key={i} style={[s.skRow, i < 5 && s.skRowDivider]}>
          <Skeleton width={90} height={12} />
          <Skeleton width={w as any} height={12} />
        </View>
      ))}
    </View>
  </View>
);

export default AdminSchoolProfileScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },

  // The school
  hero: { alignItems: 'center', paddingTop: 24, paddingBottom: 16, paddingHorizontal: 25 },
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

  // Tabs — a white strip so the page doesn't show through while held at the top
  tabsWrap: { backgroundColor: theme.colors.card },

  // School Details
  body: { paddingHorizontal: 20, paddingBottom: 48 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.primaryLight,
  },
  chipText: { fontSize: 12, fontWeight: '500', color: theme.colors.primary },
  muted: { fontSize: 13, color: theme.colors.textMuted, marginTop: 10 },
  passwordRow: { marginTop: 24, borderTopWidth: 1, borderTopColor: theme.colors.border },

  // No school info yet
  empty: { alignItems: 'center', paddingTop: 56, paddingHorizontal: 32, paddingBottom: 48 },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: theme.colors.textPrimary, marginTop: 16 },
  emptySub: { fontSize: 13, lineHeight: 19, color: theme.colors.textMuted, textAlign: 'center', marginTop: 6 },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 20,
    paddingHorizontal: 18,
    height: 42,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primary,
  },
  addBtnText: { fontSize: 14, fontWeight: '600', color: theme.colors.white },

  // Loading
  skName: { alignSelf: 'stretch', alignItems: 'center', height: 27, justifyContent: 'center', marginTop: 14 },
  skLine: { alignSelf: 'stretch', alignItems: 'center', height: 19, justifyContent: 'center', marginTop: 6 },
  skTabs: { flexDirection: 'row', gap: 20, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 12 },
  skDivider: { height: 1, backgroundColor: theme.colors.border },
  skTitle: { height: 14, justifyContent: 'center', marginTop: 18, marginBottom: 2 },
  skRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 15 },
  skRowDivider: { borderBottomWidth: 1, borderBottomColor: theme.colors.border },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
