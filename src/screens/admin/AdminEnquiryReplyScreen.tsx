import React, { useState } from 'react';
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
import VectorIcon from '../../components/VectorIcon';
import Header from '../../components/Header';
import { theme } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { EnquiryTab, replyEnquiry } from '../../api/adminContentApi';

const AdminEnquiryReplyScreen = ({ navigation, route }: any) => {
  const tab: EnquiryTab = route.params?.tab ?? 'teacher';
  const id: number = route.params?.id;
  const topic: string = route.params?.topic ?? 'Enquiry';
  const isEdit = !!route.params?.admin_text;

  const [text, setText] = useState<string>(route.params?.admin_text ?? '');
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (text.trim().length < 2) {
      Alert.alert('Required', 'Please write a reply.');
      return;
    }
    setSending(true);
    try {
      await replyEnquiry(tab, id, text.trim());
      // Pop back to the list; it refreshes on focus and shows "Replied".
      navigation.navigate('AdminEnquiriesHome');
    } catch (e) {
      Alert.alert('Error', apiErr(e, 'Could not send reply.'));
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={s.root}>
      <Header title={isEdit ? 'Edit Reply' : 'Reply'} onBackPress={() => navigation.goBack()} />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <Text style={s.contextLabel}>Replying to</Text>
          <View style={s.contextCard}>
            <VectorIcon iconSet="Ionicons" iconName="chatbubble-ellipses-outline" size={16} color={theme.colors.primary} />
            <Text style={s.contextText} numberOfLines={2}>{topic}</Text>
          </View>

          <Text style={s.label}>Your reply</Text>
          <TextInput
            style={s.input}
            value={text}
            onChangeText={setText}
            placeholder="Write your reply..."
            placeholderTextColor={theme.colors.textMuted}
            multiline
            autoFocus
          />
        </ScrollView>

        <View style={s.footer}>
          <TouchableOpacity style={s.sendBtn} onPress={send} activeOpacity={0.9} disabled={sending}>
            {sending ? <ActivityIndicator color="#fff" /> : (
              <>
                <VectorIcon iconSet="Ionicons" iconName="send" size={17} color="#fff" />
                <Text style={s.sendText}>{isEdit ? 'Update Reply' : 'Send Reply'}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};

export default AdminEnquiryReplyScreen;

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  scroll: { padding: 16 },

  contextLabel: { fontSize: 11, fontWeight: '800', color: theme.colors.textMuted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 },
  contextCard: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: theme.colors.primaryLight, borderRadius: 12, padding: 12 },
  contextText: { flex: 1, fontSize: 13, fontWeight: '700', color: theme.colors.textPrimary },

  label: { fontSize: 13, fontWeight: '800', color: theme.colors.textPrimary, marginTop: 20, marginBottom: 8 },
  input: {
    borderWidth: 1, borderColor: theme.colors.border, borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: theme.colors.textPrimary,
    backgroundColor: theme.colors.card, minHeight: 160, textAlignVertical: 'top',
  },

  footer: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 20, borderTopWidth: 1, borderTopColor: theme.colors.border, backgroundColor: theme.colors.card },
  sendBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 52, borderRadius: 14, backgroundColor: theme.colors.primary },
  sendText: { fontSize: 16, fontWeight: '800', color: '#fff' },
});
