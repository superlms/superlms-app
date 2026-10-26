import React, { useRef, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated from 'react-native-reanimated';
import VectorIcon from '../../components/VectorIcon';
import { AppAlert } from '../../components/AppDialog';
import { useKeyboardLiftStyle } from '../../hooks/useKeyboardLift';
import { theme, onThemeChange } from '../../utils/theme';
import { pickImage } from '../../utils/filePickers';
import { PickedFile } from '../../api/adminProfileApi';
import { SchoolQr, fieldErrorOf, savePaymentQr } from '../../api/adminFeeSetupApi';
import { DocHeader } from '../more/docUi';
import { FormHeading, OutlinedField, SaveButton, SaveState } from '../teacherStudents/outlinedFormUi';
import { useRevealFocused } from './adminProfileUi';
import { FormFoot, Quiet } from './feeSetupUi';

/**
 * Add / Edit Payment QR — the panel's slide-in: the QR image (shown as soon as
 * it is picked; JPG, PNG or WebP, 2 MB at most), the UPI ID and the account
 * name. A saved QR is shown to students in the app at once.
 */

const UPI = /^[A-Za-z0-9._-]{2,256}@[A-Za-z][A-Za-z0-9.-]{1,63}$/;
const TWO_MB = 2 * 1024 * 1024;

const AdminFeePaymentQrFormScreen = ({ navigation, route }: any) => {
  const saved: SchoolQr | null = route.params?.qr ?? null;
  const existing = saved?.qr ?? null;

  const [image, setImage] = useState<PickedFile | null>(null);
  const [upi, setUpi] = useState(existing?.upi_id ?? '');
  const [payee, setPayee] = useState(existing?.payee_name ?? saved?.school_name ?? '');
  const [wrong, setWrong] = useState<{ field: string; message: string } | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const busy = useRef(false);

  const lift = useKeyboardLiftStyle();
  const { ref: scrollRef, scrollProps } = useRevealFocused();
  const errorOf = (f: string) => (wrong?.field === f ? wrong.message : null);

  const stop = (field: string, message: string) => {
    setWrong({ field, message });
    AppAlert.alert('Check the form', message);
  };

  const pick = async () => {
    const f = await pickImage({ maxSide: 1600 });
    if (!f) return;
    if (f.size && f.size > TWO_MB) return stop('image', 'The QR image must be 2 MB or smaller.');
    setImage(f);
    setWrong(null);
  };

  const save = async () => {
    if (busy.current) return;
    if (!existing?.image_url && !image) return stop('image', 'Upload the QR image.');
    if (upi.trim() && !UPI.test(upi.trim())) return stop('upi_id', 'Enter a UPI ID like school@okaxis.');
    setWrong(null);
    busy.current = true;
    setSaveState('saving');
    try {
      const { message } = await savePaymentQr({ image, upi_id: upi, payee_name: payee });
      setSaveState('done');
      AppAlert.alert('Saved', message, [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } catch (e) {
      busy.current = false;
      setSaveState('idle');
      const w = fieldErrorOf(e);
      if (w?.field) stop(w.field, w.message);
      else AppAlert.alert('Not saved', w?.message ?? 'Could not save the QR.');
    }
  };

  const shown = image?.uri ?? existing?.image_url ?? null;

  return (
    <View style={s.root}>
      <DocHeader title={existing ? 'Edit Payment QR' : 'Add Payment QR'} onBackPress={() => navigation.goBack()} />
      <Animated.View style={[s.flex, lift]}>
        <ScrollView ref={scrollRef} contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} {...scrollProps}>
          <Text style={s.intro}>Students see this QR in the app's Fees and pay on it.</Text>

          <FormHeading title="QR Image" first />
          <TouchableOpacity style={[s.drop, !!errorOf('image') && s.dropError]} activeOpacity={0.7} onPress={pick}>
            {shown ? (
              <Image source={{ uri: shown }} style={s.preview} resizeMode="contain" />
            ) : (
              <View style={s.empty}>
                <VectorIcon iconSet="Ionicons" iconName="qr-code-outline" size={30} color={theme.colors.textMuted} />
                <Text style={s.emptyText}>Tap to pick the QR image</Text>
              </View>
            )}
          </TouchableOpacity>
          {errorOf('image') ? (
            <Text style={s.error}>{errorOf('image')}</Text>
          ) : (
            <Quiet>{shown ? 'Tap the QR to pick another. JPG, PNG or WebP, 2 MB at most.' : 'JPG, PNG or WebP, 2 MB at most.'}</Quiet>
          )}

          <FormHeading title="Details" />
          <OutlinedField
            label="UPI ID"
            placeholder="school@okaxis"
            autoCapitalize="none"
            autoCorrect={false}
            value={upi}
            onChangeText={(v: string) => {
              setUpi(v);
              setWrong(null);
            }}
            error={errorOf('upi_id')}
            maxLength={100}
          />
          <OutlinedField
            label="Account name"
            placeholder="The name the UPI app shows"
            value={payee}
            onChangeText={(v: string) => {
              setPayee(v);
              setWrong(null);
            }}
            error={errorOf('payee_name')}
            maxLength={100}
          />
          <View style={s.tail} />
        </ScrollView>
        <FormFoot>
          <SaveButton state={saveState} icon="qr-code-outline" label={existing ? 'Update QR' : 'Save QR'} busyLabel="Saving QR" doneLabel="QR saved" onPress={save} />
        </FormFoot>
      </Animated.View>
    </View>
  );
};

export default AdminFeePaymentQrFormScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  flex: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 16 },
  intro: { fontSize: 13, lineHeight: 19, color: theme.colors.textSecondary },
  drop: {
    marginTop: 14,
    height: 240,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  dropError: { borderColor: theme.colors.danger },
  preview: { width: '100%', height: '100%' },
  empty: { alignItems: 'center', gap: 8 },
  emptyText: { fontSize: 13, color: theme.colors.textMuted },
  error: { fontSize: 12, color: theme.colors.danger, marginTop: 6 },
  tail: { height: 24 },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
