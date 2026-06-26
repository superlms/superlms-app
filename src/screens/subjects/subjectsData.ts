export interface Topic   { id: string; name: string }
export interface Chapter { id: string; name: string; topics: Topic[] }
export interface Subject {
  id: string;
  name: string;
  icon: string;
  color: string;
  bg: string;
  teacher: string;
  chapters: Chapter[];
}

export const SUBJECTS: Subject[] = [
  {
    id: '1', name: 'Physics', icon: '⚛️', color: '#6366F1', bg: '#EEF2FF', teacher: 'Ravi Sharma',
    chapters: [
      { id: 'c1', name: 'Motion & Laws',  topics: [{ id: 't1', name: 'Introduction to Motion' }, { id: 't2', name: "Newton's Laws" }, { id: 't3', name: 'Friction' }] },
      { id: 'c2', name: 'Work & Energy',  topics: [{ id: 't1', name: 'Work Done' }, { id: 't2', name: 'Kinetic Energy' }, { id: 't3', name: 'Potential Energy' }] },
      { id: 'c3', name: 'Gravitation',    topics: [{ id: 't1', name: "Newton's Law of Gravitation" }, { id: 't2', name: 'Free Fall' }] },
      { id: 'c4', name: 'Sound',          topics: [{ id: 't1', name: 'Nature of Sound' }, { id: 't2', name: 'Speed of Sound' }] },
      { id: 'c5', name: 'Light',          topics: [] },
    ],
  },
  {
    id: '2', name: 'Mathematics', icon: '📐', color: '#0EA5E9', bg: '#E0F2FE', teacher: 'Priya Mehta',
    chapters: [
      { id: 'c1', name: 'Real Numbers',     topics: [{ id: 't1', name: "Euclid's Division Lemma" }, { id: 't2', name: 'Fundamental Theorem' }] },
      { id: 'c2', name: 'Polynomials',      topics: [{ id: 't1', name: 'Zeroes of Polynomial' }, { id: 't2', name: 'Division Algorithm' }] },
      { id: 'c3', name: 'Linear Equations', topics: [{ id: 't1', name: 'Graphical Method' }, { id: 't2', name: 'Substitution Method' }] },
      { id: 'c4', name: 'Quadratics',       topics: [{ id: 't1', name: 'Factorisation' }, { id: 't2', name: 'Quadratic Formula' }] },
    ],
  },
  {
    id: '3', name: 'Chemistry', icon: '🧪', color: '#10B981', bg: '#D1FAE5', teacher: 'Anil Verma',
    chapters: [
      { id: 'c1', name: 'Matter',            topics: [{ id: 't1', name: 'States of Matter' }, { id: 't2', name: 'Evaporation' }] },
      { id: 'c2', name: 'Atoms & Molecules', topics: [{ id: 't1', name: 'Laws of Chemical Combination' }] },
      { id: 'c3', name: 'Structure of Atom', topics: [{ id: 't1', name: 'Electrons & Protons' }, { id: 't2', name: 'Atomic Models' }] },
    ],
  },
  {
    id: '4', name: 'Biology', icon: '🌿', color: '#22C55E', bg: '#DCFCE7', teacher: 'Sunita Rao',
    chapters: [
      { id: 'c1', name: 'Cell',    topics: [{ id: 't1', name: 'Cell Theory' }, { id: 't2', name: 'Cell Organelles' }] },
      { id: 'c2', name: 'Tissues', topics: [{ id: 't1', name: 'Plant Tissues' }, { id: 't2', name: 'Animal Tissues' }] },
    ],
  },
  {
    id: '5', name: 'English', icon: '📖', color: '#F59E0B', bg: '#FEF3C7', teacher: 'Deepak Singh',
    chapters: [
      { id: 'c1', name: 'Prose',  topics: [{ id: 't1', name: 'The Fun They Had' }, { id: 't2', name: 'The Sound of Music' }] },
      { id: 'c2', name: 'Poetry', topics: [{ id: 't1', name: 'The Road Not Taken' }, { id: 't2', name: 'Wind' }] },
      { id: 'c3', name: 'Grammar', topics: [{ id: 't1', name: 'Tenses' }, { id: 't2', name: 'Voice' }] },
    ],
  },
  {
    id: '6', name: 'History', icon: '🏛️', color: '#EF4444', bg: '#FEE2E2', teacher: 'Kavita Joshi',
    chapters: [
      { id: 'c1', name: 'French Revolution', topics: [{ id: 't1', name: 'Causes' }, { id: 't2', name: 'Events' }, { id: 't3', name: 'Impact' }] },
      { id: 'c2', name: 'Russian Revolution', topics: [{ id: 't1', name: 'Background' }, { id: 't2', name: 'Bolsheviks' }] },
    ],
  },
  {
    id: '7', name: 'Geography', icon: '🌍', color: '#8B5CF6', bg: '#EDE9FE', teacher: 'Mohan Das',
    chapters: [
      { id: 'c1', name: 'India – Size & Location', topics: [{ id: 't1', name: 'Location' }, { id: 't2', name: 'Size' }] },
      { id: 'c2', name: 'Physical Features',        topics: [{ id: 't1', name: 'Himalayas' }, { id: 't2', name: 'Northern Plains' }] },
    ],
  },
  {
    id: '8', name: 'Computer', icon: '💻', color: '#EC4899', bg: '#FCE7F3', teacher: 'Neha Kapoor',
    chapters: [
      { id: 'c1', name: 'Introduction to Computers', topics: [{ id: 't1', name: 'Hardware' }, { id: 't2', name: 'Software' }] },
      { id: 'c2', name: 'MS Office', topics: [{ id: 't1', name: 'MS Word' }, { id: 't2', name: 'MS Excel' }] },
    ],
  },
  {
    id: '9', name: 'Sanskrit', icon: '📜', color: '#D97706', bg: '#FEF9C3', teacher: 'Ramesh Shastri',
    chapters: [
      { id: 'c1', name: 'Sandhi', topics: [{ id: 't1', name: 'Swar Sandhi' }, { id: 't2', name: 'Vyanjan Sandhi' }] },
    ],
  },
];
