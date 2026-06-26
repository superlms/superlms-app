import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StatusBar,
  StyleSheet,
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
import {
  ArrangementResult,
  ArrangementSlot,
  assignArrangement,
  deleteArrangement,
  getArrangements,
} from '../../api/adminArrangementApi';

const todayStr = () => new Date().toISOString().slice(0, 10);

const AdminArrangementScreen = ({ navigation }: any) => {
  const [date, setDate] = useState(todayStr());
  const [fClass, setFClass] = useState<number | null>(null);
  const [data, setData] = useState<ArrangementResult | null>(null);
  const [loading, setLoading] = useState(true);

  // per-slot draft selections
  const [picks, setPicks] = useState<Record<number, { sub: number | null; reason: string }>>({});
  const [busy, setBusy] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await getArrangements(date, fClass ?? undefined));
      setPicks({});
    } catch (e) {
      Alert.alert('Error', apiErr(e, 'Could not load arrangements.'));
    } finally {
      setLoading(false);
    }
  }, [date, fClass]);

  useEffect(() => { load(); }, [load]);
  const { refreshing, onRefresh } = useRefresh(load);

  const setPick = (slot: number, patch: Partial<{ sub: number | null; reason: string }>) =>
    setPicks(p => ({ ...p, [slot]: { sub: p[slot]?.sub ?? null, reason: p[slot]?.reason ?? '', ...patch } }));

  const assign = async (slot: ArrangementSlot) => {
    const pick = picks[slot.slot_id];
    if (!pick?.sub) return Alert.alert('Required', 'Pick a substitute teacher.');
    if (!pick.reason?.trim()) return Alert.alert('Required', 'Reason is required.');
    setBusy(slot.slot_id);
    try {
      await assignArrangement({ date, slot_id: slot.slot_id, substitute_id: pick.sub, reason: pick.reason.trim() });
      await load();
    } catch (e) {
      Alert.alert('Error', apiErr(e, 'Could not assign substitute.'));
    } finally {
      setBusy(null);
    }
  };

  const removeArr = (slot: ArrangementSlot) =>
    Alert.alert('Delete Arrangement', `Remove substitute for ${slot.subject}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await deleteArrangement(slot.arrangement!.id); await load(); }
        catch (e) { Alert.alert('Error', apiErr(e, 'Could not delete.')); }
      } },
    ]);

  const shiftDate = (days: number) => {
    const d = new Date(date + 'T00:00:00');
    d.setDate(d.getDate() + days);
    setDate(d.toISOString().slice(0, 10));
  };

  const stats = data?.stats;

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor={theme.colors.card} />
      <View style={s.topbar}>
        <TouchableOpacity style={s.menuBtn} onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('PanelHome'))} activeOpacity={0.8}>
          <VectorIcon iconSet="Ionicons" iconName="arrow-back" size={22} color={theme.colors.primary} />
        </TouchableOpacity>
        <Text style={s.title}>Arrangement</Text>
      </View>

      {/* Date picker row */}
      <View style={s.dateRow}>
        <TouchableOpacity style={s.dateArrow} onPress={() => shiftDate(-1)}><VectorIcon iconSet="Ionicons" iconName="chevron-back" size={18} color={theme.colors.primary} /></TouchableOpacity>
        <View style={s.dateBox}>
          <VectorIcon iconSet="Ionicons" iconName="calendar-outline" size={15} color={theme.colors.textMuted} />
          <TextInput style={s.dateInput} value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" placeholderTextColor={theme.colors.textMuted} />
          {!!data?.day_name && <Text style={s.dayName}>{data.day_name}</Text>}
        </View>
        <TouchableOpacity style={s.dateArrow} onPress={() => shiftDate(1)}><VectorIcon iconSet="Ionicons" iconName="chevron-forward" size={18} color={theme.colors.primary} /></TouchableOpacity>
      </View>

      <View style={s.statRow}>
        {[
          { label: 'Absent', value: stats?.absent, color: '#EF4444' },
          { label: 'Available', value: stats?.available, color: '#22C55E' },
          { label: 'Arranged', value: stats?.arrangements, color: '#0EA5E9' },
        ].map(c => (
          <View key={c.label} style={[s.statCard, { backgroundColor: c.color + '14' }]}>
            <Text style={[s.statVal, { color: c.color }]}>{c.value ?? '—'}</Text>
            <Text style={s.statLbl}>{c.label}</Text>
          </View>
        ))}
      </View>

      {/* Class filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterBar} contentContainerStyle={s.filterContent}>
        <TouchableOpacity style={[s.pchip, !fClass && s.pchipActive]} onPress={() => setFClass(null)}>
          <Text style={[s.pchipText, !fClass && s.pchipTextActive]}>All</Text>
        </TouchableOpacity>
        {(data?.classes ?? []).map(c => (
          <TouchableOpacity key={c.id} style={[s.pchip, fClass === c.id && s.pchipActive]} onPress={() => setFClass(c.id)}>
            <Text style={[s.pchipText, fClass === c.id && s.pchipTextActive]}>{c.name}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading && !refreshing ? (
        <View style={s.loader}><ActivityIndicator size="large" color={theme.colors.primary} /></View>
      ) : (
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}
          refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
          {(!data || data.teachers.length === 0) && (
            <Text style={s.empty}>No absent teachers with classes on this date. 🎉</Text>
          )}
          {data?.teachers.map(t => (
            <View key={t.teacher_id} style={s.card}>
              <View style={s.teacherHead}>
                <View style={s.absentDot} />
                <Text style={s.teacherName}>{t.teacher_name}</Text>
                <Text style={s.absentTag}>Absent</Text>
              </View>
              {t.slots.map(slot => (
                <View key={slot.slot_id} style={s.slot}>
                  <View style={s.slotTop}>
                    <Text style={s.slotSubject}>{slot.subject}</Text>
                    <Text style={s.slotTime}>{slot.start_time}–{slot.end_time}</Text>
                  </View>
                  <Text style={s.slotClass}>{slot.class}{slot.section ? ` · ${slot.section}` : ''}</Text>

                  {slot.arrangement ? (
                    <View style={s.arrangedBox}>
                      <VectorIcon iconSet="Ionicons" iconName="checkmark-circle" size={16} color="#22C55E" />
                      <Text style={s.arrangedText}>{slot.arrangement.substitute_name}{slot.arrangement.reason ? ` · ${slot.arrangement.reason}` : ''}</Text>
                      <TouchableOpacity onPress={() => removeArr(slot)}><VectorIcon iconSet="Ionicons" iconName="trash-outline" size={15} color={theme.colors.danger} /></TouchableOpacity>
                    </View>
                  ) : slot.available_substitutes.length === 0 ? (
                    <Text style={s.noSub}>No available substitute for this slot.</Text>
                  ) : (
                    <View style={s.assignBox}>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.subChips}>
                        {slot.available_substitutes.map(sub => {
                          const active = picks[slot.slot_id]?.sub === sub.id;
                          return (
                            <TouchableOpacity key={sub.id} style={[s.subChip, active && s.subChipActive]} onPress={() => setPick(slot.slot_id, { sub: sub.id })}>
                              <Text style={[s.subChipText, active && s.subChipTextActive]}>{sub.name}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                      <TextInput style={s.reasonInput} placeholder="Reason (required)" placeholderTextColor={theme.colors.textMuted}
                        value={picks[slot.slot_id]?.reason ?? ''} onChangeText={v => setPick(slot.slot_id, { reason: v })} />
                      <TouchableOpacity style={s.assignBtn} onPress={() => assign(slot)} disabled={busy === slot.slot_id} activeOpacity={0.9}>
                        {busy === slot.slot_id ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.assignBtnText}>Assign Substitute</Text>}
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              ))}
            </View>
          ))}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </View>
  );
};

export default AdminArrangementScreen;

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 40 },
  topbar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingTop: 18, paddingBottom: 14, backgroundColor: theme.colors.card, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  menuBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: theme.colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '900', color: theme.colors.textPrimary, flex: 1 },

  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 12 },
  dateArrow: { width: 40, height: 42, borderRadius: 12, backgroundColor: theme.colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  dateBox: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, height: 42, borderRadius: 12, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border },
  dateInput: { flex: 1, fontSize: 14, fontWeight: '700', color: theme.colors.textPrimary, paddingVertical: 0 },
  dayName: { fontSize: 11, fontWeight: '700', color: theme.colors.primary },

  statRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 12 },
  statCard: { flex: 1, borderRadius: 14, paddingVertical: 12, alignItems: 'center' },
  statVal: { fontSize: 20, fontWeight: '900' },
  statLbl: { fontSize: 11, color: theme.colors.textSecondary, fontWeight: '600', marginTop: 2 },

  filterBar: { maxHeight: 46, paddingLeft: 16, marginTop: 12 },
  filterContent: { gap: 8, paddingRight: 16, alignItems: 'center' },
  pchip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: theme.radius.full, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border },
  pchipActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  pchipText: { fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary },
  pchipTextActive: { color: '#fff' },

  scroll: { paddingHorizontal: 16, paddingTop: 12 },
  empty: { fontSize: 13, color: theme.colors.textMuted, textAlign: 'center', marginTop: 30 },

  card: { backgroundColor: theme.colors.card, borderRadius: 16, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: theme.colors.border },
  teacherHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  absentDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444' },
  teacherName: { flex: 1, fontSize: 15, fontWeight: '900', color: theme.colors.textPrimary },
  absentTag: { fontSize: 10, fontWeight: '800', color: '#EF4444', backgroundColor: '#FEE2E2', paddingHorizontal: 8, paddingVertical: 3, borderRadius: theme.radius.full },

  slot: { borderTopWidth: 1, borderTopColor: theme.colors.border, paddingTop: 10, marginTop: 8 },
  slotTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  slotSubject: { fontSize: 14, fontWeight: '800', color: theme.colors.textPrimary },
  slotTime: { fontSize: 12, fontWeight: '700', color: theme.colors.primary },
  slotClass: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },

  arrangedBox: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, backgroundColor: '#22C55E14', borderRadius: 10, padding: 10 },
  arrangedText: { flex: 1, fontSize: 12, fontWeight: '600', color: '#16A34A' },
  noSub: { fontSize: 12, color: theme.colors.textMuted, marginTop: 10, fontStyle: 'italic' },

  assignBox: { marginTop: 10, gap: 8 },
  subChips: { gap: 8, paddingRight: 8 },
  subChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: theme.radius.full, backgroundColor: theme.colors.background, borderWidth: 1, borderColor: theme.colors.border },
  subChipActive: { backgroundColor: theme.colors.primaryLight, borderColor: theme.colors.primary },
  subChipText: { fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary },
  subChipTextActive: { color: theme.colors.primary },
  reasonInput: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, fontSize: 13, color: theme.colors.textPrimary, backgroundColor: theme.colors.background },
  assignBtn: { height: 42, borderRadius: 10, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center' },
  assignBtnText: { fontSize: 13, fontWeight: '800', color: '#fff' },
});
