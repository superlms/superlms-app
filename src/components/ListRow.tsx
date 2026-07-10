import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import VectorIcon from './VectorIcon';
import { theme, onThemeChange } from '../utils/theme';

// Calendar-style list row: a left colour bar, a title + subtitle, an optional
// meta line (icon · text · tag pill) and a trailing chevron. Shared across the
// admin listings (Students, Teachers, Standards, Announcements, …) so every list
// reads the same. `variant="plain"` drops the card chrome for use inside another
// card (e.g. a dashboard ChartCard), where `right` usually holds a value.
export interface ListRowProps {
  color: string;
  title: string;
  subtitle?: string;
  metaIcon?: string;
  meta?: string;
  tag?: string;
  tagColor?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  variant?: 'card' | 'plain';
}

const ListRow = ({
  color, title, subtitle, metaIcon, meta, tag, tagColor, right, onPress, variant = 'card',
}: ListRowProps) => {
  const tColor = tagColor ?? color;
  const showMeta = !!metaIcon || !!meta || !!tag;
  const trailing = right !== undefined
    ? right
    : variant === 'card'
      ? <VectorIcon iconSet="Ionicons" iconName="chevron-forward" size={18} color={theme.colors.textMuted} />
      : null;

  const body = (
    <>
      <View style={[s.colorBar, { backgroundColor: color }]} />
      <View style={{ flex: 1 }}>
        <Text style={s.title} numberOfLines={1}>{title}</Text>
        {!!subtitle && <Text style={s.sub} numberOfLines={1}>{subtitle}</Text>}
        {showMeta && (
          <View style={s.metaRow}>
            {!!metaIcon && <VectorIcon iconSet="Ionicons" iconName={metaIcon} size={13} color={theme.colors.textMuted} />}
            {!!meta && <Text style={s.meta} numberOfLines={1}>{meta}</Text>}
            {!!tag && (
              <View style={[s.tag, { backgroundColor: tColor + '18' }]}>
                <Text style={[s.tagText, { color: tColor }]}>{tag}</Text>
              </View>
            )}
          </View>
        )}
      </View>
      {trailing}
    </>
  );

  const style = variant === 'card' ? s.card : s.plain;
  if (onPress) {
    return <TouchableOpacity style={style} activeOpacity={0.7} onPress={onPress}>{body}</TouchableOpacity>;
  }
  return <View style={style}>{body}</View>;
};

export default ListRow;

const __mk = () => StyleSheet.create({
  card: {
    flexDirection: 'row', gap: 10, alignItems: 'center',
    backgroundColor: theme.colors.card, borderRadius: 12, padding: 12, marginBottom: 8,
    borderWidth: 1, borderColor: theme.colors.border,
  },
  plain: { flexDirection: 'row', gap: 10, alignItems: 'center', paddingVertical: 8 },
  colorBar: { width: 4, borderRadius: 2, alignSelf: 'stretch', minHeight: 34 },
  title: { fontSize: 14, fontWeight: '800', color: theme.colors.textPrimary },
  sub: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, flexWrap: 'wrap' },
  meta: { fontSize: 11, color: theme.colors.textMuted },
  tag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: theme.radius.full },
  tagText: { fontSize: 10, fontWeight: '800', textTransform: 'capitalize' },
});

let s = __mk();
onThemeChange(() => { s = __mk(); });
