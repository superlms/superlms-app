/**
 * Dates typed the way the school writes them — DD/MM/YYYY — while the server
 * keeps YYYY-MM-DD.
 *
 * typeDate() is a box's onChangeText: the first two digits are the day and a
 * "/" follows by itself, the next two the month (never above 12) and another
 * "/", then the four of the year. A day starting 4–9 or a month starting 2–9
 * can only be that one digit, so it gets its 0 and the "/" at once. A digit
 * that would make a day above 31 or a month above 12 is not taken.
 */
export const typeDate = (next: string, prev: string): string => {
  const digits = next.replace(/\D/g, '');
  let day = '';
  let month = '';
  let year = '';

  for (const c of digits) {
    if (day.length < 2) {
      if (!day) {
        day = c > '3' ? '0' + c : c;
      } else if (Number(day + c) >= 1 && Number(day + c) <= 31) {
        day += c;
      }
    } else if (month.length < 2) {
      if (!month) {
        month = c > '1' ? '0' + c : c;
      } else if (Number(month + c) >= 1 && Number(month + c) <= 12) {
        month += c;
      }
    } else if (year.length < 4) {
      year += c;
    }
  }

  // Backspace takes the "/" away like any other character, instead of the
  // box putting it straight back.
  const slash = next.length >= prev.length || next.endsWith('/');

  let out = day;
  if (day.length === 2 && (month || slash)) out += '/' + month;
  if (month.length === 2 && (year || slash)) out += '/' + year;
  return out;
};

/**
 * DD/MM/YYYY → YYYY-MM-DD for the server. An empty box gives '', anything
 * that is not a whole, real date (31/02/2015, 12/04/15) gives null.
 */
export const toApiDate = (v?: string | null): string | null => {
  const text = (v ?? '').trim();
  if (!text) return '';

  const m = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;

  const [, dd, mm, yyyy] = m;
  const d = new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd)));
  if (d.getUTCFullYear() !== Number(yyyy) || d.getUTCMonth() !== Number(mm) - 1 || d.getUTCDate() !== Number(dd)) {
    return null;
  }
  return `${yyyy}-${mm}-${dd}`;
};

/** The server's YYYY-MM-DD (time and all) → DD/MM/YYYY for the box. */
export const fromApiDate = (v?: string | null): string => {
  const m = (v ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
};
