import React, { useCallback, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useFocusLoad } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { SeatingRoom, getSeatingRooms } from '../../api/adminSeatingApi';
import { DocHeader, DocNoData } from '../more/docUi';
import { ErrorState, PlainRow, RowsSkeleton, adminExamStyles as ui } from './adminExamUi';
import { plural } from './adminSeatingUi';

/**
 * Rooms — the panel's Rooms tab: each room with its building, its rows ×
 * columns of desks, how many sit at a desk and the seats that makes, and
 * whether it is active for seating plans. + in the header adds a room; a row
 * opens its seat map.
 */

export const roomLine = (r: SeatingRoom) =>
  `${r.rows}×${r.columns} desks · ${r.seat_capacity}/desk · ${plural(r.capacity, 'seat')}${r.is_active ? '' : ' · Inactive'}`;

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
      setRooms(await getSeatingRooms());
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
        <RowsSkeleton lead="icon" />
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
              <Text style={s.count}>{`${plural(rooms.length, 'room')} configured`}</Text>
              {rooms.map((r, i) => (
                <PlainRow
                  key={r.id}
                  icon="business-outline"
                  title={r.room_name}
                  lines={[r.building, roomLine(r)]}
                  isLast={i === rooms.length - 1}
                  onPress={() => navigation.navigate('AdminSeatingRoom', { room: r })}
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
  count: { fontSize: 12, color: theme.colors.textMuted, marginTop: 14, marginBottom: 2 },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
