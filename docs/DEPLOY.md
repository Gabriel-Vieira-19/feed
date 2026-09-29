# Implantação completa — Pedro 18 Momentos

Siga esta ordem. Ela evita apontar uma peça para outra ainda não configurada.

## 1. TeraBox Open Platform

Cadastre/solicite um aplicativo na Open Platform e obtenha:

- Client ID / AppKey
- Client Secret / SecretKey
- Private Secret
- caminho exato do espaço autorizado para esse aplicativo

Não invente o caminho. A Open Platform limita operações ao espaço do aplicativo. O Worker usa `TERABOX_ROOT_DIR` exatamente como você informar.

A autorização web é feita posteriormente pelo iframe oficial do TeraBox; os segredos ficam somente no Worker.

## 2. Supabase

1. Crie um projeto.
2. Em **Authentication**, habilite **Anonymous Sign-Ins**.
3. Abra **SQL Editor**.
4. Cole e execute `supabase/schema.sql` inteiro.
5. Em **Connect / API Keys**, copie:
   - Project URL;
   - Publishable Key (`sb_publishable_...`);
   - Secret Key (`sb_secret_...`) para uso exclusivo do Worker.

A Secret Key não deve ser colocada no frontend/Vercel.

## 3. Cloudflare Worker

Entre na pasta:

```bash
cd cloudflare-worker
npm install
npx wrangler login
```

Edite os valores públicos de `wrangler.toml`:

```toml
ALLOWED_ORIGINS = "https://SEU-SITE.vercel.app,http://localhost:5173"
SUPABASE_URL = "https://SEU_PROJETO.supabase.co"
SUPABASE_PUBLISHABLE_KEY = "sb_publishable_..."
TERABOX_ROOT_DIR = "/CAMINHO/EXATO/DO/APP-/"
TERABOX_APP_ID = "250528"
MAX_UPLOAD_BYTES = "31457280"
```

Cadastre os segredos no Cloudflare:

```bash
npx wrangler secret put SUPABASE_SECRET_KEY
npx wrangler secret put TERABOX_CLIENT_ID
npx wrangler secret put TERABOX_CLIENT_SECRET
npx wrangler secret put TERABOX_PRIVATE_SECRET
npx wrangler secret put UPLOAD_SESSION_SECRET
npx wrangler secret put ADMIN_KEY
```

Para `UPLOAD_SESSION_SECRET` e `ADMIN_KEY`, use strings aleatórias longas e diferentes.

Cheque e publique:

```bash
npm run check
npx wrangler deploy --dry-run
npm run deploy
```

Anote a URL final do Worker, por exemplo:

```text
https://pedro-momentos-api.seu-subdominio.workers.dev
```

## 4. GitHub e Vercel

Suba a pasta raiz `pedro-momentos` para um repositório próprio no GitHub.

Na Vercel:

1. **Add New > Project**.
2. Importe o repositório.
3. Framework: Vite (a Vercel normalmente detecta automaticamente).
4. Adicione as variáveis:

```text
VITE_SUPABASE_URL=https://SEU_PROJETO.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
VITE_WORKER_URL=https://SEU-WORKER.workers.dev
VITE_TERABOX_CLIENT_ID=SEU_CLIENT_ID_TERABOX
VITE_EVENT_TITLE=PEDRO 18
VITE_EVENT_SUBTITLE=Momentos da festa
```

Não coloque `TERABOX_CLIENT_SECRET`, `TERABOX_PRIVATE_SECRET`, `SUPABASE_SECRET_KEY`, `UPLOAD_SESSION_SECRET` ou `ADMIN_KEY` na Vercel.

Faça o deploy.

Depois que a URL final estiver definida, volte ao `cloudflare-worker/wrangler.toml` e confirme que `ALLOWED_ORIGINS` contém exatamente esse domínio. Republique o Worker se alterar.

## 5. Autorizar a conta TeraBox

Abra:

```text
https://SEU-SITE.vercel.app/?admin=terabox
```

1. Digite a `ADMIN_KEY` configurada no Worker.
2. Clique em **VERIFICAR CONEXÃO**.
3. Clique em **CONECTAR / RECONECTAR TERABOX**.
4. Faça login no TeraBox no iframe oficial.
5. Autorize o aplicativo.
6. Aguarde a mensagem **TeraBox conectado com sucesso**.
7. Clique novamente em **VERIFICAR CONEXÃO**.

A página recebe apenas o código temporário de autorização. A troca pelo token e a guarda dos tokens acontecem no Worker/Durable Object.

## 6. Primeiro teste real

Use primeiro uma foto pequena e depois uma foto semelhante às que serão geradas na festa:

```text
2 MB -> publicar
10–15 MB -> publicar
```

Confira quatro lugares:

1. Feed do aplicativo.
2. Aba **Meus cliques**.
3. Tabela `photos` do Supabase.
4. Arquivo original dentro do espaço do aplicativo no TeraBox.

Depois toque na foto no feed e confirme que o original abre.

## 7. Operação na festa

Na véspera:

- abra `?admin=terabox` e verifique a conexão;
- teste um upload em Wi‑Fi;
- teste um upload em 4G/5G;
- teste Android e iPhone;
- confirme que a conta TeraBox ainda tem espaço disponível.

Durante a festa, não é preciso deixar painel administrativo aberto.

## 8. Observações importantes

- O nome do convidado e a sessão anônima ficam vinculados ao navegador/aparelho. Se ele apagar os dados do navegador ou trocar de aparelho, será uma nova identidade.
- O feed usa thumbnail; o original fica intacto no TeraBox.
- Thumbnails do TeraBox são URLs temporárias. O aplicativo sabe renová-las quando necessário.
- A Open Platform usa access token de curta duração e refresh token rotativo; o Token Vault faz a renovação automaticamente e serializa a troca para não reutilizar o mesmo refresh token em paralelo.
- Quando o período total do refresh token expirar, use `?admin=terabox` para autorizar a conta novamente.
