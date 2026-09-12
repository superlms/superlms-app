import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import VectorIcon from '../../components/VectorIcon';
import { theme, onThemeChange } from '../../utils/theme';
import { STATUS_META } from './queryTypes';
import type { Query } from './queryTypes';

interface Props {
  item: Query;
  onPress?: () => void;
  isLast?: boolean;
}

// One query as a plain list row: subject, a one-line preview and a quiet meta
// line (status dot + label, time, reply hint), with a hairline separator below.
const QueryRow = ({ item, onPress, isLast }: Props) => {
  const meta = STATUS_META[item.status];
  const timeLabel = item.daysAgo === 0 ? 'Today' : `${item.daysAgo}d ago`;

  return (
    <TouchableOpacity
      style={[s.row, !isLast && s.rowBorder]}
      onPress={onPress}
      activeOpacity={0.6}
    >
      <View style={{ flex: 1 }}>
        <Text style={s.subject} numberOfLines={1}>
          {item.subject}
        </Text>
        {!!item.message && (
          <Text style={s.preview} numberOfLines={1}>
            {item.message}
          </Text>
        )}
        <View style={s.metaRow}>
          <View style={[s.dot, { backgroundColor: meta.color }]} />
          <Text style={[s.metaText, { color: meta.color }]}>{item.status}</Text>
          <Text style={s.metaText}>· {timeLabel}</Text>
          {!!item.admin_reply && <Text style={s.metaText}>· Replied</Text>}
        </View>
      </View>
      <VectorIcon
        iconSet="Ionicons"
        iconName="chevron-forward"
        size={16}
        color={theme.colors.textMuted}
      />
    </TouchableOpacity>
  );
};

export default QueryRow;

const __mk_s = () => StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },
  subject: { fontSize: 15, fontWeight: '500', color: theme.colors.textPrimary },
  preview: { fontSize: 13, color: theme.colors.textSecondary, marginTop: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  metaText: { fontSize: 12, color: theme.colors.textMuted },
});


// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
