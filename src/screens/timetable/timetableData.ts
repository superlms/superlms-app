export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
export type Day = typeof DAYS[number];

export interface StudentPeriod {
  id: string;
  time: string;
  endTime: string;
  subject: string;
  teacher: string;
  room: string;
  icon: string;
  color: string;
  bg: string;
  type: 'class' | 'break' | 'free';
}

export interface TeacherPeriod {
  id: string;
  time: string;
  endTime: string;
  subject: string;
  class: string;
  section: string;
  room: string;
  icon: string;
  color: string;
  bg: string;
  type: 'class' | 'break' | 'free';
}

export const STUDENT_TIMETABLE: Record<Day, StudentPeriod[]> = {
  Monday: [
    { id: '1', time: '08:00 AM', endTime: '08:30 AM', subject: 'English',     teacher: 'Deepak Singh',  room: 'Room 101', icon: '📖', color: '#F59E0B', bg: '#FEF3C7', type: 'class' },
    { id: '2', time: '08:30 AM', endTime: '09:00 AM', subject: 'Break',       teacher: '',              room: '',         icon: '☕', color: '#94A3B8', bg: '#F1F5F9', type: 'break' },
    { id: '3', time: '09:00 AM', endTime: '10:00 AM', subject: 'Mathematics', teacher: 'Priya Mehta',   room: 'Room 102', icon: '📐', color: '#0EA5E9', bg: '#E0F2FE', type: 'class' },
    { id: '4', time: '10:00 AM', endTime: '11:00 AM', subject: 'Physics',     teacher: 'Ravi Sharma',   room: 'Lab 1',    icon: '⚛️', color: '#6366F1', bg: '#EEF2FF', type: 'class' },
    { id: '5', time: '11:00 AM', endTime: '11:15 AM', subject: 'Break',       teacher: '',              room: '',         icon: '☕', color: '#94A3B8', bg: '#F1F5F9', type: 'break' },
    { id: '6', time: '11:15 AM', endTime: '12:15 PM', subject: 'Chemistry',   teacher: 'Anil Verma',    room: 'Lab 2',    icon: '🧪', color: '#10B981', bg: '#D1FAE5', type: 'class' },
    { id: '7', time: '12:15 PM', endTime: '01:00 PM', subject: 'Lunch',       teacher: '',              room: '',         icon: '🍱', color: '#94A3B8', bg: '#F1F5F9', type: 'break' },
    { id: '8', time: '01:00 PM', endTime: '02:00 PM', subject: 'History',     teacher: 'Kavita Joshi',  room: 'Room 103', icon: '🏛️', color: '#EF4444', bg: '#FEE2E2', type: 'class' },
    { id: '9', time: '02:00 PM', endTime: '03:00 PM', subject: 'Biology',     teacher: 'Sunita Rao',    room: 'Lab 3',    icon: '🌿', color: '#22C55E', bg: '#DCFCE7', type: 'class' },
  ],
  Tuesday: [
    { id: '1', time: '08:00 AM', endTime: '09:00 AM', subject: 'Mathematics', teacher: 'Priya Mehta',   room: 'Room 102', icon: '📐', color: '#0EA5E9', bg: '#E0F2FE', type: 'class' },
    { id: '2', time: '09:00 AM', endTime: '10:00 AM', subject: 'English',     teacher: 'Deepak Singh',  room: 'Room 101', icon: '📖', color: '#F59E0B', bg: '#FEF3C7', type: 'class' },
    { id: '3', time: '10:00 AM', endTime: '10:15 AM', subject: 'Break',       teacher: '',              room: '',         icon: '☕', color: '#94A3B8', bg: '#F1F5F9', type: 'break' },
    { id: '4', time: '10:15 AM', endTime: '11:15 AM', subject: 'Biology',     teacher: 'Sunita Rao',    room: 'Lab 3',    icon: '🌿', color: '#22C55E', bg: '#DCFCE7', type: 'class' },
    { id: '5', time: '11:15 AM', endTime: '12:15 PM', subject: 'History',     teacher: 'Kavita Joshi',  room: 'Room 103', icon: '🏛️', color: '#EF4444', bg: '#FEE2E2', type: 'class' },
    { id: '6', time: '12:15 PM', endTime: '01:00 PM', subject: 'Lunch',       teacher: '',              room: '',         icon: '🍱', color: '#94A3B8', bg: '#F1F5F9', type: 'break' },
    { id: '7', time: '01:00 PM', endTime: '02:00 PM', subject: 'Physics',     teacher: 'Ravi Sharma',   room: 'Lab 1',    icon: '⚛️', color: '#6366F1', bg: '#EEF2FF', type: 'class' },
    { id: '8', time: '02:00 PM', endTime: '03:00 PM', subject: 'Chemistry',   teacher: 'Anil Verma',    room: 'Lab 2',    icon: '🧪', color: '#10B981', bg: '#D1FAE5', type: 'class' },
  ],
  Wednesday: [
    { id: '1', time: '08:00 AM', endTime: '09:00 AM', subject: 'Physics',     teacher: 'Ravi Sharma',   room: 'Lab 1',    icon: '⚛️', color: '#6366F1', bg: '#EEF2FF', type: 'class' },
    { id: '2', time: '09:00 AM', endTime: '10:00 AM', subject: 'Chemistry',   teacher: 'Anil Verma',    room: 'Lab 2',    icon: '🧪', color: '#10B981', bg: '#D1FAE5', type: 'class' },
    { id: '3', time: '10:00 AM', endTime: '10:15 AM', subject: 'Break',       teacher: '',              room: '',         icon: '☕', color: '#94A3B8', bg: '#F1F5F9', type: 'break' },
    { id: '4', time: '10:15 AM', endTime: '11:15 AM', subject: 'Mathematics', teacher: 'Priya Mehta',   room: 'Room 102', icon: '📐', color: '#0EA5E9', bg: '#E0F2FE', type: 'class' },
    { id: '5', time: '11:15 AM', endTime: '12:15 PM', subject: 'English',     teacher: 'Deepak Singh',  room: 'Room 101', icon: '📖', color: '#F59E0B', bg: '#FEF3C7', type: 'class' },
    { id: '6', time: '12:15 PM', endTime: '01:00 PM', subject: 'Lunch',       teacher: '',              room: '',         icon: '🍱', color: '#94A3B8', bg: '#F1F5F9', type: 'break' },
    { id: '7', time: '01:00 PM', endTime: '03:00 PM', subject: 'Free Period', teacher: '',              room: '',         icon: '🎯', color: '#8B5CF6', bg: '#EDE9FE', type: 'free'  },
  ],
  Thursday: [
    { id: '1', time: '08:00 AM', endTime: '09:00 AM', subject: 'Biology',     teacher: 'Sunita Rao',    room: 'Lab 3',    icon: '🌿', color: '#22C55E', bg: '#DCFCE7', type: 'class' },
    { id: '2', time: '09:00 AM', endTime: '10:00 AM', subject: 'History',     teacher: 'Kavita Joshi',  room: 'Room 103', icon: '🏛️', color: '#EF4444', bg: '#FEE2E2', type: 'class' },
    { id: '3', time: '10:00 AM', endTime: '10:15 AM', subject: 'Break',       teacher: '',              room: '',         icon: '☕', color: '#94A3B8', bg: '#F1F5F9', type: 'break' },
    { id: '4', time: '10:15 AM', endTime: '11:15 AM', subject: 'English',     teacher: 'Deepak Singh',  room: 'Room 101', icon: '📖', color: '#F59E0B', bg: '#FEF3C7', type: 'class' },
    { id: '5', time: '11:15 AM', endTime: '12:15 PM', subject: 'Mathematics', teacher: 'Priya Mehta',   room: 'Room 102', icon: '📐', color: '#0EA5E9', bg: '#E0F2FE', type: 'class' },
    { id: '6', time: '12:15 PM', endTime: '01:00 PM', subject: 'Lunch',       teacher: '',              room: '',         icon: '🍱', color: '#94A3B8', bg: '#F1F5F9', type: 'break' },
    { id: '7', time: '01:00 PM', endTime: '02:00 PM', subject: 'Physics',     teacher: 'Ravi Sharma',   room: 'Lab 1',    icon: '⚛️', color: '#6366F1', bg: '#EEF2FF', type: 'class' },
    { id: '8', time: '02:00 PM', endTime: '03:00 PM', subject: 'Chemistry',   teacher: 'Anil Verma',    room: 'Lab 2',    icon: '🧪', color: '#10B981', bg: '#D1FAE5', type: 'class' },
  ],
  Friday: [
    { id: '1', time: '08:00 AM', endTime: '09:00 AM', subject: 'Chemistry',   teacher: 'Anil Verma',    room: 'Lab 2',    icon: '🧪', color: '#10B981', bg: '#D1FAE5', type: 'class' },
    { id: '2', time: '09:00 AM', endTime: '10:00 AM', subject: 'Biology',     teacher: 'Sunita Rao',    room: 'Lab 3',    icon: '🌿', color: '#22C55E', bg: '#DCFCE7', type: 'class' },
    { id: '3', time: '10:00 AM', endTime: '10:15 AM', subject: 'Break',       teacher: '',              room: '',         icon: '☕', color: '#94A3B8', bg: '#F1F5F9', type: 'break' },
    { id: '4', time: '10:15 AM', endTime: '11:15 AM', subject: 'History',     teacher: 'Kavita Joshi',  room: 'Room 103', icon: '🏛️', color: '#EF4444', bg: '#FEE2E2', type: 'class' },
    { id: '5', time: '11:15 AM', endTime: '12:15 PM', subject: 'Physics',     teacher: 'Ravi Sharma',   room: 'Lab 1',    icon: '⚛️', color: '#6366F1', bg: '#EEF2FF', type: 'class' },
    { id: '6', time: '12:15 PM', endTime: '01:00 PM', subject: 'Lunch',       teacher: '',              room: '',         icon: '🍱', color: '#94A3B8', bg: '#F1F5F9', type: 'break' },
    { id: '7', time: '01:00 PM', endTime: '02:00 PM', subject: 'English',     teacher: 'Deepak Singh',  room: 'Room 101', icon: '📖', color: '#F59E0B', bg: '#FEF3C7', type: 'class' },
    { id: '8', time: '02:00 PM', endTime: '03:00 PM', subject: 'Mathematics', teacher: 'Priya Mehta',   room: 'Room 102', icon: '📐', color: '#0EA5E9', bg: '#E0F2FE', type: 'class' },
  ],
  Saturday: [
    { id: '1', time: '08:00 AM', endTime: '09:00 AM', subject: 'Mathematics', teacher: 'Priya Mehta',   room: 'Room 102', icon: '📐', color: '#0EA5E9', bg: '#E0F2FE', type: 'class' },
    { id: '2', time: '09:00 AM', endTime: '10:00 AM', subject: 'English',     teacher: 'Deepak Singh',  room: 'Room 101', icon: '📖', color: '#F59E0B', bg: '#FEF3C7', type: 'class' },
    { id: '3', time: '10:00 AM', endTime: '11:00 AM', subject: 'Free Period', teacher: '',              room: '',         icon: '🎯', color: '#8B5CF6', bg: '#EDE9FE', type: 'free'  },
  ],
};

export const TEACHER_TIMETABLE: Record<Day, TeacherPeriod[]> = {
  Monday: [
    { id: '1', time: '08:00 AM', endTime: '08:30 AM', subject: 'English',     class: 'X',   section: 'Sec-A', room: 'Room 101', icon: '📖', color: '#F59E0B', bg: '#FEF3C7', type: 'class' },
    { id: '2', time: '10:00 AM', endTime: '10:30 AM', subject: 'Science',     class: 'X',   section: 'Sec-B', room: 'Lab 1',    icon: '🔬', color: '#6366F1', bg: '#EEF2FF', type: 'class' },
    { id: '3', time: '12:00 PM', endTime: '12:30 PM', subject: 'History',     class: 'IX',  section: 'Sec-C', room: 'Room 103', icon: '🏛️', color: '#EF4444', bg: '#FEE2E2', type: 'class' },
    { id: '4', time: '02:00 PM', endTime: '02:30 PM', subject: 'Maths',       class: 'VIII',section: 'Sec-A', room: 'Room 102', icon: '📐', color: '#0EA5E9', bg: '#E0F2FE', type: 'class' },
  ],
  Tuesday: [
    { id: '1', time: '09:00 AM', endTime: '09:30 AM', subject: 'English',     class: 'X',   section: 'Sec-B', room: 'Room 101', icon: '📖', color: '#F59E0B', bg: '#FEF3C7', type: 'class' },
    { id: '2', time: '11:00 AM', endTime: '11:30 AM', subject: 'Science',     class: 'IX',  section: 'Sec-A', room: 'Lab 1',    icon: '🔬', color: '#6366F1', bg: '#EEF2FF', type: 'class' },
    { id: '3', time: '01:00 PM', endTime: '01:30 PM', subject: 'Maths',       class: 'VIII',section: 'Sec-C', room: 'Room 102', icon: '📐', color: '#0EA5E9', bg: '#E0F2FE', type: 'class' },
  ],
  Wednesday: [
    { id: '1', time: '08:00 AM', endTime: '09:00 AM', subject: 'Science',     class: 'X',   section: 'Sec-A', room: 'Lab 1',    icon: '🔬', color: '#6366F1', bg: '#EEF2FF', type: 'class' },
    { id: '2', time: '10:00 AM', endTime: '11:00 AM', subject: 'English',     class: 'IX',  section: 'Sec-B', room: 'Room 101', icon: '📖', color: '#F59E0B', bg: '#FEF3C7', type: 'class' },
    { id: '3', time: '12:00 PM', endTime: '01:00 PM', subject: 'History',     class: 'VIII',section: 'Sec-A', room: 'Room 103', icon: '🏛️', color: '#EF4444', bg: '#FEE2E2', type: 'class' },
    { id: '4', time: '02:00 PM', endTime: '03:00 PM', subject: 'Free Period', class: '',    section: '',      room: '',         icon: '🎯', color: '#8B5CF6', bg: '#EDE9FE', type: 'free'  },
  ],
  Thursday: [
    { id: '1', time: '09:00 AM', endTime: '10:00 AM', subject: 'Maths',       class: 'X',   section: 'Sec-C', room: 'Room 102', icon: '📐', color: '#0EA5E9', bg: '#E0F2FE', type: 'class' },
    { id: '2', time: '11:00 AM', endTime: '12:00 PM', subject: 'Science',     class: 'IX',  section: 'Sec-D', room: 'Lab 1',    icon: '🔬', color: '#6366F1', bg: '#EEF2FF', type: 'class' },
    { id: '3', time: '01:00 PM', endTime: '02:00 PM', subject: 'English',     class: 'VIII',section: 'Sec-B', room: 'Room 101', icon: '📖', color: '#F59E0B', bg: '#FEF3C7', type: 'class' },
  ],
  Friday: [
    { id: '1', time: '08:00 AM', endTime: '09:00 AM', subject: 'History',     class: 'X',   section: 'Sec-A', room: 'Room 103', icon: '🏛️', color: '#EF4444', bg: '#FEE2E2', type: 'class' },
    { id: '2', time: '10:00 AM', endTime: '11:00 AM', subject: 'English',     class: 'IX',  section: 'Sec-C', room: 'Room 101', icon: '📖', color: '#F59E0B', bg: '#FEF3C7', type: 'class' },
    { id: '3', time: '12:00 PM', endTime: '01:00 PM', subject: 'Maths',       class: 'VIII',section: 'Sec-D', room: 'Room 102', icon: '📐', color: '#0EA5E9', bg: '#E0F2FE', type: 'class' },
    { id: '4', time: '02:00 PM', endTime: '03:00 PM', subject: 'Science',     class: 'X',   section: 'Sec-B', room: 'Lab 1',    icon: '🔬', color: '#6366F1', bg: '#EEF2FF', type: 'class' },
  ],
  Saturday: [
    { id: '1', time: '08:00 AM', endTime: '09:00 AM', subject: 'English',     class: 'X',   section: 'Sec-D', room: 'Room 101', icon: '📖', color: '#F59E0B', bg: '#FEF3C7', type: 'class' },
    { id: '2', time: '09:00 AM', endTime: '10:00 AM', subject: 'Free Period', class: '',    section: '',      room: '',         icon: '🎯', color: '#8B5CF6', bg: '#EDE9FE', type: 'free'  },
  ],
};
