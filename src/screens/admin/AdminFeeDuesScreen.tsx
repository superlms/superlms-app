import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Animated from 'react-native-reanimated';
import VectorIcon from '../../components/VectorIcon';
import { AppAlert } from '../../components/AppDialog';
import { useKeyboardLiftStyle } from '../../hooks/useKeyboardLift';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { DuesExtra, DuesStudent, fieldErrorOf, getDues, saveDues } from '../../api/adminFeeSetupApi';
import { DocHeader } from '../more/docUi';
import { SaveButton, SaveState } from '../teacherStudents/outlinedFormUi';
import { useRevealFocused } from './adminProfileUi';
import { ErrorBox, ListSkeleton } from './adminTransportUi';
import { ClassPills, useFeeClasses } from './adminFeeUi';
import { Band, FormFoot, Prompt, RemoveButton, Strip, plural, rupees } from './feeSetupUi';

/**
 * Add Dues — the panel's panel: what each student still owed from last year.
 * Pick a class (and a section, to narrow the list) and its students come up,
 * each with a box for the amount; what is entered becomes that student's own
 * fee particular, "Last Year Dues", so their fee is the class's structure plus
 * it. Emptying a box takes the dues away again.
 *
 * The + beside a box adds an earlier year's fee for that student — its own
 * name ("2023-24 Fee") and amount — and × takes one away. Save keeps the whole
 * class as it stands, the section on screen and the rest alike.
 */

const AdminFeeDuesScreen = ({ navigation, route }: any) => {
  const classes = useFeeClasses();
  const [classId, setClassId] = useState<number | null>(route.params?.classId ?? null);
  const [sectionId, setSectionId] = useState<number | null>(route.params?.sectionId ?? null);

  const [students, setStudents] = useState<DuesStudent[] | null>(null);
  const [amounts, setAmounts] = useState<Record<number, string>>({});
  const [extras, setExtras] = useState<Record<number, DuesExtra[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [wrong, setWrong] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const busy = useRef(false);
  const seq = useRef(0);

  const lift = useKeyboardLiftStyle();
  const { ref: scrollRef, scrollProps } = useRevealFocused();

  // Another class: its students, with what is saved for them. (What was typed
  // for this class stays while a section only narrows the list.)
  useEffect(() => {
    const mine = ++seq.current;
    setStudents(null);
    setError(null);
    if (!classId) return;
    getDues(classId, sectionId)
      .then(d => {
        if (mine !== seq.current) return;
        setStudents(d.students);
        setAmounts(prev => {
          const next = { ...prev };
          d.students.forEach(st => {
            if (next[st.id] === undefined) next[st.id] = st.amount;
          });
          return next;
        });
        setExtras(prev => {
          const next = { ...prev };
          d.students.forEach(st => {
            if (next[st.id] === undefined) next[st.id] = st.extras;
          });
          return next;
        });
      })
      .catch(e => mine === seq.current && setError(apiErr(e, 'Could not load the students.')));
  }, [classId, sectionId, reload]);

  const list = useMemo(() => students ?? [], [students]);
  const total = useMemo(
    () =>
      list.reduce(
        (sum, st) =>
          sum + (Number(amounts[st.id]) || 0) + (extras[st.id] ?? []).reduce((x, e) => x + (Number(e.amount) || 0), 0),
        0,
      ),
    [list, amounts, extras],
  );

  const setExtra = (id: number, i: number, key: 'name' | 'amount', v: string) => {
    setExtras(prev => ({ ...prev, [id]: (prev[id] ?? []).map((e, n) => (n === i ? { ...e, [key]: v } : e)) }));
    setWrong(null);
  };

  const save = async () => {
    if (busy.current || !classId) return;
    // An earlier year's fee needs both its name and its amount.
    for (const st of list) {
      for (const [i, e] of (extras[st.id] ?? []).entries()) {
        if (e.name.trim() && !e.amount.trim()) {
          setWrong(`extras.${st.id}.${i}.amount`);
          return AppAlert.alert('Check the form', `${st.name}: enter an amount for ${e.name.trim()}.`);
        }
        if (!e.name.trim() && e.amount.trim()) {
          setWrong(`extras.${st.id}.${i}.name`);
          return AppAlert.alert('Check the form', `${st.name}: enter the fee name.`);
        }
      }
    }

    busy.current = true;
    setSaveState('saving');
    try {
      const msg = await saveDues(classId, amounts, extras);
      setSaveState('done');
      AppAlert.alert('Saved', msg, [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } catch (e) {
      busy.current = false;
      setSaveState('idle');
      const w = fieldErrorOf(e);
      if (w?.field) setWrong(w.field);
      AppAlert.alert('Not saved', w?.message ?? 'Could not save the dues.');
    }
  };

  const body = () => {
    if (!classId) return <Prompt icon="people-outline" title="Select a class" sub="Its students come up, each with a box for what they still owe from last year." />;
    if (error && !students) return <ErrorBox message={error} onRetry={() => setReload(n => n + 1)} />;
    if (!students) return <ListSkeleton rows={7} />;
    if (list.length === 0) return <Prompt icon="people-outline" title="No students" sub="This class has no students yet." />;
    return list.map((st, i) => (
      <View key={st.id} style={[s.student, i < list.length - 1 && s.divider]}>
        <View style={s.studentHead}>
          <View style={s.studentBody}>
            <Text style={s.name} numberOfLines={1}>{st.name}</Text>
            <Text style={s.meta} numberOfLines={1}>
              {[st.admission_no ? `Adm ${st.admission_no}` : null, st.section ? `Section ${st.section}` : null].filter(Boolean).join(' · ')}
            </Text>
          </View>
          <View style={[s.box, wrong === `amounts.${st.id}` && s.boxError]}>
            <Text style={s.rupee}>₹</Text>
            <TextInput
              style={s.input}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={theme.colors.textMuted}
              value={amounts[st.id] ?? ''}
              onChangeText={v => {
                setAmounts(prev => ({ ...prev, [st.id]: v.replace(/[^0-9.]/g, '') }));
                setWrong(null);
              }}
            />
          </View>
          <TouchableOpacity
            style={s.plus}
            hitSlop={6}
            activeOpacity={0.6}
            accessibilityLabel="Add an earlier year's fee"
            onPress={() => setExtras(prev => ({ ...prev, [st.id]: [...(prev[st.id] ?? []), { id: null, name: '', amount: '' }] }))}
          >
            <VectorIcon iconSet="Ionicons" iconName="add" size={18} color={theme.colors.primary} />
          </TouchableOpacity>
        </View>
        {(extras[st.id] ?? []).map((e, n) => (
          <View key={`${st.id}-${n}`} style={s.extra}>
            <TextInput
              style={[s.extraName, wrong === `extras.${st.id}.${n}.name` && s.boxError]}
              placeholder="e.g. 2023-24 Fee"
              placeholderTextColor={theme.colors.textMuted}
              value={e.name}
              onChangeText={v => setExtra(st.id, n, 'name', v)}
              maxLength={255}
            />
            <View style={[s.box, s.extraBox, wrong === `extras.${st.id}.${n}.amount` && s.boxError]}>
              <Text style={s.rupee}>₹</Text>
              <TextInput
                style={s.input}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={theme.colors.textMuted}
                value={e.amount}
                onChangeText={v => setExtra(st.id, n, 'amount', v.replace(/[^0-9.]/g, ''))}
              />
            </View>
            <RemoveButton onPress={() => setExtras(prev => ({ ...prev, [st.id]: (prev[st.id] ?? []).filter((_, k) => k !== n) }))} />
          </View>
        ))}
      </View>
    ));
  };

  return (
    <View style={s.root}>
      <DocHeader title="Add Dues" onBackPress={() => navigation.goBack()} />
      <Band note="Each student's Last Year Dues — their fee is the class's structure plus it. + adds an earlier year's fee.">
        <ClassPills
          classes={classes}
          classId={classId}
          sectionId={sectionId}
          allLabel="Select Class"
          onChange={(c, sec) => {
            if (c !== classId) {
              setAmounts({});
              setExtras({});
            }
            setClassId(c);
            setSectionId(sec);
          }}
        />
      </Band>
      <Animated.View style={[s.flex, lift]}>
        <ScrollView ref={scrollRef} contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} {...scrollProps}>
          {!!students && list.length > 0 && <Strip items={[{ label: 'Students', value: list.length }, { label: 'Total', value: rupees(total) }]} />}
          {body()}
        </ScrollView>
        {!!classId && !!students && list.length > 0 && (
          <FormFoot>
            <SaveButton
              state={saveState}
              icon="checkmark-circle-outline"
              label={`Save Dues · ${plural(list.length, 'student')}`}
              busyLabel="Saving dues"
              doneLabel="Dues saved"
              onPress={save}
            />
          </FormFoot>
        )}
      </Animated.View>
    </View>
  );
};

export default AdminFeeDuesScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  flex: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingBottom: 32 },

  student: { paddingVertical: 12 },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },
  studentHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  studentBody: { flex: 1, gap: 2 },
  name: { fontSize: 15, fontWeight: '500', color: theme.colors.textPrimary },
  meta: { fontSize: 12, color: theme.colors.textMuted },

  box: {
    width: 110,
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
  },
  boxError: { borderColor: theme.colors.danger },
  rupee: { fontSize: 14, color: theme.colors.textMuted },
  input: { flex: 1, fontSize: 14, color: theme.colors.textPrimary, padding: 0 },
  plus: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primaryLight,
  },

  extra: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, paddingLeft: 12 },
  extraName: {
    flex: 1,
    height: 40,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    fontSize: 14,
    color: theme.colors.textPrimary,
  },
  extraBox: { width: 100 },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
