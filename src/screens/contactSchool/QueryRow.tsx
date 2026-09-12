import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { theme, onThemeChange } from '../../utils/theme';
import { STATUS_META } from './queryTypes';
import type { Query } from './queryTypes';

interface Props {
  item: Query;
  onPress?: () => void;
  isLast?: boolean;
}

// One query as a compact two-line row, separated from the next by a divider:
//   subject ................ time
//   message preview ...... ● status
const QueryRow = ({ item, onPress, isLast }: Props) => {
  const meta = STATUS_META[item.status];
  const timeLabel = item.daysAgo === 0 ? 'Today' : `${item.daysAgo}d ago`;

  return (
    <TouchableOpacity
      style={[s.row, !isLast && s.divider]}
      onPress={onPress}
      activeOpacity={0.6}
    >
      <View style={s.line}>
        <Text style={s.subject} numberOfLines={1}>
          {item.subject}
        </Text>
        <Text style={s.time}>{timeLabel}</Text>
      </View>
      <View style={s.line}>
        <Text style={s.preview} numberOfLines={1}>
          {item.message}
        </Text>
        <View style={s.status}>
          <View style={[s.dot, { backgroundColor: meta.color }]} />
          <Text style={[s.statusText, { color: meta.color }]}>{item.status}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

export default QueryRow;

const __mk_s = () => StyleSheet.create({
  row: { paddingVertical: 12, gap: 4 },
  divider: { borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  line: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  subject: { flex: 1, fontSize: 15, fontWeight: '500', color: theme.colors.textPrimary },
  time: { fontSize: 12, color: theme.colors.textMuted },
  preview: { flex: 1, fontSize: 13, color: theme.colors.textSecondary },
  status: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 12, fontWeight: '500' },
});


// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
