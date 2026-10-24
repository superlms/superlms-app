import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Keyboard, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import moment from 'moment';
import VectorIcon from '../../components/VectorIcon';
import { useFocusLoad, useRefresh } from '../../hooks/useRefresh';
import { theme, onThemeChange } from '../../utils/theme';
import { apiErr } from '../../utils/filePickers';
import { AdminProfile, SchoolInfoData, getAdminProfile } from '../../api/adminProfileApi';

/**
 * The pieces the admin app's Profile pages share (School Profile, School
 * Details, its form, a member, a document, Change Password), drawn as the
 * student app draws a person: a small heading over plain lines on hairlines,
 * and fields that are an outline and nothing else. (Change Password's boxes
 * are the student form's, from outlinedFormUi.)
 */

// ── Loading ──────────────────────────────────────────────────────────────────
/**
 * The admin's profile (GET admin/profile), loaded each time the page comes
 * into view — back from a form it is fresh. The skeleton only before the first
 * answer; after that the page stays as it is until the fresh one arrives.
 */
export const useSchoolProfile = () => {
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const loaded = useRef(false);

  const load = useCallback(async () => {
    if (!loaded.current) setLoading(true);
    try {
      setProfile(await getAdminProfile());
      loaded.current = true;
      setError('');
    } catch (e) {
      if (!loaded.current) setError(apiErr(e, 'Could not load profile.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusLoad(load);
  const { refreshing, onRefresh } = useRefresh(load);

  return { profile, setProfile, loading, error, load, refreshing, onRefresh };
};

// ── Lines ────────────────────────────────────────────────────────────────────
export interface Line {
  label: string;
  value?: string | null;
  /** Drawn in place of the value — a picture, say (the school's logo). */
  node?: React.ReactNode;
}

/** A value, or the panel's dash when the school has nothing there. */
export const dash = (v?: string | null) => (v && String(v).trim() ? String(v).trim() : '—');

/** "12 Sep 2024" from a YYYY-MM-DD (or a timestamp); the value as it comes otherwise. */
export const day = (v?: string | null) => {
  if (!v) return null;
  const m = moment(String(v).slice(0, 10), 'YYYY-MM-DD', true);
  return m.isValid() ? m.format('D MMM YYYY') : v;
};

/** "12 Sep 2026, 10:30 AM", as the panel says when the school info was last saved. */
export const stampOf = (v?: string | null) => {
  if (!v) return null;
  const m = moment(v);
  return m.isValid() ? m.format('D MMM YYYY, h:mm A') : null;
};

// A heading and its lines, as the panel lists them — every one, with a dash
// where the school has nothing — the last keeping no divider under it.
export const Block = ({ title, lines, first }: { title: string; lines: Line[]; first?: boolean }) => (
  <View>
    <Text style={[s.blockTitle, first && s.blockTitleFirst]}>{title.toUpperCase()}</Text>
    {lines.map((l, i) => (
      <View key={l.label} style={[s.line, !!l.node && s.lineCentered, i < lines.length - 1 && s.lineDivider]}>
        <Text style={s.lineLabel}>{l.label}</Text>
        {l.node ? <View style={s.lineNode}>{l.node}</View> : <Text style={s.lineValue}>{dash(l.value)}</Text>}
      </View>
    ))}
  </View>
);

/** A block's heading on its own, for what follows it that isn't lines. */
export const BlockTitle = ({ children, first }: { children: string; first?: boolean }) => (
  <Text style={[s.blockTitle, first && s.blockTitleFirst]}>{children.toUpperCase()}</Text>
);

// ── Password ─────────────────────────────────────────────────────────────────
// The panel's rules for a new password, as its checklist words them.
export const PASSWORD_RULES: { label: string; test: (p: string) => boolean }[] = [
  { label: 'At least 8 characters', test: p => p.length >= 8 },
  { label: 'An uppercase letter', test: p => /[A-Z]/.test(p) },
  { label: 'A lowercase letter', test: p => /[a-z]/.test(p) },
  { label: 'A number', test: p => /[0-9]/.test(p) },
  { label: 'A symbol (!@#$…)', test: p => /[^A-Za-z0-9]/.test(p) },
];

/** The rules under the new password, each ticked as it is met. */
export const PasswordRules = ({ password }: { password: string }) => (
  <View style={s.rules}>
    <Text style={s.rulesTitle}>PASSWORD MUST INCLUDE</Text>
    {PASSWORD_RULES.map(r => {
      const met = r.test(password);
      return (
        <View key={r.label} style={s.rule}>
          <VectorIcon
            iconSet="Ionicons"
            iconName={met ? 'checkmark-circle' : 'ellipse-outline'}
            size={15}
            color={met ? theme.colors.success : theme.colors.textMuted}
          />
          <Text style={[s.ruleText, met && s.ruleTextMet]}>{r.label}</Text>
        </View>
      );
    })}
  </View>
);

// ── School info checks ───────────────────────────────────────────────────────
/**
 * What the panel's "Save All Changes" refuses, in its words: a website that
 * isn't http(s), an email that isn't one, a mobile that isn't 10–15 digits, an
 * address over 255 characters, a section title over 255.
 */
export const schoolInfoErrors = (info: SchoolInfoData): string[] => {
  const errors: string[] = [];
  const url = (info.website_url ?? '').trim();
  if (url && !/^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(url)) {
    errors.push('Website URL must start with http:// or https://.');
  }
  const email = (info.school_email ?? '').trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push('School email must be a valid email address.');
  }
  const mobile = (info.school_mobile ?? '').trim();
  if (mobile) {
    if (!/^[0-9]+$/.test(mobile)) errors.push('Mobile number must contain only digits.');
    else if (mobile.length < 10) errors.push('Mobile number must be at least 10 digits.');
    else if (mobile.length > 15) errors.push('Mobile number must not exceed 15 digits.');
  }
  if ((info.school_address ?? '').length > 255) {
    errors.push('School address must not exceed 255 characters.');
  }
  (info.custom_sections ?? []).forEach((sec, i) => {
    if ((sec.title ?? '').length > 255) errors.push(`Section ${i + 6} title must not exceed 255 characters.`);
  });
  return errors;
};

// ── Keyboard ─────────────────────────────────────────────────────────────────
/**
 * The box being typed in is scrolled up to sit clear of the keyboard — when the
 * keyboard opens, and when another box is tapped while it is open (as on Add
 * Employee). Spread `scrollProps` on the page's ScrollView.
 */
export const useRevealFocused = () => {
  const scrollRef = useRef<ScrollView>(null);
  const scrollY = useRef(0);
  const keyboardTop = useRef<number | null>(null);

  const reveal = () => {
    const top = keyboardTop.current;
    const input: any = TextInput.State.currentlyFocusedInput?.();
    if (top == null || !input?.measureInWindow) return;
    input.measureInWindow((_x: number, y: number, _w: number, h: number) => {
      const overlap = y + h + 24 - top;
      if (overlap > 0) scrollRef.current?.scrollTo({ y: scrollY.current + overlap, animated: true });
    });
  };

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', e => {
      keyboardTop.current = e.endCoordinates.screenY;
      // The page has lifted by now; the box goes above the keyboard.
      setTimeout(reveal, 120);
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => {
      keyboardTop.current = null;
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return {
    ref: scrollRef,
    scrollProps: {
      keyboardShouldPersistTaps: 'handled' as const,
      scrollEventThrottle: 16,
      onScroll: (e: any) => {
        scrollY.current = e.nativeEvent.contentOffset.y;
      },
      onTouchEnd: () => setTimeout(reveal, 250),
    },
  };
};

const __mk_s = () => StyleSheet.create({
  // Blocks
  blockTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 1, color: theme.colors.textMuted, marginTop: 24, marginBottom: 2 },
  blockTitleFirst: { marginTop: 18 },
  line: { flexDirection: 'row', alignItems: 'flex-start', gap: 16, paddingVertical: 12 },
  lineCentered: { alignItems: 'center' },
  lineNode: { flex: 1, alignItems: 'flex-end' },
  lineDivider: { borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  lineLabel: { fontSize: 13, color: theme.colors.textSecondary, flexShrink: 0 },
  lineValue: { fontSize: 14, color: theme.colors.textPrimary, flex: 1, textAlign: 'right' },

  // Rules
  rules: { marginTop: 18, gap: 8 },
  rulesTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 1, color: theme.colors.textMuted, marginBottom: 2 },
  rule: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ruleText: { fontSize: 13, color: theme.colors.textSecondary },
  ruleTextMet: { color: theme.colors.textPrimary },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
