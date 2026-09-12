// Small words that read wrong left in capitals mid-name: "Introduction to Motion".
const SMALL_WORDS = new Set(['AN', 'AND', 'AS', 'AT', 'BY', 'FOR', 'IN', 'OF', 'ON', 'OR', 'THE', 'TO']);

/**
 * Names the school typed entirely in capitals ("MATHEMATICS", "CHAPTER 1",
 * "INTRODUCTION TO MOTION") shout from a list, so they are brought to title
 * case. Short capitalised words stay as they are — those are usually real
 * abbreviations (SST, EVS, GK) — except the small joining words above.
 *
 * Anything with a lower-case letter in it was typed that way on purpose and is
 * left exactly as it is.
 */
export const quietCaps = (text?: string | null): string => {
  const t = (text ?? '').trim();
  if (!/[A-Z]/.test(t) || t !== t.toUpperCase()) return t;

  let first = true;
  return t.replace(/[A-Z][A-Z']*/g, word => {
    const isFirst = first;
    first = false;
    const title = word[0] + word.slice(1).toLowerCase();
    if (word.length > 3) return title;
    if (SMALL_WORDS.has(word)) return isFirst ? title : word.toLowerCase();
    return word;
  });
};
