import { Image } from 'expo-image';
import React, { useState } from 'react';
import { Text, View } from 'react-native';
import type { Book } from '../db/types';
import { spineColorOf, spineTextColor } from '../lib/spine';
import { fonts } from '../theme';

type Props = {
  book: Pick<Book, 'title' | 'author' | 'coverPath' | 'spineColor'> & { coverUrl?: string | null };
  width: number;
  showText?: boolean;
};

/** Capa do livro: imagem salva ou uma capa gerada com a cor da lombada. */
export function Cover({ book, width, showText = true }: Props) {
  const height = Math.round(width * 1.5);
  const radius = { borderTopLeftRadius: 3, borderBottomLeftRadius: 3, borderTopRightRadius: 6, borderBottomRightRadius: 6 };
  const src = book.coverPath ?? book.coverUrl ?? null;
  const [failed, setFailed] = useState<string | null>(null);
  if (src && failed !== src) {
    return (
      <View style={[{ width, height, overflow: 'hidden' }, radius]}>
        {/* Capa gerada por baixo enquanto a imagem carrega. */}
        <GeneratedCover book={book} width={width} height={height} showText={false} />
        <Image
          source={{ uri: src }}
          style={{ position: 'absolute', top: 0, left: 0, width, height }}
          contentFit="cover"
          transition={200}
          cachePolicy="memory-disk"
          onError={() => setFailed(src)}
          accessibilityLabel={`Capa de ${book.title}`}
        />
      </View>
    );
  }
  return <GeneratedCover book={book} width={width} height={height} showText={showText} style={radius} />;
}

function GeneratedCover({
  book,
  width,
  height,
  showText,
  style,
}: {
  book: Props['book'];
  width: number;
  height: number;
  showText: boolean;
  style?: object;
}) {
  const bg = spineColorOf(book);
  const fg = spineTextColor(bg);
  const small = width < 70;
  return (
    <View
      style={[
        { width, height, backgroundColor: bg, borderLeftWidth: Math.max(3, width * 0.05), borderLeftColor: 'rgba(0,0,0,0.25)', padding: small ? 4 : 10, justifyContent: 'space-between' },
        style,
      ]}
      accessibilityLabel={`Capa de ${book.title}`}
    >
      {showText && !small ? (
        <>
          <Text style={{ fontFamily: fonts.serif, color: fg, fontSize: Math.max(11, width / 7) }} numberOfLines={4}>
            {book.title}
          </Text>
          {book.author ? (
            <Text style={{ fontFamily: fonts.sans, color: fg, opacity: 0.8, fontSize: 10 }} numberOfLines={2}>
              {book.author}
            </Text>
          ) : null}
        </>
      ) : null}
    </View>
  );
}
