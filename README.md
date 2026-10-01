# Pedro 18 — Momentos / Filtros V3

Aplicativo web de fotos da festa usando **Google Drive** para arquivos, **Supabase** para usuários/feed/curtidas e **Vercel** para frontend + API.

## Novidades da V3

- capas dos filtros redesenhadas novamente: cada efeito mostra **nome + explicação curta + miniatura que representa o resultado**;
- novos filtros de temperatura: **Mel, Tungstênio, Gelo e Crepúsculo**, além dos já existentes;
- **Flagra da Festa** ganhou óculos pixelados estilo *thug life*, flash e tentativa de acompanhar o maior rosto detectado na câmera;
- o Flagra também grava os óculos na foto publicada; quando a API nativa de detecção facial não existir, usa uma posição central de fallback;
- **Raridade da Foto** agora transforma a foto em uma carta: raridade Comum/Rara/Épica/Lendária, custo de elixir aleatório e moldura própria;
- a **Lendária** usa formato hexagonal e aura multicolorida animada;
- o custo de elixir é sorteado de **1 a 9** e não depende da raridade;
- Arquivo 18, Flagra, Confidencial, Memória, Raridade, Detector, Descartável e Primeira Noite agora têm movimento ao vivo;
- no feed e no modal, esses efeitos continuam animados sobre o JPEG publicado, dando sensação de GIF sem transformar todas as fotos em arquivos GIF pesados;
- a lista horizontal continua preservando a posição ao trocar filtros.

**Quem já executou `upgrade_final_to_filters_v1.sql` não precisa executar SQL adicional para a V3.**

## Efeitos de temperatura

Original, Dourado, Quente, Âmbar, Champagne, Rosé, Mel, Tungstênio, Frio, Gelo, Blue Hour, Crepúsculo e Noturno.

## Molduras e efeitos próprios da festa

Arquivo 18, Flagra da Festa, A família NÃO vai ver, Memória Desbloqueada, Raridade da Foto, Detector de Histórias, Câmera Descartável 18, Primeira Noite dos 18, Editorial 26.12, Filme 35 e Garça · 26.12.

## Raridade da Foto

A raridade é sorteada antes da captura e permanece na publicação:

- Comum;
- Rara;
- Épica;
- Lendária.

O elixir é sorteado separadamente. A Lendária usa moldura hexagonal com brilho multicolorido em movimento. A implementação reproduz a leitura visual das cartas de batalha diretamente com CSS/Canvas; não depende de imagens externas durante a festa.

## Flagra da Festa

Na câmera interna, o app tenta usar a API `FaceDetector` do navegador para posicionar os óculos no maior rosto detectado. Se o aparelho não oferecer essa API ou a detecção falhar, o filtro continua funcionando com os óculos centralizados. O JPEG final também tenta detectar o rosto antes de renderizar os óculos.

Isso deve ser testado principalmente em Android/Chrome e iPhone/Safari, pois o suporte à detecção facial nativa varia entre navegadores.

## Movimento nas publicações

A foto salva no Drive continua sendo um JPEG. O movimento é renderizado no navegador como uma camada leve sobre a foto do feed/modal:

- Arquivo 18: scanner;
- Flagra: flash periódico;
- Confidencial: carimbo/tarja;
- Memória: aviso de memória desbloqueada;
- Raridade: aura da raridade;
- Detector: linha de varredura;
- Descartável: vazamento de luz e grão;
- Primeira Noite: brilhos discretos.

Assim preservamos tamanho de arquivo baixo e não precisamos converter todas as fotos para GIF/vídeo.

## Original preservado + versão publicada

```text
CELULAR
  │
  ├─ original privado ─────────→ Google Drive / Originais
  ├─ foto com efeito ──────────→ Google Drive / Publicados
  └─ prévia leve ──────────────→ Google Drive / Prévias
```

O original não recebe filtro. A versão publicada com efeito é um JPEG separado. Em **Meus cliques**, o dono continua podendo baixar a versão publicada e, quando disponível, o original.

## Atualização a partir da V2

1. Substitua o código do GitHub pelo conteúdo desta V3.
2. Aguarde o deploy da Vercel.
3. Não execute `schema.sql` novamente.
4. Não há nova variável de ambiente.
5. Faça os testes de `docs/TESTES.md`.

## Vercel Hobby

`api/` continua com exatamente **12 Serverless Functions**. Os módulos compartilhados permanecem em `server/`.

## Ainda não incluído

- colagem;
- boomerang;
- rastreamento facial por biblioteca própria/MediaPipe para aparelhos sem `FaceDetector`;
- fotos/recortes do Pedro;
- efeitos com IA.

## Verificação local

```bash
npm install
npm run check
npm run build
```
