import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
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
import { apiErr, pickImage } from '../../utils/filePickers';
import { PickedFile } from '../../api/adminProfileApi';
import { FormModal, Field } from './AdminStandardScreen';
import {
  DriverRow,
  FeeSummary,
  Months,
  RouteRow,
  TransportStats,
  TransportStudent,
  deleteDriver,
  deletePayment,
  deleteRoute,
  getDrivers,
  getFeeStudents,
  getFeeSummary,
  getRouteOptions,
  getRoutes,
  getTransportStats,
  getTransportStudents,
  recordPayment,
  removeTransportStudent,
  saveDriver,
  saveRoute,
  saveStudentMonths,
  toggleDriver,
  toggleRoute,
} from '../../api/adminTransportApi';

type Tab = 'routes' | 'drivers' | 'students' | 'fees';
const MONTH_KEYS = ['apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec', 'jan', 'feb', 'mar'];
const MODES = ['cash', 'online', 'cheque', 'upi'];
const rupee = (n: number) => '₹' + Number(n || 0).toLocaleString('en-IN');

const AdminTransportScreen = ({ navigation }: any) => {
  const [tab, setTab] = useState<Tab>('routes');
  const [stats, setStats] = useState<TransportStats | null>(null);
  const [routeOptions, setRouteOptions] = useState<{ id: number; route_name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  // routes
  const [routes, setRoutes] = useState<RouteRow[]>([]);
  // drivers
  const [drivers, setDrivers] = useState<DriverRow[]>([]);
  const [vehicleTypes, setVehicleTypes] = useState<string[]>([]);
  // students
  const [stuRoute, setStuRoute] = useState<number | null>(null);
  const [students, setStudents] = useState<TransportStudent[]>([]);
  const [monthsOrder, setMonthsOrder] = useState<Record<string, string>>({});
  // fees
  const [feeRoute, setFeeRoute] = useState<number | null>(null);
  const [feeSearch, setFeeSearch] = useState('');
  const [feeStudents, setFeeStudents] = useState<{ id: number; name: string; admission_no: string | null; class: string }[]>([]);
  const [feeStudentId, setFeeStudentId] = useState<number | null>(null);
  const [summary, setSummary] = useState<FeeSummary | null>(null);

  const loadStats = useCallback(async () => { try { setStats(await getTransportStats()); } catch {} }, []);
  useEffect(() => { loadStats(); getRouteOptions().then(setRouteOptions).catch(() => {}); }, [loadStats]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === 'routes') setRoutes(await getRoutes({ search }));
      else if (tab === 'drivers') { const r = await getDrivers({ search }); setDrivers(r.drivers); setVehicleTypes(r.vehicle_types); }
      else if (tab === 'students') { const r = await getTransportStudents(stuRoute, search); setStudents(r.students); setMonthsOrder(r.months_order); }
    } catch (e) { Alert.alert('Error', apiErr(e, 'Could not load.')); }
    finally { setLoading(false); }
  }, [tab, search, stuRoute]);

  useEffect(() => { if (tab !== 'fees') { const t = setTimeout(load, 300); return () => clearTimeout(t); } }, [load, tab]);

  const { refreshing, onRefresh } = useRefresh(async () => { await Promise.all([loadStats(), load()]); });

  // ── Route form ──
  const [routeOpen, setRouteOpen] = useState(false);
  const [rId, setRId] = useState<number | null>(null);
  const [rName, setRName] = useState('');
  const [rPickup, setRPickup] = useState('');
  const [rDrop, setRDrop] = useState('');
  const [rFee, setRFee] = useState('');
  const [rCap, setRCap] = useState('');
  const [rActive, setRActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const openRoute = (r?: RouteRow) => {
    setRId(r?.id ?? null); setRName(r?.route_name ?? ''); setRPickup(r?.pickup_time ?? ''); setRDrop(r?.drop_time ?? '');
    setRFee(r ? String(r.monthly_fee) : ''); setRCap(r ? String(r.capacity) : ''); setRActive(r?.is_active ?? true);
    setRouteOpen(true);
  };
  const submitRoute = async () => {
    if (!rName.trim()) return Alert.alert('Required', 'Enter a route name.');
    setSaving(true);
    try {
      await saveRoute(rId, { route_name: rName.trim(), pickup_time: rPickup || null, drop_time: rDrop || null, monthly_fee: Number(rFee) || 0, capacity: Number(rCap) || 0, is_active: rActive });
      setRouteOpen(false); await Promise.all([loadStats(), load()]); getRouteOptions().then(setRouteOptions).catch(() => {});
    } catch (e) { Alert.alert('Error', apiErr(e, 'Could not save route.')); }
    finally { setSaving(false); }
  };
  const confirmDeleteRoute = (r: RouteRow) =>
    Alert.alert('Delete Route', `Delete "${r.route_name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { try { await deleteRoute(r.id); await Promise.all([loadStats(), load()]); } catch (e) { Alert.alert('Error', apiErr(e, 'Could not delete.')); } } },
    ]);

  // ── Driver form ──
  const [driverOpen, setDriverOpen] = useState(false);
  const [dId, setDId] = useState<number | null>(null);
  const [dName, setDName] = useState('');
  const [dEmail, setDEmail] = useState('');
  const [dPhone, setDPhone] = useState('');
  const [dLicense, setDLicense] = useState('');
  const [dVehicleNo, setDVehicleNo] = useState('');
  const [dVehicleType, setDVehicleType] = useState('');
  const [dAddress, setDAddress] = useState('');
  const [dExp, setDExp] = useState('');
  const [dActive, setDActive] = useState(true);
  const [dRoutes, setDRoutes] = useState<number[]>([]);
  const [dImage, setDImage] = useState<PickedFile | null>(null);

  const openDriver = (d?: DriverRow) => {
    setDId(d?.id ?? null); setDName(d?.name ?? ''); setDEmail(d?.email ?? ''); setDPhone(d?.phone ?? '');
    setDLicense(d?.license_no ?? ''); setDVehicleNo(d?.vehicle_no ?? ''); setDVehicleType(d?.vehicle_type ?? '');
    setDAddress(d?.address ?? ''); setDExp(d ? String(d.experience_years) : ''); setDActive(d?.is_active ?? true);
    setDRoutes(d?.routes.map(r => r.id) ?? []); setDImage(null);
    setDriverOpen(true);
  };
  const submitDriver = async () => {
    if (!dName.trim()) return Alert.alert('Required', 'Enter driver name.');
    if (!dEmail.trim()) return Alert.alert('Required', 'Enter driver email.');
    setSaving(true);
    try {
      await saveDriver(dId, { name: dName.trim(), email: dEmail.trim(), phone: dPhone || null, license_no: dLicense || null, vehicle_no: dVehicleNo || null, vehicle_type: dVehicleType || null, address: dAddress || null, experience_years: Number(dExp) || 0, is_active: dActive, routes: dRoutes, image: dImage });
      setDriverOpen(false); await Promise.all([loadStats(), load()]);
    } catch (e) { Alert.alert('Error', apiErr(e, 'Could not save driver.')); }
    finally { setSaving(false); }
  };
  const confirmDeleteDriver = (d: DriverRow) =>
    Alert.alert('Delete Driver', `Delete ${d.name}? Their login is removed too.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { try { await deleteDriver(d.id); await Promise.all([loadStats(), load()]); } catch (e) { Alert.alert('Error', apiErr(e, 'Could not delete.')); } } },
    ]);

  // ── Student months editor ──
  const [monthOpen, setMonthOpen] = useState(false);
  const [mStudent, setMStudent] = useState<TransportStudent | null>(null);
  const [mMonths, setMMonths] = useState<Months>({});
  const openMonths = (st: TransportStudent) => { setMStudent(st); setMMonths({ ...st.months }); setMonthOpen(true); };
  const submitMonths = async () => {
    if (!mStudent || !mStudent.route_id) return;
    setSaving(true);
    try {
      await saveStudentMonths({ student_detail_id: mStudent.student_detail_id, transportation_id: mStudent.route_id, months: mMonths });
      setMonthOpen(false); await load();
    } catch (e) { Alert.alert('Error', apiErr(e, 'Could not save.')); }
    finally { setSaving(false); }
  };
  const confirmRemoveStudent = (st: TransportStudent) => {
    if (!st.route_id) return;
    Alert.alert('Remove Student', `Remove ${st.name} from ${st.route}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => { try { await removeTransportStudent(st.student_detail_id, st.route_id!); await load(); } catch (e) { Alert.alert('Error', apiErr(e, 'Could not remove.')); } } },
    ]);
  };
  const monthsCount = Object.values(mMonths).filter(Boolean).length;

  // ── Fees ──
  const loadFeeStudents = useCallback(async () => {
    try { setFeeStudents(await getFeeStudents(feeRoute, feeSearch)); } catch { setFeeStudents([]); }
  }, [feeRoute, feeSearch]);
  useEffect(() => { if (tab === 'fees') { const t = setTimeout(loadFeeStudents, 300); return () => clearTimeout(t); } }, [tab, loadFeeStudents]);
  const loadSummary = useCallback(async (id: number) => {
    setLoading(true);
    try { setSummary(await getFeeSummary(id)); } catch (e) { Alert.alert('Error', apiErr(e, 'Could not load summary.')); }
    finally { setLoading(false); }
  }, []);
  const pickFeeStudent = (id: number) => { setFeeStudentId(id); loadSummary(id); };

  // payment
  const [payOpen, setPayOpen] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payMode, setPayMode] = useState('cash');
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));
  const [payRemark, setPayRemark] = useState('');
  const openPay = () => { setPayAmount(summary ? String(Math.max(0, summary.remaining)) : ''); setPayMode('cash'); setPayDate(new Date().toISOString().slice(0, 10)); setPayRemark(''); setPayOpen(true); };
  const submitPay = async () => {
    if (!feeStudentId) return;
    if (!(Number(payAmount) > 0)) return Alert.alert('Required', 'Enter a valid amount.');
    setSaving(true);
    try {
      await recordPayment({ student_id: feeStudentId, amount: Number(payAmount), mode: payMode, date: payDate, remark: payRemark || undefined });
      setPayOpen(false); await loadSummary(feeStudentId);
    } catch (e) { Alert.alert('Error', apiErr(e, 'Could not record payment.')); }
    finally { setSaving(false); }
  };
  const confirmDeletePayment = (id: number) =>
    Alert.alert('Delete Payment', 'Remove this payment?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { try { await deletePayment(id); if (feeStudentId) await loadSummary(feeStudentId); } catch (e) { Alert.alert('Error', apiErr(e, 'Could not delete.')); } } },
    ]);

  const statCards = [
    { label: 'Drivers', value: stats?.drivers, color: '#3B82F6' },
    { label: 'Routes', value: stats?.routes, color: '#0EA5E9' },
    { label: 'Students', value: stats?.students, color: '#EC4899' },
    { label: 'Revenue', value: stats ? rupee(stats.monthly_revenue) : undefined, color: '#22C55E' },
  ];
  const showFab = tab === 'routes' || tab === 'drivers';

  return (
    <View style={s.root}>
      <Header title="Transportation" onBackPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('PanelHome'))} />

      <View style={s.statRow}>
        {statCards.map(c => (
          <View key={c.label} style={[s.statCard, { backgroundColor: c.color + '14' }]}>
            <Text style={[s.statVal, { color: c.color }]} numberOfLines={1}>{c.value ?? '—'}</Text>
            <Text style={s.statLbl}>{c.label}</Text>
          </View>
        ))}
      </View>

      <View style={s.tabRow}>
        {([['routes', 'Routes'], ['drivers', 'Drivers'], ['students', 'Students'], ['fees', 'Fees']] as [Tab, string][]).map(([t, label]) => {
          const active = tab === t;
          return (
            <TouchableOpacity key={t} style={[s.tab, active && s.tabActive]} onPress={() => setTab(t)} activeOpacity={0.8}>
              <Text style={[s.tabText, active && s.tabTextActive]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {tab !== 'fees' && (
        <View style={s.searchRow}>
          <VectorIcon iconSet="Ionicons" iconName="search" size={16} color={theme.colors.textMuted} />
          <TextInput style={s.searchInput} placeholder="Search" placeholderTextColor={theme.colors.textMuted} value={search} onChangeText={setSearch} />
        </View>
      )}

      {/* route filter for students tab */}
      {tab === 'students' && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterBar} contentContainerStyle={s.filterContent}>
          <TouchableOpacity style={[s.pchip, stuRoute === null && s.pchipActive]} onPress={() => setStuRoute(null)}><Text style={[s.pchipText, stuRoute === null && s.pchipTextActive]}>All Routes</Text></TouchableOpacity>
          {routeOptions.map(r => (
            <TouchableOpacity key={r.id} style={[s.pchip, stuRoute === r.id && s.pchipActive]} onPress={() => setStuRoute(r.id)}>
              <Text style={[s.pchipText, stuRoute === r.id && s.pchipTextActive]}>{r.route_name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {loading && tab !== 'fees' ? (
        <View style={s.loader}><ActivityIndicator size="large" color={theme.colors.primary} /></View>
      ) : (
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
          {/* ROUTES */}
          {tab === 'routes' && (routes.length === 0 ? <Text style={s.empty}>No routes yet.</Text> : routes.map(r => (
            <View key={r.id} style={s.card}>
              <View style={s.cardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={s.cardTitle}>{r.route_name}</Text>
                  <Text style={s.cardSub}>{r.driver_name ? `👤 ${r.driver_name}` : 'No driver'} · {r.students_count} students</Text>
                </View>
                {!r.is_active && <View style={s.inactive}><Text style={s.inactiveText}>Inactive</Text></View>}
              </View>
              <View style={s.metaGrid}>
                <Text style={s.metaItem}>⏰ {r.pickup_time || '—'} → {r.drop_time || '—'}</Text>
                <Text style={s.metaItem}>💰 {rupee(r.monthly_fee)}/mo · 🪑 {r.capacity}</Text>
              </View>
              <View style={s.cardActions}>
                <TouchableOpacity style={s.smallBtn} onPress={() => toggleRoute(r.id).then(() => Promise.all([loadStats(), load()]))}><Text style={s.smallBtnText}>{r.is_active ? 'Deactivate' : 'Activate'}</Text></TouchableOpacity>
                <TouchableOpacity style={s.act} onPress={() => openRoute(r)}><VectorIcon iconSet="Ionicons" iconName="create-outline" size={16} color={theme.colors.primary} /></TouchableOpacity>
                <TouchableOpacity style={s.act} onPress={() => confirmDeleteRoute(r)}><VectorIcon iconSet="Ionicons" iconName="trash-outline" size={16} color={theme.colors.danger} /></TouchableOpacity>
              </View>
            </View>
          )))}

          {/* DRIVERS */}
          {tab === 'drivers' && (drivers.length === 0 ? <Text style={s.empty}>No drivers yet.</Text> : drivers.map(d => (
            <View key={d.id} style={s.card}>
              <View style={s.cardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={s.cardTitle}>{d.name}</Text>
                  <Text style={s.cardSub}>{d.vehicle_no || '—'}{d.vehicle_type ? ` · ${d.vehicle_type}` : ''}</Text>
                </View>
                {!d.is_active && <View style={s.inactive}><Text style={s.inactiveText}>Inactive</Text></View>}
              </View>
              <View style={s.metaGrid}>
                <Text style={s.metaItem}>📞 {d.phone || '—'} · 🪪 {d.license_no || '—'}</Text>
                {d.routes.length > 0 && <Text style={s.metaItem}>🚌 {d.routes.map(r => r.name).join(', ')}</Text>}
              </View>
              <View style={s.cardActions}>
                <TouchableOpacity style={s.smallBtn} onPress={() => toggleDriver(d.id).then(() => Promise.all([loadStats(), load()]))}><Text style={s.smallBtnText}>{d.is_active ? 'Deactivate' : 'Activate'}</Text></TouchableOpacity>
                <TouchableOpacity style={s.act} onPress={() => openDriver(d)}><VectorIcon iconSet="Ionicons" iconName="create-outline" size={16} color={theme.colors.primary} /></TouchableOpacity>
                <TouchableOpacity style={s.act} onPress={() => confirmDeleteDriver(d)}><VectorIcon iconSet="Ionicons" iconName="trash-outline" size={16} color={theme.colors.danger} /></TouchableOpacity>
              </View>
            </View>
          )))}

          {/* STUDENTS */}
          {tab === 'students' && (students.length === 0 ? <Text style={s.empty}>No transport students.</Text> : students.map(st => (
            <View key={st.student_detail_id} style={s.card}>
              <View style={s.cardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={s.cardTitle}>{st.name}</Text>
                  <Text style={s.cardSub}>{st.class} · {st.route}</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <TouchableOpacity style={s.act} onPress={() => openMonths(st)}><VectorIcon iconSet="Ionicons" iconName="calendar-outline" size={16} color={theme.colors.primary} /></TouchableOpacity>
                  <TouchableOpacity style={s.act} onPress={() => confirmRemoveStudent(st)}><VectorIcon iconSet="Ionicons" iconName="trash-outline" size={16} color={theme.colors.danger} /></TouchableOpacity>
                </View>
              </View>
              <View style={s.feeRow}>
                <View style={s.feeCell}><Text style={s.feeCap}>Annual</Text><Text style={s.feeVal}>{rupee(st.annual)}</Text></View>
                <View style={s.feeCell}><Text style={s.feeCap}>Paid</Text><Text style={[s.feeVal, { color: '#22C55E' }]}>{rupee(st.paid)}</Text></View>
                <View style={s.feeCell}><Text style={s.feeCap}>Due</Text><Text style={[s.feeVal, { color: st.remaining > 0 ? '#EF4444' : '#22C55E' }]}>{rupee(st.remaining)}</Text></View>
                <View style={s.feeCell}><Text style={s.feeCap}>Months</Text><Text style={s.feeVal}>{st.months_count}</Text></View>
              </View>
            </View>
          )))}

          {/* FEES */}
          {tab === 'fees' && (
            <>
              <View style={[s.searchRow, { marginHorizontal: 0, marginTop: 0 }]}>
                <VectorIcon iconSet="Ionicons" iconName="search" size={16} color={theme.colors.textMuted} />
                <TextInput style={s.searchInput} placeholder="Search student (name / admission no)" placeholderTextColor={theme.colors.textMuted} value={feeSearch} onChangeText={setFeeSearch} />
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterBar} contentContainerStyle={[s.filterContent, { paddingLeft: 0 }]}>
                <TouchableOpacity style={[s.pchip, feeRoute === null && s.pchipActive]} onPress={() => setFeeRoute(null)}><Text style={[s.pchipText, feeRoute === null && s.pchipTextActive]}>All</Text></TouchableOpacity>
                {routeOptions.map(r => (
                  <TouchableOpacity key={r.id} style={[s.pchip, feeRoute === r.id && s.pchipActive]} onPress={() => setFeeRoute(r.id)}>
                    <Text style={[s.pchipText, feeRoute === r.id && s.pchipTextActive]}>{r.route_name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {!feeStudentId ? (
                feeStudents.length === 0 ? <Text style={s.empty}>Pick a route or search a student.</Text> : feeStudents.map(st => (
                  <TouchableOpacity key={st.id} style={s.pickRow} onPress={() => pickFeeStudent(st.id)}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.rowName}>{st.name}</Text>
                      <Text style={s.rowSub}>{st.class}{st.admission_no ? ` · ${st.admission_no}` : ''}</Text>
                    </View>
                    <VectorIcon iconSet="Ionicons" iconName="chevron-forward" size={18} color={theme.colors.textMuted} />
                  </TouchableOpacity>
                ))
              ) : loading ? (
                <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 20 }} />
              ) : summary ? (
                <>
                  <TouchableOpacity style={s.backLink} onPress={() => { setFeeStudentId(null); setSummary(null); }}>
                    <VectorIcon iconSet="Ionicons" iconName="arrow-back" size={16} color={theme.colors.primary} />
                    <Text style={s.backLinkText}>Back to list</Text>
                  </TouchableOpacity>
                  <View style={s.card}>
                    <Text style={s.cardTitle}>{summary.student.name}</Text>
                    <Text style={s.cardSub}>{summary.student.class} · {summary.route?.name ?? 'No route'}</Text>
                    <View style={s.feeRow}>
                      <View style={s.feeCell}><Text style={s.feeCap}>Annual</Text><Text style={s.feeVal}>{rupee(summary.annual)}</Text></View>
                      <View style={s.feeCell}><Text style={s.feeCap}>Paid</Text><Text style={[s.feeVal, { color: '#22C55E' }]}>{rupee(summary.paid)}</Text></View>
                      <View style={s.feeCell}><Text style={s.feeCap}>Due</Text><Text style={[s.feeVal, { color: summary.remaining > 0 ? '#EF4444' : '#22C55E' }]}>{rupee(summary.remaining)}</Text></View>
                    </View>
                    <TouchableOpacity style={s.payBtn} onPress={openPay}><Text style={s.payBtnText}>+ Record Payment</Text></TouchableOpacity>
                  </View>

                  {summary.month_status.length > 0 && (
                    <View style={s.card}>
                      <Text style={s.sectionTitle}>Month-wise</Text>
                      <View style={s.wrapChips}>
                        {summary.month_status.map(m => {
                          const color = m.status === 'paid' ? '#22C55E' : m.status === 'partial' ? '#F59E0B' : '#EF4444';
                          return <View key={m.key} style={[s.monthTag, { backgroundColor: color + '22' }]}><Text style={[s.monthTagText, { color }]}>{m.label.slice(0, 3)}</Text></View>;
                        })}
                      </View>
                    </View>
                  )}

                  <Text style={s.sectionTitle}>Payments ({summary.payments.length})</Text>
                  {summary.payments.length === 0 && <Text style={s.empty}>No payments recorded.</Text>}
                  {summary.payments.map(p => (
                    <View key={p.id} style={s.payRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.rowName}>{rupee(p.amount)} · {p.mode.toUpperCase()}</Text>
                        <Text style={s.rowSub}>{p.date} · {p.receipt}</Text>
                      </View>
                      <TouchableOpacity style={s.act} onPress={() => confirmDeletePayment(p.id)}><VectorIcon iconSet="Ionicons" iconName="trash-outline" size={16} color={theme.colors.danger} /></TouchableOpacity>
                    </View>
                  ))}
                </>
              ) : null}
            </>
          )}
          <View style={{ height: 90 }} />
        </ScrollView>
      )}

      {showFab && (
        <TouchableOpacity style={s.fab} onPress={() => (tab === 'routes' ? openRoute() : openDriver())} activeOpacity={0.9}>
          <VectorIcon iconSet="Ionicons" iconName="add" size={28} color="#fff" />
        </TouchableOpacity>
      )}

      {/* Route form */}
      <FormModal visible={routeOpen} title={rId ? 'Edit Route' : 'Add Route'} onClose={() => setRouteOpen(false)} onSave={submitRoute} saving={saving} saveLabel="Save">
        <Field label="Route Name" value={rName} onChangeText={setRName} placeholder="e.g. Route A - North" />
        <Field label="Pickup Time" value={rPickup} onChangeText={setRPickup} placeholder="e.g. 07:30 AM" />
        <Field label="Drop Time" value={rDrop} onChangeText={setRDrop} placeholder="e.g. 03:30 PM" />
        <Field label="Monthly Fee (₹)" value={rFee} onChangeText={setRFee} placeholder="0" keyboardType="numeric" />
        <Field label="Capacity" value={rCap} onChangeText={setRCap} placeholder="0" keyboardType="numeric" />
        <View style={s.toggleRow}><Text style={s.toggleLabel}>Active</Text><Switch value={rActive} onValueChange={setRActive} trackColor={{ false: theme.colors.border, true: theme.colors.primary }} thumbColor="#fff" /></View>
      </FormModal>

      {/* Driver form */}
      <FormModal visible={driverOpen} title={dId ? 'Edit Driver' : 'Add Driver'} onClose={() => setDriverOpen(false)} onSave={submitDriver} saving={saving} saveLabel="Save">
        <TouchableOpacity style={s.photoBtn} onPress={async () => { const f = await pickImage(); if (f) setDImage(f); }}>
          <VectorIcon iconSet="Ionicons" iconName="camera-outline" size={16} color={theme.colors.primary} />
          <Text style={s.photoBtnText} numberOfLines={1}>{dImage ? dImage.name : 'Photo (optional)'}</Text>
        </TouchableOpacity>
        <Field label="Name" value={dName} onChangeText={setDName} placeholder="Driver name" />
        <Field label="Email" value={dEmail} onChangeText={setDEmail} placeholder="driver@example.com" keyboardType="email-address" autoCapitalize="none" editable={!dId} />
        <Field label="Phone" value={dPhone} onChangeText={setDPhone} placeholder="10-digit mobile" keyboardType="phone-pad" />
        <Field label="License No" value={dLicense} onChangeText={setDLicense} placeholder="License number" />
        <Field label="Vehicle No" value={dVehicleNo} onChangeText={setDVehicleNo} placeholder="Vehicle number" />
        <Text style={s.fieldLabel}>Vehicle Type</Text>
        <View style={s.wrapChips}>
          {vehicleTypes.map(v => (
            <TouchableOpacity key={v} style={[s.selChip, dVehicleType === v && s.selChipActive]} onPress={() => setDVehicleType(v)}>
              <Text style={[s.selChipText, dVehicleType === v && s.selChipTextActive]}>{v}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Field label="Address" value={dAddress} onChangeText={setDAddress} placeholder="Address" multiline />
        <Field label="Experience (years)" value={dExp} onChangeText={setDExp} placeholder="0" keyboardType="numeric" />
        <Text style={s.fieldLabel}>Routes covered</Text>
        <View style={s.wrapChips}>
          {routeOptions.map(r => {
            const on = dRoutes.includes(r.id);
            return (
              <TouchableOpacity key={r.id} style={[s.selChip, on && s.selChipActive]} onPress={() => setDRoutes(p => on ? p.filter(x => x !== r.id) : [...p, r.id])}>
                <VectorIcon iconSet="Ionicons" iconName={on ? 'checkbox' : 'square-outline'} size={13} color={on ? theme.colors.primary : theme.colors.textMuted} />
                <Text style={[s.selChipText, on && s.selChipTextActive, { marginLeft: 4 }]}>{r.route_name}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <View style={s.toggleRow}><Text style={s.toggleLabel}>Active</Text><Switch value={dActive} onValueChange={setDActive} trackColor={{ false: theme.colors.border, true: theme.colors.primary }} thumbColor="#fff" /></View>
      </FormModal>

      {/* Months editor */}
      <FormModal visible={monthOpen} title="Billable Months" onClose={() => setMonthOpen(false)} onSave={submitMonths} saving={saving} saveLabel="Save">
        <Text style={s.cardSub}>{mStudent?.name} · {rupee(mStudent?.monthly ?? 0)}/mo</Text>
        <Text style={[s.fieldLabel, { marginTop: 8 }]}>Annual: {rupee((mStudent?.monthly ?? 0) * monthsCount)} ({monthsCount} months)</Text>
        <View style={s.wrapChips}>
          {MONTH_KEYS.map(k => {
            const on = !!mMonths[k];
            return (
              <TouchableOpacity key={k} style={[s.monthChip, on && s.selChipActive]} onPress={() => setMMonths(p => ({ ...p, [k]: !p[k] }))}>
                <Text style={[s.selChipText, on && s.selChipTextActive]}>{(monthsOrder[k] ?? k).slice(0, 3)}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </FormModal>

      {/* Payment form */}
      <FormModal visible={payOpen} title="Record Payment" onClose={() => setPayOpen(false)} onSave={submitPay} saving={saving} saveLabel="Save">
        <Field label="Amount (₹)" value={payAmount} onChangeText={setPayAmount} placeholder="0" keyboardType="numeric" />
        <Text style={s.fieldLabel}>Mode</Text>
        <View style={s.wrapChips}>
          {MODES.map(m => (
            <TouchableOpacity key={m} style={[s.selChip, payMode === m && s.selChipActive]} onPress={() => setPayMode(m)}>
              <Text style={[s.selChipText, payMode === m && s.selChipTextActive]}>{m.toUpperCase()}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Field label="Date" value={payDate} onChangeText={setPayDate} placeholder="YYYY-MM-DD" />
        <Field label="Remark (optional)" value={payRemark} onChangeText={setPayRemark} placeholder="Note" multiline />
      </FormModal>
    </View>
  );
};

export default AdminTransportScreen;

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.background },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 40 },

  statRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 12 },
  statCard: { flex: 1, borderRadius: 12, paddingVertical: 10, alignItems: 'center', paddingHorizontal: 4 },
  statVal: { fontSize: 15, fontWeight: '900' },
  statLbl: { fontSize: 10, color: theme.colors.textSecondary, fontWeight: '700', marginTop: 2 },

  tabRow: { flexDirection: 'row', gap: 6, paddingHorizontal: 16, paddingTop: 12 },
  tab: { flex: 1, paddingVertical: 9, borderRadius: theme.radius.full, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center' },
  tabActive: { backgroundColor: theme.colors.primaryLight, borderColor: theme.colors.primary },
  tabText: { fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary },
  tabTextActive: { color: theme.colors.primary },

  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginTop: 12, paddingHorizontal: 12, height: 42, borderRadius: 12, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border },
  searchInput: { flex: 1, fontSize: 14, color: theme.colors.textPrimary, paddingVertical: 0 },

  filterBar: { maxHeight: 46, paddingLeft: 16, marginTop: 10 },
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
  inactive: { backgroundColor: '#FEE2E2', borderRadius: theme.radius.full, paddingHorizontal: 8, paddingVertical: 3 },
  inactiveText: { fontSize: 10, fontWeight: '800', color: theme.colors.danger },
  metaGrid: { marginTop: 10, gap: 4 },
  metaItem: { fontSize: 12, color: theme.colors.textSecondary },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  smallBtn: { flex: 1, paddingVertical: 8, borderRadius: 10, backgroundColor: theme.colors.background, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center' },
  smallBtnText: { fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary },
  act: { width: 34, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.background },

  feeRow: { flexDirection: 'row', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: theme.colors.border },
  feeCell: { flex: 1, alignItems: 'center' },
  feeCap: { fontSize: 10, color: theme.colors.textMuted, fontWeight: '700' },
  feeVal: { fontSize: 13, fontWeight: '900', color: theme.colors.textPrimary, marginTop: 2 },

  pickRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.card, borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: theme.colors.border },
  rowName: { fontSize: 14, fontWeight: '700', color: theme.colors.textPrimary },
  rowSub: { fontSize: 11, color: theme.colors.textMuted, marginTop: 2 },
  backLink: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  backLinkText: { fontSize: 13, fontWeight: '700', color: theme.colors.primary },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: theme.colors.textPrimary, marginTop: 8, marginBottom: 8 },
  payBtn: { marginTop: 12, height: 42, borderRadius: 12, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center' },
  payBtnText: { fontSize: 14, fontWeight: '800', color: '#fff' },
  payRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.card, borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: theme.colors.border },
  monthTag: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  monthTagText: { fontSize: 11, fontWeight: '800' },

  fab: { position: 'absolute', right: 18, bottom: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center', elevation: 5, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },

  fieldLabel: { fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary, marginTop: 14, marginBottom: 6 },
  wrapChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  selChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 7, borderRadius: theme.radius.full, backgroundColor: theme.colors.background, borderWidth: 1, borderColor: theme.colors.border },
  selChipActive: { backgroundColor: theme.colors.primaryLight, borderColor: theme.colors.primary },
  selChipText: { fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary },
  selChipTextActive: { color: theme.colors.primary },
  monthChip: { width: '22%', alignItems: 'center', paddingVertical: 9, borderRadius: 10, backgroundColor: theme.colors.background, borderWidth: 1, borderColor: theme.colors.border },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 },
  toggleLabel: { fontSize: 14, fontWeight: '600', color: theme.colors.textPrimary },
  photoBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.background, marginTop: 4 },
  photoBtnText: { flex: 1, fontSize: 13, color: theme.colors.textPrimary },
});
