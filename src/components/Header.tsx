import React from 'react';
import {
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
}

const Header = ({
  title,
  onBackPress,
  showBack = true,
  backgroundColor,
  rightIcon,
  onRightPress,
}: HeaderProps) => {
  const navigation = useNavigation<any>();

  const handleBackPress = () => {
    navigation.goBack();
  };

  // Default to the themed surface so the header turns dark in dark mode.
  const headerBg = backgroundColor ?? theme.colors.card;

  return (
    <>
      {/* Status bar tinted with the page background; light icons in dark mode. */}
      <StatusBar
        barStyle="dark-content"
        backgroundColor={theme.colors.statusBar}
        translucent={false}
      />
      <View style={[styles.container, { backgroundColor: headerBg }]}>
        <View style={styles.side}>
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

        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>

        <View style={[styles.side, styles.sideRight]}>
          {rightIcon && onRightPress ? (
            <TouchableOpacity
              onPress={onRightPress}
              activeOpacity={0.7}
              style={styles.backButton}
            >
              <VectorIcon
                iconSet="Ionicons"
                iconName={rightIcon}
                size={20}
                color={theme.colors.primary}
              />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </>
  );
};

export default Header;

const __mk_styles = () => StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.sm,
    height: 60,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  side: {
    width: 36,
    alignItems: 'flex-start',
  },
  sideRight: {
    alignItems: 'flex-end',
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
