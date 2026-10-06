# Pedro 18 — Momentos

Aplicativo web de fotos para a festa. Esta versão final usa **Google Drive para os arquivos**, **Supabase para usuários/feed/curtidas** e **Vercel para o site + rotas de API**.

## O que o convidado vê

- entra apenas com um nome;
- abre a câmera normal do celular;
- tira uma foto nova durante a festa;
- vê a prévia e publica no feed;
- curte fotos;
- ordena o feed por mais recentes, mais antigas, mais curtidas, menos curtidas, usuários A–Z e usuários Z–A;
- vê suas próprias publicações em **Meus cliques**;
- baixa a foto original **somente em Meus cliques**.

Não há galeria para publicação, filtros, comentários nem legenda editável. O texto “Publicado por …” é automático.

## Como as fotos são guardadas

```text
CELULAR
  │
  ├─ original ───────────────→ Google Drive / Originais
  │
  └─ prévia de até 2 MB ────→ Google Drive / Prévias
                                  │
                                  ↓
                              feed do site

Supabase guarda somente os dados:
nome, ID da foto, curtidas, horário, IDs do Drive etc.
```

A foto original **não é redimensionada nem recomprimida**. A prévia é um segundo arquivo leve, criado apenas para o feed.

## Privacidade dos originais

Os originais ficam privados no Google Drive. O aplicativo não cria mais permissão “qualquer pessoa com o link”.

O download é feito em blocos privados de até 3 MB e o backend verifica se a foto pertence ao usuário atual. Por isso o botão de download só existe em **Meus cliques** e a própria API também bloqueia downloads de fotos de outras pessoas.

Se você já usou uma versão antiga que tornou originais públicos, abra `/?admin=drive` e use **PRIVATIZAR ORIGINAIS ANTIGOS** uma vez.

## Proteção contra duplicação e falhas

- vários toques rápidos em publicar não iniciam uploads paralelos;
- o mesmo arquivo mantém um `upload_group_id` até a publicação terminar;
- se original ou prévia já chegaram ao Drive, uma nova tentativa os reaproveita;
- se a página for recarregada, a foto pendente pode ser restaurada do armazenamento local do navegador;
- o backend continua idempotente: uma publicação já concluída não é criada novamente.

## Limpeza automática

Uploads que chegaram ao Drive, mas nunca viraram uma publicação, são considerados abandonados após 8 horas.

Existe:

- botão manual no painel administrativo;
- Vercel Cron diário em `/api/cleanup-abandoned`.

Para o Cron funcionar, configure `CRON_SECRET` na Vercel.

## Painel administrativo

Abra:

```text
SUA_URL/?admin=drive
```

Com a `ADMIN_KEY`, o painel permite:

- conectar/reconectar o Drive;
- visualizar total de fotos, usuários, curtidas, fotos ocultas e armazenamento usado;
- ocultar e restaurar publicações;
- excluir uma publicação do Supabase e os dois arquivos do Drive;
- limpar uploads abandonados;
- privatizar originais criados por versões antigas;
- gerar e baixar um QR Code do aplicativo.

## OAuth antes da festa

Durante desenvolvimento o Google OAuth pode ficar em modo **Testing**. Antes da festa, altere a tela de consentimento para **In production / Em produção** e reconecte o Drive. O modo de teste pode gerar refresh tokens com validade limitada.

## Atualizando a versão 2.2 já instalada

Se você já tem o Supabase funcionando com a v2.2, **não rode `schema.sql` de novo**.

Execute apenas:

```text
supabase/upgrade_v2_2_to_final.sql
```

Depois atualize o GitHub/Vercel e adicione a nova variável privada:

```text
CRON_SECRET
```

Por fim, abra `/?admin=drive` e clique em **PRIVATIZAR ORIGINAIS ANTIGOS**.

## Implantação

Siga `docs/DEPLOY_FACIL.md`.

Resumo:

1. Supabase;
2. GitHub + Vercel;
3. Google Drive API + OAuth;
4. variáveis privadas na Vercel;
5. conectar a conta Google;
6. colocar o OAuth em produção antes da festa;
7. executar `docs/TESTES.md`.

## Estrutura principal

```text
pedro-momentos-google-drive-final/
├── api/
│   ├── _lib/
│   ├── admin-dashboard.js
│   ├── admin-drive-auth.js
│   ├── admin-drive-callback.js
│   ├── admin-drive-status.js
│   ├── admin-photo-action.js
│   ├── admin-private-originals.js
│   ├── cleanup-abandoned.js
│   ├── drive-upload-proxy.js
│   ├── drive-upload-session.js
│   ├── health.js
│   ├── media.js
│   ├── original-chunk.js
│   └── photo-publish.js
├── docs/
├── public/
├── scripts/
├── src/
│   ├── lib/
│   │   ├── drive.js
│   │   ├── pending-upload.js
│   │   ├── supabase.js
│   │   └── utils.js
│   ├── config.js
│   ├── main.js
│   └── styles.css
├── supabase/
│   ├── schema.sql
│   └── upgrade_v2_2_to_final.sql
├── .env.example
├── index.html
├── package.json
└── vercel.json
```

## Verificação local

```bash
npm install
npm run check
npm run build
```

## Proteção visual contra screenshots

Esta edição adiciona uma camada de proteção no frontend:

- cobre imediatamente o conteúdo quando a aba/janela perde foco ou fica oculta;
- reage a `PrintScreen` quando o navegador recebe o evento;
- bloqueia impressão por `Ctrl/Cmd + P` e via CSS de impressão;
- desabilita menu de contexto e arraste diretamente sobre fotos, vídeos e canvas;
- exibe uma marca d'água discreta com o nome local do convidado.

Limitação do navegador: não existe API web capaz de impedir 100% capturas feitas pelo sistema operacional, botões físicos do celular, extensões ou outro dispositivo. A proteção reduz capturas casuais e mantém identificação visual no conteúdo.
