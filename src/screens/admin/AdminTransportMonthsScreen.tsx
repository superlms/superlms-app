import React, { useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { AppDialog } from '../../components/AppDialog';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { Months, saveStudentMonths } from '../../api/adminTransportApi';
import { DocHeader } from '../more/docUi';
import { FormError, SubmitButton } from './adminFormUi';
import { formatINR } from './adminTransportUi';

/**
 * Monthly Fee Schedule, as the admin panel has it: a switch for each month of
 * the academic year the student is charged transport for — June is off by
 * default, for the vacation — and the year it comes to, monthly × the months
 * on, as they are switched.
 */

const MONTHS: [string, string][] = [
  ['apr', 'April'],
  ['may', 'May'],
  ['jun', 'June'],
  ['jul', 'July'],
  ['aug', 'August'],
  ['sep', 'September'],
  ['oct', 'October'],
  ['nov', 'November'],
  ['dec', 'December'],
  ['jan', 'January'],
  ['feb', 'February'],
  ['mar', 'March'],
];

// Stored months, with the panel's defaults for any it lacks (June off).
const withDefaults = (m?: Months | null): Months =>
  Object.fromEntries(MONTHS.map(([k]) => [k, m && k in m ? !!m[k] : k !== 'jun']));

const AdminTransportMonthsScreen = ({ navigation, route }: any) => {
  const studentId: number = route?.params?.studentId;
  const routeId: number = route?.params?.routeId;
  const name: string = route?.params?.name ?? 'Student';
  const monthly: number = Number(route?.params?.monthly ?? 0);

  const [months, setMonths] = useState<Months>(() => withDefaults(route?.params?.months));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const on = MONTHS.filter(([k]) => months[k]).length;

  const save = async () => {
    setError('');
    setSaving(true);
    try {
      await saveStudentMonths({ student_detail_id: studentId, transportation_id: routeId, months });
      setSaved(true);
    } catch (e) {
      setError(apiErr(e, 'Could not save the months.'));
    } finally {
      setSaving(false);
    }
  };

  const close = () => {
    setSaved(false);
    navigation.goBack();
  };

  return (
    <View style={s.root}>
      <DocHeader title="Monthly Fee Schedule" onBackPress={() => navigation.goBack()} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        <View style={s.head}>
          <Text style={s.kicker}>{name.toUpperCase()}</Text>
          <Text style={s.title}>{formatINR(monthly * on)}</Text>
          <Text style={s.sub}>
            {formatINR(monthly)} × {on} {on === 1 ? 'month' : 'months'} a year
          </Text>
          <Text style={s.note}>
            Switch on each month the student is charged transport fee for. {on} of 12 on · By default June is off
            (vacation).
          </Text>
        </View>

        <View style={s.rows}>
          {MONTHS.map(([key, label], i) => (
            <View key={key} style={[s.row, i < MONTHS.length - 1 && s.rowDivider]}>
              <Text style={[s.month, !months[key] && s.monthOff]}>{label}</Text>
              <Switch
                value={!!months[key]}
                onValueChange={v => setMonths(prev => ({ ...prev, [key]: v }))}
                trackColor={{ true: theme.colors.primary, false: theme.colors.border }}
                thumbColor={theme.colors.white}
              />
            </View>
          ))}
        </View>

        <View style={s.foot}>
          <FormError>{error}</FormError>
          <SubmitButton label="Save months" busy={saving} onPress={save} />
        </View>
      </ScrollView>

      <AppDialog
        visible={saved}
        title="Saved"
        message="Monthly fee schedule updated."
        actions={[{ text: 'Done', onPress: close }]}
        onRequestClose={close}
      />
    </View>
  );
};

export default AdminTransportMonthsScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  scroll: { paddingBottom: 40 },

  head: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12 },
  kicker: { fontSize: 11, fontWeight: '600', letterSpacing: 1, color: theme.colors.textMuted },
  title: { fontSize: 32, fontWeight: '700', color: theme.colors.textPrimary, marginTop: 4, lineHeight: 40 },
  sub: { fontSize: 13, color: theme.colors.textSecondary, marginTop: 2 },
  note: { fontSize: 12, color: theme.colors.textMuted, marginTop: 10, lineHeight: 17 },

  rows: { paddingHorizontal: 20 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 },
  rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },
  month: { fontSize: 15, color: theme.colors.textPrimary },
  monthOff: { color: theme.colors.textMuted },

  foot: { paddingHorizontal: 20, paddingTop: 16, gap: 8 },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
