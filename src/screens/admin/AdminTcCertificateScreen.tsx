import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { FormModal, Field } from './AdminStandardScreen';
import {
  CertItem,
  CertPayload,
  TcClass,
  TcItem,
  TcLookups,
  TcPayload,
  TcStatistics,
  TcStudent,
  TcTab,
  createCert,
  createTc,
  deleteCert,
  deleteTc,
  downloadCertificatePdf,
  getTcList,
  getTcLookups,
  getTcStats,
  getTcStudents,
  updateCert,
  updateTc,
} from '../../api/adminTcCertificateApi';

const today = () => new Date().toISOString().slice(0, 10);

// Reusable student picker (class chips → section chips → searchable list).
const StudentPicker = ({
  classes, value, valueLabel, onPick,
}: { classes: TcClass[]; value: number | null; valueLabel: string; onPick: (id: number, label: string) => void }) => {
  const [cls, setCls] = useState<number | null>(null);
  const [section, setSection] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [students, setStudents] = useState<TcStudent[]>([]);
  const sectionsFor = (cid: number | null) => classes.find(c => c.id === cid)?.sections ?? [];

  const load = useCallback(async () => {
    if (!cls) { setStudents([]); return; }
    try { setStudents(await getTcStudents({ standard_id: cls, section_id: section, search })); } catch { setStudents([]); }
  }, [cls, section, search]);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  return (
    <View>
      <Text style={s.fieldLabel}>Student {value ? `· ${valueLabel}` : ''}</Text>
      <View style={s.wrapChips}>
        {classes.map(c => (
          <TouchableOpacity key={c.id} style={[s.selChip, cls === c.id && s.selChipActive]} onPress={() => { setCls(c.id); setSection(null); }}>
            <Text style={[s.selChipText, cls === c.id && s.selChipTextActive]}>{c.name}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {!!cls && (
        <View style={[s.wrapChips, { marginTop: 8 }]}>
          {sectionsFor(cls).map(sec => (
            <TouchableOpacity key={sec.id} style={[s.selChip, section === sec.id && s.selChipActive]} onPress={() => setSection(sec.id)}>
              <Text style={[s.selChipText, section === sec.id && s.selChipTextActive]}>{sec.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
      {!!cls && (
        <>
          <View style={[s.searchRow, { marginHorizontal: 0, marginTop: 10 }]}>
            <VectorIcon iconSet="Ionicons" iconName="search" size={16} color={theme.colors.textMuted} />
            <TextInput style={s.searchInput} placeholder="Search student" placeholderTextColor={theme.colors.textMuted} value={search} onChangeText={setSearch} />
          </View>
          <View style={{ maxHeight: 190, marginTop: 8 }}>
            <ScrollView nestedScrollEnabled>
              {students.map(st => (
                <TouchableOpacity key={st.id} style={[s.stRow, value === st.id && s.stRowActive]} onPress={() => onPick(st.id, st.full_name)}>
                  <VectorIcon iconSet="Ionicons" iconName={value === st.id ? 'radio-button-on' : 'radio-button-off'} size={18} color={value === st.id ? theme.colors.primary : theme.colors.textMuted} />
                  <Text style={s.stRowText} numberOfLines={1}>{st.full_name}{st.admission_no ? ` · ${st.admission_no}` : ''}</Text>
                </TouchableOpacity>
              ))}
              {students.length === 0 && <Text style={s.pickerEmpty}>No students</Text>}
            </ScrollView>
          </View>
        </>
      )}
    </View>
  );
};

const Chips = ({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) => (
  <View style={s.wrapChips}>
    {options.map(o => (
      <TouchableOpacity key={o} style={[s.selChip, value === o && s.selChipActive]} onPress={() => onChange(o)}>
        <Text style={[s.selChipText, value === o && s.selChipTextActive]}>{o}</Text>
      </TouchableOpacity>
    ))}
  </View>
);

const AdminTcCertificateScreen = ({ navigation }: any) => {
  const [tab, setTab] = useState<TcTab>('achievement');
  const [lookups, setLookups] = useState<TcLookups | null>(null);
  const [statistics, setStatistics] = useState<TcStatistics | null>(null);

  const [items, setItems] = useState<(CertItem | TcItem)[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  // cert form
  const [certOpen, setCertOpen] = useState(false);
  const [certEditId, setCertEditId] = useState<number | null>(null);
  const [cStudent, setCStudent] = useState<number | null>(null);
  const [cStudentLabel, setCStudentLabel] = useState('');
  const [cEvent, setCEvent] = useState('');
  const [cIssuedBy, setCIssuedBy] = useState('');
  const [cDesignation, setCDesignation] = useState('');
  const [cDescription, setCDescription] = useState('');
  const [cDate, setCDate] = useState(today());
  const [savingCert, setSavingCert] = useState(false);

  // tc form
  const [tcOpen, setTcOpen] = useState(false);
  const [tcEditId, setTcEditId] = useState<number | null>(null);
  const [tStudent, setTStudent] = useState<number | null>(null);
  const [tStudentLabel, setTStudentLabel] = useState('');
  const [tForm, setTForm] = useState<TcPayload>({
    student_detail_id: 0, general_conduct: 'Good', application_date: today(), issue_date: today(),
    nationality: 'Indian', whether_failed: 'No', qualified_for_promotion: 'Yes', is_ncc_scout: 'No',
    is_sc_st: false, total_working_days: 0, days_present: 0,
  });
  const [savingTc, setSavingTc] = useState(false);

  const isTc = tab === 'tc';

  useEffect(() => { getTcLookups().then(setLookups).catch(() => {}); }, []);

  const loadStats = useCallback(async () => {
    try { const res = await getTcStats({ tab }); setStatistics(res.statistics); } catch {}
  }, [tab]);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getTcList({ tab, search, per_page: 40 });
      setItems(res.data);
    } catch (e) { Alert.alert('Error', apiErr(e, 'Could not load list.')); }
    finally { setLoading(false); }
  }, [tab, search]);

  useEffect(() => { loadStats(); }, [loadStats]);
  useEffect(() => { const t = setTimeout(loadList, 300); return () => clearTimeout(t); }, [loadList]);
  const { refreshing, onRefresh } = useRefresh(async () => { await Promise.all([loadStats(), loadList()]); });

  const download = async (row: CertItem | TcItem, name: string) => {
    setDownloadingId(row.id);
    try {
      await downloadCertificatePdf(row.pdf_url, `${isTc ? 'TC' : 'Certificate'}_${(name || 'student').replace(/\s+/g, '_')}`);
      Alert.alert('Downloaded', Platform.OS === 'android' ? 'Saved to your Downloads.' : 'Saved to your device.');
    } catch (e) { Alert.alert('Download failed', apiErr(e, 'Could not download.')); }
    finally { setDownloadingId(null); }
  };

  // ── cert ──
  const openCertCreate = () => {
    setCertEditId(null); setCStudent(null); setCStudentLabel('');
    setCEvent(''); setCIssuedBy(''); setCDesignation(''); setCDescription(''); setCDate(today());
    setCertOpen(true);
  };
  const openCertEdit = (c: CertItem) => {
    setCertEditId(c.id); setCStudent(c.student_id); setCStudentLabel(c.student_name ?? '');
    setCEvent(c.event_name); setCIssuedBy(c.issued_by); setCDesignation(c.issued_by_designation ?? '');
    setCDescription(c.description ?? ''); setCDate(c.issued_date ?? today());
    setCertOpen(true);
  };
  const saveCert = async () => {
    if (!cStudent) return Alert.alert('Required', 'Select a student.');
    if (!cEvent.trim()) return Alert.alert('Required', 'Enter an event / achievement name.');
    if (!cIssuedBy.trim()) return Alert.alert('Required', 'Enter who issued it.');
    setSavingCert(true);
    try {
      const payload: CertPayload = {
        type: tab === 'participation' ? 'participation' : 'achievement',
        student_detail_id: cStudent, event_name: cEvent.trim(), issued_by: cIssuedBy.trim(),
        issued_by_designation: cDesignation.trim() || undefined, description: cDescription.trim() || undefined,
        issued_date: cDate,
      };
      if (certEditId) await updateCert(certEditId, payload); else await createCert(payload);
      setCertOpen(false);
      await Promise.all([loadStats(), loadList()]);
    } catch (e) { Alert.alert('Error', apiErr(e, 'Could not save certificate.')); }
    finally { setSavingCert(false); }
  };
  const confirmDeleteCert = (c: CertItem) =>
    Alert.alert('Delete Certificate', `Delete ${c.student_name}'s certificate?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await deleteCert(c.id); await Promise.all([loadStats(), loadList()]); }
        catch (e) { Alert.alert('Error', apiErr(e, 'Could not delete.')); }
      } },
    ]);

  // ── tc ──
  const setT = (patch: Partial<TcPayload>) => setTForm(prev => ({ ...prev, ...patch }));
  const openTcCreate = () => {
    setTcEditId(null); setTStudent(null); setTStudentLabel('');
    setTForm({ student_detail_id: 0, general_conduct: 'Good', application_date: today(), issue_date: today(),
      nationality: 'Indian', whether_failed: 'No', qualified_for_promotion: 'Yes', is_ncc_scout: 'No',
      is_sc_st: false, total_working_days: 0, days_present: 0 });
    setTcOpen(true);
  };
  const openTcEdit = (t: TcItem) => {
    setTcEditId(t.id); setTStudent(t.student_id); setTStudentLabel(t.student_name ?? '');
    setTForm({
      student_detail_id: t.student_id, book_no: t.book_no ?? '', nationality: t.nationality,
      is_sc_st: t.is_sc_st, last_class_studied: t.last_class_studied ?? '', exam_last_taken: t.exam_last_taken ?? '',
      whether_failed: t.whether_failed, subjects_studied: t.subjects_studied ?? '', qualified_for_promotion: t.qualified_for_promotion,
      fees_paid_upto: t.fees_paid_upto ?? '', fee_concession: t.fee_concession ?? '', total_working_days: t.total_working_days,
      days_present: t.days_present, is_ncc_scout: t.is_ncc_scout, extra_activities: t.extra_activities ?? '',
      general_conduct: t.general_conduct, application_date: t.application_date ?? today(), issue_date: t.issue_date ?? today(),
      reason_for_leaving: t.reason_for_leaving ?? '', remarks: t.remarks ?? '',
    });
    setTcOpen(true);
  };
  const saveTc = async () => {
    if (!tStudent) return Alert.alert('Required', 'Select a student.');
    setSavingTc(true);
    try {
      const payload: TcPayload = { ...tForm, student_detail_id: tStudent };
      if (tcEditId) await updateTc(tcEditId, payload); else await createTc(payload);
      setTcOpen(false);
      await Promise.all([loadStats(), loadList()]);
    } catch (e) { Alert.alert('Error', apiErr(e, 'Could not save TC.')); }
    finally { setSavingTc(false); }
  };
  const confirmDeleteTc = (t: TcItem) =>
    Alert.alert('Delete TC', `Delete ${t.student_name}'s transfer certificate?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await deleteTc(t.id); await Promise.all([loadStats(), loadList()]); }
        catch (e) { Alert.alert('Error', apiErr(e, 'Could not delete.')); }
      } },
    ]);

  const statCards = [
    { label: 'Achievement', value: statistics?.achievement, color: '#F59E0B' },
    { label: 'Participation', value: statistics?.participation, color: '#8B5CF6' },
    { label: 'TC', value: statistics?.tc, color: '#EF4444' },
  ];

  const TABS: { key: TcTab; label: string }[] = [
    { key: 'achievement', label: 'Achievement' },
    { key: 'participation', label: 'Participation' },
    { key: 'tc', label: 'TC' },
  ];

  return (
    <View style={s.root}>
      <Header title="TC & Certificate" onBackPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('PanelHome'))} />

      <View style={s.statRow}>
        {statCards.map(c => (
          <View key={c.label} style={[s.statCard, { backgroundColor: c.color + '14' }]}>
            <Text style={[s.statVal, { color: c.color }]}>{c.value ?? '—'}</Text>
            <Text style={s.statLbl}>{c.label}</Text>
          </View>
        ))}
      </View>

      <View style={s.tabRow}>
        {TABS.map(t => {
          const active = tab === t.key;
          return (
            <TouchableOpacity key={t.key} style={[s.tab, active && s.tabActive]} onPress={() => { setTab(t.key); setSearch(''); }} activeOpacity={0.8}>
              <Text style={[s.tabText, active && s.tabTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={s.searchRow}>
        <VectorIcon iconSet="Ionicons" iconName="search" size={16} color={theme.colors.textMuted} />
        <TextInput style={s.searchInput} placeholder="Search" placeholderTextColor={theme.colors.textMuted} value={search} onChangeText={setSearch} />
      </View>

      {loading ? (
        <View style={s.loader}><ActivityIndicator size="large" color={theme.colors.primary} /></View>
      ) : (
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}
          refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
          {items.length === 0 && <Text style={s.empty}>Nothing here yet.</Text>}
          {items.map(row => isTc ? (
            <View key={row.id} style={s.card}>
              <View style={s.cardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={s.cardTitle} numberOfLines={1}>{(row as TcItem).student_name}</Text>
                  <Text style={s.cardSub}>{(row as TcItem).tc_no} · Issued {(row as TcItem).issue_label}</Text>
                </View>
              </View>
              {!!(row as TcItem).reason_for_leaving && <Text style={s.cardDesc} numberOfLines={2}>Reason: {(row as TcItem).reason_for_leaving}</Text>}
              <View style={s.rowActions}>
                <TouchableOpacity style={s.ghostBtn} onPress={() => download(row, (row as TcItem).student_name ?? '')} disabled={downloadingId === row.id}>
                  {downloadingId === row.id ? <ActivityIndicator size="small" color={theme.colors.primary} /> : <VectorIcon iconSet="Ionicons" iconName="download-outline" size={15} color={theme.colors.primary} />}
                  <Text style={s.ghostBtnText}>PDF</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.ghostBtn} onPress={() => openTcEdit(row as TcItem)}>
                  <VectorIcon iconSet="Ionicons" iconName="create-outline" size={15} color={theme.colors.primary} />
                  <Text style={s.ghostBtnText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.ghostBtn, { borderColor: theme.colors.danger }]} onPress={() => confirmDeleteTc(row as TcItem)}>
                  <VectorIcon iconSet="Ionicons" iconName="trash-outline" size={15} color={theme.colors.danger} />
                  <Text style={[s.ghostBtnText, { color: theme.colors.danger }]}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View key={row.id} style={s.card}>
              <View style={s.cardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={s.cardTitle} numberOfLines={1}>{(row as CertItem).student_name}</Text>
                  <Text style={s.cardSub}>{(row as CertItem).event_name}</Text>
                </View>
                <Text style={s.cardMetaText}>{(row as CertItem).issued_label}</Text>
              </View>
              <Text style={s.cardMetaText}>{(row as CertItem).certificate_no} · By {(row as CertItem).issued_by}</Text>
              <View style={s.rowActions}>
                <TouchableOpacity style={s.ghostBtn} onPress={() => download(row, (row as CertItem).student_name ?? '')} disabled={downloadingId === row.id}>
                  {downloadingId === row.id ? <ActivityIndicator size="small" color={theme.colors.primary} /> : <VectorIcon iconSet="Ionicons" iconName="download-outline" size={15} color={theme.colors.primary} />}
                  <Text style={s.ghostBtnText}>PDF</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.ghostBtn} onPress={() => openCertEdit(row as CertItem)}>
                  <VectorIcon iconSet="Ionicons" iconName="create-outline" size={15} color={theme.colors.primary} />
                  <Text style={s.ghostBtnText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.ghostBtn, { borderColor: theme.colors.danger }]} onPress={() => confirmDeleteCert(row as CertItem)}>
                  <VectorIcon iconSet="Ionicons" iconName="trash-outline" size={15} color={theme.colors.danger} />
                  <Text style={[s.ghostBtnText, { color: theme.colors.danger }]}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
          <View style={{ height: 90 }} />
        </ScrollView>
      )}

      <TouchableOpacity style={s.fab} onPress={() => (isTc ? openTcCreate() : openCertCreate())} activeOpacity={0.9}>
        <VectorIcon iconSet="Ionicons" iconName="add" size={28} color="#fff" />
      </TouchableOpacity>

      {/* Certificate form */}
      <FormModal visible={certOpen} title={certEditId ? 'Edit Certificate' : `New ${tab === 'participation' ? 'Participation' : 'Achievement'} Certificate`} onClose={() => setCertOpen(false)} onSave={saveCert} saving={savingCert} saveLabel={certEditId ? 'Update' : 'Issue'}>
        <StudentPicker classes={lookups?.classes ?? []} value={cStudent} valueLabel={cStudentLabel} onPick={(id, label) => { setCStudent(id); setCStudentLabel(label); }} />
        <Field label="Event / Achievement" value={cEvent} onChangeText={setCEvent} placeholder="e.g. Inter-School Quiz Winner" />
        <Field label="Issued By" value={cIssuedBy} onChangeText={setCIssuedBy} placeholder="e.g. Principal" />
        <Field label="Designation (optional)" value={cDesignation} onChangeText={setCDesignation} placeholder="e.g. Principal" />
        <Field label="Description (optional)" value={cDescription} onChangeText={setCDescription} placeholder="Details" multiline />
        <Field label="Issued Date (YYYY-MM-DD)" value={cDate} onChangeText={setCDate} placeholder={today()} />
      </FormModal>

      {/* TC form */}
      <FormModal visible={tcOpen} title={tcEditId ? 'Edit Transfer Certificate' : 'New Transfer Certificate'} onClose={() => setTcOpen(false)} onSave={saveTc} saving={savingTc} saveLabel={tcEditId ? 'Update' : 'Issue'}>
        <StudentPicker classes={lookups?.classes ?? []} value={tStudent} valueLabel={tStudentLabel} onPick={(id, label) => { setTStudent(id); setTStudentLabel(label); }} />
        <Field label="Book No" value={tForm.book_no ?? ''} onChangeText={(v: string) => setT({ book_no: v })} placeholder="Register book no" />
        <Field label="Nationality" value={tForm.nationality ?? 'Indian'} onChangeText={(v: string) => setT({ nationality: v })} />
        <Text style={s.fieldLabel}>SC / ST</Text>
        <Chips options={['No', 'Yes']} value={tForm.is_sc_st ? 'Yes' : 'No'} onChange={v => setT({ is_sc_st: v === 'Yes' })} />
        <Field label="Last Class Studied" value={tForm.last_class_studied ?? ''} onChangeText={(v: string) => setT({ last_class_studied: v })} />
        <Field label="Exam Last Taken" value={tForm.exam_last_taken ?? ''} onChangeText={(v: string) => setT({ exam_last_taken: v })} />
        <Text style={s.fieldLabel}>Whether Failed</Text>
        <Chips options={lookups?.failed_options ?? ['No', 'Once', 'Twice']} value={tForm.whether_failed ?? 'No'} onChange={v => setT({ whether_failed: v })} />
        <Field label="Subjects Studied" value={tForm.subjects_studied ?? ''} onChangeText={(v: string) => setT({ subjects_studied: v })} multiline />
        <Text style={s.fieldLabel}>Qualified for Promotion</Text>
        <Chips options={['Yes', 'No']} value={tForm.qualified_for_promotion ?? 'Yes'} onChange={v => setT({ qualified_for_promotion: v })} />
        <Field label="Fees Paid Upto" value={tForm.fees_paid_upto ?? ''} onChangeText={(v: string) => setT({ fees_paid_upto: v })} />
        <Field label="Fee Concession" value={tForm.fee_concession ?? ''} onChangeText={(v: string) => setT({ fee_concession: v })} />
        <Field label="Total Working Days" value={String(tForm.total_working_days ?? 0)} onChangeText={(v: string) => setT({ total_working_days: Number(v) || 0 })} keyboardType="numeric" />
        <Field label="Days Present" value={String(tForm.days_present ?? 0)} onChangeText={(v: string) => setT({ days_present: Number(v) || 0 })} keyboardType="numeric" />
        <Text style={s.fieldLabel}>NCC / Scout</Text>
        <Chips options={lookups?.ncc_options ?? ['No', 'NCC Cadet', 'Boy Scout', 'Girl Guide']} value={tForm.is_ncc_scout ?? 'No'} onChange={v => setT({ is_ncc_scout: v })} />
        <Field label="Extra Activities" value={tForm.extra_activities ?? ''} onChangeText={(v: string) => setT({ extra_activities: v })} multiline />
        <Text style={s.fieldLabel}>General Conduct</Text>
        <Chips options={lookups?.conduct_options ?? ['Excellent', 'Good', 'Satisfactory', 'Poor']} value={tForm.general_conduct} onChange={v => setT({ general_conduct: v })} />
        <Field label="Application Date (YYYY-MM-DD)" value={tForm.application_date} onChangeText={(v: string) => setT({ application_date: v })} placeholder={today()} />
        <Field label="Issue Date (YYYY-MM-DD)" value={tForm.issue_date} onChangeText={(v: string) => setT({ issue_date: v })} placeholder={today()} />
        <Field label="Reason for Leaving" value={tForm.reason_for_leaving ?? ''} onChangeText={(v: string) => setT({ reason_for_leaving: v })} multiline />
        <Field label="Remarks" value={tForm.remarks ?? ''} onChangeText={(v: string) => setT({ remarks: v })} multiline />
      </FormModal>
    </View>
  );
};

export default AdminTcCertificateScreen;

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 40 },

  statRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 12 },
  statCard: { flex: 1, borderRadius: 12, paddingVertical: 10, alignItems: 'center' },
  statVal: { fontSize: 18, fontWeight: '900' },
  statLbl: { fontSize: 10, color: theme.colors.textSecondary, fontWeight: '700', marginTop: 2 },

  tabRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 12 },
  tab: { flex: 1, paddingVertical: 9, borderRadius: theme.radius.full, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center' },
  tabActive: { backgroundColor: theme.colors.primaryLight, borderColor: theme.colors.primary },
  tabText: { fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary },
  tabTextActive: { color: theme.colors.primary },

  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginTop: 12, paddingHorizontal: 12, height: 42, borderRadius: 12, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border },
  searchInput: { flex: 1, fontSize: 14, color: theme.colors.textPrimary, paddingVertical: 0 },

  scroll: { paddingHorizontal: 16, paddingTop: 12 },
  empty: { fontSize: 13, color: theme.colors.textMuted, textAlign: 'center', marginTop: 30 },

  card: { backgroundColor: theme.colors.card, borderRadius: 16, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: theme.colors.border },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  cardTitle: { fontSize: 15, fontWeight: '900', color: theme.colors.textPrimary },
  cardSub: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },
  cardDesc: { fontSize: 13, color: theme.colors.textSecondary, marginTop: 8, lineHeight: 18 },
  cardMetaText: { fontSize: 11, color: theme.colors.textMuted, fontWeight: '600', marginTop: 4 },

  rowActions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  ghostBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, backgroundColor: theme.colors.card, borderRadius: theme.radius.full, borderWidth: 1.5, borderColor: theme.colors.primary, paddingVertical: 9 },
  ghostBtnText: { fontSize: 12, fontWeight: '700', color: theme.colors.primary },

  fab: { position: 'absolute', right: 18, bottom: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center', elevation: 5, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },

  fieldLabel: { fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary, marginTop: 14, marginBottom: 6 },
  wrapChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  selChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: theme.radius.full, backgroundColor: theme.colors.background, borderWidth: 1, borderColor: theme.colors.border },
  selChipActive: { backgroundColor: theme.colors.primaryLight, borderColor: theme.colors.primary },
  selChipText: { fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary },
  selChipTextActive: { color: theme.colors.primary },
  pickerEmpty: { fontSize: 12, color: theme.colors.textMuted, paddingVertical: 8 },

  stRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 9, paddingHorizontal: 8, borderRadius: 10 },
  stRowActive: { backgroundColor: theme.colors.primaryLight },
  stRowText: { flex: 1, fontSize: 13, color: theme.colors.textPrimary, fontWeight: '600' },
});
