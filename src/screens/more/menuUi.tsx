import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import VectorIcon from '../../components/VectorIcon';
import { Skeleton } from '../../components/Skeleton';
import { theme, onThemeChange } from '../../utils/theme';

/**
 * A menu entry for the More and Settings pages, in the Exams list's language:
 * a plain row separated by hairlines, a fixed left column (the icon, where an
 * exam has its date), the title with a short description under it, and a
 * chevron or a control on the right. No tiles, cards or tints.
 *
 *   (i)   About App                                          ›
 *         What the app is and the version you are on
 */
export const MenuRow = ({
  icon,
  title,
  description,
  trailing,
  onPress,
  isLast,
}: {
  icon: string;
  title: string;
  description?: string;
  /** A control on the right (a Switch); a chevron is shown for tappable rows otherwise. */
  trailing?: React.ReactNode;
  onPress?: () => void;
  isLast?: boolean;
}) => {
  const Container: any = onPress ? TouchableOpacity : View;
  const containerProps = onPress ? { activeOpacity: 0.6, onPress } : {};

  return (
    <Container {...containerProps} style={[s.row, !isLast && s.rowDivider]}>
      <View style={s.iconCol}>
        <VectorIcon iconSet="Ionicons" iconName={icon} size={22} color={theme.colors.textSecondary} />
      </View>

      <View style={s.body}>
        <Text style={s.title} numberOfLines={1}>
          {title}
        </Text>
        {!!description && (
          <Text style={s.description} numberOfLines={1}>
            {description}
          </Text>
        )}
      </View>

      {trailing ??
        (onPress ? (
          <VectorIcon iconSet="Ionicons" iconName="chevron-forward" size={16} color={theme.colors.textMuted} />
        ) : null)}
    </Container>
  );
};

// ── One row's skeleton ───────────────────────────────────────────────────────
// The icon, the title and description lines at their real heights, and the
// right-hand control: a switch's track or a chevron.
const TITLE_W = ['46%', '58%', '52%', '40%'];
const DESC_W = ['66%', '72%', '60%', '70%'];

export const MenuRowSkeleton = ({
  index,
  trailing = 'chevron',
  isLast,
}: {
  index: number;
  trailing?: 'switch' | 'chevron';
  isLast?: boolean;
}) => (
  <View style={[s.row, !isLast && s.rowDivider]}>
    <View style={s.iconCol}>
      <Skeleton width={22} height={22} radius={6} />
    </View>
    <View style={s.body}>
      <View style={s.skTitle}>
        <Skeleton width={TITLE_W[index % TITLE_W.length]} height={12} />
      </View>
      <View style={s.skDesc}>
        <Skeleton width={DESC_W[index % DESC_W.length]} height={10} />
      </View>
    </View>
    {trailing === 'switch' ? (
      <Skeleton width={40} height={22} radius={11} />
    ) : (
      <Skeleton width={10} height={14} radius={3} />
    )}
  </View>
);

const __mk_s = () => StyleSheet.create({
  // The page's list: the same margins as the Exams list.
  list: { paddingHorizontal: 20, paddingTop: 2, paddingBottom: 40 },

  // Row — the icon as its own column, then what the entry is.
  row: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 14 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  iconCol: { width: 40, alignItems: 'center' },
  body: { flex: 1, gap: 3 },
  title: { fontSize: 15, fontWeight: '500', color: theme.colors.textPrimary },
  description: { fontSize: 13, lineHeight: 18, color: theme.colors.textSecondary },

  // Skeleton lines, at the heights of the title (15px) and description (13/18)
  skTitle: { height: 20, justifyContent: 'center' },
  skDesc: { height: 18, justifyContent: 'center' },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

export { s as menuStyles };
