import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import VectorIcon from '../../components/VectorIcon';
import Header from '../../components/Header';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useRefresh } from '../../hooks/useRefresh';
import { theme } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { FormModal } from './AdminStandardScreen';
import {
  AdmitAnalytics,
  AdmitCardLookups,
  AdmitCardView,
  AdmitClass,
  AdmitStudent,
  authHeader,
  deleteAdmitCard,
  downloadAdmitCardPdf,
  generateAdmitCards,
  getAdmitAnalytics,
  getAdmitCard,
  getAdmitLookups,
  getAdmitStudents,
  issueAdmitCard,
} from '../../api/adminAdmitCardApi';

type Criteria = 'none' | 'attendance' | 'fee';

const AdminAdmitCardScreen = ({ navigation }: any) => {
  const [lookups, setLookups] = useState<AdmitCardLookups | null>(null);
  const [analytics, setAnalytics] = useState<AdmitAnalytics | null>(null);

  const [exam, setExam] = useState<number | null>(null);
  const [cls, setCls] = useState<number | null>(null);
  const [section, setSection] = useState<number | null>(null);
  const [status, setStatus] = useState<'' | 'issued' | 'not_issued'>('');
  const [search, setSearch] = useState('');

  const [students, setStudents] = useState<AdmitStudent[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  // generate modal
  const [genOpen, setGenOpen] = useState(false);
  const [criteria, setCriteria] = useState<Criteria>('none');
  const [percentage, setPercentage] = useState('75');
  const [generating, setGenerating] = useState(false);

  // view card
  const [card, setCard] = useState<AdmitCardView | null>(null);
  const [cardLoading, setCardLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const sectionsFor = (c: AdmitClass | undefined) => c?.sections ?? [];
  const ready = !!exam && !!cls;

  useEffect(() => { getAdmitLookups().then(setLookups).catch(() => {}); }, []);

  const loadAnalytics = useCallback(async () => {
    try { setAnalytics(await getAdmitAnalytics({ exam_id: exam, standard_id: cls, section_id: section })); } catch {}
  }, [exam, cls, section]);

  const loadStudents = useCallback(async () => {
    if (!ready) { setStudents([]); return; }
    setLoading(true);
    try {
      const res = await getAdmitStudents({ exam_id: exam!, standard_id: cls!, section_id: section, search, status, per_page: 50 });
      setStudents(res.data);
    } catch (e) { Alert.alert('Error', apiErr(e, 'Could not load students.')); }
    finally { setLoading(false); }
  }, [ready, exam, cls, section, search, status]);

  useEffect(() => { loadAnalytics(); }, [loadAnalytics]);
  useEffect(() => { const t = setTimeout(loadStudents, 300); return () => clearTimeout(t); }, [loadStudents]);
  const { refreshing, onRefresh } = useRefresh(async () => { await Promise.all([loadAnalytics(), loadStudents()]); });

  const issue = async (st: AdmitStudent) => {
    if (!exam) return;
    setBusyId(st.id);
    try {
      const res = await issueAdmitCard(exam, st.id);
      if (res.already) Alert.alert('Already issued', 'This student already has an admit card for this exam.');
      await Promise.all([loadAnalytics(), loadStudents()]);
    } catch (e) { Alert.alert('Error', apiErr(e, 'Could not issue admit card.')); }
    finally { setBusyId(null); }
  };

  const confirmDelete = (st: AdmitStudent) =>
    Alert.alert('Delete Admit Card', `Remove ${st.full_name}'s admit card?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        if (!st.admit_card_id) return;
        try { await deleteAdmitCard(st.admit_card_id); await Promise.all([loadAnalytics(), loadStudents()]); }
        catch (e) { Alert.alert('Error', apiErr(e, 'Could not delete.')); }
      } },
    ]);

  const openCard = async (st: AdmitStudent) => {
    if (!st.admit_card_id) return;
    setCardLoading(true);
    setCard({ id: st.admit_card_id } as AdmitCardView);
    try { setCard(await getAdmitCard(st.admit_card_id)); }
    catch (e) { Alert.alert('Error', apiErr(e, 'Could not load admit card.')); setCard(null); }
    finally { setCardLoading(false); }
  };

  const previewPdf = async () => {
    if (!card?.pdf_url) return;
    const headers = await authHeader();
    navigation.navigate('BookReader', { url: card.pdf_url, title: 'Admit Card', headers });
  };

  const downloadPdf = async () => {
    if (!card?.pdf_url || downloading) return;
    setDownloading(true);
    try {
      await downloadAdmitCardPdf(card.pdf_url, `Admit_Card_${(card.student.full_name || 'student').replace(/\s+/g, '_')}`);
      Alert.alert('Downloaded', Platform.OS === 'android' ? 'Saved to your Downloads.' : 'Saved to your device.');
    } catch (e) { Alert.alert('Download failed', apiErr(e, 'Could not download.')); }
    finally { setDownloading(false); }
  };

  const runGenerate = async () => {
    if (!exam || !cls) return Alert.alert('Pick exam & class', 'Select an exam and class in the filters first.');
    setGenerating(true);
    try {
      const res = await generateAdmitCards({ exam_id: exam, standard_id: cls, section_id: section, criteria, percentage: Number(percentage) || 75 });
      setGenOpen(false);
      Alert.alert('Done', `Issued ${res.generated} admit card(s).` + (res.skipped > 0 ? ` ${res.skipped} did not meet the criteria.` : ''));
      await Promise.all([loadAnalytics(), loadStudents()]);
    } catch (e) { Alert.alert('Error', apiErr(e, 'Could not generate.')); }
    finally { setGenerating(false); }
  };

  const statCards = [
    { label: 'Students', value: analytics?.total, color: '#6366F1' },
    { label: 'Issued', value: analytics?.issued, color: '#22C55E' },
    { label: 'Remaining', value: analytics?.remaining, color: '#F59E0B' },
  ];

  return (
    <View style={s.root}>
      <Header title="Admit Card" onBackPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('PanelHome'))} />

      <View style={s.statRow}>
        {statCards.map(c => (
          <View key={c.label} style={[s.statCard, { backgroundColor: c.color + '14' }]}>
            <Text style={[s.statVal, { color: c.color }]}>{c.value ?? '—'}</Text>
            <Text style={s.statLbl}>{c.label}</Text>
          </View>
        ))}
      </View>

      {/* Exam filter */}
      <Text style={s.filterLabel}>Exam</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterBar} contentContainerStyle={s.filterContent}>
        {(lookups?.exams ?? []).map(e => (
          <TouchableOpacity key={e.id} style={[s.pchip, exam === e.id && s.pchipActive]} onPress={() => setExam(exam === e.id ? null : e.id)}>
            <Text style={[s.pchipText, exam === e.id && s.pchipTextActive]}>{e.name}</Text>
          </TouchableOpacity>
        ))}
        {(lookups?.exams ?? []).length === 0 && <Text style={s.pickerEmpty}>No exams</Text>}
      </ScrollView>

      {/* Class filter */}
      <Text style={s.filterLabel}>Class</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterBar} contentContainerStyle={s.filterContent}>
        {(lookups?.classes ?? []).map(c => (
          <TouchableOpacity key={c.id} style={[s.pchip, cls === c.id && s.pchipActive]} onPress={() => { setCls(cls === c.id ? null : c.id); setSection(null); }}>
            <Text style={[s.pchipText, cls === c.id && s.pchipTextActive]}>{c.name}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Section filter */}
      {!!cls && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterBar2} contentContainerStyle={s.filterContent}>
          {sectionsFor(lookups?.classes.find(c => c.id === cls)).map(sec => (
            <TouchableOpacity key={sec.id} style={[s.pchip, section === sec.id && s.pchipActive]} onPress={() => setSection(section === sec.id ? null : sec.id)}>
              <Text style={[s.pchipText, section === sec.id && s.pchipTextActive]}>{sec.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {ready && (
        <>
          <View style={s.searchRow}>
            <VectorIcon iconSet="Ionicons" iconName="search" size={16} color={theme.colors.textMuted} />
            <TextInput style={s.searchInput} placeholder="Search name / roll / admission no" placeholderTextColor={theme.colors.textMuted} value={search} onChangeText={setSearch} />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterBar2} contentContainerStyle={s.filterContent}>
            {(['', 'issued', 'not_issued'] as const).map(st => (
              <TouchableOpacity key={st || 'all'} style={[s.pchip, status === st && s.pchipActive]} onPress={() => setStatus(st)}>
                <Text style={[s.pchipText, status === st && s.pchipTextActive]}>{st === '' ? 'All' : st === 'issued' ? 'Issued' : 'Not Issued'}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </>
      )}

      {loading ? (
        <View style={s.loader}><ActivityIndicator size="large" color={theme.colors.primary} /></View>
      ) : (
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}
          refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
          {!ready && <Text style={s.empty}>Pick an exam and class to list students.</Text>}
          {ready && students.length === 0 && <Text style={s.empty}>No students found.</Text>}
          {students.map(st => (
            <View key={st.id} style={s.card}>
              <View style={s.cardTop}>
                {st.image ? (
                  <Image source={{ uri: st.image }} style={s.avatar} />
                ) : (
                  <View style={[s.avatar, s.avatarFallback]}><Text style={s.avatarInitial}>{(st.full_name || '?').charAt(0)}</Text></View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={s.cardTitle} numberOfLines={1}>{st.full_name}</Text>
                  <Text style={s.cardSub}>Roll {st.roll_no || '—'}{st.admission_no ? ` · ${st.admission_no}` : ''}</Text>
                </View>
                {st.issued ? (
                  <View style={[s.badge, { backgroundColor: '#22C55E1F' }]}><Text style={[s.badgeText, { color: '#16A34A' }]}>Issued</Text></View>
                ) : (
                  <View style={[s.badge, { backgroundColor: '#F59E0B1F' }]}><Text style={[s.badgeText, { color: '#D97706' }]}>Pending</Text></View>
                )}
              </View>
              <View style={s.rowActions}>
                {st.issued ? (
                  <>
                    <TouchableOpacity style={s.ghostBtn} onPress={() => openCard(st)}>
                      <VectorIcon iconSet="Ionicons" iconName="eye-outline" size={15} color={theme.colors.primary} />
                      <Text style={s.ghostBtnText}>View</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[s.ghostBtn, { borderColor: theme.colors.danger }]} onPress={() => confirmDelete(st)}>
                      <VectorIcon iconSet="Ionicons" iconName="trash-outline" size={15} color={theme.colors.danger} />
                      <Text style={[s.ghostBtnText, { color: theme.colors.danger }]}>Delete</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <TouchableOpacity style={s.primaryBtn} onPress={() => issue(st)} disabled={busyId === st.id}>
                    {busyId === st.id ? <ActivityIndicator size="small" color="#fff" /> : <VectorIcon iconSet="Ionicons" iconName="add-circle-outline" size={16} color="#fff" />}
                    <Text style={s.primaryBtnText}>Issue</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))}
          <View style={{ height: 90 }} />
        </ScrollView>
      )}

      {ready && (
        <TouchableOpacity style={s.fab} onPress={() => setGenOpen(true)} activeOpacity={0.9}>
          <VectorIcon iconSet="Ionicons" iconName="albums-outline" size={24} color="#fff" />
        </TouchableOpacity>
      )}

      {/* Generate modal */}
      <FormModal visible={genOpen} title="Generate Admit Cards" onClose={() => setGenOpen(false)} onSave={runGenerate} saving={generating} saveLabel="Generate">
        <Text style={s.fieldLabel}>Eligibility criteria</Text>
        <View style={s.wrapChips}>
          {(['none', 'attendance', 'fee'] as Criteria[]).map(c => (
            <TouchableOpacity key={c} style={[s.selChip, criteria === c && s.selChipActive]} onPress={() => setCriteria(c)}>
              <Text style={[s.selChipText, criteria === c && s.selChipTextActive]}>{c === 'none' ? 'All students' : c === 'attendance' ? 'By attendance' : 'By fee paid'}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {criteria !== 'none' && (
          <>
            <Text style={s.fieldLabel}>Minimum percentage</Text>
            <TextInput style={s.numInput} value={percentage} onChangeText={setPercentage} keyboardType="numeric" placeholder="75" placeholderTextColor={theme.colors.textMuted} />
          </>
        )}
        <Text style={s.hint}>Issues cards for every not-yet-issued student in the selected exam / class{section ? ' / section' : ''} who meets the criteria.</Text>
      </FormModal>

      {/* View card */}
      <FormModal visible={!!card} title="Admit Card" onClose={() => setCard(null)} onSave={() => setCard(null)} saving={false} saveLabel="Close">
        {cardLoading || !card?.student ? (
          <View style={{ paddingVertical: 30 }}><ActivityIndicator color={theme.colors.primary} /></View>
        ) : (
          <View>
            <View style={s.paper}>
              <Text style={s.paperSchool}>{card.organization.name ?? 'School'}</Text>
              {!!card.organization.address && <Text style={s.paperAddress}>{card.organization.address}</Text>}
              <View style={s.paperTitlePill}>
                <Text style={s.paperTitleText}>ADMIT CARD — {(card.exam_name ?? '').toUpperCase()}{card.academic_year ? ` (${card.academic_year})` : ''}</Text>
              </View>
              <View style={s.studentRow}>
                {!!card.student.image_url && <Image source={{ uri: card.student.image_url }} style={s.studentPhoto} />}
                <View style={s.studentGrid}>
                  {[
                    ['Name', card.student.full_name],
                    ['Class', card.student.class],
                    ['Roll No', card.student.roll_number],
                    ['Father', card.student.father_name],
                  ].filter(([, v]) => !!v).map(([label, value]) => (
                    <View key={label as string} style={s.studentField}>
                      <Text style={s.studentLabel}>{label}</Text>
                      <Text style={s.studentValue}>{value}</Text>
                    </View>
                  ))}
                </View>
              </View>
              {card.subjects.length > 0 ? (
                <View style={s.table}>
                  <View style={[s.tr, s.trHead]}>
                    <Text style={[s.th, { flex: 1.7 }]}>Subject</Text>
                    <Text style={[s.th, { flex: 1.1 }]}>Date</Text>
                    <Text style={[s.th, { flex: 0.9 }]}>Time</Text>
                  </View>
                  {card.subjects.map((row, i) => (
                    <View key={i} style={[s.tr, i % 2 === 1 && s.trAlt]}>
                      <Text style={[s.td, { flex: 1.7, fontWeight: '700' }]} numberOfLines={1}>{row.subject_name}</Text>
                      <Text style={[s.td, { flex: 1.1 }]}>{row.exam_date || '—'}</Text>
                      <Text style={[s.td, { flex: 0.9 }]}>{row.exam_time || '—'}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={s.noSubjects}>Subject schedule will appear here once added.</Text>
              )}
              {!!card.seating_label && (
                <View style={s.centerRow}>
                  <VectorIcon iconSet="Ionicons" iconName="location-outline" size={13} color={theme.colors.textMuted} />
                  <Text style={s.centerText2}>{card.seating_label}</Text>
                </View>
              )}
            </View>
            <View style={s.actionRow}>
              <TouchableOpacity style={s.actionGhost} onPress={previewPdf} activeOpacity={0.85}>
                <VectorIcon iconSet="Ionicons" iconName="book-outline" size={17} color={theme.colors.primary} />
                <Text style={s.actionGhostText}>Preview</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.actionPrimary, downloading && { opacity: 0.7 }]} onPress={downloadPdf} disabled={downloading} activeOpacity={0.85}>
                {downloading ? <ActivityIndicator size="small" color="#fff" /> : <VectorIcon iconSet="Ionicons" iconName="download-outline" size={17} color="#fff" />}
                <Text style={s.actionPrimaryText}>{downloading ? 'Downloading…' : 'Download'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </FormModal>
    </View>
  );
};

export default AdminAdmitCardScreen;

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 40 },

  statRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 12 },
  statCard: { flex: 1, borderRadius: 12, paddingVertical: 10, alignItems: 'center' },
  statVal: { fontSize: 18, fontWeight: '900' },
  statLbl: { fontSize: 10, color: theme.colors.textSecondary, fontWeight: '700', marginTop: 2 },

  filterLabel: { fontSize: 12, fontWeight: '800', color: theme.colors.textSecondary, paddingHorizontal: 16, marginTop: 12 },
  filterBar: { maxHeight: 46, paddingLeft: 16, marginTop: 6 },
  filterBar2: { maxHeight: 46, paddingLeft: 16, marginTop: 6 },
  filterContent: { gap: 8, paddingRight: 16, alignItems: 'center' },
  pchip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: theme.radius.full, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border },
  pchipActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  pchipText: { fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary },
  pchipTextActive: { color: '#fff' },
  pickerEmpty: { fontSize: 12, color: theme.colors.textMuted, paddingVertical: 8 },

  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginTop: 12, paddingHorizontal: 12, height: 42, borderRadius: 12, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border },
  searchInput: { flex: 1, fontSize: 14, color: theme.colors.textPrimary, paddingVertical: 0 },

  scroll: { paddingHorizontal: 16, paddingTop: 12 },
  empty: { fontSize: 13, color: theme.colors.textMuted, textAlign: 'center', marginTop: 30 },

  card: { backgroundColor: theme.colors.card, borderRadius: 16, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: theme.colors.border },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  avatarFallback: { backgroundColor: theme.colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontSize: 18, fontWeight: '900', color: theme.colors.primary },
  cardTitle: { fontSize: 15, fontWeight: '900', color: theme.colors.textPrimary },
  cardSub: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: theme.radius.full },
  badgeText: { fontSize: 11, fontWeight: '800' },

  rowActions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  primaryBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: theme.colors.primary, borderRadius: theme.radius.full, paddingVertical: 10 },
  primaryBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  ghostBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: theme.colors.card, borderRadius: theme.radius.full, borderWidth: 1.5, borderColor: theme.colors.primary, paddingVertical: 10 },
  ghostBtnText: { fontSize: 13, fontWeight: '700', color: theme.colors.primary },

  fab: { position: 'absolute', right: 18, bottom: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center', elevation: 5, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },

  fieldLabel: { fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary, marginTop: 14, marginBottom: 6 },
  wrapChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  selChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: theme.radius.full, backgroundColor: theme.colors.background, borderWidth: 1, borderColor: theme.colors.border },
  selChipActive: { backgroundColor: theme.colors.primaryLight, borderColor: theme.colors.primary },
  selChipText: { fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary },
  selChipTextActive: { color: theme.colors.primary },
  numInput: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: theme.colors.textPrimary, backgroundColor: theme.colors.card, width: 120 },
  hint: { fontSize: 11, color: theme.colors.textMuted, marginTop: 12, lineHeight: 16 },

  // Paper preview (student-style)
  paper: { backgroundColor: theme.colors.card, borderRadius: theme.radius.sm, borderWidth: 1, borderColor: theme.colors.border, padding: 16 },
  paperSchool: { fontSize: 15, fontWeight: '900', color: theme.colors.primary, textAlign: 'center', letterSpacing: 0.5 },
  paperAddress: { fontSize: 10, color: theme.colors.textMuted, textAlign: 'center', marginTop: 2 },
  paperTitlePill: { alignSelf: 'center', backgroundColor: theme.colors.primaryLight, borderRadius: theme.radius.full, paddingHorizontal: 14, paddingVertical: 4, marginTop: 10 },
  paperTitleText: { fontSize: 10, fontWeight: '800', color: theme.colors.primary, letterSpacing: 0.6 },
  studentRow: { flexDirection: 'row', gap: 12, marginTop: 14, alignItems: 'center' },
  studentPhoto: { width: 64, height: 76, borderRadius: 6, borderWidth: 1, borderColor: theme.colors.border },
  studentGrid: { flex: 1, flexDirection: 'row', flexWrap: 'wrap' },
  studentField: { width: '50%', paddingVertical: 3 },
  studentLabel: { fontSize: 9, color: theme.colors.textMuted, fontWeight: '600' },
  studentValue: { fontSize: 12, fontWeight: '700', color: theme.colors.textPrimary },
  table: { marginTop: 14, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 6, overflow: 'hidden' },
  tr: { flexDirection: 'row', paddingVertical: 7, paddingHorizontal: 8, gap: 4 },
  trHead: { backgroundColor: theme.colors.primaryLight },
  trAlt: { backgroundColor: theme.colors.background },
  th: { fontSize: 9, fontWeight: '800', color: theme.colors.primary, textTransform: 'uppercase' },
  td: { fontSize: 10, color: theme.colors.textPrimary },
  noSubjects: { fontSize: 11, color: theme.colors.textMuted, marginTop: 14, fontStyle: 'italic' },
  centerRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
  centerText2: { fontSize: 11, color: theme.colors.textSecondary, fontWeight: '600', flex: 1 },

  actionRow: { flexDirection: 'row', gap: 12, marginTop: 14 },
  actionPrimary: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: theme.colors.primary, borderRadius: theme.radius.full, paddingVertical: 13 },
  actionPrimaryText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  actionGhost: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: theme.colors.card, borderRadius: theme.radius.full, borderWidth: 1.5, borderColor: theme.colors.primary, paddingVertical: 13 },
  actionGhostText: { fontSize: 14, fontWeight: '700', color: theme.colors.primary },
});
