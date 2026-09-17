import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Pdf from 'react-native-pdf';
import VectorIcon from '../../components/VectorIcon';
import { theme, onThemeChange } from '../../utils/theme';

/**
 * A school document as the admin panel makes it — its own PDF, full screen,
 * to pinch or double-tap to zoom up to five times, with nothing to download or
 * print. Report Card and Admit Card show theirs this way.
 *
 * `skeleton` is laid over the sheet until the PDF has drawn. Give the sheet a
 * `key` of the document it shows, so a different one starts afresh.
 */

// ISO A4, height over width.
export const A4 = 297 / 210;

/** A white A4 page for a skeleton to be drawn on. */
export const SheetPage = ({
  width,
  padding,
  children,
}: {
  width: number;
  padding?: number;
  children: React.ReactNode;
}) => (
  <View
    style={[
      s.page,
      { width, height: Math.round(width * A4), padding: padding ?? Math.round(width * 0.06) },
    ]}
  >
    {children}
  </View>
);

export const PdfSheet = ({
  uri,
  headers,
  skeleton,
  errorText,
  label,
}: {
  uri: string;
  headers: Record<string, string>;
  skeleton: React.ReactNode;
  errorText: string;
  /** For the log. */
  label: string;
}) => {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Bumped by "Try again" so the viewer is mounted afresh.
  const [attempt, setAttempt] = useState(0);

  if (error) {
    return (
      <View style={s.center}>
        <VectorIcon iconSet="Ionicons" iconName="cloud-offline-outline" size={32} color={theme.colors.textMuted} />
        <Text style={s.stateText}>{error}</Text>
        <TouchableOpacity
          onPress={() => {
            setError(null);
            setReady(false);
            setAttempt(a => a + 1);
          }}
          hitSlop={10}
        >
          <Text style={s.linkText}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={s.viewer}>
      <Pdf
        key={attempt}
        source={{ uri, cache: false, headers }}
        style={s.pdf}
        trustAllCerts={false}
        // The page across the screen, to pinch or double-tap up to 5×.
        fitPolicy={0}
        minScale={1}
        maxScale={5}
        enableDoubleTapZoom
        enableAntialiasing
        spacing={0}
        onLoadComplete={() => setReady(true)}
        onError={(e: any) => {
          console.log(`[${label}] PDF error:`, e);
          setError(errorText);
        }}
      />
      {!ready && (
        <View style={s.cover} pointerEvents="none">
          {skeleton}
        </View>
      )}
    </View>
  );
};

const __mk_s = () => StyleSheet.create({
  // The document on the page's grey, edge to edge
  viewer: { flex: 1, backgroundColor: theme.colors.background },
  pdf: { flex: 1, width: '100%', backgroundColor: theme.colors.background },
  cover: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: theme.colors.background,
  },
  page: { backgroundColor: theme.colors.card, gap: 18 },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24 },
  stateText: { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  linkText: { fontSize: 14, fontWeight: '600', color: theme.colors.primary },
});

// Themed stylesheets — rebuilt on light/dark toggle.
let s = __mk_s();
onThemeChange(() => { s = __mk_s(); });
