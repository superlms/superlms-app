export type ExamStatus = 'Upcoming' | 'Ongoing' | 'Completed';
export type ExamType = 'Unit Test' | 'Mid Term' | 'Final Term' | 'Pre-Board';

export interface SyllabusItem {
  subject: string;
  topics: string[];
}

export interface Exam {
  id: string;
  name: string;
  subtitle: string;
  academicYear: string;
  // Free-form exam type coming from the API (e.g. "Unit Test", "Mid Term").
  type: string;
  dateRange: string;
  startDate: string;
  endDate: string;
  status: ExamStatus;
  totalMarks: number;
  passingMarks: number;
  venue: string;
  instructions: string[];
  syllabus: SyllabusItem[];
}

export const STATUS_CONFIG: Record<
  ExamStatus,
  { color: string; bg: string; accent: string }
> = {
  Ongoing: { color: '#16A34A', bg: '#DCFCE7', accent: '#16A34A' },
  Upcoming: { color: '#D97706', bg: '#FEF3C7', accent: '#D97706' },
  Completed: { color: '#64748B', bg: '#F1F5F9', accent: '#94A3B8' },
};

// Maps the API exam status (lower-case) to the UI status label.
export const statusFromApi = (status?: string | null): ExamStatus => {
  switch ((status || '').toLowerCase()) {
    case 'upcoming':
      return 'Upcoming';
    case 'completed':
      return 'Completed';
    default:
      return 'Ongoing';
  }
};

export const TYPE_ICON: Record<string, string> = {
  'Unit Test': 'document-text-outline',
  'Mid Term': 'school-outline',
  'Final Term': 'trophy-outline',
  'Pre-Board': 'ribbon-outline',
};

// Tolerant icon lookup — exam_type is free-form on the backend, so fall back to
// a sensible default for anything not in TYPE_ICON.
export const iconForType = (type?: string | null): string =>
  (type && TYPE_ICON[type]) || 'document-text-outline';

// Shown on the Exam Detail screen when the backend has no per-exam instructions.
export const DEFAULT_EXAM_INSTRUCTIONS: string[] = [
  'Carry your admit card on all exam days.',
  'No electronic devices allowed inside the hall.',
  'Report 30 minutes before the exam starts.',
  'Use blue or black ink pen only.',
];

export const FILTERS: (ExamStatus | 'All')[] = [
  'All',
  'Upcoming',
  'Ongoing',
  'Completed',
];

// ─── Student (demo) ──────────────────────────────────────────────────────────
export const STUDENT_INFO = {
  name: 'Arjun Patel',
  photo: 'https://randomuser.me/api/portraits/men/11.jpg',
  className: '10th — A',
  rollNo: '23',
  admissionNo: 'STU-2026-0231',
  dob: '14 Aug 2011',
};

// ─── Seating / schedule per exam ─────────────────────────────────────────────
export interface SubjectSeat {
  subject: string;
  subjectCode: string;
  date: string;
  time: string;
  roomNo: string;
  seatNo: string;
}

export const SEATING_DATA: Record<string, SubjectSeat[]> = {
  '1': [
    {
      subject: 'Mathematics',
      subjectCode: 'MTH301',
      date: '03/02/2026',
      time: '10:00AM - 12:00PM',
      roomNo: 'A101',
      seatNo: '24',
    },
    {
      subject: 'Science',
      subjectCode: 'SCI302',
      date: '05/02/2026',
      time: '10:00AM - 12:00PM',
      roomNo: 'B002',
      seatNo: '49',
    },
    {
      subject: 'English',
      subjectCode: 'ENG303',
      date: '07/02/2026',
      time: '11:40AM - 1:10PM',
      roomNo: 'A103',
      seatNo: '12',
    },
  ],
  '2': [
    {
      subject: 'Mathematics',
      subjectCode: 'MTH301',
      date: '10/03/2026',
      time: '10:00AM - 12:00PM',
      roomNo: 'C201',
      seatNo: '31',
    },
    {
      subject: 'Science',
      subjectCode: 'SCI302',
      date: '12/03/2026',
      time: '10:00AM - 12:00PM',
      roomNo: 'C202',
      seatNo: '08',
    },
    {
      subject: 'Social Science',
      subjectCode: 'SST304',
      date: '14/03/2026',
      time: '11:40AM - 1:10PM',
      roomNo: 'B005',
      seatNo: '17',
    },
  ],
  '3': [
    {
      subject: 'Mathematics',
      subjectCode: 'MTH301',
      date: '05/11/2025',
      time: '10:00AM - 12:00PM',
      roomNo: 'A101',
      seatNo: '24',
    },
    {
      subject: 'Science',
      subjectCode: 'SCI302',
      date: '07/11/2025',
      time: '10:00AM - 12:00PM',
      roomNo: 'A102',
      seatNo: '36',
    },
  ],
  '4': [
    {
      subject: 'Mathematics',
      subjectCode: 'MTH301',
      date: '01/03/2026',
      time: '10:00AM - 12:00PM',
      roomNo: 'D301',
      seatNo: '55',
    },
    {
      subject: 'Science',
      subjectCode: 'SCI302',
      date: '03/03/2026',
      time: '10:00AM - 12:00PM',
      roomNo: 'D302',
      seatNo: '22',
    },
    {
      subject: 'English',
      subjectCode: 'ENG303',
      date: '05/03/2026',
      time: '11:40AM - 1:10PM',
      roomNo: 'D303',
      seatNo: '41',
    },
    {
      subject: 'Social Science',
      subjectCode: 'SST304',
      date: '07/03/2026',
      time: '11:40AM - 1:10PM',
      roomNo: 'D304',
      seatNo: '09',
    },
  ],
};

// ─── Marks / results per exam (evaluated copies) ─────────────────────────────
export interface SubjectResult {
  subject: string;
  code: string;
  obtained: number;
  total: number;
  grade: string;
}

export const EXAM_RESULTS: Record<string, SubjectResult[]> = {
  '1': [
    { subject: 'Mathematics', code: 'MTH301', obtained: 78, total: 100, grade: 'B+' },
    { subject: 'Science', code: 'SCI302', obtained: 84, total: 100, grade: 'A' },
    { subject: 'English', code: 'ENG303', obtained: 91, total: 100, grade: 'A+' },
  ],
  '3': [
    { subject: 'Mathematics', code: 'MTH301', obtained: 72, total: 100, grade: 'B' },
    { subject: 'Science', code: 'SCI302', obtained: 80, total: 100, grade: 'A' },
  ],
  '4': [
    { subject: 'Mathematics', code: 'MTH301', obtained: 88, total: 100, grade: 'A' },
    { subject: 'Science', code: 'SCI302', obtained: 76, total: 100, grade: 'B+' },
    { subject: 'English', code: 'ENG303', obtained: 90, total: 100, grade: 'A+' },
    { subject: 'Social Science', code: 'SST304', obtained: 69, total: 100, grade: 'B' },
  ],
};

export const GRADE_META: Record<string, { color: string; bg: string }> = {
  'A+': { color: '#16A34A', bg: '#DCFCE7' },
  A: { color: '#16A34A', bg: '#DCFCE7' },
  'B+': { color: '#0EA5E9', bg: '#E0F2FE' },
  B: { color: '#0EA5E9', bg: '#E0F2FE' },
  C: { color: '#D97706', bg: '#FEF3C7' },
  D: { color: '#D97706', bg: '#FEF3C7' },
  F: { color: '#EF4444', bg: '#FEE2E2' },
};

export const gradeFor = (pct: number): string =>
  pct >= 90
    ? 'A+'
    : pct >= 80
    ? 'A'
    : pct >= 70
    ? 'B+'
    : pct >= 60
    ? 'B'
    : pct >= 50
    ? 'C'
    : pct >= 35
    ? 'D'
    : 'F';

// ─── Report cards per academic year ──────────────────────────────────────────
export interface ReportCardData {
  year: string;
  term: string;
  subjects: SubjectResult[];
  attendance: string;
  rank: string;
  remarks: string;
}

export const REPORT_CARDS: Record<string, ReportCardData> = {
  '2026-2027': {
    year: '2026-2027',
    term: 'Term I',
    subjects: [
      { subject: 'Mathematics', code: 'MTH301', obtained: 78, total: 100, grade: 'B+' },
      { subject: 'Science', code: 'SCI302', obtained: 84, total: 100, grade: 'A' },
      { subject: 'English', code: 'ENG303', obtained: 91, total: 100, grade: 'A+' },
      { subject: 'Social Science', code: 'SST304', obtained: 74, total: 100, grade: 'B+' },
      { subject: 'Hindi', code: 'HIN305', obtained: 82, total: 100, grade: 'A' },
    ],
    attendance: '92% (184/200 days)',
    rank: '4th of 42',
    remarks:
      'Arjun has shown consistent improvement this term. Excellent grasp of English and Science. Needs more practice in Social Science map work.',
  },
  '2025-2026': {
    year: '2025-2026',
    term: 'Final Term',
    subjects: [
      { subject: 'Mathematics', code: 'MTH301', obtained: 88, total: 100, grade: 'A' },
      { subject: 'Science', code: 'SCI302', obtained: 76, total: 100, grade: 'B+' },
      { subject: 'English', code: 'ENG303', obtained: 90, total: 100, grade: 'A+' },
      { subject: 'Social Science', code: 'SST304', obtained: 69, total: 100, grade: 'B' },
      { subject: 'Hindi', code: 'HIN305', obtained: 79, total: 100, grade: 'B+' },
    ],
    attendance: '89% (178/200 days)',
    rank: '6th of 40',
    remarks:
      'A sincere and disciplined student. Performed very well in languages. Should focus on time management during exams.',
  },
};

export const EXAMS: Exam[] = [
  {
    id: '1',
    name: 'IA 1',
    subtitle: 'Marks System',
    academicYear: '2026-2027',
    type: 'Unit Test',
    dateRange: '03 Feb - 26 Feb 2026',
    startDate: '03 Feb 2026',
    endDate: '26 Feb 2026',
    status: 'Ongoing',
    totalMarks: 100,
    passingMarks: 35,
    venue: 'Main Examination Hall',
    instructions: [
      'Carry your admit card on all exam days.',
      'No electronic devices allowed inside the hall.',
      'Report 30 minutes before the exam starts.',
      'Use blue or black ink pen only.',
    ],
    syllabus: [
      {
        subject: 'Mathematics',
        topics: ['Algebra', 'Linear Equations', 'Polynomials'],
      },
      { subject: 'Science', topics: ['Motion', 'Force & Laws', 'Gravitation'] },
      {
        subject: 'English',
        topics: ['Grammar', 'Comprehension', 'Writing Skills'],
      },
    ],
  },
  {
    id: '2',
    name: 'Mid Term',
    subtitle: 'Marks System',
    academicYear: '2026-2027',
    type: 'Mid Term',
    dateRange: '10 Mar - 20 Mar 2026',
    startDate: '10 Mar 2026',
    endDate: '20 Mar 2026',
    status: 'Upcoming',
    totalMarks: 100,
    passingMarks: 35,
    venue: 'Block B — Rooms 201-210',
    instructions: [
      'Carry your admit card on all exam days.',
      'No electronic devices allowed inside the hall.',
      'Report 30 minutes before the exam starts.',
      'Use blue or black ink pen only.',
    ],
    syllabus: [
      {
        subject: 'Mathematics',
        topics: ['Triangles', 'Coordinate Geometry', 'Statistics'],
      },
      {
        subject: 'Science',
        topics: ['Work & Energy', 'Sound', 'Structure of Atom'],
      },
      {
        subject: 'Social Science',
        topics: ['French Revolution', 'Socialism', 'Nazism'],
      },
    ],
  },
  {
    id: '3',
    name: 'IA 2',
    subtitle: 'Marks System',
    academicYear: '2025-2026',
    type: 'Unit Test',
    dateRange: '05 Nov - 15 Nov 2025',
    startDate: '05 Nov 2025',
    endDate: '15 Nov 2025',
    status: 'Completed',
    totalMarks: 100,
    passingMarks: 35,
    venue: 'Main Examination Hall',
    instructions: [
      'Carry your admit card on all exam days.',
      'No electronic devices allowed inside the hall.',
      'Report 30 minutes before the exam starts.',
    ],
    syllabus: [
      { subject: 'Mathematics', topics: ['Circles', 'Constructions', 'Areas'] },
      {
        subject: 'Science',
        topics: ['Natural Resources', 'Improvement in Food', 'Cell'],
      },
    ],
  },
  {
    id: '4',
    name: 'Final Term',
    subtitle: 'Marks System',
    academicYear: '2025-2026',
    type: 'Final Term',
    dateRange: '01 Mar - 20 Mar 2026',
    startDate: '01 Mar 2026',
    endDate: '20 Mar 2026',
    status: 'Completed',
    totalMarks: 100,
    passingMarks: 35,
    venue: 'All Blocks',
    instructions: [
      'Carry your admit card on all exam days.',
      'No electronic devices allowed inside the hall.',
      'Report 30 minutes before the exam starts.',
      'Use blue or black ink pen only.',
      'Rough work must be done in the answer sheet only.',
    ],
    syllabus: [
      { subject: 'Mathematics', topics: ['Full Syllabus'] },
      { subject: 'Science', topics: ['Full Syllabus'] },
      { subject: 'English', topics: ['Full Syllabus'] },
      { subject: 'Social Science', topics: ['Full Syllabus'] },
    ],
  },
];
