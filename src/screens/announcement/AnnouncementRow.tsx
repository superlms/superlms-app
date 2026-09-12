import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import VectorIcon from '../../components/VectorIcon';
import { theme, onThemeChange } from '../../utils/theme';
import type { Announcement } from './announcementData';

interface Props {
  item: Announcement;
  onPress: (item: Announcement) => void;
  isLast?: boolean;
}

// One announcement as a compact two-line row, separated from the next by a
// divider:
//   ● title ...................... time
//   preview .................... 📎
const AnnouncementRow = ({ item, onPress, isLast }: Props) => {
  const timeLabel = item.daysAgo === 0 ? 'Today' : `${item.daysAgo}d ago`;
  const hasAttachment = item.hasImage || item.hasPdf;

  return (
    <TouchableOpacity
      style={[s.row, !isLast && s.divider]}
      onPress={() => onPress(item)}
      activeOpacity={0.6}
    >
      <View style={s.line}>
        {item.isNew && <View style={s.newDot} />}
        <Text style={s.title} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={s.time}>{timeLabel}</Text>
      </View>

      {(!!item.content || hasAttachment) && (
        <View style={s.line}>
          <Text style={s.preview} numberOfLines={1}>
            {item.content}
          </Text>
          {hasAttachment && (
            <VectorIcon iconSet="Feather" iconName="paperclip" size={13} color={theme.colors.textMuted} />
          )}
        </View>
      )}
    </TouchableOpacity>
  );
};

export default AnnouncementRow;

const __mk_s = () => StyleSheet.create({
  row: { paddingVertical: 12, gap: 4 },
  divider: { borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  line: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  newDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: theme.colors.primary },
  title: { flex: 1, fontSize: 15, fontWeight: '500', color: theme.colors.textPrimary },
  time: { fontSize: 12, color: theme.colors.textMuted },
  preview: { flex: 1, fontSize: 13, color: theme.colors.textSecondary },
});


// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
