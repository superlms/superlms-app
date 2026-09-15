import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BackHandler, FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import Header from '../../components/Header';
import VectorIcon from '../../components/VectorIcon';
import { Skeleton } from '../../components/Skeleton';
import { theme, onThemeChange } from '../../utils/theme';
import { DocNoData } from '../more/docUi';
import { type ChatContact, chatErrorMessage, getChatContacts } from '../../api/chatApi';

type DrawerRole = 'student' | 'teacher';

/**
 * Starting a chat, from the + on Chats.
 *
 *  - A student picks one of the teachers who teach their class's subjects.
 *  - A teacher picks a class, then one of its students.
 *
 * The conversation opens in place of this screen, so going back from it lands
 * on Chats, where it now shows once a message has been sent.
 */

interface ClassGroup {
  key: string;
  label: string;
  students: ChatContact[];
}

// "NURSERY · SECTION A"
const classLabel = (c: ChatContact) =>
  [c.standard?.name, c.section?.name].filter(Boolean).join(' · ') || c.subtitle || 'Class';

const classKey = (c: ChatContact) =>
  c.standard || c.section ? `${c.standard?.id ?? 0}-${c.section?.id ?? 0}` : `label:${c.subtitle ?? ''}`;

const initials = (name: string) =>
  name
    .split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

const Avatar = ({ person }: { person: ChatContact }) =>
  person.avatar ? (
    <Image source={{ uri: person.avatar }} style={s.avatar} />
  ) : (
    <View style={[s.avatar, s.avatarFallback]}>
      <Text style={s.avatarInitials}>{initials(person.name)}</Text>
    </View>
  );

const NewChatScreen = ({ navigation, route }: any) => {
  const userRole: DrawerRole = route?.params?.userRole === 'teacher' ? 'teacher' : 'student';
  const isTeacher = userRole === 'teacher';

  const [people, setPeople] = useState<ChatContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // The class a teacher has picked, before picking one of its students.
  const [pickedKey, setPickedKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setPeople(await getChatContacts());
    } catch (e: any) {
      setError(chatErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const classes = useMemo<ClassGroup[]>(() => {
    if (!isTeacher) return [];
    const byKey = new Map<string, ClassGroup>();
    people.forEach(p => {
      const key = classKey(p);
      const group = byKey.get(key) ?? { key, label: classLabel(p), students: [] };
      group.students.push(p);
      byKey.set(key, group);
    });
    return [...byKey.values()].sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
  }, [people, isTeacher]);

  const picked = classes.find(c => c.key === pickedKey) ?? null;

  // The phone's back button steps from a class's students back to the classes.
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        if (!picked) return false;
        setPickedKey(null);
        return true;
      });
      return () => sub.remove();
    }, [picked]),
  );

  const open = (p: ChatContact) =>
    navigation.replace('UserChats', {
      contact: {
        user_id: p.user_id,
        name: p.name,
        avatar: p.avatar,
        subtitle: p.subtitle,
        subjects: p.subjects,
        standard: p.standard,
        section: p.section,
      },
      userRole,
    });

  const title = isTeacher ? (picked ? picked.label : 'Choose a class') : 'Choose a teacher';
  const choosingClass = isTeacher && !picked;
  const list = isTeacher ? picked?.students ?? [] : people;

  const body = () => {
    if (loading) {
      // The rows as they will arrive: a round photo or class icon, a name and a line under it.
      return (
        <View style={s.list}>
          {[0, 1, 2, 3, 4].map(i => (
            <View key={i} style={[s.row, i < 4 && s.rowDivider]}>
              <Skeleton width={choosingClass ? 40 : 46} height={choosingClass ? 40 : 46} radius={choosingClass ? 20 : 23} />
              <View style={s.rowText}>
                <Skeleton width={['52%', '40%', '60%', '46%', '34%'][i]} height={13} />
                <Skeleton width={['30%', '44%', '24%', '36%', '28%'][i]} height={10} />
              </View>
            </View>
          ))}
        </View>
      );
    }

    if (error) {
      return (
        <View style={s.centeredBox}>
          <VectorIcon iconSet="Ionicons" iconName="cloud-offline-outline" size={32} color={theme.colors.textMuted} />
          <Text style={s.errorText}>{error}</Text>
          <TouchableOpacity onPress={load} hitSlop={10}>
            <Text style={s.linkText}>Try again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (choosingClass) {
      return (
        <FlatList
          data={classes}
          keyExtractor={c => c.key}
          contentContainerStyle={[s.list, classes.length === 0 && s.listEmpty]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <DocNoData
              icon="people-outline"
              title="No classes"
              subtitle="No classes are assigned to you in the timetable yet."
            />
          }
          renderItem={({ item, index }) => (
            <TouchableOpacity
              style={[s.row, index < classes.length - 1 && s.rowDivider]}
              activeOpacity={0.6}
              onPress={() => setPickedKey(item.key)}
            >
              <View style={s.classIcon}>
                <VectorIcon iconSet="Ionicons" iconName="people-outline" size={19} color={theme.colors.textSecondary} />
              </View>
              <View style={s.rowText}>
                <Text style={s.name} numberOfLines={1}>
                  {item.label}
                </Text>
                <Text style={s.detail}>
                  {item.students.length} {item.students.length === 1 ? 'student' : 'students'}
                </Text>
              </View>
              <VectorIcon iconSet="Ionicons" iconName="chevron-forward" size={13} color={theme.colors.textMuted} />
            </TouchableOpacity>
          )}
        />
      );
    }

    return (
      <FlatList
        data={list}
        keyExtractor={p => String(p.user_id)}
        contentContainerStyle={[s.list, list.length === 0 && s.listEmpty]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <DocNoData
            icon="chatbubbles-outline"
            title={isTeacher ? 'No students' : 'No teachers yet'}
            subtitle={
              isTeacher
                ? 'There are no students in this class yet.'
                : 'No teachers are assigned to your class subjects yet.'
            }
          />
        }
        renderItem={({ item, index }) => (
          <TouchableOpacity
            style={[s.row, index < list.length - 1 && s.rowDivider]}
            activeOpacity={0.6}
            onPress={() => open(item)}
          >
            <Avatar person={item} />
            <View style={s.rowText}>
              <Text style={s.name} numberOfLines={1}>
                {item.name}
              </Text>
              {!isTeacher && !!item.subtitle && (
                <Text style={s.detail} numberOfLines={1}>
                  {item.subtitle}
                </Text>
              )}
            </View>
            <VectorIcon iconSet="Ionicons" iconName="chevron-forward" size={13} color={theme.colors.textMuted} />
          </TouchableOpacity>
        )}
      />
    );
  };

  return (
    <View style={s.root}>
      <Header
        title={title}
        divider
        height={50}
        onBackPress={() => (picked ? setPickedKey(null) : navigation.goBack())}
      />
      {body()}
    </View>
  );
};

export default NewChatScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },

  list: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 30 },
  listEmpty: { flexGrow: 1 },

  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  rowText: { flex: 1, gap: 4 },
  name: { fontSize: 15, fontWeight: '500', color: theme.colors.textPrimary },
  detail: { fontSize: 12, color: theme.colors.textMuted },

  avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: theme.colors.background },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarInitials: { fontSize: 15, fontWeight: '600', color: theme.colors.textSecondary },
  classIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
  },

  centeredBox: { alignItems: 'center', paddingTop: 72, paddingHorizontal: 24, gap: 10 },
  errorText: { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  linkText: { fontSize: 14, fontWeight: '600', color: theme.colors.primary },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
