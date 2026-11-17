# Estante — controle de leitura

App Android (Expo SDK 58 + React Native + TypeScript) para registrar livros lidos, em leitura e na fila, com nota, resenha e uma estante visual. A especificação completa está em [SPEC.md](SPEC.md).

## Estrutura

```
src/
  app/                 telas (Expo Router)
    (tabs)/            Início, Biblioteca, Adicionar, Números
    livro/             novo, detalhe ([id]) e edição ([id]/editar)
    ajustes.tsx        nome, meta anual, backup
  components/          Bookshelf (estante + arrastar), Spine, Cover, Stars, Sheet, BookForm…
  db/                  SQLite (expo-sqlite): esquema, repositório e hooks reativos
  lib/                 busca ISBN/título, capas e cor da lombada, ordenação, estatísticas, backup
  theme.ts             cores (claro = papel creme, escuro = madeira) e fontes (Lora + Inter)
```

## Rodar em desenvolvimento

O app usa módulos nativos (câmera, SQLite, gestos), então precisa de um *development build* — o Expo Go pode não ter tudo.

```bash
npm install
```

```bash
npx eas-cli@latest login
```

```bash
npx eas-cli@latest build --profile development --platform android
```

Instale o APK gerado no celular e depois rode o servidor:

```bash
npx expo start --dev-client
```

## Gerar o APK para usar no dia a dia

```bash
npx eas-cli@latest build --profile preview --platform android
```

No fim do build a Expo mostra um link/QR code para baixar o APK. Instale no Android (pode ser preciso permitir "instalar apps desconhecidos"). Mande o mesmo APK para a outra pessoa — cada celular tem a sua estante, separada.

## Checagens

```bash
npm run typecheck
```

```bash
npx expo-doctor
```

## Notas

- Dados ficam só no celular (SQLite). Use **Ajustes → Exportar backup** de vez em quando; o arquivo JSON pode ser importado em outro aparelho (mescla, nunca apaga).
- Busca de livros: BrasilAPI (ISBN), Google Books e Open Library como reserva. O Google Books sem chave tem cota diária compartilhada e às vezes recusa; aí a Open Library assume.
- `metro.config.js` só tem ajustes para rodar no navegador (testes); não afeta o Android.
