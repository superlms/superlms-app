import apiClient from './apiClient';
import constant from '../utils/constant';
import { authHeader, downloadPdf } from './pdfDownload';

// Re-exported so screens can keep importing it from this module.
export { authHeader };

// Unwrap the standard { success, message, data } envelope.
const unwrap = (data: any) => data?.data ?? data;

// ─── Types (mirror ExamController::formatAdmitCard) ─────────────────────────────
export interface AdmitCardSubject {
  subject_id: number | null;
  subject_name: string;
  subject_code: string | null;
  exam_date: string | null;
  exam_date_formatted: string | null;
  exam_day: string | null;
  exam_time: string | null;
  exam_time_formatted: string | null;
  exam_duration: string;
  total_marks: number | null;
  passing_marks: number | null;
  status: string;
}

export interface AdmitCardExam {
  id: number;
  name: string;
  academic_year: string | null;
  exam_type: string | null;
  term: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string;
  total_marks: number | null;
  passing_marks: number | null;
  total_subjects: number;
}

export interface AdmitCardData {
  id: number;
  issued: boolean;
  admit_card_number: string | null;
  issue_date: string | null;
  issue_date_formatted: string | null;
  status: string;
  pdf_url: string;
  exam: AdmitCardExam;
  subjects: AdmitCardSubject[];
  student: {
    full_name: string | null;
    admission_no: string | null;
    roll_no: string | null;
    roll_number: string | null;
    exam_roll_number: string | null;
    father_name: string | null;
    mother_name: string | null;
    image_url: string | null;
    class: string | null;
  };
  exam_center: {
    name: string | null;
    address: string | null;
    reporting_time: string | null;
    seat_number: string | null;
    room_number: string | null;
    seating_label: string | null;
  };
  organization: {
    name: string | null;
    address: string | null;
    phone: string | null;
    email: string | null;
    logo_url: string | null;
  };
  exam_rules: {
    allowed_items: string[];
    prohibited_items: string[];
    general_instructions: string | null;
  };
}

// ─── Endpoints ──────────────────────────────────────────────────────────────────

/**
 * GET /exams/{id}/admit-card
 * Returns the issued admit card for the authenticated student + the selected
 * exam. Throws an axios error with status 404 when the admin hasn't issued one
 * yet — callers should treat that as the "not issued" empty state
 * (see `isAdmitCardNotIssued`).
 */
export const getExamAdmitCard = async (examId: number | string): Promise<AdmitCardData> => {
  const { data } = await apiClient.get(`/exams/${examId}/admit-card`);
  return unwrap(data) as AdmitCardData;
};

// A 404 from the admit-card endpoint means "not issued yet", not a hard error.
export const isAdmitCardNotIssued = (e: any): boolean => e?.response?.status === 404;

// Absolute URL of the PDF stream (the API already returns it, but we can also
// build it from the exam id as a fallback).
export const admitCardPdfUrl = (examId: number | string): string =>
  `${constant.API_BASE_URL}/exams/${examId}/admit-card/pdf`;

/** Download the admit-card PDF to the device (Android Downloads / iOS share). */
export const downloadAdmitCardPdf = (pdfUrl: string, fileName: string): Promise<string> =>
  downloadPdf(pdfUrl, fileName);

// ─── Error → friendly message ───────────────────────────────────────────────────
export const admitCardErrorMessage = (e: any): string => {
  const status = e?.response?.status;
  const serverMsg = e?.response?.data?.message;
  if (status === 401) return 'Your session has expired. Please log in again.';
  if (status === 403) return serverMsg || 'Only students can view admit cards.';
  if (status === 404) return serverMsg || 'Admit card has not been issued for this exam yet.';
  if (e?.message === 'Network Error' || !e?.response) {
    return 'No internet connection. Check your network and try again.';
  }
  if (status >= 500) return serverMsg || 'The server ran into a problem. Please try again.';
  return serverMsg || 'Something went wrong. Please try again.';
};
