export interface HWAttachment {
  type: 'image' | 'pdf';
  name: string;
  url?: string;
}

export interface Homework {
  id: string;
  subjectId: string;
  subjectName: string;
  subjectIcon: string;
  subjectColor: string;
  teacherName: string;
  title: string;
  description: string;
  dueDate: string; // 'YYYY-MM-DD'
  createdAt: string; // 'HH:MM AM/PM'
  attachments?: HWAttachment[];
}

export interface HWSubject {
  id: string;
  name: string;
  icon: string;
  color: string;
  bg: string;
}

export const HW_SUBJECTS: HWSubject[] = [
  { id: 's1', name: 'Physics', icon: '⚛️', color: '#6366F1', bg: '#EEF2FF' },
  {
    id: 's2',
    name: 'Mathematics',
    icon: '📐',
    color: '#0EA5E9',
    bg: '#E0F2FE',
  },
  { id: 's3', name: 'Chemistry', icon: '🧪', color: '#10B981', bg: '#D1FAE5' },
  { id: 's4', name: 'English', icon: '📖', color: '#F59E0B', bg: '#FEF3C7' },
  { id: 's5', name: 'History', icon: '🏛️', color: '#EF4444', bg: '#FEE2E2' },
];

const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};

// Shared in-memory store — both screens import this array
export const HOMEWORK_STORE: Homework[] = [
  {
    id: 'hw1',
    subjectId: 's1',
    subjectName: 'Physics',
    subjectIcon: '⚛️',
    subjectColor: '#6366F1',
    teacherName: 'Mr. Sharma',
    title: "Newton's Laws Practice",
    description:
      "Solve problems 1–10 from chapter 3 on Newton's laws of motion.",
    dueDate: daysAgo(0),
    createdAt: '09:30 AM',
    attachments: [
      {
        type: 'image',
        name: 'chapter3_diagram.jpg',
        url: 'https://picsum.photos/seed/physics/900/600',
      },
      { type: 'pdf', name: 'chapter3_problems.pdf' },
    ],
  },
  {
    id: 'hw2',
    subjectId: 's2',
    subjectName: 'Mathematics',
    subjectIcon: '📐',
    subjectColor: '#0EA5E9',
    teacherName: 'Ms. Patel',
    title: 'Polynomial Zeroes',
    description:
      'Find zeroes of the given polynomials — exercise 2.2 Q1 to Q5.',
    dueDate: daysAgo(0),
    createdAt: '11:00 AM',
  },
  {
    id: 'hw3',
    subjectId: 's3',
    subjectName: 'Chemistry',
    subjectIcon: '🧪',
    subjectColor: '#10B981',
    teacherName: 'Mr. Verma',
    title: 'Balancing Equations',
    description:
      'Balance the chemical equations given in the worksheet and write the reaction types.',
    dueDate: daysAgo(2),
    createdAt: '10:15 AM',
    attachments: [{ type: 'pdf', name: 'equations_worksheet.pdf' }],
  },
  {
    id: 'hw4',
    subjectId: 's4',
    subjectName: 'English',
    subjectIcon: '📖',
    subjectColor: '#F59E0B',
    teacherName: 'Ms. Iyer',
    title: 'Essay: My Best Friend',
    description:
      'Write a 300-word essay on "My Best Friend". Focus on grammar and paragraph structure.',
    dueDate: daysAgo(5),
    createdAt: '01:40 PM',
    attachments: [
      {
        type: 'image',
        name: 'essay_format.jpg',
        url: 'https://picsum.photos/seed/english/900/600',
      },
    ],
  },
  {
    id: 'hw5',
    subjectId: 's5',
    subjectName: 'History',
    subjectIcon: '🏛️',
    subjectColor: '#EF4444',
    teacherName: 'Mr. Khan',
    title: 'Mughal Empire Timeline',
    description:
      'Prepare a timeline chart of major Mughal emperors with one achievement each.',
    dueDate: daysAgo(9),
    createdAt: '12:05 PM',
  },
  {
    id: 'hw6',
    subjectId: 's2',
    subjectName: 'Mathematics',
    subjectIcon: '📐',
    subjectColor: '#0EA5E9',
    teacherName: 'Ms. Patel',
    title: 'Linear Equations Graphs',
    description:
      'Draw graphs for the pair of linear equations — exercise 3.1 Q1 to Q3.',
    dueDate: daysAgo(13),
    createdAt: '09:00 AM',
    attachments: [
      {
        type: 'image',
        name: 'graph_sample.jpg',
        url: 'https://picsum.photos/seed/maths/900/600',
      },
      { type: 'pdf', name: 'graph_paper.pdf' },
    ],
  },
];

const fmt = (d: Date) =>
  d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

export const addHomework = (hw: Omit<Homework, 'id' | 'createdAt'>) => {
  HOMEWORK_STORE.push({
    ...hw,
    id: `hw_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: fmt(new Date()),
  });
};
