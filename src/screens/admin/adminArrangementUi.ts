import type { ArrangementSlot } from '../../api/adminArrangementApi';
import { clock12 } from './adminFormUi';

/**
 * The words the admin app's Arrangement pages say a period with.
 */

/** "6th · A · Hindi" */
export const slotClassLine = (slot: ArrangementSlot) =>
  [slot.class, slot.section, slot.subject].filter(v => v && v !== '—').join(' · ');

/** "P3 · 08:00 AM – 08:45 AM" — the period as the school's day counts it. */
export const slotTimeLine = (slot: ArrangementSlot, fallback?: number) => {
  const period = slot.period ?? fallback;
  return [period ? `P${period}` : null, `${clock12(slot.start_time)} – ${clock12(slot.end_time)}`]
    .filter(Boolean)
    .join(' · ');
};
