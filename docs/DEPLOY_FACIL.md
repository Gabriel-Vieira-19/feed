# Deploy fácil — versão final

Se você já está com a v2.2 funcionando, a atualização é pequena. Não precisa recriar Supabase, Google Cloud ou Drive.

---

## CASO A — você já está usando a v2.2

### 1. Supabase

Abra o SQL Editor e execute somente:

```text
supabase/upgrade_v2_2_to_final.sql
```

Isso preserva fotos, usuários e curtidas.

### 2. Vercel

Adicione uma nova variável privada:

```text
CRON_SECRET
```

Use uma senha aleatória longa, diferente da `ADMIN_KEY`.

As variáveis finais ficam:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
VITE_EVENT_TITLE
VITE_EVENT_SUBTITLE
SUPABASE_SERVICE_ROLE_KEY
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
APP_URL
ADMIN_KEY
CRON_SECRET
```

### 3. GitHub

Substitua o código atual por esta versão e faça um commit.

A Vercel fará o deploy automaticamente.

### 4. Painel administrativo

Abra:

```text
SUA_APP_URL/?admin=drive
```

Informe a `ADMIN_KEY` e clique em **ATUALIZAR PAINEL**.

Depois clique uma vez em:

```text
PRIVATIZAR ORIGINAIS ANTIGOS
```

Isso remove eventuais permissões públicas criadas pelas versões de teste.

### 5. Google OAuth

Antes da festa:

```text
Google Cloud
→ Google Auth Platform
→ Audience / Público-alvo
→ Publishing status
→ In production / Em produção
```

Depois volte ao painel do aplicativo e use **CONECTAR / RECONECTAR DRIVE**.

---

## CASO B — instalação nova

### ETAPA 1 — Supabase

1. Crie um projeto.
2. Ative `Authentication → Providers → Anonymous Sign-Ins`.
3. Abra `SQL Editor`.
4. Execute `supabase/schema.sql`.
5. Copie:
   - Project URL;
   - Publishable Key;
   - Secret / Service Role Key.

### ETAPA 2 — GitHub + Vercel

1. Crie um repositório.
2. Envie todos os arquivos.
3. Importe o repositório na Vercel.
4. Configure inicialmente:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
VITE_EVENT_TITLE=PEDRO 18
VITE_EVENT_SUBTITLE=Momentos da festa
```

5. Faça o primeiro deploy e guarde a URL.

### ETAPA 3 — Google Cloud

1. Crie um projeto.
2. Ative a **Google Drive API**.
3. Configure a tela OAuth.
4. Crie `OAuth Client ID → Web application`.
5. Em `Authorized redirect URIs`, coloque exatamente:

```text
SUA_APP_URL/api/admin-drive-callback
```

6. Copie `Client ID` e `Client Secret`.

### ETAPA 4 — variáveis privadas

Na Vercel, adicione:

```text
SUPABASE_SERVICE_ROLE_KEY
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
APP_URL
ADMIN_KEY
CRON_SECRET
```

Depois faça um redeploy.

### ETAPA 5 — conectar Drive

Abra:

```text
SUA_APP_URL/?admin=drive
```

Informe a `ADMIN_KEY`, conecte a conta Google e atualize o painel.

O aplicativo cria:

```text
Pedro Momentos/
├── Originais/
└── Prévias/
```

### ETAPA 6 — produção do OAuth

Durante desenvolvimento, você pode manter o OAuth em Testing.

Antes da festa, altere para **Em produção** e reconecte a conta. Em modo de teste, refresh tokens podem expirar em cerca de 7 dias; em produção eles normalmente permanecem válidos até revogação ou longo período de inatividade.

### ETAPA 7 — testes

Siga `docs/TESTES.md`.
