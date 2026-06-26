import { theme } from '../../utils/theme';

// Per-subject color palette used by the chip filter and the card badge.
// Known subjects get a fixed color; everything else falls back to a hashed
// pick from PALETTE so two same-named subjects always render identically.

export interface SubjectMeta {
  color: string;
  bg:    string;
}

const KNOWN: Record<string, SubjectMeta> = {
  All:      { color: theme.colors.primary, bg: theme.colors.primaryLight },
  Hindi:    { color: '#8B5CF6', bg: '#EDE9FE' },
  Maths:    { color: '#0EA5E9', bg: '#E0F2FE' },
  Math:     { color: '#0EA5E9', bg: '#E0F2FE' },
  Mathematics: { color: '#0EA5E9', bg: '#E0F2FE' },
  Science:  { color: '#10B981', bg: '#D1FAE5' },
  SST:      { color: '#F59E0B', bg: '#FEF3C7' },
  'Social Studies': { color: '#F59E0B', bg: '#FEF3C7' },
  English:  { color: '#EF4444', bg: '#FEE2E2' },
  Physics:  { color: '#6366F1', bg: '#E0E7FF' },
  Chemistry:{ color: '#14B8A6', bg: '#CCFBF1' },
  Biology:  { color: '#22C55E', bg: '#DCFCE7' },
  Computer: { color: '#F97316', bg: '#FFEDD5' },
};

const PALETTE: SubjectMeta[] = [
  { color: '#6366F1', bg: '#E0E7FF' },
  { color: '#0EA5E9', bg: '#E0F2FE' },
  { color: '#10B981', bg: '#D1FAE5' },
  { color: '#F59E0B', bg: '#FEF3C7' },
  { color: '#EF4444', bg: '#FEE2E2' },
  { color: '#8B5CF6', bg: '#EDE9FE' },
  { color: '#EC4899', bg: '#FCE7F3' },
  { color: '#14B8A6', bg: '#CCFBF1' },
];

const hash = (s: string): number => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
};

export const subjectMetaFor = (subject: string): SubjectMeta => {
  if (KNOWN[subject]) return KNOWN[subject];
  return PALETTE[hash(subject) % PALETTE.length];
};
