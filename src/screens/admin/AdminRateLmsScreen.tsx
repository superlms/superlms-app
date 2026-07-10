import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import VectorIcon from '../../components/VectorIcon';
import Header from '../../components/Header';
import { theme } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { getRating, submitRating } from '../../api/adminMoreApi';

const LABELS = ['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent'];

const AdminRateLmsScreen = ({ navigation }: any) => {
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await getRating();
      setRating(r.rating);
      setFeedback(r.feedback);
      setSubmittedAt(r.submitted_at ?? null);
    } catch {
      // first-time / no rating yet — leave blank
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const save = async () => {
    if (rating < 1) return Alert.alert('Rate first', 'Please tap a star to rate.');
    if (!feedback.trim()) return Alert.alert('Feedback', 'Please share a few words of feedback.');
    setSaving(true);
    try {
      const r = await submitRating(rating, feedback.trim());
      setSubmittedAt(r.submitted_at ?? new Date().toISOString());
      Alert.alert('Thank you!', 'Your feedback has been submitted.');
    } catch (e) {
      Alert.alert('Error', apiErr(e, 'Could not submit rating.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={s.root}>
      <Header title="Rate LMS" onBackPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('PanelHome'))} />
      {loading ? (
        <View style={s.loader}><ActivityIndicator size="large" color={theme.colors.primary} /></View>
      ) : (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
            <View style={s.hero}>
              <View style={s.heroIcon}><VectorIcon iconSet="Ionicons" iconName="star" size={30} color="#F59E0B" /></View>
              <Text style={s.heroTitle}>How is your experience?</Text>
              <Text style={s.heroDesc}>Your feedback helps us improve the LMS for your school.</Text>
            </View>

            <View style={s.starRow}>
              {[1, 2, 3, 4, 5].map(n => (
                <TouchableOpacity key={n} onPress={() => setRating(n)} activeOpacity={0.7} style={s.star}>
                  <VectorIcon iconSet="Ionicons" iconName={n <= rating ? 'star' : 'star-outline'} size={38} color={n <= rating ? '#F59E0B' : theme.colors.border} />
                </TouchableOpacity>
              ))}
            </View>
            {rating > 0 && <Text style={s.ratingLabel}>{LABELS[rating]}</Text>}

            <Text style={s.label}>Feedback</Text>
            <TextInput style={s.input} placeholder="Tell us what you think..." placeholderTextColor={theme.colors.textMuted}
              multiline value={feedback} onChangeText={setFeedback} />

            {!!submittedAt && (
              <Text style={s.note}>Last submitted: {new Date(submittedAt).toLocaleString()}</Text>
            )}
          </ScrollView>
          <View style={s.footer}>
            <TouchableOpacity style={s.saveBtn} onPress={save} activeOpacity={0.9} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveText}>{submittedAt ? 'Update Rating' : 'Submit Rating'}</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}
    </View>
  );
};

export default AdminRateLmsScreen;

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 16 },
  hero: { alignItems: 'center', marginTop: 8, marginBottom: 20 },
  heroIcon: { width: 64, height: 64, borderRadius: 20, backgroundColor: '#F59E0B18', alignItems: 'center', justifyContent: 'center' },
  heroTitle: { fontSize: 18, fontWeight: '900', color: theme.colors.textPrimary, marginTop: 12 },
  heroDesc: { fontSize: 13, color: theme.colors.textSecondary, textAlign: 'center', marginTop: 4, paddingHorizontal: 20, lineHeight: 19 },
  starRow: { flexDirection: 'row', justifyContent: 'center', gap: 6 },
  star: { padding: 2 },
  ratingLabel: { textAlign: 'center', fontSize: 14, fontWeight: '800', color: '#F59E0B', marginTop: 8 },
  label: { fontSize: 13, fontWeight: '800', color: theme.colors.textPrimary, marginTop: 24, marginBottom: 8 },
  input: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: theme.colors.textPrimary, backgroundColor: theme.colors.card, minHeight: 120, textAlignVertical: 'top' },
  note: { fontSize: 11, color: theme.colors.textMuted, marginTop: 12, textAlign: 'center' },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: theme.colors.border, backgroundColor: theme.colors.card },
  saveBtn: { height: 52, borderRadius: 14, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center' },
  saveText: { fontSize: 16, fontWeight: '800', color: '#fff' },
});
