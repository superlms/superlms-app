import constant from '../../utils/constant';

// Covers, subject icons and PDFs come from the same host as the API but outside
// the /api/v1 prefix.
const FILE_ORIGIN = constant.API_BASE_URL.replace(/\/api\/v\d+\/?$/, '');

export const resolveFileUrl = (url?: string | null): string | undefined => {
  if (!url) return undefined;
  if (/^https?:\/\//i.test(url)) return url;
  return `${FILE_ORIGIN}/${url.replace(/^\/+/, '')}`;
};

// Subjects are often stored in capitals ("MATHEMATICS"), which shout from a tab
// strip. Long all-caps words are brought to title case; short ones stay as they
// are, since those are usually real abbreviations — SST, EVS, GK.
export const subjectLabel = (name?: string | null): string =>
  (name ?? '')
    .trim()
    .split(/(\s+)/)
    .map(w =>
      w.length > 3 && w === w.toUpperCase() && /[A-Z]/.test(w)
        ? w[0] + w.slice(1).toLowerCase()
        : w,
    )
    .join('');
