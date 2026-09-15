import React from 'react';
import { StyleProp, StyleSheet, Text, TextStyle, TouchableOpacity, View } from 'react-native';
import VectorIcon from '../../components/VectorIcon';
import { Skeleton, SkeletonText } from '../../components/Skeleton';
import { theme, onThemeChange } from '../../utils/theme';
import { STATUS_META } from './queryTypes';
import type { Query } from './queryTypes';
import { queryTimeLabel } from './queryData';

interface Props {
  item: Query;
  onPress?: () => void;
  isLast?: boolean;
  // Drawn as a skeleton: the icon a grey circle, each line a bar as long as its text.
  skeleton?: boolean;
}

const Words = ({
  skeleton,
  style,
  children,
}: {
  skeleton?: boolean;
  style: StyleProp<TextStyle>;
  children: React.ReactNode;
}) =>
  skeleton ? (
    <SkeletonText style={style} numberOfLines={1}>{children}</SkeletonText>
  ) : (
    <Text style={style} numberOfLines={1}>{children}</Text>
  );

// One query as a two-line row led by a round icon, as on Notifications — the
// same speech bubble in plain grey whatever its status — separated from the
// next by a divider:
//   (💬)  subject ................ time
//         message preview ...... ● status
const QueryRow = ({ item, onPress, isLast, skeleton }: Props) => {
  const meta = STATUS_META[item.status];

  return (
    <TouchableOpacity
      style={[s.row, !isLast && s.divider]}
      onPress={onPress}
      activeOpacity={0.6}
      disabled={skeleton}
    >
      {skeleton ? (
        <Skeleton width={36} height={36} radius={18} />
      ) : (
        <View style={s.lead}>
          <VectorIcon iconSet="Ionicons" iconName="chatbubble-ellipses-outline" size={17} color={theme.colors.textSecondary} />
        </View>
      )}

      <View style={s.body}>
        <View style={s.line}>
          <View style={s.fill}>
            <Words skeleton={skeleton} style={s.subject}>{item.subject}</Words>
          </View>
          <Words skeleton={skeleton} style={s.time}>{queryTimeLabel(item)}</Words>
        </View>
        <View style={s.line}>
          <View style={s.fill}>
            <Words skeleton={skeleton} style={s.preview}>{item.message}</Words>
          </View>
          <View style={s.status}>
            {skeleton ? (
              <Skeleton width={6} height={6} radius={3} />
            ) : (
              <View style={[s.dot, { backgroundColor: meta.color }]} />
            )}
            <Words skeleton={skeleton} style={[s.statusText, { color: meta.color }]}>{item.status}</Words>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

export default QueryRow;

const __mk_s = () => StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  divider: { borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  lead: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
  },
  body: { flex: 1, gap: 4 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  fill: { flex: 1 },
  subject: { fontSize: 15, fontWeight: '500', color: theme.colors.textPrimary },
  time: { fontSize: 12, color: theme.colors.textMuted },
  preview: { fontSize: 13, color: theme.colors.textSecondary },
  status: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 12, fontWeight: '500' },
});


// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
