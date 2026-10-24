import { useEffect, useState } from 'react';

/**
 * Files going up and coming down, as they go — so the app can show how far
 * along each one is. Uploads are reported by the API client (any request that
 * carries a file), downloads by downloadFile and the other savers.
 *
 *   const t = startTransfer('download', 'Receipt 12.pdf');
 *   t.update(received, total);
 *   t.done();   // or t.fail()
 *
 * TransferToast draws them; a SavingButton that is saving draws the upload it
 * is waiting on in itself, and the toast leaves that one to it.
 */

export type TransferKind = 'upload' | 'download';
export type TransferState = 'running' | 'done' | 'failed';

export interface Transfer {
  id: number;
  kind: TransferKind;
  /** What is moving: a file's name, or "2 files". */
  label: string;
  /** 0 to 1; null while the size is not known yet. */
  progress: number | null;
  state: TransferState;
  /** A saving button is drawing it; the toast leaves it alone. */
  claimed: boolean;
}

export interface TransferHandle {
  update: (loaded: number, total?: number | null) => void;
  done: () => void;
  fail: () => void;
}

let nextId = 1;
let transfers: Transfer[] = [];
const listeners = new Set<() => void>();
// How many saving buttons are drawing an upload themselves.
let claims = 0;

const emit = () => listeners.forEach(l => l());

const patch = (id: number, change: Partial<Transfer>) => {
  let changed = false;
  transfers = transfers.map(t => {
    if (t.id !== id) return t;
    changed = true;
    return { ...t, ...change };
  });
  if (changed) emit();
};

// A finished one stays a moment, for the tick, then goes.
const DONE_HOLD = 1400;
const FAIL_HOLD = 300;

export const startTransfer = (kind: TransferKind, label: string): TransferHandle => {
  const id = nextId++;
  transfers = [
    ...transfers,
    { id, kind, label, progress: null, state: 'running', claimed: kind === 'upload' && claims > 0 },
  ];
  emit();

  // Progress events can come many times a second; only a visible step is drawn.
  let last = -1;
  const finish = (state: TransferState, hold: number) => {
    patch(id, state === 'done' ? { state, progress: 1 } : { state });
    setTimeout(() => {
      transfers = transfers.filter(t => t.id !== id);
      emit();
    }, hold);
  };

  return {
    update: (loaded, total) => {
      if (!total || total <= 0) return;
      const p = Math.max(0, Math.min(1, loaded / total));
      if (p - last < 0.01 && p < 1) return;
      last = p;
      patch(id, { progress: p });
    },
    done: () => finish('done', DONE_HOLD),
    fail: () => finish('failed', FAIL_HOLD),
  };
};

export const getTransfers = () => transfers;

export const subscribeTransfers = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** Every transfer on the go (and the ones just finished). */
export const useTransfers = (): Transfer[] => {
  const [list, setList] = useState(transfers);
  useEffect(() => {
    setList(transfers);
    return subscribeTransfers(() => setList(transfers));
  }, []);
  return list;
};

/** The newest upload still going, or null. */
export const useActiveUpload = (enabled = true): Transfer | null => {
  const list = useTransfers();
  if (!enabled) return null;
  for (let i = list.length - 1; i >= 0; i--) {
    if (list[i].kind === 'upload' && list[i].state === 'running') return list[i];
  }
  return null;
};

/** A saving button draws the upload itself while it holds a claim. */
export const claimUploads = () => {
  claims++;
  // One that set off a moment before the button turned busy is its too.
  transfers = transfers.map(t => (t.kind === 'upload' && t.state === 'running' ? { ...t, claimed: true } : t));
  emit();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    claims = Math.max(0, claims - 1);
    emit();
  };
};

// ── What a request's body holds ─────────────────────────────────────────────
// React Native's FormData keeps its parts as [name, value] pairs; a file is a
// value with a uri. Text-only forms (sign in, OTP) carry no file and are not
// shown.
export const filesIn = (body: any): string | null => {
  const parts: any[] = body?._parts ?? body?.getParts?.() ?? [];
  if (!Array.isArray(parts)) return null;
  const files = parts
    .map(p => (Array.isArray(p) ? p[1] : p))
    .filter(v => v && typeof v === 'object' && typeof v.uri === 'string');
  if (files.length === 0) return null;
  if (files.length > 1) return `${files.length} files`;
  const f = files[0];
  return String(f.name || f.fileName || 'file');
};
