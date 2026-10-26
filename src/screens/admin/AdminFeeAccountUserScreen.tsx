import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import AppRefreshControl from '../../components/AppRefreshControl';
import { AppAlert } from '../../components/AppDialog';
import { useFocusLoad } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { AccountUser, deleteAccountUser, getAccountUser, toggleAccountUser } from '../../api/adminFeeSetupApi';
import { DocHeader } from '../more/docUi';
import { Avatar, ErrorBox } from './adminTransportUi';
import { QuietAction, confirmDestructive } from './adminFormUi';
import { CheckCard } from '../teacherStudents/outlinedFormUi';
import { HeadActions, HeadBtn, NumLine, dmy } from './feeSetupUi';

/**
 * One accounts login — the panel's view panel: the photo, name and status,
 * then their details. Active switches the login on or off at once; the pencil
 * edits; Delete removes the login for good.
 */

const AdminFeeAccountUserScreen = ({ navigation, route }: any) => {
  const id: number = route.params.id;
  const [user, setUser] = useState<AccountUser | null>(route.params?.row ?? null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setUser(await getAccountUser(id));
    } catch (e) {
      setError(apiErr(e, 'Could not load the user.'));
    } finally {
      setRefreshing(false);
    }
  }, [id]);

  useFocusLoad(load);

  const toggle = async () => {
    if (!user || toggling) return;
    setToggling(true);
    try {
      const r = await toggleAccountUser(user.id);
      setUser(u => (u ? { ...u, is_active: r.is_active } : u));
    } catch (e) {
      AppAlert.alert('Not changed', apiErr(e, 'Could not change the status.'));
    } finally {
      setToggling(false);
    }
  };

  const remove = () =>
    confirmDestructive('Delete user?', `${user?.name ?? 'This user'} can no longer sign in. This cannot be undone.`, 'Yes, delete', async () => {
      setDeleting(true);
      try {
        const msg = await deleteAccountUser(id);
        AppAlert.alert('Deleted', msg, [{ text: 'OK', onPress: () => navigation.goBack() }]);
      } catch (e) {
        AppAlert.alert('Not deleted', apiErr(e, 'Could not delete the user.'));
      } finally {
        setDeleting(false);
      }
    });

  const facts: [string, string | null | undefined][] = user
    ? [
        ['Email', user.email],
        ['Mobile', user.mobile_number],
        ['Alternate Mobile', user.alternate_mobile],
        ['Designation', user.designation],
        ['Department', user.department],
        ['Employee ID', user.employee_id],
        ['Address', user.address],
        ['Added', user.created_at ? dmy(user.created_at) : null],
      ]
    : [];

  return (
    <View style={s.root}>
      <DocHeader
        title="Accounts user"
        onBackPress={() => navigation.goBack()}
        rightSlot={
          user ? (
            <HeadActions>
              <HeadBtn icon="create-outline" onPress={() => navigation.navigate('AdminFeeAccountUserForm', { user })} />
            </HeadActions>
          ) : undefined
        }
      />
      {error && !user ? (
        <ErrorBox message={error} onRetry={load} />
      ) : (
        <ScrollView
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        >
          {!!user && (
            <>
              <View style={s.who}>
                <Avatar uri={user.image} name={user.name} size={64} />
                <Text style={s.name}>{user.name}</Text>
                <Text style={[s.status, user.is_active ? s.on : s.off]}>{user.is_active ? 'Active' : 'Inactive'}</Text>
              </View>

              <CheckCard
                icon={user.is_active ? 'lock-open-outline' : 'lock-closed-outline'}
                label="Active"
                note={toggling ? 'Saving…' : user.is_active ? 'Can sign in to the accounts panel' : 'Cannot sign in until switched on'}
                value={user.is_active}
                onValueChange={toggle}
              />

              <View style={s.facts}>
                {facts.map(([label, value], i) => (
                  <NumLine key={label} label={label} value={value || '—'} muted={!value} isLast={i === facts.length - 1} />
                ))}
              </View>

              <View style={s.quietAction}>
                <QuietAction icon="trash-2" label="Delete user" danger busy={deleting} onPress={remove} />
              </View>
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
};

export default AdminFeeAccountUserScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  scroll: { paddingHorizontal: 20, paddingBottom: 40 },
  who: { alignItems: 'center', paddingTop: 20, paddingBottom: 6, gap: 6 },
  name: { fontSize: 18, fontWeight: '700', color: theme.colors.textPrimary, marginTop: 6 },
  status: { fontSize: 12, fontWeight: '700', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, overflow: 'hidden' },
  on: { color: '#047857', backgroundColor: '#10B981' + '1F' },
  off: { color: theme.colors.danger, backgroundColor: theme.colors.danger + '14' },
  facts: { marginTop: 14 },
  quietAction: { marginTop: 24, alignItems: 'flex-start' },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
