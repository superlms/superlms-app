import React, { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Header from '../../components/Header';
import { theme } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { Field, ChipPicker } from './AdminStandardScreen';
import { CardType, IdCardRow, updateIdCard } from '../../api/adminIdCardApi';

const AdminIdCardEditScreen = ({ navigation, route }: any) => {
  const type: CardType = route.params?.type ?? 'student';
  const card: IdCardRow = route.params?.card;

  const [expiry, setExpiry] = useState<string>(card?.expiry_date ?? '');
  const [status, setStatus] = useState<'active' | 'inactive'>((card?.status as any) === 'inactive' ? 'inactive' : 'active');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!expiry) return Alert.alert('Required', 'Expiry date is required.');
    setSaving(true);
    try {
      await updateIdCard(type, card.id, { expiry_date: expiry, status });
      navigation.goBack();
    } catch (e) {
      Alert.alert('Error', apiErr(e, 'Could not update card.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={s.root}>
      <Header title="Edit ID Card" onBackPress={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        {!!card?.card_number && <Text style={s.cardNo}>{card.card_number}</Text>}
        <Field label="Expiry Date" value={expiry} onChangeText={setExpiry} placeholder="YYYY-MM-DD" />
        <Text style={s.label}>Status</Text>
        <ChipPicker items={[{ id: 'active', label: 'Active' }, { id: 'inactive', label: 'Inactive' }]}
          selected={[status]} onToggle={(id: any) => setStatus(id)} />
      </ScrollView>
      <View style={s.footer}>
        <TouchableOpacity style={s.saveBtn} onPress={save} activeOpacity={0.9} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveText}>Save</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default AdminIdCardEditScreen;

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  scroll: { padding: 16 },
  cardNo: { fontSize: 13, fontWeight: '800', color: theme.colors.textSecondary, marginBottom: 4 },
  label: { fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary, marginTop: 12, marginBottom: 6 },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: theme.colors.border, backgroundColor: theme.colors.card },
  saveBtn: { height: 52, borderRadius: 14, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center' },
  saveText: { fontSize: 16, fontWeight: '800', color: '#fff' },
});
