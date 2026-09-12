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

// One announcement as a compact two-line row behind a megaphone, separated from
// the next by a divider. An announcement that is still new carries the icon and
// its title in the accent colour:
//   📣  title ...................... 2d ago
//       preview .......................... 📎
const AnnouncementRow = ({ item, onPress, isLast }: Props) => {
  const timeLabel = item.daysAgo === 0 ? 'Today' : `${item.daysAgo}d ago`;
  const hasAttachment = item.hasImage || item.hasPdf;

  return (
    <TouchableOpacity
      style={[s.row, !isLast && s.divider]}
      onPress={() => onPress(item)}
      activeOpacity={0.6}
    >
      <View style={s.iconSlot}>
        <VectorIcon
          iconSet="Ionicons"
          iconName="megaphone-outline"
          size={18}
          color={item.isNew ? theme.colors.primary : theme.colors.textSecondary}
        />
      </View>

      <View style={s.body}>
        <View style={s.line}>
          <Text style={[s.title, item.isNew && s.titleNew]} numberOfLines={1}>
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
              <VectorIcon
                iconSet="Feather"
                iconName="paperclip"
                size={13}
                color={theme.colors.textMuted}
              />
            )}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

export default AnnouncementRow;

const __mk_s = () => StyleSheet.create({
  row: { flexDirection: 'row', gap: 12, paddingVertical: 13 },
  divider: { borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  iconSlot: { width: 22, alignItems: 'center', paddingTop: 1 },
  body: { flex: 1, gap: 4 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flex: 1, fontSize: 15, fontWeight: '500', color: theme.colors.textPrimary },
  titleNew: { fontWeight: '600', color: theme.colors.primary },
  time: { fontSize: 12, color: theme.colors.textMuted },
  preview: { flex: 1, fontSize: 13, color: theme.colors.textSecondary },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
