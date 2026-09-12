import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { CardType, IdCardRow, updateIdCard } from '../../api/adminIdCardApi';
import { DocHeader } from '../more/docUi';

const STATUSES: { key: 'active' | 'inactive'; label: string }[] = [
  { key: 'active', label: 'Active' },
  { key: 'inactive', label: 'Inactive' },
];

const AdminIdCardEditScreen = ({ navigation, route }: any) => {
  const type: CardType = route.params?.type ?? 'student';
  const card: IdCardRow = route.params?.card;

  const [expiry, setExpiry] = useState<string>(card?.expiry_date ?? '');
  const [status, setStatus] = useState<'active' | 'inactive'>(
    (card?.status as any) === 'inactive' ? 'inactive' : 'active',
  );
  const [focused, setFocused] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(expiry)) {
      setError('The expiry date must be written as YYYY-MM-DD.');
      return;
    }

    setError('');
    setSaving(true);
    try {
      await updateIdCard(type, card.id, { expiry_date: expiry, status });
      navigation.goBack();
    } catch (e) {
      setError(apiErr(e, 'Could not update card.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={s.root}>
      <DocHeader title="Edit ID Card" onBackPress={() => navigation.goBack()} />

      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {/* Which card is being changed */}
          {!!card?.card_number && (
            <View>
              <Text style={s.cardNoLabel}>CARD NO.</Text>
              <Text style={s.cardNo}>{card.card_number}</Text>
              {!!card?.name && <Text style={s.cardName}>{card.name}</Text>}
            </View>
          )}

          {/* Expiry */}
          <View style={[s.field, focused && s.fieldFocused]}>
            <Text style={s.fieldLabel}>Expiry date</Text>
            <TextInput
              style={s.fieldInput}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={theme.colors.textMuted}
              value={expiry}
              onChangeText={t => { setExpiry(t); setError(''); }}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              keyboardType="numbers-and-punctuation"
            />
          </View>

          {/* Status */}
          <View>
            <Text style={s.sectionLabel}>Status</Text>
            <View style={s.segment}>
              {STATUSES.map(st => {
                const active = status === st.key;
                return (
                  <TouchableOpacity
                    key={st.key}
                    activeOpacity={0.7}
                    onPress={() => setStatus(st.key)}
                    style={[s.segmentItem, active && s.segmentItemActive]}
                  >
                    <Text style={[s.segmentText, active && s.segmentTextActive]}>{st.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {!!error && <Text style={s.errorText}>{error}</Text>}

          <TouchableOpacity
            activeOpacity={0.85}
            onPress={save}
            style={[s.submitBtn, saving && s.submitBtnBusy]}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color={theme.colors.white} size="small" />
            ) : (
              <Text style={s.submitText}>Update Card</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

export default AdminIdCardEditScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  flex: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40, gap: 16 },

  cardNoLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 0.8, color: theme.colors.textMuted },
  cardNo: { fontSize: 18, fontWeight: '600', color: theme.colors.textPrimary, marginTop: 4 },
  cardName: { fontSize: 14, color: theme.colors.textSecondary, marginTop: 2 },

  // Input card
  field: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  fieldFocused: { borderColor: theme.colors.primary },
  fieldLabel: { fontSize: 12, fontWeight: '500', color: theme.colors.textMuted },
  fieldInput: {
    fontSize: 15,
    color: theme.colors.textPrimary,
    paddingHorizontal: 0,
    paddingVertical: 4,
    marginTop: 2,
  },

  // Status segment
  sectionLabel: { fontSize: 12, fontWeight: '500', color: theme.colors.textMuted, marginBottom: 8 },
  segment: {
    flexDirection: 'row',
    padding: 3,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
  segmentItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  segmentItemActive: { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
  segmentText: { fontSize: 13, fontWeight: '500', color: theme.colors.textSecondary },
  segmentTextActive: { color: theme.colors.primary, fontWeight: '600' },

  errorText: { fontSize: 13, color: theme.colors.danger, lineHeight: 18 },

  // Submit
  submitBtn: {
    height: 48,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  submitBtnBusy: { opacity: 0.7 },
  submitText: { fontSize: 15, fontWeight: '600', color: theme.colors.white },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
