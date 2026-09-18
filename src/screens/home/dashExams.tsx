import React from 'react';
import moment from 'moment';
import type { DashExam } from '../../api/dashboardApi';
import { humanize, marksLabel } from '../exam/examUi';
import { DateBlock, LineRow, Pill } from './dashboardUi';

/**
 * Upcoming exams as the dashboards list them: the day each starts in a small
 * calendar block, the exam, and how soon it is and what it is out of.
 */

// The day an exam starts. Older servers send only "25 Sep - 28 Sep 2026", whose
// first half takes the year of the second.
const startOf = (exam: DashExam): moment.Moment | null => {
  if (exam.start_date) {
    const d = moment(exam.start_date.slice(0, 10), 'YYYY-MM-DD', true);
    return d.isValid() ? d : null;
  }
  const [from, to] = (exam.date_range ?? '').split(' - ');
  const year = /\d{4}/.exec(to ?? from ?? '')?.[0];
  if (!from || !year) return null;
  const d = moment(/\d{4}/.test(from) ? from : `${from} ${year}`, 'DD MMM YYYY', true);
  return d.isValid() ? d : null;
};

// "Starts in 7 days", "Starts tomorrow", "On now · ends 28 Sep".
export const examSoon = (exam: DashExam): string => {
  if (exam.status === 'ongoing') {
    const end = exam.end_date ? moment(exam.end_date.slice(0, 10), 'YYYY-MM-DD', true) : null;
    return end?.isValid() ? `On now · ends ${end.format('D MMM')}` : 'On now';
  }
  const start = startOf(exam);
  if (!start) return exam.date_range || 'Date to be announced';
  const n = start.diff(moment().startOf('day'), 'days');
  if (n <= 0) return 'Starts today';
  if (n === 1) return 'Starts tomorrow';
  if (n <= 30) return `Starts in ${n} days`;
  return `Starts ${start.format('D MMM')}`;
};

export const ExamRows = ({
  exams,
  onPress,
}: {
  exams: DashExam[];
  onPress?: (exam: DashExam) => void;
}) => (
  <>
    {exams.map((exam, i) => {
      const live = exam.status === 'ongoing';
      return (
        <LineRow
          key={exam.id}
          lead={<DateBlock iso={startOf(exam)?.format('YYYY-MM-DD')} accent={live} />}
          title={exam.name}
          meta={[examSoon(exam), humanize(exam.type), marksLabel(exam.total_marks)].filter(Boolean).join(' · ')}
          trailing={live ? <Pill text="Ongoing" tone="accent" /> : null}
          metaLines={2}
          onPress={onPress ? () => onPress(exam) : undefined}
          isLast={i === exams.length - 1}
        />
      );
    })}
  </>
);
