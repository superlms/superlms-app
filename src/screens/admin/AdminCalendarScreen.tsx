import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { DrawerActions } from '@react-navigation/native';
import VectorIcon from '../../components/VectorIcon';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useRefresh } from '../../hooks/useRefresh';
import { theme } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { ApiEvent, getCalendarEvents } from '../../api/calendarApi';
import { EventType, createEvent, deleteEvent, updateEvent } from '../../api/adminContentApi';

const EVENT_TYPES: { key: EventType; label: string; color: string }[] = [
  { key: 'class', label: 'Class', color: '#3b82f6' },
  { key: 'exam', label: 'Exam', color: '#ef4444' },
  { key: 'meeting', label: 'Meeting', color: '#f59e0b' },
  { key: 'event', label: 'Event', color: '#10b981' },
  { key: 'holiday', label: 'Holiday', color: '#8b5cf6' },
];
const colorFor = (t: string) => EVENT_TYPES.find(e => e.key === t)?.color ?? '#6b7280';

const pad = (n: number) => String(n).padStart(2, '0');
const fmtDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayStr = () => fmtDate(new Date());
const monthLabel = (d: Date) => d.toLocaleString('default', { month: 'long', year: 'numeric' });
const hhmm = (t?: string | null) => (t ? t.slice(0, 5) : '');

const AdminCalendarScreen = ({ navigation }: any) => {
  const [cursor, setCursor] = useState(new Date());
  const [events, setEvents] = useState<ApiEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [date, setDate] = useState(todayStr());
  const [type, setType] = useState<EventType>('event');
  const [allDay, setAllDay] = useState(true);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const start = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
      const end = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
      const list = await getCalendarEvents(fmtDate(start), fmtDate(end), undefined, 100);
      setEvents(list.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)));
    } catch (e) {
      Alert.alert('Error', apiErr(e, 'Could not load events.'));
    } finally {
      setLoading(false);
    }
  }, [cursor]);

  useEffect(() => {
    load();
  }, [load]);

  const { refreshing, onRefresh } = useRefresh(load);

  const shiftMonth = (delta: number) => setCursor(c => new Date(c.getFullYear(), c.getMonth() + delta, 1));

  const openCreate = () => {
    setEditId(null);
    setTitle('');
    setDesc('');
    setDate(todayStr());
    setType('event');
    setAllDay(true);
    setStart('');
    setEnd('');
    setModal(true);
  };
  const openEdit = (e: ApiEvent) => {
    setEditId(e.id);
    setTitle(e.title);
    setDesc(e.description ?? '');
    setDate(e.date);
    setType((EVENT_TYPES.find(t => t.key === e.event_type)?.key ?? 'event') as EventType);
    setAllDay(!!e.is_all_day);
    setStart(hhmm(e.start_time));
    setEnd(hhmm(e.end_time));
    setModal(true);
  };

  const validTime = (t: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t);

  const save = async () => {
    if (!title.trim()) {
      Alert.alert('Required', 'Title is required.');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      Alert.alert('Invalid date', 'Use the format YYYY-MM-DD.');
      return;
    }
    if (!allDay && (start || end)) {
      if (start && !validTime(start)) return Alert.alert('Invalid time', 'Start time must be HH:mm (24h).');
      if (end && !validTime(end)) return Alert.alert('Invalid time', 'End time must be HH:mm (24h).');
    }
    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        description: desc.trim() || null,
        date,
        is_all_day: allDay,
        start_time: allDay ? null : start || null,
        end_time: allDay ? null : end || null,
        event_type: type,
        color: colorFor(type),
      };
      if (editId) await updateEvent(editId, payload);
      else await createEvent(payload);
      setModal(false);
      await load();
    } catch (e) {
      Alert.alert('Error', apiErr(e, 'Could not save event.'));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (e: ApiEvent) =>
    Alert.alert('Delete event', `Delete "${e.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteEvent(e.id);
            await load();
          } catch (err) {
            Alert.alert('Error', apiErr(err, 'Could not delete.'));
          }
        },
      },
    ]);

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor={theme.colors.card} />
      <View style={s.topbar}>
        <TouchableOpacity style={s.menuBtn} onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('PanelHome'))} activeOpacity={0.8}>
          <VectorIcon iconSet="Ionicons" iconName="arrow-back" size={22} color={theme.colors.primary} />
        </TouchableOpacity>
        <Text style={s.title}>Calendar</Text>
      </View>

      {/* Month nav */}
      <View style={s.monthNav}>
        <TouchableOpacity style={s.navBtn} onPress={() => shiftMonth(-1)} activeOpacity={0.8}>
          <VectorIcon iconSet="Ionicons" iconName="chevron-back" size={18} color={theme.colors.primary} />
        </TouchableOpacity>
        <Text style={s.monthText}>{monthLabel(cursor)}</Text>
        <TouchableOpacity style={s.navBtn} onPress={() => shiftMonth(1)} activeOpacity={0.8}>
          <VectorIcon iconSet="Ionicons" iconName="chevron-forward" size={18} color={theme.colors.primary} />
        </TouchableOpacity>
      </View>

      {loading && !refreshing ? (
        <View style={s.loader}><ActivityIndicator size="large" color={theme.colors.primary} /></View>
      ) : (
        <ScrollView
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {events.length === 0 && <Text style={s.empty}>No events this month.</Text>}
          {events.map(e => (
            <View key={e.id} style={s.card}>
              <View style={[s.colorBar, { backgroundColor: e.color || colorFor(e.event_type) }]} />
              <View style={{ flex: 1 }}>
                <Text style={s.cardTitle} numberOfLines={1}>{e.title}</Text>
                {!!e.description && <Text style={s.cardBody} numberOfLines={2}>{e.description}</Text>}
                <View style={s.metaRow}>
                  <VectorIcon iconSet="Ionicons" iconName="calendar-outline" size={13} color={theme.colors.textMuted} />
                  <Text style={s.cardMeta}>{e.date}{e.is_all_day ? ' · All day' : (e.start_time ? ` · ${hhmm(e.start_time)}${e.end_time ? `–${hhmm(e.end_time)}` : ''}` : '')}</Text>
                  <View style={[s.typeTag, { backgroundColor: (e.color || colorFor(e.event_type)) + '18' }]}>
                    <Text style={[s.typeTagText, { color: e.color || colorFor(e.event_type) }]}>{e.event_type}</Text>
                  </View>
                </View>
              </View>
              <View style={{ gap: 6 }}>
                <TouchableOpacity style={s.iconAction} onPress={() => openEdit(e)} activeOpacity={0.8}>
                  <VectorIcon iconSet="Ionicons" iconName="create-outline" size={16} color={theme.colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity style={s.iconAction} onPress={() => confirmDelete(e)} activeOpacity={0.8}>
                  <VectorIcon iconSet="Ionicons" iconName="trash-outline" size={16} color={theme.colors.danger} />
                </TouchableOpacity>
              </View>
            </View>
          ))}
          <View style={{ height: 90 }} />
        </ScrollView>
      )}

      <TouchableOpacity style={s.fab} onPress={openCreate} activeOpacity={0.9}>
        <VectorIcon iconSet="Ionicons" iconName="add" size={28} color="#fff" />
      </TouchableOpacity>

      {/* Form modal */}
      <Modal transparent visible={modal} animationType="fade" onRequestClose={() => setModal(false)}>
        <KeyboardAvoidingView style={s.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>{editId ? 'Edit Event' : 'New Event'}</Text>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <TextInput style={s.input} value={title} onChangeText={setTitle} placeholder="Title" placeholderTextColor={theme.colors.textMuted} />
              <TextInput style={[s.input, s.inputMultiline, { marginTop: 10 }]} value={desc} onChangeText={setDesc} placeholder="Description (optional)" placeholderTextColor={theme.colors.textMuted} multiline />

              <Text style={s.fieldLabel}>Date</Text>
              <TextInput style={s.input} value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" placeholderTextColor={theme.colors.textMuted} />

              <Text style={s.fieldLabel}>Type</Text>
              <View style={s.typeWrap}>
                {EVENT_TYPES.map(t => {
                  const active = type === t.key;
                  return (
                    <TouchableOpacity key={t.key} style={[s.chip, active && { backgroundColor: t.color + '18', borderColor: t.color }]} onPress={() => setType(t.key)} activeOpacity={0.8}>
                      <Text style={[s.chipText, active && { color: t.color }]}>{t.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={s.switchRow}>
                <Text style={s.fieldLabel}>All day</Text>
                <Switch value={allDay} onValueChange={setAllDay} trackColor={{ true: theme.colors.primary }} />
              </View>

              {!allDay && (
                <View style={s.timeRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.fieldLabel}>Start (HH:mm)</Text>
                    <TextInput style={s.input} value={start} onChangeText={setStart} placeholder="09:00" placeholderTextColor={theme.colors.textMuted} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.fieldLabel}>End (HH:mm)</Text>
                    <TextInput style={s.input} value={end} onChangeText={setEnd} placeholder="10:00" placeholderTextColor={theme.colors.textMuted} />
                  </View>
                </View>
              )}
            </ScrollView>

            <View style={s.modalActions}>
              <TouchableOpacity style={[s.modalBtn, s.modalBtnGhost]} onPress={() => setModal(false)} activeOpacity={0.85}>
                <Text style={s.modalBtnGhostText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.modalBtn, s.modalBtnPrimary]} onPress={save} activeOpacity={0.9} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.modalBtnPrimaryText}>{editId ? 'Update' : 'Create'}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

export default AdminCalendarScreen;

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topbar: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 18, paddingTop: 18, paddingBottom: 14,
    backgroundColor: theme.colors.card, borderBottomWidth: 1, borderBottomColor: theme.colors.border,
  },
  menuBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: theme.colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '900', color: theme.colors.textPrimary },

  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  navBtn: { width: 38, height: 38, borderRadius: 10, backgroundColor: theme.colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  monthText: { fontSize: 16, fontWeight: '800', color: theme.colors.textPrimary },

  scroll: { paddingHorizontal: 16, paddingTop: 4 },
  empty: { fontSize: 13, color: theme.colors.textMuted, textAlign: 'center', marginTop: 30 },

  card: { flexDirection: 'row', gap: 10, backgroundColor: theme.colors.card, borderRadius: 16, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: theme.colors.border },
  colorBar: { width: 4, borderRadius: 2, alignSelf: 'stretch' },
  cardTitle: { fontSize: 15, fontWeight: '800', color: theme.colors.textPrimary },
  cardBody: { fontSize: 13, color: theme.colors.textSecondary, marginTop: 3, lineHeight: 18 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, flexWrap: 'wrap' },
  cardMeta: { fontSize: 11, color: theme.colors.textMuted },
  typeTag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: theme.radius.full },
  typeTagText: { fontSize: 10, fontWeight: '800', textTransform: 'capitalize' },
  iconAction: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.background },

  fab: { position: 'absolute', right: 18, bottom: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center', elevation: 5, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  modalCard: { width: '100%', maxWidth: 440, maxHeight: '88%', backgroundColor: theme.colors.card, borderRadius: 18, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: theme.colors.textPrimary, marginBottom: 14, textAlign: 'center' },
  input: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: theme.colors.textPrimary, backgroundColor: theme.colors.background },
  inputMultiline: { minHeight: 70, textAlignVertical: 'top' },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary, marginTop: 14, marginBottom: 8 },
  typeWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: theme.radius.full, backgroundColor: theme.colors.background, borderWidth: 1, borderColor: theme.colors.border },
  chipText: { fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  timeRow: { flexDirection: 'row', gap: 12 },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 16 },
  modalBtn: { flex: 1, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  modalBtnGhost: { backgroundColor: theme.colors.border },
  modalBtnGhostText: { fontSize: 15, fontWeight: '700', color: theme.colors.textPrimary },
  modalBtnPrimary: { backgroundColor: theme.colors.primary },
  modalBtnPrimaryText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
