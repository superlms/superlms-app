import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import AppRefreshControl from '../../components/AppRefreshControl';
import { useRefresh, useFocusLoad } from '../../hooks/useRefresh';
import { getTermsOfUse } from '../../api/authApi';
import {
  DocHeader,
  DocIntro,
  DocSection,
  DocBody,
  DocNoData,
  DocSkeleton,
  DocError,
  docStyles,
  lastUpdated,
  type DocShape,
} from './docUi';

interface Section { head: string; desc: string; }
interface TermsOfUseData {
  metadata:     { sections: Section[] };
  last_updated: string;
}

const TITLE = 'Terms of Use';

// The terms' opening sections as they read — the heading's and each line's
// length in characters — so the loading page has the terms' own shape.
const SHAPE: DocShape[] = [
  // Introduction and Acceptance
  { head: 27, lines: [57, 24, 103, 50, 28, 0, 323, 0, 277, 0, 327, 0, 84, 32, 68, 97, 49, 57, 97, 52] },
  // Who May Use the Site
  { head: 20, lines: [164, 171, 248, 253] },
];

const TermsOfUseScreen = () => {
  const [data, setData]       = useState<TermsOfUseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      setData(await getTermsOfUse());
    } catch (e: any) {
      if (e?.response?.status === 404) {
        setData({} as TermsOfUseData);
      } else {
        setError(e?.response?.data?.message ?? 'Failed to load terms of use.');
      }
    } finally {
      setLoading(false);
    }
  };

  const { refreshing, onRefresh } = useRefresh(fetchData);
  useFocusLoad(fetchData);

  // "Last updated", then the terms' sections.
  if (loading) return <DocSkeleton title={TITLE} intro={{ meta: true }} shape={SHAPE} />;
  if (error || !data) return <DocError title={TITLE} message={error || 'Something went wrong.'} onRetry={fetchData} />;

  const sections = data.metadata?.sections ?? [];

  return (
    <View style={docStyles.root}>
      <DocHeader title={TITLE} />
      <ScrollView
        contentContainerStyle={docStyles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {sections.length === 0 ? (
          <DocNoData
            icon="document-text-outline"
            subtitle="The terms of use haven’t been added yet. Pull down to refresh."
          />
        ) : (
          <>
            <DocIntro meta={lastUpdated(data.last_updated)} />
            {sections.map((sec, i) => (
              <DocSection key={i} title={sec.head}>
                <DocBody>{sec.desc}</DocBody>
              </DocSection>
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
};

export default TermsOfUseScreen;
