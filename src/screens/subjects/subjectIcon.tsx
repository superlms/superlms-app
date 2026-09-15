import React, { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import VectorIcon from '../../components/VectorIcon';
import { resolveFileUrl } from './subjectsUi';

/**
 * A subject's built-in icon: a coloured tile with a white glyph, the same set
 * the web panel draws (App\Support\SubjectIcons on the server). The API sends
 * each subject's icon as an SVG link — /subject-icon/{key} — which an <Image>
 * cannot draw, so the key is read off the link and the tile is drawn here.
 */

type IconDef = { color: string } & ({ icon: string } | { text: string });

// Tile colours match SubjectIcons::ICONS; glyphs are the nearest Ionicons (the
// set the Android build ships — MaterialCommunityIcons' font is not bundled,
// so its glyphs draw blank), or the character itself where a letter says it.
const ICONS: Record<string, IconDef> = {
  mathematics: { color: '#0f9b8e', text: 'π' },
  physics: { color: '#5a4a9f', icon: 'magnet-outline' },
  chemistry: { color: '#7b4fa0', icon: 'flask-outline' },
  biology: { color: '#e05263', icon: 'body-outline' },
  literature: { color: '#3f8f5b', icon: 'book-outline' },
  history: { color: '#c9a227', icon: 'time-outline' },
  geography: { color: '#2f6f8f', icon: 'earth-outline' },
  english: { color: '#2f7fbf', text: 'A' },
  hindi: { color: '#e07a3f', text: 'अ' },
  sanskrit: { color: '#b4553a', text: 'ॐ' },
  language: { color: '#4a8fb0', icon: 'language-outline' },
  science: { color: '#3f8f7a', icon: 'beaker-outline' },
  environment: { color: '#4f9e4f', icon: 'leaf-outline' },
  astronomy: { color: '#3a5a8c', icon: 'telescope-outline' },
  'social science': { color: '#7a5aa8', icon: 'people-outline' },
  civics: { color: '#8c6b3f', icon: 'library-outline' },
  sociology: { color: '#4f9a92', icon: 'chatbubbles-outline' },
  psychology: { color: '#5f7fbf', icon: 'happy-outline' },
  philosophy: { color: '#8f5f8f', icon: 'infinite-outline' },
  humanities: { color: '#c96f4a', icon: 'accessibility-outline' },
  economics: { color: '#2f8f6f', icon: 'trending-up-outline' },
  business: { color: '#2f6f9f', icon: 'briefcase-outline' },
  accountancy: { color: '#6f6f9f', icon: 'calculator-outline' },
  computer: { color: '#3a6ea5', icon: 'laptop-outline' },
  art: { color: '#d4645f', icon: 'color-palette-outline' },
  music: { color: '#6f5fa8', icon: 'musical-notes-outline' },
  'physical education': { color: '#e08a3c', icon: 'walk-outline' },
  'moral science': { color: '#c95f7a', icon: 'heart-outline' },
  'general knowledge': { color: '#d1a03c', icon: 'bulb-outline' },
  other: { color: '#7c8794', icon: 'bookmark-outline' },
};

// "https://superlms.in/subject-icon/social-science" → "social science"
const iconKey = (url?: string | null): string | null => {
  const m = url?.match(/\/subject-icon\/([^/?#]+)/);
  if (!m) return null;
  return decodeURIComponent(m[1]).replace(/\.svg$/i, '').replace(/-/g, ' ').toLowerCase();
};

export const SubjectIcon = ({ image, size = 40 }: { image?: string | null; size?: number }) => {
  const [failed, setFailed] = useState(false);
  const key = iconKey(image);
  const radius = Math.round(size * 0.2);

  // An uploaded picture rather than a built-in icon.
  if (key === null && image && !failed) {
    return (
      <Image
        source={{ uri: resolveFileUrl(image) }}
        style={{ width: size, height: size, borderRadius: radius }}
        resizeMode="contain"
        onError={() => setFailed(true)}
      />
    );
  }

  const def = ICONS[key ?? 'other'] ?? ICONS.other;
  const glyph = Math.round(size * 0.58);

  return (
    <View style={[s.tile, { width: size, height: size, borderRadius: radius, backgroundColor: def.color }]}>
      {'text' in def ? (
        <Text style={[s.letter, { fontSize: Math.round(glyph * 0.85) }]}>{def.text}</Text>
      ) : (
        <VectorIcon iconSet="Ionicons" iconName={def.icon} size={glyph} color="#FFFFFF" />
      )}
    </View>
  );
};

const s = StyleSheet.create({
  tile: { alignItems: 'center', justifyContent: 'center' },
  letter: { color: '#FFFFFF', fontWeight: '600', textAlign: 'center', includeFontPadding: false },
});
