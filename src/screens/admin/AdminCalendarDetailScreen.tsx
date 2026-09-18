import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import moment from 'moment';
import { HeaderIconButton } from '../../components/Header';
import AppRefreshControl from '../../components/AppRefreshControl';
import { AppAlert } from '../../components/AppDialog';
import { useRefresh, useFocusLoad } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { AdminEvent, deleteEvent, getAdminCalendarMonth } from '../../api/adminContentApi';
import { DetailRow } from '../calendar/calendarUi';
import { DocHeader, DocSection, DocBody, docStyles } from '../more/docUi';
import { AttachmentChips, INK, QUIET } from '../notification/inboxUi';
import { Hint, QuietAction, confirmDestructive } from './adminFormUi';
import { eventTiming, isPastDay, typeLabel } from './adminCalendarUi';

/**
 * One event, as a student's Event page draws it — its kind, day and time, the
 * title, the description with its file, the details and who posted it — with
 * the admin panel's actions: the pencil opens it to edit, and Delete removes it
 * from the calendar. An event whose day has passed is completed; it can still
 * be deleted but no longer edited, as on the panel.
 */

const TITLE = 'Event';

const AdminCalendarDetailScreen = ({ navigation, route }: any) => {
  const [item, setItem] = useState<AdminEvent | null>(route?.params?.item ?? null);
  const [deleting, setDeleting] = useState(false);

  // The form hands back the event as it saved it.
  const passed: AdminEvent | undefined = route?.params?.item;
  useEffect(() => {
    if (passed) setItem(passed);
  }, [passed]);

  // What the calendar passed shows at once; coming back from Edit refreshes it
  // from its month.
  const refresh = useCallback(async () => {
    if (!item) return;
    try {
      const res = await getAdminCalendarMonth(moment(item.date).format('YYYY-MM'));
      const found = res.events.find(e => e.id === item.id);
      if (found) setItem(found);
    } catch {
      // keep what is shown
    }
    // The event can move to another day on edit; its id stays.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id, item?.date]);

  useFocusLoad(refresh);
  const { refreshing, onRefresh } = useRefresh(refresh);

  if (!item) {
    return (
      <View style={docStyles.root}>
        <DocHeader title={TITLE} onBackPress={() => navigation.goBack()} />
        <View style={s.centeredBox}>
          <Text style={s.mutedText}>Event not found</Text>
        </View>
      </View>
    );
  }

  const completed = item.is_completed || isPastDay(item.date);

  const remove = () =>
    confirmDestructive(
      'Delete event?',
      'This will permanently remove the event from the calendar. This action cannot be undone.',
      'Delete',
      async () => {
        setDeleting(true);
        try {
          await deleteEvent(item.id);
          navigation.goBack();
        } catch (e) {
          AppAlert.alert('Could not delete', apiErr(e, 'Please try again.'));
        } finally {
          setDeleting(false);
        }
      },
    );

  // "Exam · 18 Sep 2026 · Friday"
  const headLine = [
    typeLabel(item.event_type),
    moment(item.date).format('D MMM YYYY'),
    moment(item.date).format('dddd'),
  ].join(' · ');
  const timing = eventTiming(item);

  const classLabel = [item.standard, item.section].filter(Boolean).join(' - ');
  // Where and for whom — only the lines that are filled in.
  const rows = [
    ['Location', item.location],
    ['Class', classLabel],
    ['Subject', item.subject],
    ['Teacher', item.teacher],
  ].filter(([, v]) => !!v) as [string, string][];

  const poster = item.creator_name || 'Admin';

  return (
    <View style={docStyles.root}>
      <DocHeader
        title={TITLE}
        onBackPress={() => navigation.goBack()}
        rightSlot={
          completed ? undefined : (
            <HeaderIconButton
              icon="create-outline"
              onPress={() => navigation.navigate('AdminCalendarForm', { item })}
            />
          )
        }
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={docStyles.scroll}
        refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Kind, date and day; the timing; then the title */}
        <View>
          <Text style={s.metaText}>{headLine}</Text>
          {!!timing && <Text style={[s.metaText, s.timing]}>{timing}</Text>}
          <Text style={s.title}>{item.title}</Text>
          {completed && <Text style={s.completed}>Completed</Text>}
        </View>

        {/* Description, with the attachment right under it */}
        <DocSection title="Description">
          <DocBody>{item.description || 'No description available'}</DocBody>
          <AttachmentChips downloadAs={item.title} items={[{ url: item.attachment }]} />
        </DocSection>

        {rows.length > 0 && (
          <DocSection title="Details">
            {rows.map(([label, value], i) => (
              <DetailRow key={label} label={label} value={value} last={i === rows.length - 1} />
            ))}
          </DocSection>
        )}

        {/* Posted by */}
        <View style={s.divider} />
        <DocSection title="Posted By">
          <View style={s.creatorRow}>
            <View style={[s.creatorAvatar, s.creatorAvatarFallback]}>
              <Text style={s.creatorInitial}>{poster.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={s.creatorInfo}>
              <Text style={s.creatorName}>{poster}</Text>
            </View>
          </View>
        </DocSection>

        <View style={s.divider} />
        {completed && <Hint>This event is already completed, so it can no longer be edited.</Hint>}
        <QuietAction icon="trash-2" label="Delete event" danger busy={deleting} onPress={remove} />
      </ScrollView>
    </View>
  );
};

export default AdminCalendarDetailScreen;

const __mk_s = () => StyleSheet.create({
  centeredBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  mutedText: { fontSize: 14, color: theme.colors.textMuted },

  // Head: kind · date · day, the timing, the title
  metaText: { fontSize: 12, color: QUIET },
  timing: { marginTop: 2 },
  title: { fontSize: 20, fontWeight: '700', color: INK, lineHeight: 27, marginTop: 6 },
  completed: { fontSize: 13, fontWeight: '600', color: theme.colors.textMuted, marginTop: 6 },

  divider: { height: 1, backgroundColor: theme.colors.border },

  // Creator
  creatorRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  creatorAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: theme.colors.background },
  creatorAvatarFallback: { alignItems: 'center', justifyContent: 'center' },
  creatorInitial: { fontSize: 15, fontWeight: '600', color: theme.colors.textSecondary },
  creatorInfo: { flex: 1 },
  creatorName: { fontSize: 15, fontWeight: '500', color: INK },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
