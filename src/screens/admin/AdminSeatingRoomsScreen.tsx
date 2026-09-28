import React, { useCallback, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import AppRefreshControl from '../../components/AppRefreshControl';
import VectorIcon from '../../components/VectorIcon';
import { useFocusLoad } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { SeatingRoom, getSeatingRooms } from '../../api/adminSeatingApi';
import { DocHeader, DocNoData } from '../more/docUi';
import { ErrorState, adminExamStyles as ui } from './adminExamUi';
import { ListSkeleton } from './adminStudentsUi';
import { plural } from './adminSeatingUi';

/**
 * Rooms — the panel's Rooms tab: each room with its building, its rows ×
 * columns of desks, how many sit at a desk and the seats that makes, and
 * whether it is active for seating plans. + in the header adds a room; a row
 * opens its seat map. Drawn as the Students list is — a round initial, the
 * name, the building and the desks under it, OFF for an inactive room — in the
 * order they were added, the first room at the top.
 */

export const roomLine = (r: SeatingRoom) =>
  `${r.rows}×${r.columns} desks · ${r.seat_capacity}/desk · ${plural(r.capacity, 'seat')}${r.is_active ? '' : ' · Inactive'}`;

// ── One room, as a student's row ─────────────────────────────────────────────
//   (R)  Room 101                                                  >
//        Main Block
//        5×4 desks · 2/desk · 40 seats
const RoomRow = ({ room, isLast, onOpen }: { room: SeatingRoom; isLast: boolean; onOpen: () => void }) => (
  <TouchableOpacity style={[s.row, !isLast && s.rowDivider]} activeOpacity={0.6} onPress={onOpen}>
    <View style={s.initialBox}>
      <Text style={s.initial}>{(room.room_name || 'R').charAt(0).toUpperCase()}</Text>
    </View>
    <View style={s.body}>
      <Text style={s.name} numberOfLines={1}>{room.room_name}</Text>
      {!!room.building && <Text style={s.meta} numberOfLines={1}>{room.building}</Text>}
      <Text style={s.desks} numberOfLines={1}>
        {`${room.rows}×${room.columns} desks · ${room.seat_capacity}/desk · ${plural(room.capacity, 'seat')}`}
      </Text>
    </View>
    {!room.is_active && <Text style={s.off}>OFF</Text>}
    <VectorIcon iconSet="Ionicons" iconName="chevron-forward" size={13} color={theme.colors.textMuted} />
  </TouchableOpacity>
);

const AdminSeatingRoomsScreen = ({ navigation }: any) => {
  const [rooms, setRooms] = useState<SeatingRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadedOnce = useRef(false);

  const load = useCallback(async () => {
    if (!loadedOnce.current) setLoading(true);
    setError(null);
    try {
      // The first room added at the top, each one added after it below.
      setRooms((await getSeatingRooms()).slice().sort((a, b) => a.id - b.id));
      loadedOnce.current = true;
    } catch (e) {
      setError(apiErr(e, 'Could not load the rooms.'));
    } finally {
      setLoading(false);
    }
  }, []);

  // On arrival, and back from a room added, edited or deleted.
  useFocusLoad(load);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <View style={s.root}>
      <DocHeader
        title="Rooms"
        onBackPress={() => navigation.goBack()}
        rightIcon="add"
        onRightPress={() => navigation.navigate('AdminSeatingRoomForm', {})}
      />

      {loading ? (
        <ListSkeleton photo />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : (
        <ScrollView
          style={s.fill}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[ui.list, rooms.length === 0 && s.grow]}
          refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {rooms.length === 0 ? (
            <DocNoData
              icon="business-outline"
              title="No rooms yet"
              subtitle="Add a room with rows & columns — seats are auto-generated."
            />
          ) : (
            <>
              <Text style={s.count}>
                {`${plural(rooms.length, 'room')} · ${rooms.filter(r => r.is_active).length} active`}
              </Text>
              {rooms.map((r, i) => (
                <RoomRow
                  key={r.id}
                  room={r}
                  isLast={i === rooms.length - 1}
                  onOpen={() => navigation.navigate('AdminSeatingRoom', { room: r })}
                />
              ))}
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
};

export default AdminSeatingRoomsScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  fill: { flex: 1 },
  grow: { flexGrow: 1 },
  count: { fontSize: 12, color: theme.colors.textMuted, paddingTop: 12, paddingBottom: 2 },

  // A room's row — the Students list's row (adminStudentsUi).
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 13 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  initialBox: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
  },
  initial: { fontSize: 14, fontWeight: '600', color: theme.colors.primary },
  body: { flex: 1, gap: 3 },
  name: { fontSize: 15, fontWeight: '500', color: theme.colors.textPrimary },
  meta: { fontSize: 13, color: theme.colors.textSecondary },
  desks: { fontSize: 12, color: theme.colors.textMuted },
  off: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8, color: theme.colors.textMuted },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
