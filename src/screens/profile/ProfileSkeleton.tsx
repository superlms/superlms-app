import React from 'react';
import { StyleSheet, View } from 'react-native';
import { theme, onThemeChange } from '../../utils/theme';
import { Skeleton } from '../../components/Skeleton';
import { DocHeader } from '../more/docUi';

// Value bars vary a little so the list doesn't read as a grid of equal blocks.
const VALUE_WIDTHS = ['72%', '52%', '64%', '40%', '80%', '48%'];

// Loading state that matches the profile page line for line: the 96px photo,
// the name and the line under it, the full-width rule, then one row per
// detail — a label bar sized to its label in the left half and a value bar
// from the middle. Every box has the height of the text it stands in for, so
// nothing moves when the profile arrives.
const ProfileSkeleton = ({
  labels,
  subWidth = '45%',
}: {
  /** The detail labels, in page order — one skeleton row each. */
  labels: string[];
  /** Width of the line under the name (email / admission no.). */
  subWidth?: number | string;
}) => (
  <View style={s.root}>
    <DocHeader title="Profile" />

    <View style={s.head}>
      <Skeleton width={96} height={96} radius={48} />
      <View style={s.nameLine}>
        <Skeleton width="46%" height={18} radius={6} />
      </View>
      <View style={s.subLine}>
        <Skeleton width={subWidth} height={11} radius={5} />
      </View>
    </View>

    <View style={s.divider} />

    <View style={s.body}>
      {labels.map((label, i) => (
        <View key={label} style={[s.row, i < labels.length - 1 && s.rowBorder]}>
          <View style={s.labelCol}>
            <Skeleton width={Math.min(label.length * 7.5, 140)} height={11} radius={5} />
          </View>
          <View style={s.valueCol}>
            <Skeleton width={VALUE_WIDTHS[i % VALUE_WIDTHS.length]} height={11} radius={5} />
          </View>
        </View>
      ))}
    </View>
  </View>
);

export default ProfileSkeleton;

// Mirrors the profile screens' styles: head padding, name 20px + 14 gap, the
// line under it 13px + 4 gap, rows of 14px text with 14px padding.
const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card, overflow: 'hidden' },

  head: { alignItems: 'center', paddingTop: 28, paddingBottom: 24, paddingHorizontal: 20 },
  nameLine: { alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', height: 27, marginTop: 14 },
  subLine: { alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', height: 18, marginTop: 4 },

  divider: { height: 1, backgroundColor: theme.colors.divider },

  body: { paddingHorizontal: 20, paddingTop: 4 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14 },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },
  labelCol: { width: '50%', height: 19, paddingRight: 12, justifyContent: 'center' },
  valueCol: { flex: 1, height: 19, justifyContent: 'center' },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
