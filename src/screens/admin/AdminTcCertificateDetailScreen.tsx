import React, { useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppAlert } from '../../components/AppDialog';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { DocHeader, DocSection, docStyles } from '../more/docUi';
import { DetailRow } from '../calendar/calendarUi';
import {
  CertItem,
  TcItem,
  certificatePdfUrl,
  deleteCert,
  deleteTc,
  downloadCertificatePdf,
} from '../../api/adminTcCertificateApi';
import { QuietAction, confirmDestructive } from './adminFormUi';
import { HeadActions, HeadBtn } from './adminAdmitCardUi';
import { longDate } from './adminTcUi';

/**
 * One certificate or TC with everything issued on it, as a student's detail
 * pages draw theirs: what it is and when it was issued over its title, then
 * the student and every field in the panel's groups. The header has Edit, then
 * Download — the panel's PDF, saved to the phone. Delete sits at the foot, as
 * on the app's other detail pages.
 *
 * Route params: kind ('cert' | 'tc'); item — the row from the list (an edit
 * hands back the saved one); classes — for the edit form's picker.
 */

const or = (v?: string | number | null) => (v === null || v === undefined || v === '' ? '—' : String(v));

const Rows = ({ rows }: { rows: [string, string | number | null | undefined][] }) => (
  <>
    {rows.map(([label, value], i) => (
      <DetailRow key={label} label={label} value={or(value)} last={i === rows.length - 1} />
    ))}
  </>
);

const AdminTcCertificateDetailScreen = ({ navigation, route }: any) => {
  const kind: 'cert' | 'tc' = route?.params?.kind ?? 'cert';
  const item: CertItem | TcItem = route?.params?.item;
  const classes = route?.params?.classes ?? [];

  const [downloading, setDownloading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isTc = kind === 'tc';
  const cert = item as CertItem;
  const tc = item as TcItem;
  const typeLabel = isTc
    ? 'Transfer Certificate'
    : `${cert.type === 'participation' ? 'Participation' : 'Achievement'} Certificate`;
  const number = isTc ? tc.tc_no : cert.certificate_no;

  const download = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      await downloadCertificatePdf(
        certificatePdfUrl(kind, item.id),
        `${isTc ? 'TC' : 'Certificate'}_${(item.student_name || 'student').replace(/\s+/g, '_')}`,
      );
      AppAlert.alert('Downloaded', Platform.OS === 'android' ? 'Saved to your Downloads.' : 'Saved to your device.');
    } catch (e) {
      AppAlert.alert('Download failed', apiErr(e, 'Could not download.'));
    } finally {
      setDownloading(false);
    }
  };

  const edit = () => navigation.navigate(isTc ? 'AdminTcForm' : 'AdminCertForm', { item, classes });

  const remove = () =>
    confirmDestructive(
      isTc ? 'Delete Transfer Certificate?' : 'Delete Certificate?',
      `${[typeLabel, number].filter(Boolean).join(' · ')} for ${item.student_name || 'this student'} will be removed.`,
      'Yes, Delete',
      async () => {
        setDeleting(true);
        try {
          if (isTc) await deleteTc(item.id);
          else await deleteCert(item.id);
          navigation.goBack();
        } catch (e) {
          AppAlert.alert('Could not delete', apiErr(e, 'Please try again.'));
          setDeleting(false);
        }
      },
    );

  const issuedOn = isTc ? tc.issue_label || longDate(tc.issue_date) : cert.issued_label || longDate(cert.issued_date);

  return (
    <View style={docStyles.root}>
      <DocHeader
        title={isTc ? 'Transfer Certificate' : 'Certificate'}
        onBackPress={() => navigation.goBack()}
        rightSlot={
          <HeadActions>
            <HeadBtn icon="create-outline" onPress={edit} />
            <HeadBtn icon="download-outline" onPress={download} busy={downloading} />
          </HeadActions>
        }
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={docStyles.scroll}>
        {/* What it is and when, then its title */}
        <View>
          <Text style={s.kicker}>{[typeLabel, issuedOn ? `Issued ${issuedOn}` : null].filter(Boolean).join(' · ')}</Text>
          <Text style={s.title}>{isTc ? item.student_name || 'Transfer Certificate' : cert.event_name}</Text>
          {!!number && <Text style={s.number}>{number}</Text>}
        </View>

        <DocSection title="Student">
          <Rows
            rows={[
              ['Name', item.student_name],
              ['Admission No', item.admission_no],
            ]}
          />
        </DocSection>

        {isTc ? (
          <>
            <DocSection title="Transfer Certificate">
              <Rows
                rows={[
                  ['TC No', tc.tc_no],
                  ['Book No', tc.book_no],
                ]}
              />
            </DocSection>

            <DocSection title="Student & Academic">
              <Rows
                rows={[
                  ['Nationality', tc.nationality],
                  ['Scheduled Caste / Tribe', tc.is_sc_st ? 'Yes' : 'No'],
                  ['Class Last Studied', tc.last_class_studied],
                  ['Exam Last Taken with Result', tc.exam_last_taken],
                  ['Whether Failed', tc.whether_failed],
                  ['Qualified for Promotion', tc.qualified_for_promotion],
                  ['Subjects Studied', tc.subjects_studied],
                ]}
              />
            </DocSection>

            <DocSection title="Attendance & Fees">
              <Rows
                rows={[
                  ['Total Working Days', tc.total_working_days],
                  ['Days Present', tc.days_present],
                  ['Fees Paid Upto', tc.fees_paid_upto],
                  ['Fee Concession', tc.fee_concession],
                ]}
              />
            </DocSection>

            <DocSection title="Activities & Conduct">
              <Rows
                rows={[
                  ['NCC / Scout / Guide', tc.is_ncc_scout],
                  ['General Conduct', tc.general_conduct],
                  ['Games / Extra-Curricular', tc.extra_activities],
                ]}
              />
            </DocSection>

            <DocSection title="Issue Details">
              <Rows
                rows={[
                  ['Date of Application', longDate(tc.application_date)],
                  ['Date of Issue', longDate(tc.issue_date)],
                  ['Reason for Leaving', tc.reason_for_leaving],
                  ['Any Other Remark', tc.remarks],
                ]}
              />
            </DocSection>
          </>
        ) : (
          <DocSection title="Certificate">
            <Rows
              rows={[
                ['Type', cert.type === 'participation' ? 'Participation' : 'Achievement'],
                ['Certificate No', cert.certificate_no],
                ['Event / Activity', cert.event_name],
                ['Description', cert.description],
                ['Issued By', cert.issued_by],
                ['Designation', cert.issued_by_designation],
                ['Issued Date', longDate(cert.issued_date)],
              ]}
            />
          </DocSection>
        )}

        <View style={s.foot}>
          <QuietAction
            icon="trash-2"
            label={isTc ? 'Delete transfer certificate' : 'Delete certificate'}
            danger
            busy={deleting}
            onPress={remove}
          />
        </View>
      </ScrollView>
    </View>
  );
};

export default AdminTcCertificateDetailScreen;

const __mk_s = () => StyleSheet.create({
  kicker: { fontSize: 12, color: theme.colors.textMuted, marginBottom: 6 },
  title: { fontSize: 20, fontWeight: '700', color: theme.colors.textPrimary, lineHeight: 27 },
  number: { fontSize: 13, color: theme.colors.textSecondary, marginTop: 4 },
  foot: { paddingTop: 4 },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
