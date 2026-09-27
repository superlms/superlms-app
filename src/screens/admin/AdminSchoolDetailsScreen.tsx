import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import AppRefreshControl from '../../components/AppRefreshControl';
import { Skeleton } from '../../components/Skeleton';
import { theme, onThemeChange } from '../../utils/theme';
import { DocError, DocHeader } from '../more/docUi';
import { PlainRow } from './adminExamUi';
import { Block, BlockTitle, day, useSchoolProfile } from './adminProfileUi';

/**
 * School Details — the panel's School Profile tab, opened from Profile: every
 * field the super-admin set when adding the school, its bank details, and the
 * signed-in account — for a sub-admin, their own details and the screens
 * granted to them, as the panel's sub-admin card has them — each block a
 * heading over plain lines, a dash where the school has nothing. Change
 * Password is at the foot.
 */

const cap = (v?: string | null) => (v ? v.charAt(0).toUpperCase() + v.slice(1) : v);

const AdminSchoolDetailsScreen = ({ navigation }: any) => {
  const { profile, loading, error, load, refreshing, onRefresh } = useSchoolProfile();

  if (loading && !profile) return <DetailsLoading onBack={() => navigation.goBack()} />;
  if (error && !profile) return <DocError title="School Details" message={error} onRetry={load} />;
  if (!profile) return null;

  const org = profile.organization;
  const user = profile.user;
  const isSubAdmin = user?.role === 'sub-admin';
  const granted = user?.granted_access ?? [];

  return (
    <View style={s.root}>
      <DocHeader title="School Details" onBackPress={() => navigation.goBack()} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.body}
        refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
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
            {granted.length > 0 ? (
              <View style={s.chips}>
                {granted.map(p => (
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
      </ScrollView>
    </View>
  );
};

// The page as it will stand: a heading, then its lines — a label and a value.
const DetailsLoading = ({ onBack }: { onBack: () => void }) => (
  <View style={s.root}>
    <DocHeader title="School Details" onBackPress={onBack} />
    <View style={s.body}>
      <View style={s.skTitle}>
        <Skeleton width={110} height={10} />
      </View>
      {['58%', '44%', '36%', '30%', '50%', '26%', '40%', '34%'].map((w, i, all) => (
        <View key={i} style={[s.skRow, i < all.length - 1 && s.skRowDivider]}>
          <Skeleton width={90} height={12} />
          <Skeleton width={w as any} height={12} />
        </View>
      ))}
    </View>
  </View>
);

export default AdminSchoolDetailsScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
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

  // Loading
  skTitle: { height: 14, justifyContent: 'center', marginTop: 18, marginBottom: 2 },
  skRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 15 },
  skRowDivider: { borderBottomWidth: 1, borderBottomColor: theme.colors.border },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
