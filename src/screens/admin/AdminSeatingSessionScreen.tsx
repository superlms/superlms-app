import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import AppRefreshControl from '../../components/AppRefreshControl';
import { AppAlert } from '../../components/AppDialog';
import { useRefresh, useFocusLoad } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import {
  FinderMode,
  SeatingPlanDetail,
  SeatingSession,
  deleteSeatingPlan,
  getSeatingPlan,
  publishSeatingPlan,
  seatingListPdfUrl,
  seatingRoomPdfUrl,
} from '../../api/adminSeatingApi';
import { DetailRow } from '../calendar/calendarUi';
import { DocHeader, DocList, DocRow, DocSection, docStyles } from '../more/docUi';
import { QuietAction, SubmitButton, confirmDestructive } from './adminFormUi';
import { DRAFT, PUBLISHED, longDay, plural, statusLabel } from './adminSeatingUi';

/**
 * One generated session (a date and shift) as the finder found it: its paper,
 * date, shift and time, the candidates, classes and rooms, and conflicts;
 * then the panel's seating list — who sits where, narrowed as the finder was
 * — and each room's chart as the panel's Room PDF. Publish tells each student
 * seated in it their room and seat; Delete, at the foot, removes the session's
 * plan with its seat and invigilator assignments.
 *
 * Route params: row (from the finder), mode, roomId, standardId, sectionId.
 */

const TITLE = 'Seating Session';

const AdminSeatingSessionScreen = ({ navigation, route }: any) => {
  const row: SeatingSession = route?.params?.row;
  const mode: FinderMode = route?.params?.mode ?? 'room';
  const roomId: number | null = route?.params?.roomId ?? null;
  const standardId: number | null = route?.params?.standardId ?? null;
  const sectionId: number | null = route?.params?.sectionId ?? null;

  const [plan, setPlan] = useState<SeatingPlanDetail | null>(null);
  const [status, setStatus] = useState<string>(row?.status ?? 'draft');
  const [publishing, setPublishing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    if (!row) return;
    try {
      const p = await getSeatingPlan(row.plan_id);
      setPlan(p);
      setStatus(p.status);
    } catch {
      // what the finder passed stays on screen
    }
  }, [row]);

  useFocusLoad(load);
  const { refreshing, onRefresh } = useRefresh(load);

  if (!row) {
    return (
      <View style={docStyles.root}>
        <DocHeader title={TITLE} onBackPress={() => navigation.goBack()} />
        <View style={s.center}>
          <Text style={s.muted}>Session not found</Text>
        </View>
      </View>
    );
  }

  const published = status === 'published';
  const color = published ? PUBLISHED : DRAFT;
  const safe = (t: string) => t.replace(/[^A-Za-z0-9_-]+/g, '_');

  const openList = () =>
    navigation.navigate('AdminSeatingPdf', {
      title: 'Seating List',
      uri: seatingListPdfUrl(row.plan_id, {
        room: mode === 'room' ? roomId : null,
        standard: standardId,
        section: sectionId,
        subject: row.subject,
      }),
      fileName: `seating_${safe(`${row.subject}_${row.date ?? ''}`)}`,
    });

  const openRoom = (id: number, name: string) =>
    navigation.navigate('AdminSeatingPdf', {
      title: name,
      uri: seatingRoomPdfUrl(row.plan_id, id),
      fileName: `seating_${safe(name)}_plan${row.plan_id}`,
    });

  const publish = async () => {
    setPublishing(true);
    try {
      const msg = await publishSeatingPlan(row.plan_id);
      setStatus('published');
      AppAlert.alert('Published', msg);
    } catch (e) {
      AppAlert.alert('Could not publish', apiErr(e, 'Please try again.'));
    } finally {
      setPublishing(false);
    }
  };

  const remove = () =>
    confirmDestructive(
      'Delete seating plan?',
      'All seat & invigilator assignments for this plan will be permanently removed.',
      'Delete',
      async () => {
        setDeleting(true);
        try {
          await deleteSeatingPlan(row.plan_id);
          navigation.goBack();
        } catch (e) {
          AppAlert.alert('Could not delete', apiErr(e, 'Please try again.'));
        } finally {
          setDeleting(false);
        }
      },
    );

  const conflicts = plan?.conflicts ?? row.conflicts;

  return (
    <View style={docStyles.root}>
      <DocHeader title={TITLE} onBackPress={() => navigation.goBack()} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={docStyles.scroll}
        refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* When, and where it stands; then the paper */}
        <View>
          <View style={s.metaLine}>
            <Text style={s.dateText}>{`${longDay(row.date)} · ${row.session}`}</Text>
            <View style={s.status}>
              <View style={[s.dot, { backgroundColor: color }]} />
              <Text style={[s.statusText, { color }]}>{statusLabel(status)}</Text>
            </View>
          </View>
          <Text style={s.title}>{row.subject}</Text>
          {!!(plan?.name ?? row.name) && <Text style={s.sub}>{plan?.name ?? row.name}</Text>}
        </View>

        <DocSection title="Details">
          <DetailRow label="Exam" value={plan?.exam_name} />
          <DetailRow label="Date" value={longDay(row.date)} />
          <DetailRow label="Shift" value={row.session} />
          {mode === 'room' && row.time !== '—' && <DetailRow label="Time" value={row.time} />}
          <DetailRow label="Candidates" value={plural(row.students, 'candidate')} />
          <DetailRow label="Classes" value={row.classes.join(', ') || '—'} />
          <DetailRow label="Rooms" value={row.rooms.join(', ') || '—'} />
          <DetailRow label="Conflicts" value={conflicts > 0 ? plural(conflicts, 'conflict') : 'No conflicts'} last />
        </DocSection>

        {/* The panel's View / Download / Print — one sheet */}
        <DocSection title="Seating List">
          <DocList>
            <DocRow
              icon="file-text"
              title="Seating list"
              sub="Who sits where, room by room, in seat order"
              trailingIcon="chevron-forward"
              onPress={openList}
              isLast
            />
          </DocList>
        </DocSection>

        {!!plan && plan.rooms.length > 0 && (
          <DocSection title="Room Charts">
            <DocList>
              {plan.rooms.map((r, i) => (
                <DocRow
                  key={r.id}
                  icon="grid"
                  title={r.room_name}
                  sub={[r.building, `${r.filled}/${r.capacity} seats filled`].filter(Boolean).join(' · ')}
                  trailingIcon="chevron-forward"
                  onPress={() => openRoom(r.id, r.room_name)}
                  isLast={i === plan.rooms.length - 1}
                />
              ))}
            </DocList>
          </DocSection>
        )}

        {!published && (
          <View style={s.publish}>
            <SubmitButton label="Publish Plan" busy={publishing} onPress={publish} />
            <Text style={s.hint}>Each student seated in it hears their room and seat.</Text>
          </View>
        )}

        <View style={s.divider} />
        <QuietAction icon="trash-2" label="Delete this session's plan" danger busy={deleting} onPress={remove} />
      </ScrollView>
    </View>
  );
};

export default AdminSeatingSessionScreen;

const __mk_s = () => StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  muted: { fontSize: 14, color: theme.colors.textMuted },

  metaLine: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 12, rowGap: 4, marginBottom: 8 },
  dateText: { fontSize: 13, color: theme.colors.textMuted },
  status: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: 13, fontWeight: '500' },
  title: { fontSize: 20, fontWeight: '700', color: theme.colors.textPrimary, lineHeight: 27 },
  sub: { fontSize: 13, color: theme.colors.textSecondary, marginTop: 4 },

  publish: { gap: 8 },
  hint: { fontSize: 12, color: theme.colors.textMuted, textAlign: 'center' },
  divider: { height: 1, backgroundColor: theme.colors.border },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
