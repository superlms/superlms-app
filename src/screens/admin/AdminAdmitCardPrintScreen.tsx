import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import VectorIcon from '../../components/VectorIcon';
import { AppAlert } from '../../components/AppDialog';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { DocHeader } from '../more/docUi';
import { OptionSheet, PickerCard, SubmitButton } from './adminFormUi';
import {
  AdmitCardLookups,
  PrintableCard,
  getAdmitLookups,
  getPrintableCards,
  printAdmitCards,
} from '../../api/adminAdmitCardApi';

/**
 * Print Admit Cards — the web's Print panel. It starts by saying who you are
 * printing for (exam, class, a section or all), then lists the cards issued
 * there that have not been printed yet, every one ticked; the ones printed
 * before come back only when asked for, as a reprint. Print stamps the ticked
 * cards as printed — so the next run brings only the ones issued since — and
 * opens them four to an A4 sheet.
 *
 * Route params (all optional, from where it was opened): examId, classId, sectionId.
 */

const AdminAdmitCardPrintScreen = ({ navigation, route }: any) => {
  const insets = useSafeAreaInsets();
  const [lookups, setLookups] = useState<AdmitCardLookups | null>(null);
  const [examId, setExamId] = useState<number | null>(route?.params?.examId ?? null);
  const [classId, setClassId] = useState<number | null>(route?.params?.classId ?? null);
  const [sectionId, setSectionId] = useState<number | null>(route?.params?.sectionId ?? null);
  const [includeDone, setIncludeDone] = useState(false);

  const [cards, setCards] = useState<PrintableCard[] | null>(null);
  const [alreadyPrinted, setAlreadyPrinted] = useState(0);
  const [selected, setSelected] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [printing, setPrinting] = useState(false);
  const [sheet, setSheet] = useState<'exam' | 'class' | 'section' | null>(null);

  useEffect(() => {
    getAdmitLookups()
      .then(setLookups)
      .catch(e => setError(apiErr(e, 'Could not load the exams and classes.')));
  }, []);

  const exams = lookups?.exams ?? [];
  const classes = lookups?.classes ?? [];
  const exam = exams.find(e => e.id === examId);
  const cls = classes.find(c => c.id === classId);
  const sections = cls?.sections ?? [];
  const section = sections.find(x => x.id === sectionId);
  const ready = !!examId && !!classId;

  // Any change of the pickers rebuilds the list, and ticks all of it.
  const seq = useRef(0);
  const load = useCallback(async () => {
    const mine = ++seq.current;
    if (!examId || !classId) {
      setCards(null);
      setSelected([]);
      setAlreadyPrinted(0);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const r = await getPrintableCards({
        exam_id: examId,
        standard_id: classId,
        section_id: sectionId,
        include_done: includeDone,
      });
      if (mine !== seq.current) return;
      setCards(r.cards);
      setAlreadyPrinted(r.already_printed);
      setSelected(r.cards.map(c => c.id));
    } catch (e) {
      if (mine === seq.current) setError(apiErr(e, 'Could not load the cards to print.'));
    } finally {
      if (mine === seq.current) setLoading(false);
    }
  }, [examId, classId, sectionId, includeDone]);

  // Back from the sheet, the printed ones have left the list.
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const toggle = (id: number) =>
    setSelected(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));

  const print = async () => {
    if (!examId || !classId) {
      AppAlert.alert('Pick exam & class', 'Choose the exam and class you are printing for.');
      return;
    }
    if (selected.length === 0) {
      AppAlert.alert('Nothing selected', 'Select at least one student to print.');
      return;
    }
    setPrinting(true);
    try {
      const r = await printAdmitCards(selected);
      navigation.navigate('AdminAdmitCardSheet', { ids: r.ids });
    } catch (e) {
      AppAlert.alert('Could not print', apiErr(e, 'The print sheet could not be made.'));
    } finally {
      setPrinting(false);
    }
  };

  const list = cards ?? [];

  const body = () => {
    if (!ready) {
      return <Text style={s.waiting}>Pick an exam and a class to see what is waiting to be printed.</Text>;
    }
    if (loading && !cards) {
      return (
        <View style={s.loadingBox}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      );
    }
    return (
      <>
        <View style={s.countRow}>
          <Text style={s.countText}>
            <Text style={s.countNum}>{list.length}</Text>
            {includeDone ? ' card(s) issued' : ' card(s) not printed yet'}
          </Text>
          <View style={s.links}>
            <TouchableOpacity onPress={() => setSelected(list.map(c => c.id))} hitSlop={8}>
              <Text style={s.link}>Select all</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setSelected([])} hitSlop={8}>
              <Text style={s.linkQuiet}>Clear</Text>
            </TouchableOpacity>
          </View>
        </View>

        {alreadyPrinted > 0 && (
          <View style={s.switchBox}>
            <Text style={s.switchLabel}>{`Include the ${alreadyPrinted} already printed (reprint)`}</Text>
            <Switch
              value={includeDone}
              onValueChange={setIncludeDone}
              trackColor={{ true: theme.colors.primary, false: theme.colors.border }}
              thumbColor={theme.colors.white}
            />
          </View>
        )}

        {list.length === 0 ? (
          <Text style={s.waiting}>Nothing left to print for this class — every issued card has already come out.</Text>
        ) : (
          <View style={s.cardList}>
            {list.map((c, i) => {
              const on = selected.includes(c.id);
              return (
                <TouchableOpacity
                  key={c.id}
                  style={[s.cardRow, i < list.length - 1 && s.cardDivider]}
                  activeOpacity={0.6}
                  onPress={() => toggle(c.id)}
                >
                  <VectorIcon
                    iconSet="Ionicons"
                    iconName={on ? 'checkbox' : 'square-outline'}
                    size={20}
                    color={on ? theme.colors.primary : theme.colors.textMuted}
                  />
                  <View style={s.cardBody}>
                    <Text style={s.cardName} numberOfLines={1}>{c.student_name || '—'}</Text>
                    <Text style={s.cardMeta} numberOfLines={1}>
                      {`Roll ${c.roll_number || '—'} · ${c.admit_card_number ?? ''}`}
                    </Text>
                  </View>
                  {!!c.printed_at && <Text style={s.printed}>PRINTED</Text>}
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </>
    );
  };

  return (
    <View style={s.root}>
      <DocHeader title="Print Admit Cards" onBackPress={() => navigation.goBack()} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        <Text style={s.intro}>Pick the class and section, tick the students — 4 cards to an A4 sheet.</Text>

        <PickerCard
          label="Exam"
          value={exam ? [exam.name, exam.academic_year].filter(Boolean).join(' · ') : null}
          placeholder="Select exam"
          onPress={() => setSheet('exam')}
        />
        <View style={s.pair}>
          <PickerCard
            label="Class"
            value={cls?.name}
            placeholder="Select class"
            onPress={() => setSheet('class')}
            disabled={!examId}
            style={s.half}
          />
          <PickerCard
            label="Section"
            value={section ? section.name : cls ? 'All sections' : null}
            placeholder="All sections"
            onPress={() => setSheet('section')}
            disabled={sections.length === 0}
            style={s.half}
          />
        </View>

        {!!error && <Text style={s.error}>{error}</Text>}

        {body()}
      </ScrollView>

      {/* How many are ticked, and Print */}
      <View style={[s.foot, { paddingBottom: insets.bottom + 12 }]}>
        <Text style={s.footCount}>{`${selected.length} selected`}</Text>
        <View style={s.footBtn}>
          <SubmitButton label="Print" busy={printing} onPress={print} />
        </View>
      </View>

      <OptionSheet
        visible={sheet === 'exam'}
        title="Exam"
        options={exams.map(e => ({ key: String(e.id), label: e.name, sub: e.academic_year ?? undefined }))}
        selected={examId ? [String(examId)] : []}
        onPick={k => setExamId(Number(k))}
        onClose={() => setSheet(null)}
        emptyText="No exams yet — add one under Exams."
      />
      <OptionSheet
        visible={sheet === 'class'}
        title="Class"
        options={classes.map(c => ({ key: String(c.id), label: c.name }))}
        selected={classId ? [String(classId)] : []}
        onPick={k => {
          if (Number(k) !== classId) setSectionId(null);
          setClassId(Number(k));
        }}
        onClose={() => setSheet(null)}
        emptyText="No classes yet."
      />
      <OptionSheet
        visible={sheet === 'section'}
        title="Section"
        options={[
          { key: '0', label: 'All sections' },
          ...sections.map(x => ({ key: String(x.id), label: x.name })),
        ]}
        selected={[String(sectionId ?? 0)]}
        onPick={k => setSectionId(Number(k) || null)}
        onClose={() => setSheet(null)}
      />
    </View>
  );
};

export default AdminAdmitCardPrintScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  scroll: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24, gap: 14 },

  intro: { fontSize: 14, lineHeight: 21, color: theme.colors.textSecondary },
  pair: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
  error: { fontSize: 13, color: theme.colors.danger, lineHeight: 18 },

  waiting: {
    fontSize: 14,
    lineHeight: 20,
    color: theme.colors.textMuted,
    textAlign: 'center',
    paddingVertical: 36,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
  },
  loadingBox: { paddingVertical: 36, alignItems: 'center' },

  // What is waiting
  countRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingTop: 4 },
  countText: { flex: 1, fontSize: 14, color: theme.colors.textSecondary },
  countNum: { fontWeight: '600', color: theme.colors.textPrimary },
  links: { flexDirection: 'row', gap: 16 },
  link: { fontSize: 13, fontWeight: '600', color: theme.colors.primary },
  linkQuiet: { fontSize: 13, color: theme.colors.textMuted },

  switchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: 14,
  },

  switchLabel: { flex: 1, fontSize: 14, color: theme.colors.textPrimary },

  // The cards
  cardList: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: 14,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  cardDivider: { borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  cardBody: { flex: 1, gap: 2 },
  cardName: { fontSize: 15, color: theme.colors.textPrimary },
  cardMeta: { fontSize: 12, color: theme.colors.textMuted },
  printed: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8, color: theme.colors.textMuted },

  // Foot
  foot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.card,
  },
  footCount: { fontSize: 13, color: theme.colors.textSecondary },
  // The button carries the forms' 8px top margin; the row is centred without it.
  footBtn: { flex: 1, marginTop: -8 },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
