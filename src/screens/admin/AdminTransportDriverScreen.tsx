import React, { useCallback, useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { HeaderIconButton } from '../../components/Header';
import AppRefreshControl from '../../components/AppRefreshControl';
import { AppAlert } from '../../components/AppDialog';
import { useRefresh, useFocusLoad } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { DriverRow, deleteDriver, getDriver, toggleDriver } from '../../api/adminTransportApi';
import { DocHeader } from '../more/docUi';
import { QuietAction, confirmDestructive } from './adminFormUi';
import { Avatar, ErrorBox, InfoRow, Section } from './adminTransportUi';

/**
 * One driver, drawn as the Driver block of a student's My Route page — the
 * photo and name, then what the admin panel's driver view lists: phone (tap to
 * call), email, licence and vehicle numbers, experience, address, the routes
 * they drive and whether they are active. The pencil edits them; they can be
 * switched off and on, or deleted with their login.
 */

const AdminTransportDriverScreen = ({ navigation, route }: any) => {
  const id: number = route?.params?.id;
  const [item, setItem] = useState<DriverRow | null>(route?.params?.item ?? null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'toggle' | 'delete' | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setItem(await getDriver(id));
    } catch (e) {
      setError(apiErr(e, 'Could not load this driver.'));
    }
  }, [id]);

  useFocusLoad(load);
  const { refreshing, onRefresh } = useRefresh(load);

  const toggle = async () => {
    setBusy('toggle');
    try {
      await toggleDriver(id);
      await load();
    } catch (e) {
      AppAlert.alert('Could not change status', apiErr(e, 'Please try again.'));
    } finally {
      setBusy(null);
    }
  };

  const remove = () =>
    confirmDestructive(
      'Delete driver?',
      'Removes the driver and their login. Assigned routes will have no driver.',
      'Delete',
      async () => {
        setBusy('delete');
        try {
          await deleteDriver(id);
          navigation.goBack();
        } catch (e) {
          AppAlert.alert('Could not delete', apiErr(e, 'Please try again.'));
        } finally {
          setBusy(null);
        }
      },
    );

  if (!item) {
    return (
      <View style={s.root}>
        <DocHeader title="Driver" onBackPress={() => navigation.goBack()} />
        {!!error && <ErrorBox message={error} onRetry={load} />}
      </View>
    );
  }

  const call = item.phone ? () => Linking.openURL(`tel:${item.phone}`) : undefined;
  const mail = item.email ? () => Linking.openURL(`mailto:${item.email}`) : undefined;

  const rows = [
    ['Phone', item.phone || 'N/A', call],
    ['Email', item.email || 'N/A', mail],
    ['License No.', item.license_no || 'N/A', undefined],
    ['Vehicle No.', item.vehicle_no || 'N/A', undefined],
    ['Experience', `${item.experience_years || 0} years`, undefined],
    ['Address', item.address || 'N/A', undefined],
    ['Status', item.is_active ? 'Active' : 'Inactive', undefined],
  ] as [string, string, (() => void) | undefined][];

  return (
    <View style={s.root}>
      <DocHeader
        title="Driver"
        onBackPress={() => navigation.goBack()}
        rightSlot={
          <HeaderIconButton icon="create-outline" onPress={() => navigation.navigate('AdminTransportDriverForm', { item })} />
        }
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
        refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Who they are */}
        <View style={s.head}>
          <Avatar uri={item.image} name={item.name} size={56} />
          <View style={s.headBody}>
            <Text style={s.name} numberOfLines={2}>
              {item.name}
            </Text>
            <Text style={s.role}>{call ? 'Driver · tap the number to call' : 'Driver'}</Text>
          </View>
        </View>

        <View style={s.rows}>
          {rows.map(([label, value, onPress], i) => (
            <InfoRow
              key={label}
              label={label}
              value={value}
              onPress={value !== 'N/A' ? onPress : undefined}
              tone={label === 'Status' && !item.is_active ? 'due' : undefined}
              last={i === rows.length - 1}
            />
          ))}
        </View>

        <Section title="Routes">
          {item.routes.length === 0 ? (
            <Text style={s.none}>No route assigned. Pick routes in the driver form.</Text>
          ) : (
            item.routes.map((r, i) => (
              <InfoRow
                key={r.id}
                label={r.name}
                value={r.vehicle_type || '—'}
                last={i === item.routes.length - 1}
              />
            ))
          )}
        </Section>

        <View style={s.divider} />
        <View style={s.actions}>
          <QuietAction
            icon={item.is_active ? 'pause-circle' : 'play-circle'}
            label={item.is_active ? 'Mark driver inactive' : 'Mark driver active'}
            busy={busy === 'toggle'}
            onPress={toggle}
          />
          <QuietAction icon="trash-2" label="Delete driver" danger busy={busy === 'delete'} onPress={remove} />
        </View>
      </ScrollView>
    </View>
  );
};

export default AdminTransportDriverScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  scroll: { paddingBottom: 40 },

  head: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12 },
  headBody: { flex: 1, gap: 3 },
  name: { fontSize: 20, fontWeight: '700', color: theme.colors.textPrimary },
  role: { fontSize: 13, color: theme.colors.textMuted },

  rows: { paddingHorizontal: 20, paddingBottom: 6 },
  none: { fontSize: 14, color: theme.colors.textMuted, paddingVertical: 12 },

  divider: { height: StyleSheet.hairlineWidth, backgroundColor: theme.colors.border },
  actions: { paddingHorizontal: 20, paddingTop: 20, gap: 22 },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
