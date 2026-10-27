import React, { useState } from 'react';
import {
  ActivityIndicator,
  LayoutChangeEvent,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { theme, onThemeChange } from '../utils/theme';
import VectorIcon from './VectorIcon';
import { useNavigation } from '@react-navigation/native';

interface HeaderProps {
  title: string;
  onBackPress?: () => void;
  showBack?: boolean;
  backgroundColor?: string;
  /** Optional right-side action (e.g. a "manage / edit" icon). */
  rightIcon?: string;
  onRightPress?: () => void;
  /** Optional right-side info pill (e.g. a count or badge). */
  rightText?: string;
  /** Optional custom right-side content (e.g. multiple action buttons). */
  rightSlot?: React.ReactNode;
  /** Draw a thin line between the header and the screen below. */
  divider?: boolean;
  /** Bar height (default 60). */
  height?: number;
}

/**
 * A round icon button as the header draws it — for a rightSlot holding several.
 * Busy: a small spinner in the circle in place of the icon, and no tap.
 */
export const HeaderIconButton = ({
  icon,
  onPress,
  size = 20,
  busy,
  accessibilityLabel,
}: {
  icon: string;
  onPress: () => void;
  size?: number;
  busy?: boolean;
  accessibilityLabel?: string;
}) => (
  <TouchableOpacity
    onPress={onPress}
    disabled={busy}
    activeOpacity={0.7}
    style={styles.backButton}
    accessibilityRole="button"
    accessibilityLabel={accessibilityLabel}
  >
    {busy ? (
      <ActivityIndicator size="small" color={theme.colors.primary} />
    ) : (
      <VectorIcon iconSet="Ionicons" iconName={icon} size={size} color={theme.colors.primary} />
    )}
  </TouchableOpacity>
);

/** Several header buttons side by side, for a rightSlot. */
export const HeaderActions = ({ children }: { children: React.ReactNode }) => (
  <View style={styles.actions}>{children}</View>
);

const Header = ({
  title,
  onBackPress,
  showBack = true,
  backgroundColor,
  rightIcon,
  onRightPress,
  rightText,
  rightSlot,
  divider,
  height = 60,
}: HeaderProps) => {
  const navigation = useNavigation<any>();

  const handleBackPress = () => {
    navigation.goBack();
  };

  // Default to the themed surface so the header turns dark in dark mode.
  const headerBg = backgroundColor ?? theme.colors.card;

  // The title sits in the very middle of the bar, however many buttons are on
  // the right: the left side is kept as wide as the right one turns out to be.
  const [rightWidth, setRightWidth] = useState(SIDE);
  const onRightLayout = (e: LayoutChangeEvent) => {
    const w = Math.max(SIDE, Math.ceil(e.nativeEvent.layout.width));
    if (w !== rightWidth) setRightWidth(w);
  };

  return (
    <>
      {/* Translucent, as at the app's root, whose white strip under the status
          bar meets the header with no seam. */}
      <StatusBar
        barStyle="dark-content"
        backgroundColor={theme.colors.statusBar}
        translucent
      />
      <View style={[styles.container, { backgroundColor: headerBg, height }, divider && styles.divider]}>
        <View style={[styles.side, { width: rightWidth }]}>
          {showBack ? (
            <TouchableOpacity
              onPress={onBackPress ? onBackPress : handleBackPress}
              activeOpacity={0.7}
              style={styles.backButton}
            >
              <VectorIcon
                iconSet="Ionicons"
                iconName="chevron-back"
                size={22}
                color={theme.colors.textPrimary}
              />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* A long title steps its size down a little before it is cut short. */}
        <Text style={styles.title} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.82}>
          {title}
        </Text>

        <View
          style={[styles.side, styles.sideRight, (rightText || rightSlot) ? styles.sideAuto : null]}
          onLayout={onRightLayout}
        >
          {rightSlot ? (
            rightSlot
          ) : rightText ? (
            <View style={styles.rightPill}>
              <Text style={styles.rightPillText}>{rightText}</Text>
            </View>
          ) : rightIcon && onRightPress ? (
            <HeaderIconButton icon={rightIcon} onPress={onRightPress} />
          ) : null}
        </View>
      </View>
    </>
  );
};

export default Header;

// A side of the bar: one round button wide.
const SIDE = 36;

const __mk_styles = () => StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.sm,
  },
  divider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.divider,
  },
  side: {
    width: SIDE,
    alignItems: 'flex-start',
  },
  sideRight: {
    alignItems: 'flex-end',
  },
  sideAuto: {
    width: 'auto',
    minWidth: SIDE,
  },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rightPill: {
    minWidth: 28,
    height: 24,
    paddingHorizontal: 8,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rightPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginHorizontal: theme.spacing.sm,
  },
});


// Themed stylesheets — rebuilt on light/dark toggle.
let styles = __mk_styles();
onThemeChange(() => { styles = __mk_styles(); });
