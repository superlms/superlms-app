import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { theme, onThemeChange } from '../utils/theme';
import VectorIcon from './VectorIcon';

// ─── Base shimmering block ─────────────────────────────────────────────────────
export const Skeleton = ({
  width = '100%',
  height = 14,
  radius = 8,
  style,
}: {
  width?: number | string;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}) => {
  const opacity = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 750, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.5, duration: 750, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        { width: width as any, height, borderRadius: radius, backgroundColor: theme.colors.border, opacity },
        style,
      ]}
    />
  );
};

// ─── Text and icons as skeletons ───────────────────────────────────────────────
// A skeleton drawn from what the page will say. The text is laid out in its own
// style but unseen, so it takes exactly the room it will; a bar stands over each
// line it wraps to, as long as that line and a little shorter than the type.
// Margins on the text are allowed for; flex or alignSelf belong on a wrapper.
// With numberOfLines, only the lines the text shows get bars. Screen readers
// skip it.
interface LineBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

const sameLines = (a: LineBox[], b: LineBox[]) =>
  a.length === b.length &&
  a.every((l, i) => l.x === b[i].x && l.y === b[i].y && l.width === b[i].width && l.height === b[i].height);

export const SkeletonText = ({
  style,
  numberOfLines,
  children,
}: {
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
  children?: React.ReactNode;
}) => {
  const [lines, setLines] = useState<LineBox[]>([]);
  // Where the text starts in its box, past any margin.
  const [at, setAt] = useState({ x: 0, y: 0 });
  const bar = Math.round((StyleSheet.flatten(style)?.fontSize ?? 14) * 0.85);

  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Text
        style={[style, s.unseen]}
        numberOfLines={numberOfLines}
        onLayout={e => {
          const { x, y } = e.nativeEvent.layout;
          setAt(p => (p.x === x && p.y === y ? p : { x, y }));
        }}
        onTextLayout={e => {
          const next = e.nativeEvent.lines.map(({ x, y, width, height }) => ({ x, y, width, height }));
          setLines(p => (sameLines(p, next) ? p : next));
        }}
      >
        {children}
      </Text>
      {(numberOfLines ? lines.slice(0, numberOfLines) : lines).map((l, i) => (
        <Skeleton
          key={i}
          width={l.width}
          height={bar}
          style={[s.line, { left: at.x + l.x, top: at.y + l.y + (l.height - bar) / 2 }]}
        />
      ))}
    </View>
  );
};

// An icon's glyph laid out unseen, with a box a fifth smaller centred over it.
// Takes the same props as VectorIcon, so the two can stand in for each other.
export const SkeletonIcon = ({
  iconSet = 'Ionicons',
  iconName,
  size = 24,
  style,
}: {
  iconSet?: string;
  iconName: string;
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
}) => {
  const box = Math.round(size * 0.8);
  return (
    <View style={style}>
      <VectorIcon iconSet={iconSet} iconName={iconName} size={size} color="transparent" />
      <View style={s.iconBox}>
        <Skeleton width={box} height={box} radius={Math.max(3, Math.round(size / 5))} />
      </View>
    </View>
  );
};

// ─── Building blocks ───────────────────────────────────────────────────────────
const Card = ({ children }: { children: React.ReactNode }) => (
  <View style={s.card}>{children}</View>
);

const ListRow = () => (
  <View style={s.listCard}>
    <Skeleton width={44} height={44} radius={12} />
    <View style={s.rowBody}>
      <Skeleton width="65%" height={13} />
      <Skeleton width="40%" height={11} />
    </View>
    <Skeleton width={46} height={22} radius={11} />
  </View>
);

const ChipsRow = () => (
  <View style={s.chipsRow}>
    {[72, 88, 64, 80].map((w, i) => (
      <Skeleton key={i} width={w} height={30} radius={16} />
    ))}
  </View>
);

const StatRow = () => (
  <View style={s.chipsRow}>
    {[0, 1, 2, 3].map(i => (
      <Skeleton key={i} width={84} height={92} radius={14} />
    ))}
  </View>
);

const DocLines = ({ count = 6 }: { count?: number }) => (
  <View style={s.docCard}>
    {Array.from({ length: count }).map((_, i) => (
      <Skeleton key={i} width={i % 3 === 2 ? '55%' : '100%'} height={12} />
    ))}
  </View>
);

// ─── Full-screen skeletons per layout ──────────────────────────────────────────
export type SkeletonVariant = 'list' | 'detail' | 'profile' | 'dashboard' | 'doc';

const Variant = ({ variant }: { variant: SkeletonVariant }) => {
  switch (variant) {
    case 'doc':
      return (
        <>
          <Skeleton width="60%" height={20} />
          <DocLines count={5} />
          <DocLines count={4} />
        </>
      );

    case 'detail':
      return (
        <>
          <Card>
            <View style={s.rowTop}>
              <Skeleton width={50} height={50} radius={14} />
              <View style={s.rowBody}>
                <Skeleton width="70%" height={16} />
                <Skeleton width="45%" height={12} />
              </View>
            </View>
            <View style={{ height: 10 }} />
            <Skeleton width="100%" height={10} />
            <Skeleton width="80%" height={10} />
          </Card>
          {[0, 1].map(i => (
            <Card key={i}>
              <Skeleton width="40%" height={14} />
              <View style={{ height: 8 }} />
              <Skeleton width="100%" height={12} />
              <Skeleton width="90%" height={12} />
              <Skeleton width="60%" height={12} />
            </Card>
          ))}
        </>
      );

    case 'profile':
      return (
        <>
          <View style={s.profileTop}>
            <Skeleton width={96} height={96} radius={48} />
            <Skeleton width={160} height={18} />
            <Skeleton width={110} height={12} />
          </View>
          {[0, 1].map(i => (
            <Card key={i}>
              {[0, 1, 2].map(j => (
                <View key={j} style={s.infoRow}>
                  <Skeleton width={34} height={34} radius={17} />
                  <View style={s.rowBody}>
                    <Skeleton width="35%" height={10} />
                    <Skeleton width="70%" height={13} />
                  </View>
                </View>
              ))}
            </Card>
          ))}
        </>
      );

    case 'dashboard':
      return (
        <>
          <ChipsRow />
          <StatRow />
          <Card>
            <Skeleton width="50%" height={14} />
            <View style={{ height: 12 }} />
            <Skeleton width="100%" height={10} radius={5} />
            <View style={s.dashLegend}>
              <Skeleton width={70} height={11} />
              <Skeleton width={70} height={11} />
              <Skeleton width={70} height={11} />
            </View>
          </Card>
          <Card>
            <Skeleton width="45%" height={14} />
            <View style={s.perfRow}>
              <Skeleton width={104} height={104} radius={52} />
              <View style={s.rowBody}>
                {[0, 1, 2, 3].map(i => (
                  <Skeleton key={i} width="100%" height={12} />
                ))}
              </View>
            </View>
          </Card>
        </>
      );

    case 'list':
    default:
      return (
        <>
          {Array.from({ length: 6 }).map((_, i) => (
            <ListRow key={i} />
          ))}
        </>
      );
  }
};

/**
 * Drop-in replacement for a full-screen loading spinner.
 * Renders a layout-matched shimmering placeholder.
 */
export const ScreenSkeleton = ({
  variant = 'list',
  scroll = false,
}: {
  variant?: SkeletonVariant;
  scroll?: boolean;
}) => {
  if (scroll) {
    return (
      <ScrollView
        style={s.fill}
        contentContainerStyle={s.container}
        showsVerticalScrollIndicator={false}
        scrollEnabled={false}
      >
        <Variant variant={variant} />
      </ScrollView>
    );
  }
  return (
    <View style={[s.fill, s.container]}>
      <Variant variant={variant} />
    </View>
  );
};

export default ScreenSkeleton;

const __mk_s = () => StyleSheet.create({
  fill: { flex: 1, alignSelf: 'stretch', width: '100%', backgroundColor: theme.colors.background },
  container: { padding: 16, gap: 14 },

  card: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 14,
    gap: 8,
  },
  listCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 12, width: '100%' },
  rowBody: { flex: 1, gap: 8 },

  chipsRow: { flexDirection: 'row', gap: 10 },

  docCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 16,
    gap: 12,
  },

  profileTop: { alignItems: 'center', gap: 12, paddingVertical: 16 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, width: '100%' },

  dashLegend: { flexDirection: 'row', gap: 14, marginTop: 12 },
  perfRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 12 },

  // Text and icons as skeletons
  unseen: { color: 'transparent' },
  line: { position: 'absolute' },
  iconBox: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
});


// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
