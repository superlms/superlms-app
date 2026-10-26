import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useFocusLoad } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { FeeStudent, StudentLedger, getFeeStudents, getStudentLedger } from '../../api/adminFeeApi';
import { PenaltyClassRow, getPenaltyClass } from '../../api/adminFeeSetupApi';
import { DocHeader } from '../more/docUi';
import { UnderlineTabs } from './adminExamUi';
import { Avatar, ErrorBox, ListSkeleton } from './adminTransportUi';
import { ClassPills, useFeeClasses } from './adminFeeUi';
import { StatCells } from './panelUi';
import {
  Band,
  ClearPill,
  GroupHead,
  GroupsSkeleton,
  HeadActions,
  HeadLink,
  NumLine,
  PickPill,
  Prompt,
  Strip,
  rupees,
} from './feeSetupUi';

/**
 * Penalties — the panel's tab: late-fee penalties on the fee cycle's
 * installments, net of anything waived or paid off.
 *
 * By Student: a class, a section and a student in the band, then what they
 * owe — academic, transport and in all — and each fee cycle's installments
 * with their due date, balance, status and the penalty still due. Waiver in
 * the header writes a penalty off.
 *
 * By Class: a class (and a section) and every student of it with what they
 * owe in penalty, academic and transport; a row opens that student's view.
 */

type Tab = 'by_student' | 'by_class';

const STATUS_WORD: Record<string, string> = { paid: 'Paid', partial: 'Partial', pending: 'Due', na: '—' };

const AdminFeePenaltiesScreen = ({ navigation }: any) => {
  const classes = useFeeClasses();
  const [tab, setTab] = useState<Tab>('by_student');

  // ── By student ─────────────────────────────────────────────────────────────
  const [classId, setClassId] = useState<number | null>(null);
  const [sectionId, setSectionId] = useState<number | null>(null);
  const [students, setStudents] = useState<FeeStudent[]>([]);
  const [studentId, setStudentId] = useState<number | null>(null);
  const [ledger, setLedger] = useState<StudentLedger | null>(null);
  const [ledgerError, setLedgerError] = useState<string | null>(null);
  const [loadingLedger, setLoadingLedger] = useState(false);
  const lseq = useRef(0);

  useEffect(() => {
    let live = true;
    setStudents([]);
    if (!classId) return;
    getFeeStudents({ standard_id: classId, section_id: sectionId ?? undefined })
      .then(d => live && setStudents(d))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [classId, sectionId]);

  const loadLedger = useCallback(async () => {
    const mine = ++lseq.current;
    if (!studentId) {
      setLedger(null);
      return;
    }
    setLedgerError(null);
    setLoadingLedger(true);
    try {
      const d = await getStudentLedger(studentId);
      if (mine === lseq.current) setLedger(d);
    } catch (e) {
      if (mine === lseq.current) setLedgerError(apiErr(e, 'Could not load the penalties.'));
    } finally {
      if (mine === lseq.current) setLoadingLedger(false);
    }
  }, [studentId]);

  useEffect(() => {
    setLedger(null);
    loadLedger();
  }, [loadLedger]);

  // ── By class ───────────────────────────────────────────────────────────────
  const [cClassId, setCClassId] = useState<number | null>(null);
  const [cSectionId, setCSectionId] = useState<number | null>(null);
  const [rows, setRows] = useState<PenaltyClassRow[] | null>(null);
  const [classTotal, setClassTotal] = useState(0);
  const [classError, setClassError] = useState<string | null>(null);
  const cseq = useRef(0);

  const loadClass = useCallback(async () => {
    const mine = ++cseq.current;
    setRows(null);
    setClassError(null);
    if (!cClassId) return;
    try {
      const d = await getPenaltyClass(cClassId, cSectionId);
      if (mine === cseq.current) {
        setRows(d.students);
        setClassTotal(d.total);
      }
    } catch (e) {
      if (mine === cseq.current) setClassError(apiErr(e, 'Could not load the students.'));
    }
  }, [cClassId, cSectionId]);

  useEffect(() => {
    loadClass();
  }, [loadClass]);

  // Back from a waiver, the figures are fresh.
  const first = useRef(true);
  useFocusLoad(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (studentId) loadLedger();
    if (cClassId) loadClass();
  });

  const [refreshing, setRefreshing] = useState(false);
  const refresh = async () => {
    setRefreshing(true);
    try {
      await (tab === 'by_student' ? loadLedger() : loadClass());
    } finally {
      setRefreshing(false);
    }
  };

  const openFromClass = (row: PenaltyClassRow) => {
    setClassId(cClassId);
    setSectionId(cSectionId);
    setStudentId(row.id);
    setTab('by_student');
  };

  const student = students.find(x => x.id === studentId) ?? null;

  // ── Views ──────────────────────────────────────────────────────────────────
  const byStudent = () => {
    if (!studentId) {
      return <Prompt icon="person-outline" title="Select a student" sub="Pick a class, section and student from the filter above to see what they owe in penalties." />;
    }
    if (ledgerError && !ledger) return <ErrorBox message={ledgerError} onRetry={loadLedger} />;
    if (!ledger || loadingLedger) return <GroupsSkeleton groups={2} lines={4} />;

    const cycles = ledger.cycles ?? [];
    const academic = cycles.find(c => c.fee_type === 'academic');
    const transport = cycles.find(c => c.fee_type === 'transport');
    const net = cycles.reduce((sum, c) => sum + (c.penalty_net || 0), 0);
    const amber = (v: number) => (v > 0 ? '#D97706' : theme.colors.textMuted);

    return (
      <View style={s.pad}>
        <View style={s.who}>
          <Avatar uri={ledger.photo} name={ledger.student.name} size={40} />
          <View style={s.whoBody}>
            <Text style={s.whoName} numberOfLines={1}>{ledger.student.name}</Text>
            <Text style={s.whoMeta} numberOfLines={1}>{`${ledger.student.class_section} · Adm ${ledger.student.admission_no}`}</Text>
          </View>
        </View>
        <StatCells
          columns={3}
          items={[
            { label: 'Academic', value: rupees(academic?.penalty_net ?? 0), color: amber(academic?.penalty_net ?? 0) },
            { label: 'Transport', value: rupees(transport?.penalty_net ?? 0), color: amber(transport?.penalty_net ?? 0) },
            { label: 'Total Still Due', value: rupees(net), color: amber(net) },
          ]}
        />

        {cycles.length === 0 ? (
          <Prompt icon="repeat-outline" title="No fee cycle" sub="No fee cycle is defined for this student's class." />
        ) : (
          cycles.map(c => {
            const parts = [
              `Penalty accrued ${rupees(c.penalty_total)}`,
              c.penalty_waived > 0 ? `Waived − ${rupees(c.penalty_waived)}` : null,
              c.penalty_paid > 0 ? `Paid − ${rupees(c.penalty_paid)}` : null,
              `Still Due ${rupees(c.penalty_net)}`,
            ].filter(Boolean);
            return (
              <View key={c.fee_type}>
                <GroupHead
                  icon="repeat-outline"
                  title={`${c.fee_type === 'transport' ? 'Transport' : 'Academic'} Fee Cycle`}
                  sub={`${c.label} · ${c.year}\n${parts.join(' · ')}`}
                />
                {c.installments.map((inst, n) => (
                  <NumLine
                    key={`${c.fee_type}-${n}`}
                    n={n + 1}
                    label={inst.label}
                    sub={`${inst.due_date ? `Due ${inst.due_date}` : 'No due date'}${inst.overdue ? ' · Overdue' : ''} · ${rupees(inst.amount)} · Balance ${rupees(inst.balance)} · ${STATUS_WORD[inst.status] ?? '—'}`}
                    value={inst.penalty_net > 0 ? rupees(inst.penalty_net) : '—'}
                    valueSub="Penalty due"
                    tone={inst.penalty_net > 0 ? 'warn' : undefined}
                    muted={inst.penalty_net <= 0}
                    isLast={n === c.installments.length - 1}
                  />
                ))}
              </View>
            );
          })
        )}
      </View>
    );
  };

  const byClass = () => {
    if (!cClassId) return <Prompt icon="people-outline" title="Pick a class" sub="Choose a class — and a section, if you want — to list its students with what they owe in penalties." />;
    if (classError && !rows) return <ErrorBox message={classError} onRetry={loadClass} />;
    if (!rows) return <ListSkeleton rows={7} />;
    if (rows.length === 0) return <Prompt icon="people-outline" title="No students" sub="This class has no students yet." />;
    return (
      <View style={s.pad}>
        <Strip items={[{ label: 'Students', value: rows.length }, { label: 'Total penalty due', value: rupees(classTotal), color: classTotal > 0 ? '#D97706' : undefined }]} />
        {rows.map((r, i) => (
          <NumLine
            key={r.id}
            n={i + 1}
            label={r.name}
            sub={`Adm ${r.admission_no} · ${r.class_section}\nAcademic ${rupees(r.academic_penalty)} · Transport ${rupees(r.transport_penalty)}`}
            value={rupees(r.total_penalty)}
            valueSub="Total due"
            tone={r.total_penalty > 0 ? 'warn' : undefined}
            muted={r.total_penalty <= 0}
            onPress={() => openFromClass(r)}
            isLast={i === rows.length - 1}
          />
        ))}
      </View>
    );
  };

  const canWaive = tab === 'by_student' && !!ledger;

  return (
    <View style={s.root}>
      <DocHeader
        title="Penalties"
        onBackPress={() => navigation.goBack()}
        rightSlot={
          <HeadActions>
            <HeadLink
              label="Waiver"
              disabled={!canWaive}
              onPress={() => ledger && navigation.navigate('AdminFeeWaiver', { studentId: ledger.student.id, name: ledger.student.name, cycles: ledger.cycles, collectedBy: ledger.submitted_by })}
            />
          </HeadActions>
        }
      />
      <UnderlineTabs
        tabs={[
          { key: 'by_student', label: 'By Student' },
          { key: 'by_class', label: 'By Class' },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'by_student' ? (
        <Band>
          <ClassPills
            classes={classes}
            classId={classId}
            sectionId={sectionId}
            allLabel="Select Class"
            onChange={(c, sec) => {
              setClassId(c);
              setSectionId(sec);
              setStudentId(null);
            }}
          />
          {!!classId && (
            <PickPill
              title="Student"
              label={student ? student.name : 'Select Student'}
              active={!!student}
              options={students.map(x => ({ key: String(x.id), label: x.name, sub: x.admission_no ? `Adm ${x.admission_no}` : undefined }))}
              value={studentId ? String(studentId) : null}
              onPick={k => setStudentId(Number(k))}
            />
          )}
          {(!!classId || !!studentId) && (
            <ClearPill
              onPress={() => {
                setClassId(null);
                setSectionId(null);
                setStudentId(null);
              }}
            />
          )}
        </Band>
      ) : (
        <Band>
          <ClassPills
            classes={classes}
            classId={cClassId}
            sectionId={cSectionId}
            allLabel="Select Class"
            onChange={(c, sec) => {
              setCClassId(c);
              setCSectionId(sec);
            }}
          />
          {!!cClassId && (
            <ClearPill
              onPress={() => {
                setCClassId(null);
                setCSectionId(null);
              }}
            />
          )}
        </Band>
      )}

      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={refresh} />}
      >
        {tab === 'by_student' ? byStudent() : byClass()}
      </ScrollView>
    </View>
  );
};

export default AdminFeePenaltiesScreen;

const __mk_s = () => StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.card },
  pad: { paddingHorizontal: 20 },
  scroll: { paddingBottom: 40 },
  who: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  whoBody: { flex: 1, gap: 2 },
  whoName: { fontSize: 15, fontWeight: '600', color: theme.colors.textPrimary },
  whoMeta: { fontSize: 12, color: theme.colors.textMuted },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });

