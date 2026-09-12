import React from 'react';
import { Dimensions, Image, StyleSheet, Text, View } from 'react-native';

/**
 * The ID card exactly as the web admin prints it
 * (resources/views/admin/id-cards/_card.blade.php).
 *
 * Design language: quiet and typographic, CR80 portrait. One ink, one muted
 * grey, one hairline and a single accent used sparingly — a rule at the head of
 * each face and the tick before the role. No gradients, no glows, no rotated
 * frames: the hierarchy is carried by size and space instead of ornament.
 *
 * Front: who this is (photo, name, role) then the facts, on hairline rows.
 * Back:  what to do with it (QR), who to reach, and how long it is good for.
 *
 * Every measurement below is the web card's pixel value multiplied by `K`, so
 * the proportions survive whatever width the phone gives us.
 */

// ── Palette (the web card's CSS variables) ───────────────────────────────────
const C = {
  ink: '#101828', // headings, values
  body: '#344054', // ordinary text
  muted: '#8a94a6', // labels, captions
  line: '#e7eaf0', // hairlines
  wash: '#f7f8fa', // the one tinted surface
  accent: '#1b3a5c', // used three times, never as fill
  white: '#ffffff',
  photoPh: '#c2c9d6',
  activeInk: '#17663a',
  activeLine: '#bfe3cd',
  inactiveInk: '#9a2c2c',
  inactiveLine: '#eec4c4',
};

// ── CR80 portrait, 326 × 516 in the browser ──────────────────────────────────
const { width } = Dimensions.get('window');
export const CARD_W = Math.min(width - 40, 340);
const K = CARD_W / 326;
export const CARD_H = Math.round(516 * K);

const r = (n: number) => n * K;

const initial = (v?: string | null) => (v && v.trim() ? v.trim()[0] : 'S').toUpperCase();

// ── The shape both ID-card APIs are normalised into ──────────────────────────
export interface IdCardFaceData {
  school: {
    name: string;
    logo?: string | null;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
    website?: string | null;
  };
  photo?: string | null;
  name: string;
  subtitle: string;
  rows: { label: string; value: string }[];
  cardNumber: string;
  issueDate: string;
  expiryDate: string;
  status: string;
  qrCode?: string | null;
}

// The QR arrives either as raw base64 or as a ready data URI.
export const qrUri = (qr?: string | null): string | null => {
  if (!qr) return null;
  return qr.startsWith('data:') ? qr : `data:image/png;base64,${qr}`;
};

// Associative front_rows ({ "Reg No": "123" }) → an ordered list, keeping the
// admin's row order and dropping rows with nothing to say.
export const rowsFromObject = (obj: any): { label: string; value: string }[] => {
  if (!obj || typeof obj !== 'object') return [];
  return Object.entries(obj)
    .map(([label, v]) => ({ label, value: v == null ? '' : String(v) }))
    .filter(f => f.value.trim() !== '' && f.value.trim() !== '—');
};

// ── FRONT ────────────────────────────────────────────────────────────────────
export const IdCardFront = ({ data }: { data: IdCardFaceData }) => {
  const { school } = data;

  return (
    <View style={s.card}>
      <View style={s.rule} />

      {/* Masthead */}
      <View style={s.mast}>
        <View style={s.logo}>
          {school.logo ? (
            <Image source={{ uri: school.logo }} style={s.logoImg} resizeMode="contain" />
          ) : (
            <View style={s.logoPh}>
              <Text style={s.logoPhText}>{initial(school.name)}</Text>
            </View>
          )}
        </View>
        <Text style={s.school} numberOfLines={2}>
          {school.name}
        </Text>
        {!!school.address && (
          <Text style={s.schoolSub} numberOfLines={2}>
            {school.address}
          </Text>
        )}
      </View>

      {/* Identity */}
      <View style={s.id}>
        {data.photo ? (
          <Image source={{ uri: data.photo }} style={s.photo} />
        ) : (
          <View style={[s.photo, s.photoPh]}>
            <Text style={s.photoPhText}>{initial(data.name)}</Text>
          </View>
        )}
        <Text style={s.name} numberOfLines={2}>
          {data.name}
        </Text>
        <View style={s.role}>
          <View style={s.roleDot} />
          <Text style={s.roleText} numberOfLines={1}>
            {data.subtitle}
          </Text>
        </View>
      </View>

      {/* Facts */}
      <View style={s.rows}>
        {data.rows.map((f, i) => (
          <View key={f.label} style={[s.row, i < data.rows.length - 1 && s.rowLine]}>
            <Text style={s.rowK} numberOfLines={1}>
              {f.label}
            </Text>
            <Text style={s.rowV}>{f.value || '—'}</Text>
          </View>
        ))}
      </View>

      {/* Foot */}
      <View style={s.foot}>
        <View>
          <Text style={s.footLbl}>Card No.</Text>
          <Text style={s.footVal}>{data.cardNumber}</Text>
        </View>
        <View style={s.footRight}>
          <Text style={s.footLbl}>Valid Till</Text>
          <Text style={s.footVal}>{data.expiryDate}</Text>
        </View>
      </View>
    </View>
  );
};

// ── BACK ─────────────────────────────────────────────────────────────────────
export const IdCardBack = ({ data }: { data: IdCardFaceData }) => {
  const { school } = data;
  const qr = qrUri(data.qrCode);
  const active = String(data.status).toLowerCase() === 'active';
  const hasContact = !!(school.phone || school.email || school.website || school.address);

  return (
    <View style={s.card}>
      <View style={s.rule} />

      <View style={s.back}>
        <Text style={s.backHead} numberOfLines={1}>
          {school.name}
        </Text>

        {/* Scan to verify */}
        <View style={s.qr}>
          <View style={s.qrTile}>
            {qr ? (
              <Image source={{ uri: qr }} style={s.qrImg} resizeMode="contain" />
            ) : (
              <View style={s.qrPh}>
                <Text style={s.qrPhText}>QR</Text>
              </View>
            )}
          </View>
          <Text style={s.qrCap}>Scan to verify</Text>
          <Text style={s.qrNo}>{data.cardNumber}</Text>
        </View>

        {/* Who to reach */}
        {hasContact && (
          <View>
            <Text style={s.sec}>School</Text>
            {!!school.phone && <ContactLine label="Phone" value={school.phone} />}
            {!!school.email && <ContactLine label="Email" value={school.email} />}
            {!!school.website && <ContactLine label="Web" value={school.website} />}
            {!!school.address && <ContactLine label="Address" value={school.address} />}
          </View>
        )}

        <Text style={s.note}>
          Property of {school.name} and not transferable. If found, please return it to the
          school.
        </Text>

        <View style={s.sign}>
          <View style={s.signLine} />
          <Text style={s.signRole}>Principal</Text>
          <Text style={s.signSub}>Authorised Signatory</Text>
        </View>
      </View>

      {/* Foot */}
      <View style={s.backFoot}>
        <View>
          <Text style={s.footLbl}>Issued</Text>
          <Text style={s.backFootVal}>{data.issueDate}</Text>
        </View>
        <View style={[s.status, active ? s.statusActive : s.statusInactive]}>
          <Text style={[s.statusText, active ? s.statusTextActive : s.statusTextInactive]}>
            {data.status}
          </Text>
        </View>
        <View style={s.footRight}>
          <Text style={s.footLbl}>Valid Till</Text>
          <Text style={s.backFootVal}>{data.expiryDate}</Text>
        </View>
      </View>
    </View>
  );
};

const ContactLine = ({ label, value }: { label: string; value: string }) => (
  <View style={s.ci}>
    <Text style={s.ciK}>{label}</Text>
    <Text style={s.ciV}>{value}</Text>
  </View>
);

const s = StyleSheet.create({
  // ── Card shell ──
  card: {
    width: CARD_W,
    height: CARD_H,
    backgroundColor: C.white,
    borderRadius: r(12),
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: C.line,
    flexDirection: 'column',
    // 0 1px 2px rgba(16,24,40,.04), 0 8px 24px rgba(16,24,40,.06)
    shadowColor: '#101828',
    shadowOpacity: 0.07,
    shadowRadius: r(12),
    shadowOffset: { width: 0, height: r(4) },
    elevation: 3,
  },

  // The only piece of colour on the card.
  rule: { height: r(4), backgroundColor: C.accent },

  // ── Masthead ──
  mast: {
    paddingTop: r(16),
    paddingHorizontal: r(22),
    paddingBottom: r(14),
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  logo: { width: r(38), height: r(38), marginBottom: r(9) },
  logoImg: { width: '100%', height: '100%' },
  logoPh: {
    width: '100%',
    height: '100%',
    borderRadius: r(19),
    backgroundColor: C.wash,
    borderWidth: 1,
    borderColor: C.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoPhText: { fontSize: r(16), fontWeight: '600', color: C.accent },
  school: {
    fontSize: r(13.5),
    fontWeight: '600',
    color: C.ink,
    letterSpacing: r(0.2),
    lineHeight: r(16.9),
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  schoolSub: {
    marginTop: r(4),
    fontSize: r(7.5),
    lineHeight: r(10.9),
    color: C.muted,
    letterSpacing: r(0.5),
    textAlign: 'center',
  },

  // ── Identity ──
  id: { paddingTop: r(20), paddingHorizontal: r(22), alignItems: 'center' },
  photo: {
    width: r(104),
    height: r(124),
    borderRadius: r(8),
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.wash,
  },
  photoPh: { alignItems: 'center', justifyContent: 'center' },
  photoPhText: { fontSize: r(38), fontWeight: '500', color: C.photoPh },
  name: {
    marginTop: r(14),
    fontSize: r(17),
    fontWeight: '600',
    color: C.ink,
    lineHeight: r(20.4),
    letterSpacing: -r(0.1),
    textAlign: 'center',
  },
  role: { flexDirection: 'row', alignItems: 'center', gap: r(6), marginTop: r(6) },
  roleDot: { width: r(3), height: r(3), borderRadius: r(1.5), backgroundColor: C.accent },
  roleText: {
    fontSize: r(8),
    fontWeight: '600',
    color: C.body,
    letterSpacing: r(1.6),
    textTransform: 'uppercase',
  },

  // ── Facts ──
  rows: { paddingTop: r(10), paddingHorizontal: r(22), flex: 1, minHeight: 0 },
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: r(10),
    paddingVertical: r(3),
  },
  rowLine: { borderBottomWidth: 1, borderBottomColor: C.line },
  rowK: {
    width: r(84),
    color: C.muted,
    fontWeight: '500',
    fontSize: r(8),
    letterSpacing: r(0.7),
    textTransform: 'uppercase',
  },
  rowV: { flex: 1, color: C.ink, fontWeight: '500', fontSize: r(9.5), lineHeight: r(13.3) },

  // ── Foot (both faces) ──
  foot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: r(10),
    paddingHorizontal: r(22),
    backgroundColor: C.wash,
    borderTopWidth: 1,
    borderTopColor: C.line,
  },
  footRight: { alignItems: 'flex-end' },
  footLbl: { fontSize: r(7), color: C.muted, letterSpacing: r(1), textTransform: 'uppercase' },
  footVal: { fontSize: r(10), color: C.ink, fontWeight: '600', marginTop: r(2) },

  // ── Back ──
  back: { flex: 1, paddingTop: r(18), paddingHorizontal: r(22), minHeight: 0 },
  backHead: {
    fontSize: r(9),
    fontWeight: '600',
    color: C.ink,
    textAlign: 'center',
    letterSpacing: r(1.4),
    textTransform: 'uppercase',
    paddingBottom: r(12),
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },

  qr: { alignItems: 'center', paddingTop: r(16), paddingBottom: r(14) },
  qrTile: {
    width: r(118),
    height: r(118),
    padding: r(8),
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: r(8),
  },
  qrImg: { width: '100%', height: '100%' },
  qrPh: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.wash,
  },
  qrPhText: { color: C.muted, fontSize: r(11), letterSpacing: r(2) },
  qrCap: {
    marginTop: r(9),
    fontSize: r(7.5),
    color: C.muted,
    letterSpacing: r(1.3),
    textTransform: 'uppercase',
  },
  qrNo: {
    marginTop: r(3),
    fontSize: r(10.5),
    fontWeight: '600',
    color: C.ink,
    letterSpacing: r(0.4),
  },

  sec: {
    fontSize: r(7),
    color: C.muted,
    letterSpacing: r(1.4),
    textTransform: 'uppercase',
    paddingBottom: r(6),
    borderBottomWidth: 1,
    borderBottomColor: C.line,
    marginBottom: r(8),
  },
  ci: { flexDirection: 'row', gap: r(8), paddingVertical: r(1.5) },
  ciK: { width: r(42), color: C.muted, fontSize: r(8.5), lineHeight: r(12.8) },
  ciV: { flex: 1, color: C.body, fontSize: r(8.5), lineHeight: r(12.8) },

  note: {
    marginTop: 'auto',
    paddingTop: r(12),
    paddingBottom: r(10),
    fontSize: r(7.5),
    lineHeight: r(11.6),
    color: C.muted,
    textAlign: 'center',
  },

  sign: { alignItems: 'flex-end', paddingBottom: r(10) },
  signLine: { width: r(108), borderBottomWidth: 1, borderBottomColor: C.body },
  signRole: {
    marginTop: r(5),
    fontSize: r(8),
    fontWeight: '600',
    color: C.ink,
    letterSpacing: r(0.6),
  },
  signSub: { marginTop: r(1), fontSize: r(7), color: C.muted, letterSpacing: r(0.5) },

  backFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: r(10),
    paddingHorizontal: r(22),
    backgroundColor: C.wash,
    borderTopWidth: 1,
    borderTopColor: C.line,
  },
  backFootVal: { fontSize: r(9.5), color: C.ink, fontWeight: '600', marginTop: r(2) },

  status: {
    paddingVertical: r(3),
    paddingHorizontal: r(9),
    borderRadius: 999,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.white,
  },
  statusActive: { borderColor: C.activeLine },
  statusInactive: { borderColor: C.inactiveLine },
  statusText: {
    fontSize: r(7.5),
    fontWeight: '600',
    letterSpacing: r(1.1),
    textTransform: 'uppercase',
    color: C.body,
  },
  statusTextActive: { color: C.activeInk },
  statusTextInactive: { color: C.inactiveInk },
});

export const idCardPalette = C;
