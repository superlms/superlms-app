import React, { useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { AppAlert } from '../../components/AppDialog';
import { useKeyboardLiftStyle } from '../../hooks/useKeyboardLift';
import { theme, onThemeChange } from '../../utils/theme';
import { RouteStructure, fieldErrorOf, plainNumber, saveRouteFee } from '../../api/adminFeeSetupApi';
import { DocHeader } from '../more/docUi';
import { CheckCard, FormHeading, OutlinedField, SaveButton, SaveState } from '../teacherStudents/outlinedFormUi';
import { useRevealFocused } from './adminProfileUi';
import { FormFoot, Quiet, rupees } from './feeSetupUi';

/**
 * Edit Route Fee — the panel's route panel on the Transport tab: the route's
 * name, its monthly fee (every month but June), the pickup time and whether it
 * runs. The year's fee under it moves as the monthly fee is typed.
 */

const AdminFeeRouteFormScreen = ({ navigation, route: nav }: any) => {
  const route: RouteStructure = nav.params.route;
  const [name, setName] = useState(route.name);
  const [fee, setFee] = useState(plainNumber(route.monthly_fee));
  const [pickup, setPickup] = useState(route.pickup_time ?? '');
  const [active, setActive] = useState(route.is_active);
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

  const save = async () => {
    if (busy.current) return;
    if (!name.trim()) return stop('name', 'Enter the route name.');
    if (fee.trim() === '' || isNaN(Number(fee))) return stop('monthly_fee', 'Enter the monthly fee.');
    setWrong(null);
    busy.current = true;
    setSaveState('saving');
    try {
      const msg = await saveRouteFee(route.id, { name: name.trim(), monthly_fee: fee.trim(), pickup_time: pickup.trim(), is_active: active });
      setSaveState('done');
      AppAlert.alert('Saved', msg, [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } catch (e) {
      busy.current = false;
      setSaveState('idle');
      const w = fieldErrorOf(e);
      if (w?.field) stop(w.field, w.message);
      else AppAlert.alert('Not saved', w?.message ?? 'Could not save the route.');
    }
  };

  const monthly = Number(fee) || 0;

  return (
    <View style={s.root}>
      <DocHeader title="Edit Route Fee" onBackPress={() => navigation.goBack()} />
      <Animated.View style={[s.flex, lift]}>
        <ScrollView ref={scrollRef} contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} {...scrollProps}>
          <Text style={s.intro}>Every month costs the monthly fee except June, which is free.</Text>

          <FormHeading title="Route" first />
          <OutlinedField
            required
            label="Route Name"
            value={name}
            onChangeText={(v: string) => {
              setName(v);
              setWrong(null);
            }}
            error={errorOf('name')}
            maxLength={255}
          />
          <OutlinedField
            required
            label="Monthly Fee (₹)"
            keyboardType="decimal-pad"
            value={fee}
            onChangeText={(v: string) => {
              setFee(v.replace(/[^0-9.]/g, ''));
              setWrong(null);
            }}
            error={errorOf('monthly_fee')}
          />
          <Quiet>{`${rupees(monthly)} × 11 billable months = ${rupees(monthly * 11)} a year`}</Quiet>
          <OutlinedField
            label="Pickup Time"
            placeholder="e.g. 07:30"
            value={pickup}
            onChangeText={setPickup}
            error={errorOf('pickup_time')}
            maxLength={20}
          />
          <CheckCard icon="bus-outline" label="Active" note="An inactive route is kept but not run." value={active} onValueChange={setActive} />
          <View style={s.tail} />
        </ScrollView>
        <FormFoot>
          <SaveButton state={saveState} icon="checkmark-circle-outline" label="Save Route Fee" busyLabel="Saving route" doneLabel="Route saved" onPress={save} />
        </FormFoot>
      </Animated.View>
    </View>
  );
};

export default AdminFeeRouteFormScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  flex: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 16 },
  intro: { fontSize: 13, lineHeight: 19, color: theme.colors.textSecondary },
  tail: { height: 24 },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
