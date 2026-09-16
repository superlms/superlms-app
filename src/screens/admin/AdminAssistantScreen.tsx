import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated from 'react-native-reanimated';
import Header, { HeaderIconButton } from '../../components/Header';
import VectorIcon from '../../components/VectorIcon';
import { useKeyboardLiftStyle } from '../../hooks/useKeyboardLift';
import { theme } from '../../utils/theme';
import {
  askAssistant,
  getAssistantStatus,
  type AssistantQuota,
  type AssistantStatus,
  type AssistantTurn,
} from '../../api/assistantApi';

// ─── Answer text ──────────────────────────────────────────────────────────────
// Answers arrive as markdown: headings, lists, **bold**, `code` and tables.

const Inline = ({ text, style }: { text: string; style: any }) => (
  <Text style={style}>
    {text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, i) =>
      part.startsWith('**') && part.endsWith('**') && part.length > 4 ? (
        <Text key={i} style={s.bold}>
          {part.slice(2, -2)}
        </Text>
      ) : part.startsWith('`') && part.endsWith('`') && part.length > 2 ? (
        <Text key={i} style={s.code}>
          {part.slice(1, -1)}
        </Text>
      ) : (
        part
      ),
    )}
  </Text>
);

const tableCells = (line: string) =>
  line
    .trim()
    .replace(/^\||\|$/g, '')
    .split('|')
    .map(c => c.trim());

const Table = ({ lines }: { lines: string[] }) => {
  const rows = lines
    .filter(l => !/^\s*\|?\s*:?-{2,}/.test(l))
    .map(tableCells);
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tableWrap}>
      <View>
        {rows.map((cells, r) => (
          <View key={r} style={[s.tableRow, r === 0 && s.tableHead]}>
            {cells.map((cell, c) => (
              <View key={c} style={s.tableCell}>
                <Inline text={cell} style={[s.answer, r === 0 && s.bold]} />
              </View>
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  );
};

const Answer = ({ text }: { text: string }) => {
  const blocks: React.ReactNode[] = [];
  const lines = text.replace(/\r/g, '').split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().startsWith('|')) {
      const table: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        table.push(lines[i]);
        i++;
      }
      i--;
      blocks.push(<Table key={blocks.length} lines={table} />);
      continue;
    }
    if (!line.trim()) {
      blocks.push(<View key={blocks.length} style={s.gap} />);
      continue;
    }
    const heading = line.match(/^\s*#{1,6}\s+(.*)$/);
    if (heading) {
      blocks.push(<Inline key={blocks.length} text={heading[1]} style={[s.answer, s.heading]} />);
      continue;
    }
    const bullet = line.match(/^(\s*)[-*•]\s+(.*)$/);
    const numbered = line.match(/^(\s*)(\d+[.)])\s+(.*)$/);
    if (bullet || numbered) {
      const indent = (bullet ?? numbered)![1].length > 1 ? 14 : 0;
      blocks.push(
        <View key={blocks.length} style={[s.listRow, { paddingLeft: indent }]}>
          <Text style={[s.answer, s.listMark]}>{bullet ? '•' : numbered![2]}</Text>
          <Inline text={bullet ? bullet[2] : numbered![3]} style={[s.answer, s.listText]} />
        </View>,
      );
      continue;
    }
    blocks.push(<Inline key={blocks.length} text={line} style={s.answer} />);
  }

  return <View>{blocks}</View>;
};

// ─── Screen ───────────────────────────────────────────────────────────────────

/**
 * LMS Assist: the web panel's Super LMS assistant for the school admin — ask
 * about the school in plain words (Hinglish too) and get answers from its own
 * data. The day's questions are shared by everyone with the same role.
 */
const AdminAssistantScreen = ({ navigation }: any) => {
  const lift = useKeyboardLiftStyle();
  const scrollRef = useRef<ScrollView>(null);

  const [status, setStatus] = useState<AssistantStatus | null>(null);
  const [loadError, setLoadError] = useState('');
  const [messages, setMessages] = useState<AssistantTurn[]>([]);
  const [prompt, setPrompt] = useState('');
  const [pending, setPending] = useState(false);
  const [quota, setQuota] = useState<AssistantQuota | null>(null);

  const load = useCallback(async () => {
    setLoadError('');
    try {
      const st = await getAssistantStatus();
      setStatus(st);
      setQuota(st);
    } catch (e: any) {
      setLoadError(e?.response?.data?.message ?? 'Could not reach LMS Assist. Please try again.');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const ask = async (text: string) => {
    const question = text.trim();
    if (!question || pending) return;
    const history = messages;
    setMessages([...history, { role: 'user', text: question }]);
    setPrompt('');
    setPending(true);
    try {
      const answer = await askAssistant(question, history);
      setMessages(m => [...m, { role: 'model', text: answer.text || 'No answer came back.' }]);
      if (answer.quota) setQuota(answer.quota);
    } catch {
      setMessages(m => [
        ...m,
        { role: 'model', text: 'Something went wrong while answering. Please try again.' },
      ]);
    } finally {
      setPending(false);
    }
  };

  const back = () => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('PanelHome'));

  const left =
    quota && !quota.unlimited && quota.remaining != null
      ? `${quota.remaining} of ${quota.daily_limit} questions left today · resets ${quota.resets}`
      : null;

  return (
    <View style={s.root}>
      <Header
        title="LMS Assist"
        onBackPress={back}
        divider
        rightSlot={
          messages.length > 0 && !pending ? (
            <HeaderIconButton icon="refresh-outline" onPress={() => setMessages([])} />
          ) : undefined
        }
      />

      {!status ? (
        <View style={s.center}>
          {loadError ? (
            <>
              <Text style={s.muted}>{loadError}</Text>
              <TouchableOpacity style={s.retry} onPress={load} activeOpacity={0.8}>
                <Text style={s.retryText}>Try again</Text>
              </TouchableOpacity>
            </>
          ) : (
            <ActivityIndicator color={theme.colors.primary} />
          )}
        </View>
      ) : !status.enabled ? (
        <View style={s.center}>
          <Text style={s.muted}>LMS Assist isn't available right now.</Text>
        </View>
      ) : (
        <Animated.View style={[s.flex, lift]}>
          <ScrollView
            ref={scrollRef}
            style={s.flex}
            contentContainerStyle={s.thread}
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
          >
            {messages.length === 0 && (
              <View style={s.intro}>
                <View style={s.introIcon}>
                  <VectorIcon iconSet="Ionicons" iconName="sparkles" size={26} color={theme.colors.primary} />
                </View>
                <Text style={s.introTitle}>Ask {status.name} about your school</Text>
                <Text style={s.introText}>
                  Students, attendance, fees, exams and more — answered from {status.scope.toLowerCase()}'s own
                  data.
                </Text>
                <View style={s.chips}>
                  {status.suggestions.map(q => (
                    <TouchableOpacity key={q} style={s.chip} activeOpacity={0.7} onPress={() => ask(q)}>
                      <Text style={s.chipText}>{q}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {messages.map((m, i) =>
              m.role === 'user' ? (
                <View key={i} style={[s.bubble, s.mine]}>
                  <Text style={s.mineText}>{m.text}</Text>
                </View>
              ) : (
                <View key={i} style={[s.bubble, s.theirs]}>
                  <Answer text={m.text} />
                </View>
              ),
            )}

            {pending && (
              <View style={[s.bubble, s.theirs, s.typing]}>
                <ActivityIndicator size="small" color={theme.colors.primary} />
                <Text style={s.muted}>Looking it up…</Text>
              </View>
            )}
          </ScrollView>

          {!!left && <Text style={s.quota}>{left}</Text>}

          <View style={s.composer}>
            <TextInput
              value={prompt}
              onChangeText={setPrompt}
              placeholder="Ask about your school…"
              placeholderTextColor={theme.colors.textMuted}
              multiline
              maxLength={1000}
              style={s.input}
            />
            <TouchableOpacity
              style={[s.send, (!prompt.trim() || pending) && s.sendOff]}
              disabled={!prompt.trim() || pending}
              activeOpacity={0.8}
              onPress={() => ask(prompt)}
            >
              <VectorIcon iconSet="Ionicons" iconName="send" size={18} color={theme.colors.white} />
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}
    </View>
  );
};

export default AdminAssistantScreen;

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  muted: { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center' },
  retry: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primary,
  },
  retryText: { color: theme.colors.white, fontWeight: '600' },

  thread: { padding: 16, gap: 10, flexGrow: 1 },

  intro: { alignItems: 'center', paddingTop: 24, paddingHorizontal: 8 },
  introIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  introTitle: {
    marginTop: 12,
    fontSize: 17,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    textAlign: 'center',
  },
  introText: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  chips: { marginTop: 18, gap: 8, alignSelf: 'stretch' },
  chip: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  chipText: { fontSize: 14, color: theme.colors.textPrimary },

  bubble: { maxWidth: '88%', borderRadius: theme.radius.md, paddingHorizontal: 14, paddingVertical: 10 },
  mine: { alignSelf: 'flex-end', backgroundColor: theme.colors.primary },
  mineText: { fontSize: 15, lineHeight: 21, color: theme.colors.white },
  theirs: {
    alignSelf: 'flex-start',
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  typing: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  answer: { fontSize: 15, lineHeight: 21, color: theme.colors.textPrimary },
  bold: { fontWeight: '700' },
  code: { fontFamily: 'monospace', fontSize: 13, color: theme.colors.primary },
  heading: { fontWeight: '700', marginTop: 4 },
  gap: { height: 6 },
  listRow: { flexDirection: 'row', gap: 8 },
  listMark: { minWidth: 12 },
  listText: { flex: 1 },
  tableWrap: { marginVertical: 6 },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  tableHead: { backgroundColor: theme.colors.background },
  tableCell: { minWidth: 96, maxWidth: 200, paddingHorizontal: 8, paddingVertical: 6 },

  quota: {
    fontSize: 12,
    color: theme.colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: 16,
    paddingBottom: 6,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 10,
    backgroundColor: theme.colors.card,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.divider,
  },
  input: {
    flex: 1,
    maxHeight: 120,
    minHeight: 44,
    paddingHorizontal: 14,
    paddingTop: 11,
    paddingBottom: 11,
    borderRadius: 22,
    backgroundColor: theme.colors.background,
    fontSize: 15,
    color: theme.colors.textPrimary,
  },
  send: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendOff: { opacity: 0.5 },
});
