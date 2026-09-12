import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import VectorIcon from '../../components/VectorIcon';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { CardType, generateIdCards } from '../../api/adminIdCardApi';
import { DocHeader } from '../more/docUi';

const TYPE_LABEL: Record<CardType, string> = {
  student: 'students',
  teacher: 'teachers',
  employee: 'employees',
};

const AdminIdCardGenerateScreen = ({ navigation, route }: any) => {
  const type: CardType = route.params?.type ?? 'student';
  const standards: { id: number; name: string }[] = route.params?.standards ?? [];

  const [expiry, setExpiry] = useState<string>(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [classes, setClasses] = useState<number[]>([]);
  const [focused, setFocused] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [doneMsg, setDoneMsg] = useState('');

  const toggleClass = (id: number) =>
    setClasses(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));

  const run = async () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(expiry)) {
      setError('The expiry date must be written as YYYY-MM-DD.');
      return;
    }

    setError('');
    setSaving(true);
    try {
      const res = await generateIdCards({
        type,
        expiry_date: expiry,
        standard_ids: type === 'student' ? classes : undefined,
      });
      setDoneMsg(
        res.generated > 0
          ? `${res.generated} card${res.generated === 1 ? '' : 's'} issued.`
          : `No new cards — every one of your ${TYPE_LABEL[type]} already has an active card.`,
      );
    } catch (e) {
      setError(apiErr(e, 'Could not generate cards.'));
    } finally {
      setSaving(false);
    }
  };

  const closeDone = () => {
    setDoneMsg('');
    navigation.goBack();
  };

  return (
    <View style={s.root}>
      <DocHeader title="Generate ID Cards" onBackPress={() => navigation.goBack()} />

      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={s.intro}>
            A card is issued to every one of your {TYPE_LABEL[type]} who does not already have an
            active one.
          </Text>

          {/* Expiry */}
          <View style={[s.field, focused && s.fieldFocused]}>
            <Text style={s.fieldLabel}>Card expiry date</Text>
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

          {/* Classes — students only */}
          {type === 'student' && (
            <View>
              <Text style={s.sectionLabel}>Classes</Text>
              <View style={s.classList}>
                {standards.length === 0 ? (
                  <Text style={s.emptyClasses}>No classes found.</Text>
                ) : (
                  standards.map((std, i) => {
                    const on = classes.includes(std.id);
                    return (
                      <TouchableOpacity
                        key={std.id}
                        style={[s.classRow, i < standards.length - 1 && s.classRowDivider]}
                        activeOpacity={0.6}
                        onPress={() => toggleClass(std.id)}
                      >
                        <Text style={s.className}>{std.name}</Text>
                        <VectorIcon
                          iconSet="Ionicons"
                          iconName={on ? 'checkmark-circle' : 'ellipse-outline'}
                          size={20}
                          color={on ? theme.colors.primary : theme.colors.border}
                        />
                      </TouchableOpacity>
                    );
                  })
                )}
              </View>
              <Text style={s.hint}>
                {classes.length > 0
                  ? `${classes.length} class${classes.length === 1 ? '' : 'es'} selected.`
                  : 'Nothing selected means every class.'}
              </Text>
            </View>
          )}

          <Text style={s.hint}>
            After the first batch, anyone added later gets a card automatically each night using
            this expiry date.
          </Text>

          {!!error && <Text style={s.errorText}>{error}</Text>}

          <TouchableOpacity
            activeOpacity={0.85}
            onPress={run}
            style={[s.submitBtn, saving && s.submitBtnBusy]}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color={theme.colors.white} size="small" />
            ) : (
              <Text style={s.submitText}>Generate Cards</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Done */}
      <Modal transparent visible={!!doneMsg} animationType="fade" onRequestClose={closeDone}>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <VectorIcon iconSet="Ionicons" iconName="checkmark-circle-outline" size={44} color={theme.colors.success} />
            <Text style={s.modalTitle}>Generated</Text>
            <Text style={s.modalDesc}>{doneMsg}</Text>
            <TouchableOpacity style={s.modalBtn} activeOpacity={0.85} onPress={closeDone}>
              <Text style={s.modalBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default AdminIdCardGenerateScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  flex: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40, gap: 14 },

  intro: { fontSize: 14, lineHeight: 21, color: theme.colors.textSecondary },

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

  // Classes
  sectionLabel: { fontSize: 12, fontWeight: '500', color: theme.colors.textMuted, marginBottom: 8 },
  classList: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: 14,
  },
  classRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 12,
  },
  classRowDivider: { borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  className: { flex: 1, fontSize: 15, color: theme.colors.textPrimary },
  emptyClasses: { fontSize: 14, color: theme.colors.textMuted, paddingVertical: 14 },

  hint: { fontSize: 12, color: theme.colors.textMuted, lineHeight: 18 },
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

  // Done modal
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
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    textAlign: 'center',
    marginTop: 12,
  },
  modalDesc: {
    marginTop: 6,
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  modalBtn: {
    marginTop: 22,
    alignSelf: 'stretch',
    height: 48,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtnText: { fontSize: 15, fontWeight: '600', color: theme.colors.white },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
