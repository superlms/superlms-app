import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import moment from 'moment';
import VectorIcon from '../../components/VectorIcon';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useRefresh } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { ApiEvent, EventDetail, getEventById } from '../../api/calendarApi';
import { deleteEvent } from '../../api/adminContentApi';
import { DetailRow, capitalize, timingLabel } from '../calendar/calendarUi';
import { DocHeader, DocLoading } from '../more/docUi';

const TITLE = 'Event';

const AdminCalendarDetailScreen = ({ navigation, route }: any) => {
  const passed: ApiEvent | undefined = route?.params?.item;
  const id: number = route?.params?.id ?? passed?.id;
  const [detail, setDetail] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const d = await getEventById(id);
      setDetail(d);
    } catch {
      // fall back to the list event we were passed
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const { refreshing, onRefresh } = useRefresh(refresh);

  // Prefer the full detail; fall back to the passed list event.
  const title = detail?.title ?? passed?.title ?? '';
  const eventType = detail?.event_type ?? passed?.event_type ?? 'event';
  const color = detail?.color || passed?.color || '';
  const date = detail?.date ?? passed?.date;
  const isAllDay = detail?.is_all_day ?? passed?.is_all_day;
  const startT = detail?.start_time ?? passed?.start_time;
  const endT = detail?.end_time ?? passed?.end_time;
  const description = detail?.description ?? passed?.description;
  const timing = timingLabel(isAllDay, startT, endT);

  const loc = detail?.location;
  const acad = detail?.academic_details;

  // When, where and what — every line that is actually filled in.
  const rows = [
    ['Date', date ? moment(date).format('dddd, DD MMM YYYY') : undefined],
    ['Time', timing],
    ['Location', loc?.full_address || loc?.location || loc?.room_number || loc?.building],
    [
      'Class',
      acad?.standard
        ? `${acad.standard.name}${acad.section ? ' - ' + acad.section.name : ''}`
        : undefined,
    ],
    ['Subject', acad?.subject?.name],
    ['Teacher', acad?.teacher?.name],
    ['Created by', detail?.creator_name],
  ].filter(([, v]) => !!v) as [string, string][];

  // What the form screen needs to open this event for editing.
  const forEdit: ApiEvent = {
    id,
    title,
    description: description ?? '',
    date: date ?? '',
    start_time: startT ?? null,
    end_time: endT ?? null,
    is_all_day: !!isAllDay,
    event_type: eventType,
    color,
    location: null,
    academic_details: null,
    created_at: '',
    updated_at: '',
  };

  const remove = async () => {
    setDeleting(true);
    try {
      await deleteEvent(id);
      setConfirmOpen(false);
      navigation.goBack();
    } catch (e) {
      setConfirmOpen(false);
      Alert.alert('Error', apiErr(e, 'Could not delete.'));
    } finally {
      setDeleting(false);
    }
  };

  if (loading && !detail && !passed) return <DocLoading title={TITLE} />;

  return (
    <View style={s.root}>
      <DocHeader
        title={TITLE}
        onBackPress={() => navigation.goBack()}
        rightIcon="create-outline"
        onRightPress={() => navigation.navigate('AdminCalendarForm', { item: forEdit })}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
        refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Kind of event, then its name */}
        <View style={s.head}>
          <Text style={s.type}>{capitalize(eventType).toUpperCase()}</Text>
          <Text style={s.title}>{title}</Text>
        </View>

        {/* When, where and what */}
        {rows.length > 0 && (
          <>
            <View style={s.divider} />
            <View style={s.body}>
              {rows.map(([label, value], i) => (
                <DetailRow
                  key={label}
                  label={label}
                  value={value}
                  last={i === rows.length - 1}
                />
              ))}
            </View>
          </>
        )}

        <View style={s.divider} />
        <View style={s.section}>
          <Text style={s.sectionTitle}>Description</Text>
          <Text style={s.bodyText}>{description || 'No description added.'}</Text>
        </View>

        {/* Delete — a quiet text action, never a heavy red block */}
        <View style={s.divider} />
        <TouchableOpacity
          style={s.deleteBtn}
          activeOpacity={0.6}
          onPress={() => setConfirmOpen(true)}
          hitSlop={8}
        >
          <VectorIcon iconSet="Feather" iconName="trash-2" size={15} color={theme.colors.danger} />
          <Text style={s.deleteText}>Delete event</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Delete confirmation */}
      <Modal
        transparent
        visible={confirmOpen}
        animationType="fade"
        onRequestClose={() => setConfirmOpen(false)}
      >
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Delete event?</Text>
            <Text style={s.modalDesc}>
              “{title}” will be removed from the calendar for everyone. This cannot be undone.
            </Text>
            <View style={s.modalActions}>
              <TouchableOpacity
                style={[s.modalBtn, s.modalBtnGhost]}
                activeOpacity={0.7}
                disabled={deleting}
                onPress={() => setConfirmOpen(false)}
              >
                <Text style={s.modalBtnGhostText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.modalBtn, s.modalBtnDanger, deleting && s.modalBtnBusy]}
                activeOpacity={0.85}
                disabled={deleting}
                onPress={remove}
              >
                {deleting ? (
                  <ActivityIndicator size="small" color={theme.colors.white} />
                ) : (
                  <Text style={s.modalBtnDangerText}>Delete</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default AdminCalendarDetailScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  scroll: { paddingBottom: 40 },

  // Head
  head: { paddingHorizontal: 20, paddingTop: 22, paddingBottom: 20 },
  type: { fontSize: 11, fontWeight: '600', letterSpacing: 0.8, color: theme.colors.textMuted },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    lineHeight: 29,
    marginTop: 6,
  },

  // Full-width lines between the blocks
  divider: { height: 1, backgroundColor: theme.colors.divider },

  // Label / value rows
  body: { paddingHorizontal: 20, paddingTop: 2 },

  // Prose section
  section: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 22 },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: theme.colors.textSecondary, marginBottom: 8 },
  bodyText: { fontSize: 15, lineHeight: 24, color: theme.colors.textPrimary },

  // Delete
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  deleteText: { fontSize: 14, fontWeight: '500', color: theme.colors.danger },

  // Confirm modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    padding: 24,
  },
  modalTitle: { fontSize: 17, fontWeight: '600', color: theme.colors.textPrimary },
  modalDesc: { marginTop: 8, fontSize: 14, color: theme.colors.textSecondary, lineHeight: 20 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 22 },
  modalBtn: {
    flex: 1,
    height: 46,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtnBusy: { opacity: 0.7 },
  modalBtnGhost: { borderWidth: 1, borderColor: theme.colors.border },
  modalBtnGhostText: { fontSize: 15, fontWeight: '500', color: theme.colors.textPrimary },
  modalBtnDanger: { backgroundColor: theme.colors.danger },
  modalBtnDangerText: { fontSize: 15, fontWeight: '600', color: theme.colors.white },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
