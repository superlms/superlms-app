import React from 'react';
import { RefreshControl, RefreshControlProps } from 'react-native';
import { theme } from '../utils/theme';

/**
 * App-wide pull-to-refresh control with the brand look & feel.
 *
 * Drop it into any ScrollView / FlatList via the `refreshControl` prop:
 *
 *   <ScrollView refreshControl={<AppRefreshControl refreshing={r} onRefresh={fn} />} />
 *
 * On Android it renders the branded circular spinner (primary → secondary
 * sweep) on a white pill; on iOS it tints the elastic spinner with the
 * primary colour and shows a subtle "Refreshing…" caption.
 */
const AppRefreshControl = (props: Partial<RefreshControlProps> & {
  refreshing: boolean;
  onRefresh: () => void;
}) => {
  return (
    <RefreshControl
      // Android (circular spinner) — `large` reads a few px bigger & cleaner
      colors={[theme.colors.primary, theme.colors.secondary]}
      progressBackgroundColor={theme.colors.white}
      size="large"
      // iOS (elastic spinner)
      tintColor={theme.colors.primary}
      title="Refreshing…"
      titleColor={theme.colors.textMuted}
      {...props}
    />
  );
};

export default AppRefreshControl;
