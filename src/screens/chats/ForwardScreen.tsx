import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  ToastAndroid,
  TouchableOpacity,
  View,
} from 'react-native';

import Header from '../../components/Header';
import VectorIcon from '../../components/VectorIcon';
import { Skeleton } from '../../components/Skeleton';
import { AppAlert } from '../../components/AppDialog';
import { theme, onThemeChange } from '../../utils/theme';
import { DocNoData } from '../more/docUi';
import {
  type ChatContact,
  chatErrorMessage,
  forwardChatMessages,
  getChatContacts,
  sendChatMessage,
} from '../../api/chatApi';
import { fileUri, keepSentFile } from './chatFiles';

/**
 * Forward to…, for the messages picked in a conversation. Recent chats come
 * first, then everyone else this user can message; pick one or more and send.
 * Sent to one person, their conversation opens in place of this screen; sent
 * to several, it goes back to where the messages were picked.
 *
 * Files leave the server once they reach a phone, so messages with files go
 * again from this phone's copies, one after another to each person.
 */

// A picked message: its words, and its file on this phone.
export interface ForwardItem {
  id: number;
  body: string | null;
  file: { path: string; name: string; type: string } | null;
}

const initials = (name: string) =>
  name
    .split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

// By the name: a teacher's subjects, or a student's class · section.
const detailOf = (p: ChatContact) => [p.standard?.name, p.section?.name].filter(Boolean).join(' · ') || p.subtitle;

const ForwardScreen = ({ navigation, route }: any) => {
  const ids: number[] = route?.params?.ids ?? [];
  const items: ForwardItem[] = route?.params?.items ?? [];
  const userRole = route?.params?.userRole === 'teacher' ? 'teacher' : 'student';

  const [people, setPeople] = useState<ChatContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<number[]>([]);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError(null);
    getChatContacts()
      .then(list => {
        // The server lists the latest conversation first.
        if (live) setPeople(list);
      })
      .catch(e => {
        if (live) setError(chatErrorMessage(e));
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [attempt]);

  const q = query.trim().toLowerCase();
  const list = q
    ? people.filter(p => p.name.toLowerCase().includes(q) || (detailOf(p) ?? '').toLowerCase().includes(q))
    : people;

  const toggle = (id: number) => setPicked(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));

  const send = async () => {
    if (!picked.length || sending) return;
    setSending(true);
    try {
      if (items.some(item => item.file)) {
        for (const userId of picked) {
          for (const item of items) {
            const file = item.file
              ? { uri: fileUri(item.file.path), name: item.file.name, type: item.file.type }
              : null;
            const saved = await sendChatMessage(userId, {
              body: item.body ?? undefined,
              file,
              forwardedFrom: item.id,
            });
            // The copy sent keeps its own file on this phone, as anything sent does.
            if (file && saved.attachment) await keepSentFile(saved, file);
          }
        }
      } else {
        await forwardChatMessages(ids, picked);
      }
      if (Platform.OS === 'android') ToastAndroid.show('Forwarded', ToastAndroid.SHORT);
      const only = picked.length === 1 ? people.find(p => p.user_id === picked[0]) : null;
      if (only) {
        navigation.replace('UserChats', {
          contact: {
            user_id: only.user_id,
            name: only.name,
            avatar: only.avatar,
            subtitle: only.subtitle,
            subjects: only.subjects,
            standard: only.standard,
            section: only.section,
          },
          userRole,
        });
      } else {
        navigation.goBack();
      }
    } catch (e: any) {
      setSending(false);
      AppAlert.alert('Could not forward', chatErrorMessage(e));
    }
  };

  const pickedNames = picked
    .map(id => people.find(p => p.user_id === id)?.name)
    .filter(Boolean)
    .join(', ');

  return (
    <View style={s.root}>
      <Header title="Forward to…" divider height={50} onBackPress={() => navigation.goBack()} />

      <View style={s.searchWrap}>
        <View style={s.searchRow}>
          <VectorIcon iconSet="Ionicons" iconName="search" size={16} color={theme.colors.textMuted} />
          <TextInput
            style={s.searchInput}
            placeholder="Search"
            placeholderTextColor={theme.colors.textMuted}
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
          />
          {!!query && (
            <TouchableOpacity onPress={() => setQuery('')} hitSlop={8}>
              <VectorIcon iconSet="Ionicons" iconName="close" size={16} color={theme.colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {loading ? (
        <View style={s.list}>
          {[0, 1, 2, 3, 4, 5].map(i => (
            <View key={i} style={[s.row, i < 5 && s.rowDivider]}>
              <Skeleton width={46} height={46} radius={23} />
              <View style={s.rowText}>
                <Skeleton width={['52%', '40%', '60%', '46%', '34%', '48%'][i]} height={13} />
                <Skeleton width={['30%', '44%', '24%', '36%', '28%', '32%'][i]} height={10} />
              </View>
            </View>
          ))}
        </View>
      ) : error ? (
        <View style={s.centeredBox}>
          <VectorIcon iconSet="Ionicons" iconName="cloud-offline-outline" size={32} color={theme.colors.textMuted} />
          <Text style={s.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => setAttempt(a => a + 1)} hitSlop={10}>
            <Text style={s.linkText}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={list}
          keyExtractor={p => String(p.user_id)}
          contentContainerStyle={[s.list, list.length === 0 && s.listEmpty]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <DocNoData
              icon="chatbubbles-outline"
              title={q ? 'No one found' : 'No one to forward to'}
              subtitle={q ? 'Nothing matches that search.' : 'There is no one you can message yet.'}
            />
          }
          renderItem={({ item, index }) => {
            const on = picked.includes(item.user_id);
            const detail = detailOf(item);
            return (
              <TouchableOpacity
                style={[s.row, index < list.length - 1 && s.rowDivider]}
                activeOpacity={0.6}
                onPress={() => toggle(item.user_id)}
              >
                <View>
                  {item.avatar ? (
                    <Image source={{ uri: item.avatar }} style={s.avatar} />
                  ) : (
                    <View style={[s.avatar, s.avatarFallback]}>
                      <Text style={s.avatarInitials}>{initials(item.name)}</Text>
                    </View>
                  )}
                  {on && (
                    <View style={s.tick}>
                      <VectorIcon iconSet="Ionicons" iconName="checkmark" size={11} color={theme.colors.white} />
                    </View>
                  )}
                </View>
                <View style={s.rowText}>
                  <Text style={s.name} numberOfLines={1}>
                    {item.name}
                  </Text>
                  {!!detail && (
                    <Text style={s.detail} numberOfLines={1}>
                      {detail}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* Who it goes to, and send */}
      {picked.length > 0 && (
        <View style={s.sendBar}>
          <Text style={s.sendNames} numberOfLines={1}>
            {pickedNames}
          </Text>
          <TouchableOpacity style={s.sendBtn} activeOpacity={0.85} disabled={sending} onPress={send}>
            {sending ? (
              <ActivityIndicator size="small" color={theme.colors.white} />
            ) : (
              <VectorIcon iconSet="Ionicons" iconName="send" size={18} color={theme.colors.white} />
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

export default ForwardScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },

  searchWrap: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 44,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
  },
  searchInput: { flex: 1, fontSize: 15, color: theme.colors.textPrimary, padding: 0 },

  list: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 90 },
  listEmpty: { flexGrow: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  rowText: { flex: 1, gap: 3 },
  name: { fontSize: 15, fontWeight: '500', color: theme.colors.textPrimary },
  detail: { fontSize: 12, color: theme.colors.textMuted },

  avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: theme.colors.background },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarInitials: { fontSize: 15, fontWeight: '600', color: theme.colors.textSecondary },
  tick: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 17,
    height: 17,
    borderRadius: 9,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: theme.colors.card,
  },

  sendBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: theme.colors.card,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  sendNames: { flex: 1, fontSize: 14, color: theme.colors.textPrimary },
  sendBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  centeredBox: { alignItems: 'center', paddingTop: 72, paddingHorizontal: 24, gap: 10 },
  errorText: { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  linkText: { fontSize: 14, fontWeight: '600', color: theme.colors.primary },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
