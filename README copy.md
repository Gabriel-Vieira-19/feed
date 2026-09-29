# Pedro 18 — Momentos

Aplicativo web independente para registrar e compartilhar as fotos da festa.

## Experiência do convidado

1. No primeiro acesso, informa apenas o nome.
2. Entra no **Feed da festa**.
3. Toca em **Câmera** para abrir a câmera normal do celular ou escolher uma imagem da galeria.
4. Confere a foto sem filtros e sem qualquer recompressão do original.
5. Escolhe **Publicar na festa**, **Salvar no celular** ou **Escolher outra**.
6. No feed, as fotos aparecem com o texto automático **Publicado por Nome** e podem receber curtidas.
7. Em **Meus cliques**, vê as próprias publicações daquela sessão/aparelho.

Não existem legendas editáveis, comentários ou filtros nesta versão.

## Arquitetura

```text
Vercel (frontend Vite)
        |
        |-- Supabase Auth anônimo
        |-- Supabase Postgres (perfis, fotos e curtidas)
        |-- Supabase Realtime (novas fotos)
        |
        +-- Cloudflare Worker
                 |
                 |-- valida a sessão Supabase
                 |-- guarda os segredos fora do navegador
                 |-- Token Vault em Durable Object
                 |-- renova access_token/refresh_token de forma serializada
                 +-- TeraBox Open Platform
                       |-- originais
                       +-- thumbnails do feed
```

## Proteções já implementadas

- O navegador nunca recebe `client_secret`, `private_secret`, refresh token do TeraBox ou Secret Key do Supabase.
- O access token do TeraBox também não é exposto aos convidados.
- O Worker aceita chamadas apenas das origens configuradas em `ALLOWED_ORIGINS`.
- Uploads usam uma sessão curta assinada por HMAC.
- O nome gravado na publicação é lido do perfil no servidor; o cliente não consegue forjar o autor da foto no payload.
- O upload é fragmentado e cada fragmento é validado pelo MD5 retornado pelo TeraBox.
- A finalização do upload é idempotente para suportar repetição após perda de conexão/resposta.
- Duplo clique em **Publicar** é bloqueado no frontend.
- Miniaturas expiradas ou ainda não geradas são renovadas automaticamente.
- O original é transmitido pelo Worker apenas quando a pessoa toca para ampliar a foto.
- RLS do Supabase impede que convidados gravem diretamente na tabela de fotos.

## Escala do feed

O feed carrega 20 fotos por página e usa thumbnails do TeraBox, não os originais de 10–15 MB. Novas fotos chegam por Realtime; existe também uma atualização periódica a cada 30 segundos para recuperar contagens de curtidas e servir como fallback.

## TeraBox

A integração segue o fluxo oficial:

```text
autorização -> access/refresh token
precreate -> upload dos fragmentos -> create
filemetas -> thumbnail
download -> dlink -> original
```

Os originais são enviados sem redimensionamento e sem recompressão.

### O que ainda precisa ser preenchido por você

Uma integração real só pode ser concluída depois que você tiver as credenciais da Open Platform:

- `TERABOX_CLIENT_ID`
- `TERABOX_CLIENT_SECRET`
- `TERABOX_PRIVATE_SECRET`
- caminho exato autorizado para o aplicativo (`TERABOX_ROOT_DIR`)

Depois do deploy, a autorização inicial da conta é feita em:

```text
https://SEU-SITE.vercel.app/?admin=terabox
```

Essa tela administrativa não é usada pelos convidados.

## Implantação

Siga `docs/DEPLOY.md` na ordem indicada.

Antes da festa, execute também o roteiro de `docs/TESTES.md` em pelo menos um Android e um iPhone reais.

## Desenvolvimento local

```bash
npm install
cp .env.example .env.local
npm run dev
```

Worker:

```bash
cd cloudflare-worker
npm install
cp .dev.vars.example .dev.vars
npm run dev
```

## Verificações

Depois de instalar as dependências:

```bash
npm run check
npm run build
cd cloudflare-worker
npm run check
npx wrangler deploy --dry-run
```
