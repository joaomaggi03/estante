import { Image } from 'expo-image';
import React, { createContext, useContext, useState } from 'react';
import { Text, View } from 'react-native';
import { useSetting } from '../db/hooks';
import type { Book } from '../db/types';
import { spineColorOf, spineHeight, spineTextColor, spineWidth } from '../lib/spine';
import { fonts } from '../theme';

/** Como desenhar a lombada quando não há foto real: gerada (cor + título) ou faixa lateral da capa. */
export type SpineMode = 'generated' | 'cover';

const SpineModeContext = createContext<SpineMode>('generated');

export function SpineModeProvider({ children }: { children: React.ReactNode }) {
  const mode: SpineMode = useSetting('spineStyle') === 'cover' ? 'cover' : 'generated';
  return <SpineModeContext.Provider value={mode}>{children}</SpineModeContext.Provider>;
}

type Props = {
  book: Pick<Book, 'title' | 'spineColor' | 'spinePhotoPath' | 'pageCount'> & {
    coverPath?: string | null;
    coverUrl?: string | null;
  };
  dim?: boolean;
  highlight?: string;
  /** Força um estilo (ex.: prévia nos Ajustes); senão usa o escolhido nos Ajustes. */
  mode?: SpineMode;
};

const COVER_RATIO = 2 / 3; // largura/altura típica de uma capa
const EDGE_SKIP = 0.025; // pula a dobra/borda branca na beirada da capa

/** Lombada: foto real (se houver), faixa lateral da capa ou gerada com a cor da capa e o título. */
export function Spine({ book, dim, highlight, mode }: Props) {
  const contextMode = useContext(SpineModeContext);
  const [failedCover, setFailedCover] = useState<string | null>(null);
  const effective = mode ?? contextMode;
  const w = spineWidth(book);
  const h = spineHeight(book);
  const outline = highlight ? { borderWidth: 2, borderColor: highlight } : null;
  const frame = { width: w, height: h, borderTopLeftRadius: 2, borderTopRightRadius: 2, opacity: dim ? 0.35 : 1 };

  if (book.spinePhotoPath) {
    return (
      <Image
        source={{ uri: book.spinePhotoPath }}
        style={[frame, outline]}
        contentFit="cover"
        accessibilityLabel={book.title}
      />
    );
  }

  const cover = book.coverPath ?? book.coverUrl ?? null;
  if (effective === 'cover' && cover && failedCover !== cover) {
    // A capa é desenhada na altura da lombada e só a faixa da esquerda aparece.
    const coverW = h * COVER_RATIO;
    return (
      <View
        accessibilityLabel={book.title}
        style={[frame, { overflow: 'hidden', borderLeftWidth: 1, borderLeftColor: 'rgba(0,0,0,0.3)' }, outline]}
      >
        <Image
          source={{ uri: cover }}
          style={{ position: 'absolute', top: 0, left: -coverW * EDGE_SKIP, width: coverW, height: h }}
          contentFit="cover"
          contentPosition="left"
          cachePolicy="memory-disk"
          onError={() => setFailedCover(cover)}
        />
        {/* Sombra leve na borda direita para dar volume. */}
        <View style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 2, backgroundColor: 'rgba(0,0,0,0.18)' }} />
      </View>
    );
  }

  const bg = spineColorOf(book);
  const fg = spineTextColor(bg);
  return (
    <View
      accessibilityLabel={book.title}
      style={[frame, { backgroundColor: bg, borderLeftWidth: 1, borderLeftColor: 'rgba(0,0,0,0.25)', overflow: 'hidden' }, outline]}
    >
      {/* Texto girado: um container com largura e altura trocadas, rotacionado -90°. */}
      <View
        style={{
          position: 'absolute',
          width: h - 8,
          height: w,
          left: (w - (h - 8)) / 2,
          top: (h - w) / 2,
          transform: [{ rotate: '-90deg' }],
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Text numberOfLines={1} style={{ fontFamily: fonts.serif, fontSize: w < 18 ? 9 : 11, color: fg }}>
          {book.title}
        </Text>
      </View>
    </View>
  );
}
