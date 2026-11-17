import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import { BookForm } from '../../../components/BookForm';
import { Txt } from '../../../components/ui';
import { useBook } from '../../../db/hooks';

export default function EditBookScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const book = useBook(id);
  if (!book) return <Txt style={{ padding: 16 }}>Livro não encontrado.</Txt>;
  return <BookForm key={book.id} existing={book} />;
}
