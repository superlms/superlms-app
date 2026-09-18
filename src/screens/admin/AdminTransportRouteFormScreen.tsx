import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { AppDialog } from '../../components/AppDialog';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { RouteGroup, saveRouteGroup } from '../../api/adminTransportApi';
import { DocHeader } from '../more/docUi';
import {
  ChipChoices,
  FieldLabel,
  FormCard,
  FormError,
  Hint,
  PickerCard,
  SubmitButton,
  SwitchRow,
  TimeSheet,
  clock12,
  toHHmm,
} from './adminFormUi';
import { VEHICLE_TYPES } from './adminTransportUi';

/**
 * A new route, or one being edited, as the admin panel's route form has it:
 * its name, the vehicle types it runs (a route row is made for each, so a
 * driver can be set per type), pickup and drop times, the monthly fee,
 * capacity, and whether it runs. The driver is set from the Driver form.
 * Unticking a type on an edit drops that vehicle unless students still ride it.
 */

const AdminTransportRouteFormScreen = ({ navigation, route }: any) => {
  const item: RouteGroup | undefined = route?.params?.item;
  const isEdit = !!item;

  const [name, setName] = useState(item?.route_name ?? '');
  const [types, setTypes] = useState<string[]>(item?.vehicle_types ?? []);
  const [pickup, setPickup] = useState(toHHmm(item?.pickup_time));
  const [drop, setDrop] = useState(toHHmm(item?.drop_time));
  const [fee, setFee] = useState(item ? String(item.monthly_fee ?? 0) : '');
  const [capacity, setCapacity] = useState(item ? String(item.capacity ?? 0) : '');
  const [active, setActive] = useState(item ? item.is_active : true);

  const [timeOpen, setTimeOpen] = useState<'pickup' | 'drop' | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');

  const toggleType = (t: string) => {
    setTypes(prev => (prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]));
    setError('');
  };

  const save = async () => {
    if (!name.trim()) {
      setError('Enter a route name.');
      return;
    }
    if (types.length === 0) {
      setError('Pick at least one vehicle type.');
      return;
    }
    const feeNum = fee.trim() ? Number(fee) : 0;
    const capNum = capacity.trim() ? Number(capacity) : 0;
    if (!Number.isFinite(feeNum) || feeNum < 0) {
      setError('Enter the monthly fee as a number.');
      return;
    }
    if (!Number.isInteger(capNum) || capNum < 0 || capNum > 1000) {
      setError('Capacity must be a whole number up to 1000.');
      return;
    }

    setError('');
    setSaving(true);
    try {
      const res = await saveRouteGroup(item?.key ?? null, {
        route_name: name.trim(),
        // In the panel's order.
        vehicle_types: VEHICLE_TYPES.filter(t => types.includes(t)).concat(types.filter(t => !VEHICLE_TYPES.includes(t))),
        pickup_time: pickup || null,
        drop_time: drop || null,
        monthly_fee: feeNum,
        capacity: capNum,
        is_active: active,
      });
      setSavedMsg(res.message || (isEdit ? 'Route updated' : 'Route created'));
    } catch (e) {
      setError(apiErr(e, 'Could not save route.'));
    } finally {
      setSaving(false);
    }
  };

  const closeSaved = () => {
    setSavedMsg('');
    navigation.goBack();
  };

  return (
    <View style={s.root}>
      <DocHeader title={isEdit ? 'Edit Route' : 'Add Route'} onBackPress={() => navigation.goBack()} />

      <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <FormCard
            label="Route name"
            value={name}
            onChangeText={t => {
              setName(t);
              setError('');
            }}
            placeholder="e.g. Route 1 — North Zone"
            maxLength={255}
          />

          <View style={s.group}>
            <FieldLabel>Vehicle types</FieldLabel>
            <ChipChoices
              options={VEHICLE_TYPES.map(t => ({ key: t, label: t }))}
              selected={types}
              onToggle={toggleType}
            />
            <Hint>
              {types.length > 1
                ? `${types.length} routes will be created — one per vehicle type. The list shows them as a single route, and a driver is assigned to each type separately.`
                : 'Pick more than one to run this route with several vehicle types.'}
            </Hint>
          </View>

          <View style={s.pair}>
            <PickerCard
              label="Pickup time"
              value={pickup ? clock12(pickup) : null}
              icon="time-outline"
              onPress={() => setTimeOpen('pickup')}
              style={s.flex}
            />
            <PickerCard
              label="Drop time"
              value={drop ? clock12(drop) : null}
              icon="time-outline"
              onPress={() => setTimeOpen('drop')}
              style={s.flex}
            />
          </View>

          <View style={s.pair}>
            <FormCard
              label="Monthly fee (₹)"
              value={fee}
              onChangeText={t => {
                setFee(t.replace(/[^0-9.]/g, ''));
                setError('');
              }}
              placeholder="0"
              keyboardType="decimal-pad"
              maxLength={10}
              style={s.flex}
            />
            <FormCard
              label="Capacity"
              value={capacity}
              onChangeText={t => {
                setCapacity(t.replace(/[^0-9]/g, ''));
                setError('');
              }}
              placeholder="0"
              keyboardType="number-pad"
              maxLength={4}
              style={s.flex}
            />
          </View>
          {!!Number(fee) && (
            <Hint>
              {`₹${Number(fee).toLocaleString('en-IN')} a month comes to ₹${(Number(fee) * 11).toLocaleString('en-IN')} a year (11 months — June off).`}
            </Hint>
          )}

          <Hint>Assign a driver to this route from the Driver form.</Hint>

          <SwitchRow label="Active route" value={active} onValueChange={setActive} />

          <FormError>{error}</FormError>

          <SubmitButton label={isEdit ? 'Update Route' : 'Add Route'} busy={saving} onPress={save} />
        </ScrollView>
      </KeyboardAvoidingView>

      <TimeSheet
        visible={!!timeOpen}
        value={timeOpen === 'drop' ? drop : pickup}
        title={timeOpen === 'drop' ? 'Drop time' : 'Pickup time'}
        onPick={t => (timeOpen === 'drop' ? setDrop(t) : setPickup(t))}
        onClose={() => setTimeOpen(null)}
      />

      <AppDialog
        visible={!!savedMsg}
        title={isEdit ? 'Route updated' : 'Route added'}
        message={savedMsg}
        actions={[{ text: 'Done', onPress: closeSaved }]}
        onRequestClose={closeSaved}
      />
    </View>
  );
};

export default AdminTransportRouteFormScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  flex: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40, gap: 14 },
  group: { gap: 8 },
  pair: { flexDirection: 'row', gap: 12 },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
