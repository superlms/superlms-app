// ─── Selection options (all carry the IDs the marks/exam-copy APIs need) ──────
export interface OptionItem {
  id: string;
  label: string;
}

export interface ExamOption extends OptionItem {
  examId: number;
  totalMarks: number;
}

export interface ClassOption extends OptionItem {
  standardId: number;
  sectionId: number;
}

export interface SubjectOption extends OptionItem {
  subjectId: number;
}

// ─── Selection across the stepped dropdown ───────────────────────────────────
export interface Selection {
  exam: ExamOption | null;
  cls: ClassOption | null;
  subject: SubjectOption | null;
}

export const emptySelection = (): Selection => ({
  exam: null,
  cls: null,
  subject: null,
});

export const isComplete = (s: Selection): boolean =>
  !!(s.exam && s.cls && s.subject);

// ─── Students (roster loaded from the API) ───────────────────────────────────
export interface UploadStudent {
  id: string; // String(student_detail_id) — used as list/map key
  studentDetailId: number;
  rollNo: string;
  name: string;
}

// ─── Submitted entries (shared by upload + manage screens) ───────────────────
export interface UploadEntry {
  studentId: string;
  studentDetailId: number;
  rollNo: string;
  name: string;
  fileName?: string; // copy mode
  uri?: string; // copy mode (local file picked this session)
  fileType?: string; // copy mode
  pdfUrl?: string; // copy mode (already-uploaded copy from the server)
  marks?: number; // marks mode
  serverId?: number; // id of the saved row, if it already exists (enables delete/update)
}
