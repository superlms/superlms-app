import React, { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { AppDialog } from '../../components/AppDialog';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr, pickImage } from '../../utils/filePickers';
import { PickedFile } from '../../api/adminProfileApi';
import { DriverRow, RouteOption, getRouteOptions, routeLabel, saveDriver } from '../../api/adminTransportApi';
import { DocHeader } from '../more/docUi';
import {
  FormCard,
  FormError,
  Hint,
  OptionSheet,
  PickerCard,
  SubmitButton,
  SwitchRow,
  withinOneMb,
} from './adminFormUi';
import { Avatar } from './adminTransportUi';

/**
 * A new driver, or one being edited, as the admin panel's driver form has it:
 * a photo of up to 1 MB, the name and a 10-digit mobile number, an email only
 * if they have one, licence and vehicle numbers, years of experience, the
 * address, and the routes they drive — each vehicle type of a route on its
 * own. A new driver signs in with 123456; an edit can switch them off.
 */

const MOBILE = /^[6-9]\d{9}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const AdminTransportDriverFormScreen = ({ navigation, route }: any) => {
  const item: DriverRow | undefined = route?.params?.item;
  const isEdit = !!item;

  const [name, setName] = useState(item?.name ?? '');
  const [email, setEmail] = useState(item?.email ?? '');
  const [phone, setPhone] = useState(item?.phone ?? '');
  const [license, setLicense] = useState(item?.license_no ?? '');
  const [vehicleNo, setVehicleNo] = useState(item?.vehicle_no ?? '');
  const [experience, setExperience] = useState(item ? String(item.experience_years ?? 0) : '');
  const [address, setAddress] = useState(item?.address ?? '');
  const [active, setActive] = useState(item ? item.is_active : true);
  const [routeIds, setRouteIds] = useState<number[]>(item?.routes.map(r => r.id) ?? []);
  const [photo, setPhoto] = useState<PickedFile | null>(null);

  const [options, setOptions] = useState<RouteOption[]>([]);
  const [routesOpen, setRoutesOpen] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');

  const phoneRef = useRef<TextInput>(null);

  useEffect(() => {
    getRouteOptions().then(setOptions).catch(() => {});
  }, []);

  const choosePhoto = async () => {
    const f = await pickImage();
    if (f && withinOneMb(f, 'Photo')) setPhoto(f);
  };

  const toggleRoute = (key: string) => {
    const id = Number(key);
    setRouteIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  };

  const save = async () => {
    if (!name.trim()) {
      setError('Enter the driver’s name.');
      return;
    }
    if (!phone.trim()) {
      setError('Mobile number is required.');
      return;
    }
    if (!MOBILE.test(phone.trim())) {
      setError('Enter a valid 10-digit mobile number.');
      return;
    }
    if (email.trim() && !EMAIL.test(email.trim())) {
      setError('Enter a valid email, or leave it empty.');
      return;
    }
    const years = experience.trim() ? Number(experience) : 0;
    if (!Number.isInteger(years) || years < 0 || years > 50) {
      setError('Experience must be between 0 and 50 years.');
      return;
    }

    setError('');
    setSaving(true);
    try {
      await saveDriver(item?.id ?? null, {
        name: name.trim(),
        email: email.trim() || undefined,
        phone: phone.trim(),
        license_no: license.trim() || null,
        vehicle_no: vehicleNo.trim() || null,
        address: address.trim() || null,
        experience_years: years,
        is_active: active,
        routes: routeIds,
        image: photo,
      });
      setSavedMsg(isEdit ? 'The driver has been updated.' : 'The driver has been added. They sign in with the password 123456.');
    } catch (e) {
      setError(apiErr(e, 'Could not save driver.'));
    } finally {
      setSaving(false);
    }
  };

  const closeSaved = () => {
    setSavedMsg('');
    navigation.goBack();
  };

  const picked = options.filter(o => routeIds.includes(o.id));
  // Before the options arrive, the driver's own routes name themselves.
  const routesValue = picked.length
    ? picked.map(routeLabel).join(', ')
    : item?.routes.filter(r => routeIds.includes(r.id)).map(r => r.label ?? r.name).join(', ') || null;

  return (
    <View style={s.root}>
      <DocHeader title={isEdit ? 'Edit Driver' : 'Add Driver'} onBackPress={() => navigation.goBack()} />

      <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {/* Photo */}
          <TouchableOpacity style={s.photoRow} activeOpacity={0.7} onPress={choosePhoto}>
            <Avatar uri={photo?.uri ?? item?.image} name={name || 'Driver'} size={56} />
            <View style={s.photoBody}>
              <Text style={s.photoTitle}>{photo || item?.image ? 'Change photo' : 'Add a photo'}</Text>
              <Text style={s.photoHint}>JPG or PNG · max 1 MB</Text>
            </View>
          </TouchableOpacity>

          <FormCard
            label="Name"
            value={name}
            onChangeText={t => {
              setName(t);
              setError('');
            }}
            placeholder="Driver’s full name"
            maxLength={255}
            returnKeyType="next"
            onSubmitEditing={() => phoneRef.current?.focus()}
          />
          <FormCard
            label="Phone"
            inputRef={phoneRef}
            value={phone}
            onChangeText={t => {
              setPhone(t.replace(/[^0-9]/g, ''));
              setError('');
            }}
            placeholder="10-digit mobile"
            keyboardType="phone-pad"
            maxLength={10}
          />
          <FormCard
            label="Email (optional)"
            value={email}
            onChangeText={t => {
              setEmail(t);
              setError('');
            }}
            placeholder="driver@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            maxLength={255}
          />
          <View style={s.pair}>
            <FormCard
              label="License No."
              value={license}
              onChangeText={setLicense}
              autoCapitalize="characters"
              maxLength={50}
              style={s.flex}
            />
            <FormCard
              label="Vehicle No."
              value={vehicleNo}
              onChangeText={setVehicleNo}
              autoCapitalize="characters"
              maxLength={30}
              style={s.flex}
            />
          </View>
          <FormCard
            label="Experience (yrs)"
            value={experience}
            onChangeText={t => setExperience(t.replace(/[^0-9]/g, ''))}
            placeholder="0"
            keyboardType="number-pad"
            maxLength={2}
          />
          <FormCard
            label="Address"
            value={address}
            onChangeText={setAddress}
            multiline
            minHeight={70}
            maxLength={500}
          />

          <View style={s.group}>
            <PickerCard
              label="Assign routes"
              value={routesValue}
              placeholder="No route"
              onPress={() => setRoutesOpen(true)}
            />
            <Hint>Each vehicle type of a route is assigned on its own. A route left unticked here has no driver.</Hint>
          </View>

          {isEdit && <SwitchRow label="Active" value={active} onValueChange={setActive} />}
          {!isEdit && <Hint>The driver signs in with the password 123456.</Hint>}

          <FormError>{error}</FormError>

          <SubmitButton label={isEdit ? 'Update Driver' : 'Add Driver'} busy={saving} onPress={save} />
        </ScrollView>
      </KeyboardAvoidingView>

      <OptionSheet
        visible={routesOpen}
        title="Assign routes"
        multi
        options={options.map(o => ({ key: String(o.id), label: routeLabel(o), sub: o.is_active === false ? 'Inactive' : undefined }))}
        selected={routeIds.map(String)}
        onPick={toggleRoute}
        onClose={() => setRoutesOpen(false)}
        emptyText="No routes yet. Add a route first."
      />

      <AppDialog
        visible={!!savedMsg}
        title={isEdit ? 'Driver updated' : 'Driver added'}
        message={savedMsg}
        actions={[{ text: 'Done', onPress: closeSaved }]}
        onRequestClose={closeSaved}
      />
    </View>
  );
};

export default AdminTransportDriverFormScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  flex: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40, gap: 14 },
  group: { gap: 8 },
  pair: { flexDirection: 'row', gap: 12 },

  photoRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 4 },
  photoBody: { flex: 1, gap: 2 },
  photoTitle: { fontSize: 15, fontWeight: '600', color: theme.colors.primary },
  photoHint: { fontSize: 12, color: theme.colors.textMuted },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
