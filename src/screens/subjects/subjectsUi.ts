import constant from '../../utils/constant';

// Subject images come from the same host as the API but outside the /api/v1 prefix.
const FILE_ORIGIN = constant.API_BASE_URL.replace(/\/api\/v\d+\/?$/, '');

export const resolveFileUrl = (url?: string | null): string | undefined => {
  if (!url) return undefined;
  if (/^https?:\/\//i.test(url)) return url;
  return `${FILE_ORIGIN}/${url.replace(/^\/+/, '')}`;
};

// "1 chapter", "10 chapters".
export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
