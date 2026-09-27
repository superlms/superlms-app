import apiClient from './apiClient';
import { PickedFile } from './adminProfileApi';

// ─── Rules & Regulations (edit) ───────────────────────────────────────────────
// The web panel's Rules & Regulations editor, over /admin/rules-and-regulation.
// Students and teachers read the same rules at /rules-and-regulation.

const unwrap = (data: any) => data?.data ?? data;
const MULTIPART = { headers: { 'Content-Type': 'multipart/form-data' } };

export interface RuleSection {
  head: string;
  desc: string;
}

export interface RuleInfo {
  key: string | null;
  value: string | null;
}

export interface RuleFile {
  title: string;
  file_path: string;
  file_type?: string | null;
  /** Bytes. */
  file_size?: number | null;
}

export interface AdminRules {
  /** False until the school saves its rules the first time. */
  exists: boolean;
  /** The standard school rules, to start from, while nothing is saved. */
  using_defaults: boolean;
  sections: RuleSection[];
  additional_info: RuleInfo[];
  files: RuleFile[];
  last_updated: string | null;
}

export const getAdminRules = async (): Promise<AdminRules> => {
  const { data } = await apiClient.get('/admin/rules-and-regulation');
  return unwrap(data);
};

export interface AdminRulesPayload {
  sections: RuleSection[];
  additional_info: { key: string; value: string }[];
  /** New PDFs, each with its title; the saved ones stay. */
  newFiles: { title: string; file: PickedFile }[];
}

export const saveAdminRules = async (p: AdminRulesPayload): Promise<{ rules: AdminRules; message: string }> => {
  const form = new FormData();
  p.sections.forEach((s, i) => {
    form.append(`sections[${i}][head]`, s.head);
    form.append(`sections[${i}][desc]`, s.desc);
  });
  p.additional_info.forEach((a, i) => {
    form.append(`additional_info[${i}][key]`, a.key);
    form.append(`additional_info[${i}][value]`, a.value);
  });
  p.newFiles.forEach((f, i) => {
    form.append(`file_titles[${i}]`, f.title);
    form.append(`files[${i}]`, {
      uri: f.file.uri,
      type: f.file.type || 'application/pdf',
      name: f.file.name || 'document.pdf',
    } as any);
  });
  const { data } = await apiClient.post('/admin/rules-and-regulation', form, MULTIPART);
  return { rules: unwrap(data), message: data?.message ?? '' };
};

/** Takes a saved PDF off straight away, as the panel's cross does. */
export const removeAdminRulesFile = async (file_path: string): Promise<AdminRules> => {
  const { data } = await apiClient.post('/admin/rules-and-regulation/files/remove', { file_path });
  return unwrap(data);
};
