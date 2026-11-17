import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import { BookForm } from '../../components/BookForm';
import { getDraft } from '../../lib/draft';

export default function NewBookScreen() {
  const { source, draft } = useLocalSearchParams<{ source?: string; draft?: string }>();
  const d = getDraft(draft);
  return <BookForm key={draft ?? 'vazio'} initial={d?.data ?? null} pending={d?.pending ?? null} source={source ?? null} />;
}
