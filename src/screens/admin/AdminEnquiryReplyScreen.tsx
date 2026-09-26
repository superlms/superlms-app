import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { EnquiryTab, replyEnquiry } from '../../api/adminContentApi';
import { DocHeader } from '../more/docUi';
import { FormCard, FormError, Hint, SubmitButton } from './adminFormUi';

/**
 * The school's reply to a student's or teacher's query, as the panel's reply
 * form has it: who it answers and what they asked, then the reply — at least
 * five characters. Sent, it marks the query replied and goes back to the list.
 *
 * Route params: tab, id, topic, admin_text (the reply so far), user_name, query.
 */

const MIN = 5;

const AdminEnquiryReplyScreen = ({ navigation, route }: any) => {
  const tab: EnquiryTab = route.params?.tab ?? 'teacher';
  const id: number = route.params?.id;
  const topic: string = route.params?.topic || 'Enquiry';
  const userName: string | undefined = route.params?.user_name;
  const query: string | undefined = route.params?.query;
  const isEdit = !!route.params?.admin_text;

  const [text, setText] = useState<string>(route.params?.admin_text ?? '');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (!text.trim()) return setError('Write your reply.');
    if (text.trim().length < MIN) return setError(`Your reply must be at least ${MIN} characters.`);
    setError('');
    setSending(true);
    try {
      await replyEnquiry(tab, id, text.trim());
      // Back to the list; it refreshes on focus and shows "Replied".
      navigation.navigate('AdminEnquiriesHome');
    } catch (e) {
      setError(apiErr(e, 'Could not send the reply.'));
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={s.root}>
      <DocHeader title={isEdit ? 'Edit Reply' : 'Send Reply'} onBackPress={() => navigation.goBack()} />

      <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          {/* Who it answers, and what they asked */}
          <View style={s.context}>
            <Text style={s.contextLabel}>{userName ? `Replying to ${userName}` : 'Replying to'}</Text>
            <Text style={s.topic}>{topic}</Text>
            {!!query && (
              <Text style={s.query} numberOfLines={4}>
                {query}
              </Text>
            )}
          </View>

          <View style={s.group}>
            <FormCard
              label="Your Reply"
              value={text}
              onChangeText={t => {
                setText(t);
                setError('');
              }}
              placeholder="Type your reply here..."
              multiline
              minHeight={160}
            />
            <Hint>At least {MIN} characters.</Hint>
          </View>

          <FormError>{error}</FormError>

          <SubmitButton label={isEdit ? 'Update Reply' : 'Send Reply'} busy={sending} onPress={send} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

export default AdminEnquiryReplyScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  flex: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40, gap: 14 },
  group: { gap: 8 },

  context: { paddingBottom: 4 },
  contextLabel: { fontSize: 12, color: theme.colors.textMuted },
  topic: { fontSize: 17, fontWeight: '600', color: theme.colors.textPrimary, marginTop: 4 },
  query: { fontSize: 14, lineHeight: 21, color: theme.colors.textSecondary, marginTop: 6 },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
