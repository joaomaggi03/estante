# App de Leitura — Especificação

## Plataforma e stack
- App Android (só Android), instalado por APK direto (sem loja).
- Expo + React Native + TypeScript.
- APK gerado via **EAS Build** (nuvem da Expo, plano grátis). O usuário cria a própria conta Expo.
- Uso pessoal: cada pessoa no seu celular, listas totalmente separadas. Sem login, sem servidor.

## Dados
- Armazenamento local em SQLite (`expo-sqlite`).
- Capas baixadas e salvas no armazenamento do app (`expo-file-system`), exibidas offline.

### Modelo `Book`
| Campo | Tipo | Observação |
|---|---|---|
| id | string (UUID) | usado no merge do import |
| title | string | obrigatório |
| author | string? | |
| isbn | string? | salvo internamente; usado para detectar duplicados |
| status | `want` \| `reading` \| `read` | |
| rating | number? | 0,5 a 5, passo 0,5 (meia estrela) |
| review | string? | opinião/resenha pessoal |
| startDate | date? | |
| endDate | date? | |
| coverUrl | string? | URL de origem (usada no backup) |
| coverPath | string? | arquivo local |
| pageCount | number? | vem da API, editável; define a largura da lombada |
| spineColor | string? | cor dominante extraída da capa (fallback: derivada do título) |
| spinePhotoPath | string? | foto opcional da lombada real, recortada |
| shelfId | string? | prateleira na "Minha ordem" (null = Recém-chegados) |
| shelfPosition | number? | posição dentro da prateleira |

### Modelo `Shelf` (prateleiras da "Minha ordem")
| Campo | Tipo | Observação |
|---|---|---|
| id | string (UUID) | |
| status | `want` \| `reading` \| `read` | cada aba tem suas próprias prateleiras |
| name | string | editável |
| position | number | ordem das prateleiras |
| createdAt / updatedAt | datetime | |

### Regras por status
- **Quero ler:** título (+ autor/capa).
- **Lendo:** + data de início — preenchida com hoje automaticamente ao entrar no status (editável).
- **Lido:** + data de término (auto = hoje, editável), nota e resenha (opcionais).
- Releitura não é tratada: um livro = um registro.

## Cadastro de livro
- **Scanner ISBN** com `expo-camera` (EAN-13).
- **Busca por título** online.
- Fontes por ISBN, consultadas **em paralelo** e mescladas campo a campo (cada campo vem da primeira fonte que o tiver): BrasilAPI → Open Library (Books API, também pelo ISBN-10) → Google Books. Títulos em CAIXA ALTA (CBL) são normalizados.
- Busca progressiva: o formulário abre com o que chegou em ~2,5 s (BrasilAPI + fontes rápidas); as fontes lentas (Open Library às vezes leva 10 s+) completam depois só os campos vazios, mesmo que o livro já tenha sido salvo. Sem páginas em nenhuma fonte: mediana das edições da obra na Open Library, se título e autor baterem.
- Busca por título: Google Books; Open Library quando o Google falha.
- Chave opcional da Google Books API nos Ajustes (sem chave a cota anônima costuma estar esgotada).
- Capas em tamanho médio; o livro é salvo na hora e a capa é baixada (e a cor da lombada extraída) em segundo plano. Capa que falha cai para a capa gerada.
- Preenche título, autor, capa; formulário sempre editável. Cadastro manual sempre disponível.
- **Duplicados:** mesmo ISBN ou mesmo título+autor → avisa e oferece abrir o existente.

## Telas
- **Navegação inferior:** Início · Biblioteca · Adicionar (scanner) · Números.
- **Início:** destaque do(s) livro(s) em "Lendo" — vários permitidos, carrossel deslizável. Mostra capa, título, autor, "começou em X, há N dias" (sem progresso por página) e botão "Terminei" (marca como lido e abre nota/resenha). Abaixo: barra da meta anual e "Próximos na fila" (Quero ler).
- **Biblioteca (estante):** livros como lombadas em prateleiras de madeira, uma prateleira por ano de término. Filtros: Lidos / Quero ler / Lendo. Toque na lombada → resumo (capa, nota, data) → detalhe.
  - Prateleiras: nicho com cantos levemente arredondados (~8px) e fundo em cor sólida de madeira clara; tábua da frente com cantos arredondados (~4px) em cor sólida de madeira e um filete de luz na borda superior. Sem textura.
  - Lombada gerada: cor dominante da capa + título vertical; largura proporcional ao nº de páginas.
  - Opcional: substituir por foto da lombada real (câmera + recorte).
  - **Ordenar estante** (botão no topo → painel inferior), com crescente/decrescente. Cada ordem define como as prateleiras são agrupadas:
    | Ordem | Prateleiras |
    |---|---|
    | Por ano de leitura (padrão) | uma por ano de término |
    | Lidos mais recentemente | uma por mês de término |
    | Mais bem avaliados | uma por nota (5, 4,5, 4…; "sem nota" no fim) |
    | Título (A–Z) | por faixa de letras |
    | Autor (A–Z) | por faixa de letras do autor |
    | Tamanho (páginas) | contínuo, quebra quando a prateleira enche |
    | Cor da lombada | contínuo, em degradê de cores |
  - Em "Quero ler", "por ano"/"recentes" usam a data em que o livro foi adicionado.
  - A ordem escolhida fica salva por aba (Lidos / Quero ler / Lendo).
  - **Minha ordem (arrumação livre):** botão lápis discreto no canto do título abre o modo edição.
    - Segurar e arrastar livros dentro e entre prateleiras (só em pé, sem pilhas).
    - Renomear (toque no nome), reordenar (setas ↑/↓), excluir (livros vão para Recém-chegados) e criar prateleiras.
    - Tocar no lápis em uma ordem automática copia o arranjo atual como ponto de partida e muda para "Minha ordem" (só na primeira vez; depois mantém a arrumação salva). Trocar para ordens automáticas não apaga a arrumação.
    - Livro novo na aba (cadastrado ou que mudou de status) entra na prateleira "Recém-chegados" no topo, que some quando vazia.
    - Prateleiras independentes por aba.
    - Implementação: `react-native-gesture-handler` + `react-native-reanimated` para drag entre prateleiras.
- **Adicionar:** câmera abre direto no scanner; abaixo, busca por título com resultados ao digitar; link "Cadastrar manualmente".
- **Confirmar dados / formulário:** pré-preenchido pela API, tudo editável (capa, título, autor, páginas, ISBN, status, datas conforme status, lombada + "Fotografar a lombada real").
- **"Terminei":** painel inferior (bottom sheet) com estrelas, resenha, data de término e botão "Colocar na estante".
- **Detalhe do livro:** capa, título, autor, status, nota (toque/arraste, meia estrela), início/término/duração, resenha. Nota e resenha editáveis direto na tela; lápis abre o formulário; lixeira com confirmação.
- Busca local por título/autor.
- Ordenar por data de término, nota, título.
- Excluir livro com confirmação.
- Detalhe/edição do livro.
- **Estatísticas:** lidos por ano (gráfico de barras), nota média (geral e por ano), tempo médio de leitura (dias entre início e término), meta anual com progresso.
- **Configurações:** meta anual, exportar, importar.

## Backup
- Exportar **JSON** com livros e prateleiras (sem imagens; guarda `coverUrl`), compartilhado via `expo-sharing`.
- Importar JSON (`expo-document-picker`) com **merge**: adiciona novos, atualiza mesmo `id`, nunca apaga. Capas rebaixadas pela URL.

## Visual
- Direção **aconchegante / papel**: tons de papel creme, madeira e couro, tipografia serifada; ar de biblioteca antiga.
- Segue o tema do sistema: claro = papel creme; escuro = madeira escura/couro.
- Interface em português.
