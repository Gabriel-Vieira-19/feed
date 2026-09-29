# Pedro 18 — Momentos

Aplicativo web de fotos para a festa. Esta versão usa **Google Drive para guardar as imagens originais**, **Supabase para usuários/feed/curtidas** e **Vercel para o site + pequenas rotas de API**.

## O que o convidado vê

- entra apenas com um nome;
- abre a câmera normal do celular ou escolhe da galeria;
- vê uma prévia;
- publica no feed;
- pode salvar a foto localmente antes de publicar;
- curte fotos;
- vê suas próprias publicações em “Meus cliques”.

Não há filtros, comentários nem legenda editável. O texto “Publicado por …” é automático.

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

## Por que o upload não passa pela Vercel

Fotos de celular podem ultrapassar 4,5 MB. O navegador primeiro pede ao backend uma sessão de upload do Google Drive e depois envia os bytes **diretamente para o Google**. Isso evita o limite de corpo das Vercel Functions.

O envio usa upload retomável em blocos de 4 MB. Se ocorrer uma falha temporária, o app consulta até onde o Drive recebeu e tenta continuar.

## Segurança

- `GOOGLE_CLIENT_SECRET` nunca vai para o navegador.
- o `refresh_token` do Google é salvo em `app_settings` no Supabase e só o backend com `service_role` acessa;
- o frontend usa apenas a chave pública do Supabase;
- uploads só podem ser iniciados por uma sessão anônima válida do Supabase;
- ao publicar, o backend verifica se os dois arquivos do Drive pertencem ao mesmo usuário e ao mesmo upload;
- a prévia é privada no Drive e é entregue pelo endpoint `/api/media`;
- a foto original recebe permissão “qualquer pessoa com o link” apenas para permitir que convidados a abram no visualizador do Drive.

## Estrutura

```text
pedro-momentos-google-drive/
├── api/
│   ├── _lib/
│   ├── admin-drive-auth.js
│   ├── admin-drive-callback.js
│   ├── admin-drive-status.js
│   ├── drive-upload-session.js
│   ├── health.js
│   ├── media.js
│   ├── original-link.js
│   └── photo-publish.js
├── docs/
│   ├── DEPLOY_FACIL.md
│   └── TESTES.md
├── public/
├── scripts/
├── src/
│   ├── lib/
│   │   ├── drive.js
│   │   ├── supabase.js
│   │   └── utils.js
│   ├── config.js
│   ├── main.js
│   └── styles.css
├── supabase/
│   ├── reset_test_project.sql
│   └── schema.sql
├── .env.example
├── index.html
├── package.json
└── vercel.json
```

## Implantação

Não tente configurar tudo de uma vez. Siga [docs/DEPLOY_FACIL.md](docs/DEPLOY_FACIL.md) na ordem indicada.

Resumo:

1. criar Supabase;
2. colocar projeto no GitHub e fazer primeiro deploy na Vercel;
3. criar OAuth do Google Drive usando a URL da Vercel;
4. adicionar as variáveis privadas na Vercel;
5. abrir `/?admin=drive` e conectar a conta Google;
6. executar os testes.

## Desenvolvimento local

```bash
npm install
npm run dev
```

Para verificar a estrutura do código:

```bash
npm run check
```

> O OAuth do Google é mais simples de testar no domínio real da Vercel, porque o `redirect_uri` precisa coincidir exatamente com o cadastrado no Google Cloud.


## Correção de upload via Vercel

A versão 2.1 não envia mais os blocos diretamente do navegador para a URL de sessão do Google Drive. Os blocos de 3 MB passam por `/api/drive-upload-proxy`, que os encaminha ao Drive. Isso evita erros genéricos `Failed to fetch`/CORS no navegador e mantém cada requisição abaixo do limite de 4,5 MB das Vercel Functions. O arquivo original continua sem compressão ou conversão.

## v2.2 — proteção contra fotos duplicadas em novas tentativas

Se uma publicação falhar depois que a foto original ou a prévia já tiver sido enviada ao Google Drive, tocar novamente em **PUBLICAR** reaproveita os arquivos já concluídos. O mesmo arquivo mantém um `upload_group_id` temporário até a publicação terminar, e a API consulta o Drive antes de abrir uma nova sessão.

Isso cobre três casos importantes:

- vários toques rápidos no botão: o botão e as demais ações ficam bloqueados enquanto há um envio ativo;
- falha depois do original: a próxima tentativa não envia o original novamente;
- falha depois de o backend publicar, mas antes de o celular receber a resposta: `photo-publish` continua idempotente e devolve a publicação já existente.

As cópias antigas criadas por versões anteriores usavam identificadores diferentes e, por isso, não podem ser reconhecidas com segurança como duplicatas. Elas podem ser excluídas manualmente da pasta `Pedro Momentos/Originais` no Drive.
