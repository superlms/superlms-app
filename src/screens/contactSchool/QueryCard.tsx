import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import VectorIcon from '../../components/VectorIcon';
import { theme, onThemeChange } from '../../utils/theme';
import { STATUS_META } from './queryTypes';
import type { Query } from './queryTypes';

interface Props {
  item: Query;
  onPress?: () => void;
}

const QueryCard = ({ item, onPress }: Props) => {
  const meta = STATUS_META[item.status];
  const timeLabel = item.daysAgo === 0 ? 'Today' : `${item.daysAgo}d ago`;

  return (
    <TouchableOpacity style={s.card} onPress={onPress} activeOpacity={0.8}>
      {/* Accent bar */}
      <View style={[s.accentBar, { backgroundColor: meta.color }]} />

      <View style={s.cardInner}>
        {/* Top row: icon + subject/time + status badge */}
        <View style={s.cardTop}>
          <View style={[s.iconWrap, { backgroundColor: meta.bg }]}>
            <VectorIcon
              iconSet="Ionicons"
              iconName="chatbubble-ellipses-outline"
              size={18}
              color={meta.color}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.cardTitle} numberOfLines={1}>
              {item.subject}
            </Text>
            <View style={s.timeRow}>
              <VectorIcon
                iconSet="Feather"
                iconName="clock"
                size={11}
                color={theme.colors.textMuted}
              />
              <Text style={s.timeText}>{timeLabel}</Text>
            </View>
          </View>
          <View style={[s.badge, { backgroundColor: meta.bg }]}>
            <View style={[s.badgeDot, { backgroundColor: meta.color }]} />
            <Text style={[s.badgeText, { color: meta.color }]}>
              {item.status}
            </Text>
          </View>
          <VectorIcon
            iconSet="Ionicons"
            iconName="chevron-forward"
            size={16}
            color={theme.colors.textMuted}
          />
        </View>

        {/* Message preview */}
        <Text style={s.message} numberOfLines={2}>
          {item.message}
        </Text>

        {/* Footer hint: reply (attachments show on the View Query screen) */}
        {item.admin_reply && (
          <View style={s.hintRow}>
            <View style={s.hintItem}>
              <VectorIcon
                iconSet="Ionicons"
                iconName="chatbox-ellipses-outline"
                size={11}
                color="#10B981"
              />
              <Text style={[s.hintText, { color: '#10B981' }]}>
                School replied
              </Text>
            </View>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

export default QueryCard;

const __mk_s = () => StyleSheet.create({
  // Card (shared template)
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
    elevation: 2,
  },
  accentBar: { height: 4, width: '100%' },
  cardInner: { padding: theme.spacing.md, gap: 8 },

  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  timeText: { fontSize: 11, color: theme.colors.textMuted, fontWeight: '500' },

  // Status badge (shared template)
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.radius.full,
  },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: 11, fontWeight: '700' },

  message: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    lineHeight: 19,
  },

  // Footer hints
  hintRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  hintItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  hintText: {
    fontSize: 11,
    color: theme.colors.primary,
    fontWeight: '600',
  },
});


// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
