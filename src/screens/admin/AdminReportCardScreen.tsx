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
import {
  RcClass,
  RcIssueStudent,
  RcStats,
  ReportCardItem,
  downloadReportCardPdf,
  getReportCardIssueStudents,
  getReportCardLookups,
  getReportCardStats,
  getReportCards,
  issueReportCards,
  revokeReportCard,
} from '../../api/adminReportCardApi';

type Tab = 'list' | 'issue';

const AdminReportCardScreen = ({ navigation }: any) => {
  const [tab, setTab] = useState<Tab>('list');
  const [classes, setClasses] = useState<RcClass[]>([]);
  const [stats, setStats] = useState<RcStats | null>(null);

  // list
  const [items, setItems] = useState<ReportCardItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [fClass, setFClass] = useState<number | null>(null);
  const [fSection, setFSection] = useState<number | null>(null);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  // issue
  const [iClass, setIClass] = useState<number | null>(null);
  const [iSection, setISection] = useState<number | null>(null);
  const [issueStudents, setIssueStudents] = useState<RcIssueStudent[]>([]);
  const [issueLoading, setIssueLoading] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);
  const [issuing, setIssuing] = useState(false);

  const sectionsFor = (cid: number | null) => classes.find(c => c.id === cid)?.sections ?? [];

  useEffect(() => { getReportCardLookups().then(r => setClasses(r.classes)).catch(() => {}); }, []);

  const loadStats = useCallback(async () => {
    try { setStats(await getReportCardStats({ standard_id: fClass, section_id: fSection })); } catch {}
  }, [fClass, fSection]);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getReportCards({ search, standard_id: fClass, section_id: fSection, per_page: 40 });
      setItems(res.data);
    } catch (e) { Alert.alert('Error', apiErr(e, 'Could not load report cards.')); }
    finally { setLoading(false); }
  }, [search, fClass, fSection]);

  useEffect(() => { loadStats(); }, [loadStats]);
  useEffect(() => { const t = setTimeout(loadList, 300); return () => clearTimeout(t); }, [loadList]);
  const { refreshing, onRefresh } = useRefresh(async () => { await Promise.all([loadStats(), loadList()]); });

  const download = async (rc: ReportCardItem) => {
    setDownloadingId(rc.id);
    try {
      await downloadReportCardPdf(rc.pdf_url, `Report_Card_${(rc.full_name || 'student').replace(/\s+/g, '_')}`);
      Alert.alert('Downloaded', Platform.OS === 'android' ? 'Saved to your Downloads.' : 'Saved to your device.');
    } catch (e) { Alert.alert('Download failed', apiErr(e, 'Could not download.')); }
    finally { setDownloadingId(null); }
  };

  const revoke = (rc: ReportCardItem) =>
    Alert.alert('Revoke Report Card', `Revoke ${rc.full_name}'s report card?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Revoke', style: 'destructive', onPress: async () => {
        try { await revokeReportCard(rc.id); await Promise.all([loadStats(), loadList()]); }
        catch (e) { Alert.alert('Error', apiErr(e, 'Could not revoke.')); }
      } },
    ]);

  // ── issue flow ──
  const loadIssueStudents = useCallback(async () => {
    if (!iClass || !iSection) { setIssueStudents([]); return; }
    setIssueLoading(true);
    setSelected([]);
    try { setIssueStudents(await getReportCardIssueStudents(iClass, iSection)); }
    catch (e) { Alert.alert('Error', apiErr(e, 'Could not load students.')); }
    finally { setIssueLoading(false); }
  }, [iClass, iSection]);

  useEffect(() => { loadIssueStudents(); }, [loadIssueStudents]);

  const toggle = (st: RcIssueStudent) => {
    if (!st.marks_complete || st.already_issued) return;
    setSelected(prev => prev.includes(st.id) ? prev.filter(x => x !== st.id) : [...prev, st.id]);
  };

  const selectAllEligible = () => {
    const eligible = issueStudents.filter(s => s.marks_complete && !s.already_issued).map(s => s.id);
    setSelected(selected.length === eligible.length ? [] : eligible);
  };

  const doIssue = async () => {
    if (!iClass || !iSection || selected.length === 0) return Alert.alert('Select students', 'Pick at least one eligible student.');
    setIssuing(true);
    try {
      const res = await issueReportCards({ standard_id: iClass, section_id: iSection, student_ids: selected });
      Alert.alert('Done', `Issued ${res.issued} report card(s).` + (res.skipped > 0 ? ` ${res.skipped} skipped (already issued).` : ''));
      await Promise.all([loadStats(), loadIssueStudents(), loadList()]);
    } catch (e) { Alert.alert('Error', apiErr(e, 'Could not issue.')); }
    finally { setIssuing(false); }
  };

  const statCards = [
    { label: 'Students', value: stats?.total_students, color: '#6366F1' },
    { label: 'Active', value: stats?.active_students, color: '#0EA5E9' },
    { label: 'Issued', value: stats?.issued, color: '#22C55E' },
    { label: 'Pending', value: stats?.pending, color: '#F59E0B' },
  ];

  return (
    <View style={s.root}>
      <Header title="Report Card" onBackPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('PanelHome'))} />

      <View style={s.statRow}>
        {statCards.map(c => (
          <View key={c.label} style={[s.statCard, { backgroundColor: c.color + '14' }]}>
            <Text style={[s.statVal, { color: c.color }]}>{c.value ?? '—'}</Text>
            <Text style={s.statLbl}>{c.label}</Text>
          </View>
        ))}
      </View>

      <View style={s.tabRow}>
        {(['list', 'issue'] as Tab[]).map(t => {
          const active = tab === t;
          return (
            <TouchableOpacity key={t} style={[s.tab, active && s.tabActive]} onPress={() => setTab(t)} activeOpacity={0.8}>
              <Text style={[s.tabText, active && s.tabTextActive]}>{t === 'list' ? 'Issued' : 'Issue New'}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {tab === 'list' ? (
        <>
          <View style={s.searchRow}>
            <VectorIcon iconSet="Ionicons" iconName="search" size={16} color={theme.colors.textMuted} />
            <TextInput style={s.searchInput} placeholder="Search name / admission no" placeholderTextColor={theme.colors.textMuted} value={search} onChangeText={setSearch} />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterBar} contentContainerStyle={s.filterContent}>
            {classes.map(c => (
              <TouchableOpacity key={c.id} style={[s.pchip, fClass === c.id && s.pchipActive]} onPress={() => { setFClass(fClass === c.id ? null : c.id); setFSection(null); }}>
                <Text style={[s.pchipText, fClass === c.id && s.pchipTextActive]}>{c.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          {!!fClass && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterBar2} contentContainerStyle={s.filterContent}>
              {sectionsFor(fClass).map(sec => (
                <TouchableOpacity key={sec.id} style={[s.pchip, fSection === sec.id && s.pchipActive]} onPress={() => setFSection(fSection === sec.id ? null : sec.id)}>
                  <Text style={[s.pchipText, fSection === sec.id && s.pchipTextActive]}>{sec.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {loading ? (
            <View style={s.loader}><ActivityIndicator size="large" color={theme.colors.primary} /></View>
          ) : (
            <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}
              refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
              {items.length === 0 && <Text style={s.empty}>No report cards issued yet.</Text>}
              {items.map(rc => (
                <View key={rc.id} style={s.card}>
                  <View style={s.cardTop}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.cardTitle} numberOfLines={1}>{rc.full_name}</Text>
                      <Text style={s.cardSub}>{[rc.standard, rc.section].filter(Boolean).join(' ')} · {rc.academic_year}</Text>
                    </View>
                    <View style={[s.badge, { backgroundColor: rc.status === 'issued' ? '#22C55E1F' : '#EF44441F' }]}>
                      <Text style={[s.badgeText, { color: rc.status === 'issued' ? '#16A34A' : '#DC2626' }]}>{rc.status === 'issued' ? 'Issued' : 'Revoked'}</Text>
                    </View>
                  </View>
                  <View style={s.cardMeta}>
                    <Text style={s.cardMetaText}>{rc.issued_by ? `By ${rc.issued_by}` : ''} · {rc.issued_label}</Text>
                  </View>
                  <View style={s.rowActions}>
                    <TouchableOpacity style={s.ghostBtn} onPress={() => download(rc)} disabled={downloadingId === rc.id}>
                      {downloadingId === rc.id ? <ActivityIndicator size="small" color={theme.colors.primary} /> : <VectorIcon iconSet="Ionicons" iconName="download-outline" size={15} color={theme.colors.primary} />}
                      <Text style={s.ghostBtnText}>PDF</Text>
                    </TouchableOpacity>
                    {rc.status === 'issued' && (
                      <TouchableOpacity style={[s.ghostBtn, { borderColor: theme.colors.danger }]} onPress={() => revoke(rc)}>
                        <VectorIcon iconSet="Ionicons" iconName="close-circle-outline" size={15} color={theme.colors.danger} />
                        <Text style={[s.ghostBtnText, { color: theme.colors.danger }]}>Revoke</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ))}
              <View style={{ height: 40 }} />
            </ScrollView>
          )}
        </>
      ) : (
        // ── Issue tab ──
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          <Text style={s.fieldLabel}>Class</Text>
          <View style={s.wrapChips}>
            {classes.map(c => (
              <TouchableOpacity key={c.id} style={[s.selChip, iClass === c.id && s.selChipActive]} onPress={() => { setIClass(c.id); setISection(null); }}>
                <Text style={[s.selChipText, iClass === c.id && s.selChipTextActive]}>{c.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {!!iClass && (
            <>
              <Text style={s.fieldLabel}>Section</Text>
              <View style={s.wrapChips}>
                {sectionsFor(iClass).map(sec => (
                  <TouchableOpacity key={sec.id} style={[s.selChip, iSection === sec.id && s.selChipActive]} onPress={() => setISection(sec.id)}>
                    <Text style={[s.selChipText, iSection === sec.id && s.selChipTextActive]}>{sec.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          {issueLoading ? (
            <View style={{ paddingVertical: 24 }}><ActivityIndicator color={theme.colors.primary} /></View>
          ) : !iSection ? (
            <Text style={s.empty}>Pick a class and section to see eligible students.</Text>
          ) : issueStudents.length === 0 ? (
            <Text style={s.empty}>No students in this section.</Text>
          ) : (
            <>
              <TouchableOpacity style={s.selectAllRow} onPress={selectAllEligible}>
                <VectorIcon iconSet="Ionicons" iconName="checkmark-done-outline" size={16} color={theme.colors.primary} />
                <Text style={s.selectAllText}>Select all eligible</Text>
              </TouchableOpacity>
              {issueStudents.map(st => {
                const disabled = !st.marks_complete || st.already_issued;
                const on = selected.includes(st.id);
                return (
                  <TouchableOpacity key={st.id} style={[s.stCard, disabled && { opacity: 0.6 }]} onPress={() => toggle(st)} activeOpacity={disabled ? 1 : 0.8}>
                    <VectorIcon iconSet="Ionicons" iconName={on ? 'checkbox' : 'square-outline'} size={20} color={on ? theme.colors.primary : theme.colors.textMuted} />
                    <View style={{ flex: 1 }}>
                      <Text style={s.cardTitle} numberOfLines={1}>{st.full_name}</Text>
                      <Text style={s.cardSub}>Roll {st.roll_no}{st.admission_no ? ` · ${st.admission_no}` : ''}</Text>
                      {st.already_issued ? (
                        <Text style={[s.tagLine, { color: '#16A34A' }]}>Already issued</Text>
                      ) : !st.marks_complete ? (
                        <Text style={[s.tagLine, { color: '#D97706' }]}>{st.missing_info}</Text>
                      ) : (
                        <Text style={[s.tagLine, { color: theme.colors.primary }]}>Ready to issue</Text>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
              <TouchableOpacity style={[s.issueBtn, (selected.length === 0 || issuing) && { opacity: 0.6 }]} onPress={doIssue} disabled={selected.length === 0 || issuing} activeOpacity={0.9}>
                {issuing ? <ActivityIndicator size="small" color="#fff" /> : <VectorIcon iconSet="Ionicons" iconName="document-text-outline" size={18} color="#fff" />}
                <Text style={s.issueBtnText}>Issue {selected.length > 0 ? `(${selected.length})` : ''}</Text>
              </TouchableOpacity>
            </>
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </View>
  );
};

export default AdminReportCardScreen;

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
  tabText: { fontSize: 13, fontWeight: '700', color: theme.colors.textSecondary },
  tabTextActive: { color: theme.colors.primary },

  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginTop: 12, paddingHorizontal: 12, height: 42, borderRadius: 12, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border },
  searchInput: { flex: 1, fontSize: 14, color: theme.colors.textPrimary, paddingVertical: 0 },

  filterBar: { maxHeight: 46, paddingLeft: 16, marginTop: 10 },
  filterBar2: { maxHeight: 46, paddingLeft: 16, marginTop: 4 },
  filterContent: { gap: 8, paddingRight: 16, alignItems: 'center' },
  pchip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: theme.radius.full, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border },
  pchipActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  pchipText: { fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary },
  pchipTextActive: { color: '#fff' },

  scroll: { paddingHorizontal: 16, paddingTop: 12 },
  empty: { fontSize: 13, color: theme.colors.textMuted, textAlign: 'center', marginTop: 30 },

  card: { backgroundColor: theme.colors.card, borderRadius: 16, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: theme.colors.border },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  cardTitle: { fontSize: 15, fontWeight: '900', color: theme.colors.textPrimary },
  cardSub: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },
  cardMeta: { marginTop: 8 },
  cardMetaText: { fontSize: 11, color: theme.colors.textMuted, fontWeight: '600' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: theme.radius.full },
  badgeText: { fontSize: 11, fontWeight: '800' },

  rowActions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  ghostBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: theme.colors.card, borderRadius: theme.radius.full, borderWidth: 1.5, borderColor: theme.colors.primary, paddingVertical: 10 },
  ghostBtnText: { fontSize: 13, fontWeight: '700', color: theme.colors.primary },

  fieldLabel: { fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary, marginTop: 14, marginBottom: 6 },
  wrapChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  selChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: theme.radius.full, backgroundColor: theme.colors.background, borderWidth: 1, borderColor: theme.colors.border },
  selChipActive: { backgroundColor: theme.colors.primaryLight, borderColor: theme.colors.primary },
  selChipText: { fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary },
  selChipTextActive: { color: theme.colors.primary },

  selectAllRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14, marginBottom: 4 },
  selectAllText: { fontSize: 13, fontWeight: '700', color: theme.colors.primary },
  stCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: theme.colors.card, borderRadius: 14, padding: 12, marginTop: 8, borderWidth: 1, borderColor: theme.colors.border },
  tagLine: { fontSize: 11, fontWeight: '700', marginTop: 3 },
  issueBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: theme.colors.primary, borderRadius: theme.radius.full, paddingVertical: 14, marginTop: 18 },
  issueBtnText: { fontSize: 15, fontWeight: '800', color: '#fff' },
});
