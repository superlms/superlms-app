import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import VectorIcon from '../../components/VectorIcon';
import { HeaderIconButton } from '../../components/Header';
import AppRefreshControl from '../../components/AppRefreshControl';
import { AppAlert } from '../../components/AppDialog';
import { useRefresh, useFocusLoad } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { SeatingRoom, deleteSeatingRoom, getSeatingRooms } from '../../api/adminSeatingApi';
import { DocBody, DocHeader, DocSection, docStyles } from '../more/docUi';
import { QuietAction, confirmDestructive } from './adminFormUi';
import { plural, seatLabel } from './adminSeatingUi';

/**
 * A room's seat map, as the panel's: every desk drawn from the board at the
 * front, row by row, with one figure per candidate the desk seats and the
 * desk's label (column letter, row number — A1, B1, …); then the desks and
 * seats in total and the room's notes. The pencil edits the room; Delete, at
 * the foot, removes it and its seats (plans already made keep their copy).
 *
 * Route params: room – from the list, or as the form saved it.
 */

const DESK = 54;

const AdminSeatingRoomScreen = ({ navigation, route }: any) => {
  const [room, setRoom] = useState<SeatingRoom | null>(route?.params?.room ?? null);
  const [deleting, setDeleting] = useState(false);

  // The form hands back the room as it saved it.
  const passed: SeatingRoom | undefined = route?.params?.room;
  useEffect(() => {
    if (passed) setRoom(passed);
  }, [passed]);

  const refresh = useCallback(async () => {
    if (!room) return;
    try {
      const found = (await getSeatingRooms()).find(r => r.id === room.id);
      if (found) setRoom(found);
    } catch {
      // keep what is shown
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.id]);

  useFocusLoad(refresh);
  const { refreshing, onRefresh } = useRefresh(refresh);

  if (!room) {
    return (
      <View style={docStyles.root}>
        <DocHeader title="Room" onBackPress={() => navigation.goBack()} />
        <View style={s.center}>
          <Text style={s.muted}>Room not found</Text>
        </View>
      </View>
    );
  }

  const remove = () =>
    confirmDestructive(
      'Delete room?',
      'All its seats will be removed. Existing plans keep their snapshot.',
      'Delete',
      async () => {
        setDeleting(true);
        try {
          await deleteSeatingRoom(room.id);
          navigation.goBack();
        } catch (e) {
          AppAlert.alert('Could not delete', apiErr(e, 'Please try again.'));
        } finally {
          setDeleting(false);
        }
      },
    );

  const perDesk = Math.max(1, room.seat_capacity || 1);
  const rows = Array.from({ length: room.rows }, (_, i) => i + 1);
  const cols = Array.from({ length: room.columns }, (_, i) => i + 1);
  const meta = [
    room.building,
    `${room.rows} × ${room.columns} desks`,
    `${perDesk} per desk`,
    plural(room.capacity, 'seat'),
    room.is_active ? 'Active' : 'Inactive',
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <View style={docStyles.root}>
      <DocHeader
        title={room.room_name}
        onBackPress={() => navigation.goBack()}
        rightSlot={
          <HeaderIconButton icon="create-outline" onPress={() => navigation.navigate('AdminSeatingRoomForm', { room })} />
        }
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={docStyles.scroll}
        refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Text style={s.meta}>{meta}</Text>

        {/* The room from the board at the front */}
        <View>
          <View style={s.board}>
            <Text style={s.boardText}>BOARD / FRONT</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.gridWrap}>
            <View style={s.grid}>
              {rows.map(r => (
                <View key={r} style={s.gridRow}>
                  {cols.map(c => (
                    <View key={c} style={s.desk}>
                      <View style={s.figures}>
                        {Array.from({ length: perDesk }, (_, k) => (
                          <VectorIcon key={k} iconSet="Ionicons" iconName="person" size={perDesk > 3 ? 9 : 12} color={theme.colors.primary} />
                        ))}
                      </View>
                      <Text style={s.deskLabel}>{seatLabel(r, c)}</Text>
                    </View>
                  ))}
                </View>
              ))}
            </View>
          </ScrollView>
          <View style={s.legend}>
            <View style={s.legendItem}>
              <VectorIcon iconSet="Ionicons" iconName="person" size={12} color={theme.colors.primary} />
              <Text style={s.legendText}>one candidate</Text>
            </View>
            <Text style={s.legendText}>{`${room.rows * room.columns} desks · ${plural(room.capacity, 'seat')} in total`}</Text>
          </View>
        </View>

        {!!room.notes && (
          <DocSection title="Notes">
            <DocBody>{room.notes}</DocBody>
          </DocSection>
        )}

        <View style={s.divider} />
        <QuietAction icon="trash-2" label="Delete room" danger busy={deleting} onPress={remove} />
      </ScrollView>
    </View>
  );
};

export default AdminSeatingRoomScreen;

const __mk_s = () => StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  muted: { fontSize: 14, color: theme.colors.textMuted },
  meta: { fontSize: 13, color: theme.colors.textSecondary, lineHeight: 19 },

  board: {
    alignItems: 'center',
    paddingVertical: 6,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.background,
    marginBottom: 12,
  },
  boardText: { fontSize: 10, fontWeight: '700', letterSpacing: 1, color: theme.colors.textMuted },
  gridWrap: { flexGrow: 1, justifyContent: 'center' },
  grid: { gap: 6 },
  gridRow: { flexDirection: 'row', gap: 6 },
  desk: {
    width: DESK,
    minHeight: DESK,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 6,
  },
  figures: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 1, paddingHorizontal: 3 },
  deskLabel: { fontSize: 10, fontWeight: '600', color: theme.colors.textMuted },
  legend: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendText: { fontSize: 12, color: theme.colors.textMuted },

  divider: { height: 1, backgroundColor: theme.colors.border },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
