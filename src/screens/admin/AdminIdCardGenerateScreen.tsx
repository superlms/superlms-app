import React, { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Header from '../../components/Header';
import { theme } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { Field, ChipPicker } from './AdminStandardScreen';
import { CardType, generateIdCards } from '../../api/adminIdCardApi';

const AdminIdCardGenerateScreen = ({ navigation, route }: any) => {
  const type: CardType = route.params?.type ?? 'student';
  const standards: { id: number; name: string }[] = route.params?.standards ?? [];

  const [expiry, setExpiry] = useState<string>(() => {
    const d = new Date(); d.setFullYear(d.getFullYear() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [classes, setClasses] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);

  const run = async () => {
    if (!expiry) return Alert.alert('Required', 'Expiry date is required.');
    setSaving(true);
    try {
      const res = await generateIdCards({ type, expiry_date: expiry, standard_ids: type === 'student' ? classes : undefined });
      Alert.alert('Done', res.generated > 0 ? `Generated ${res.generated} card(s).` : 'No new cards — all already have an active ID card.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } catch (e) {
      Alert.alert('Error', apiErr(e, 'Could not generate cards.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={s.root}>
      <Header title={`Generate ${type} cards`} onBackPress={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <Field label="Expiry Date" value={expiry} onChangeText={setExpiry} placeholder="YYYY-MM-DD" />
        {type === 'student' && (
          <>
            <Text style={s.label}>Classes (leave empty for all)</Text>
            <ChipPicker multi items={standards.map(x => ({ id: x.id, label: x.name }))} selected={classes}
              onToggle={(id: number) => setClasses(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]))} />
          </>
        )}
        <Text style={s.note}>Only people without an active card get a new one.</Text>
      </ScrollView>
      <View style={s.footer}>
        <TouchableOpacity style={s.saveBtn} onPress={run} activeOpacity={0.9} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveText}>Generate</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default AdminIdCardGenerateScreen;

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  scroll: { padding: 16 },
  label: { fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary, marginTop: 12, marginBottom: 6 },
  note: { fontSize: 11, color: theme.colors.textMuted, marginTop: 12 },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: theme.colors.border, backgroundColor: theme.colors.card },
  saveBtn: { height: 52, borderRadius: 14, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center' },
  saveText: { fontSize: 16, fontWeight: '800', color: '#fff' },
});
