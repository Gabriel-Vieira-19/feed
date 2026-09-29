# Deploy fácil — faça nesta ordem

A ideia desta versão é evitar um servidor separado e manipulação manual de tokens. Você terá somente:

```text
GitHub → Vercel → Google Drive
              ↘ Supabase
```

## ETAPA 1 — Supabase

### 1. Crie um projeto

Entre no Supabase e crie um projeto novo para **Pedro Momentos**.

### 2. Ative usuários anônimos

No painel:

```text
Authentication
→ Providers
→ Anonymous Sign-Ins
→ ON
```

### 3. Crie as tabelas

Abra:

```text
SQL Editor
→ New query
```

Cole todo o conteúdo de:

```text
supabase/schema.sql
```

Clique em **Run**.

### 4. Copie duas informações

No painel do Supabase, copie:

```text
Project URL
Publishable Key
```

Você também precisará da **Secret / Service Role Key**, mas ela será colocada somente na Vercel.

---

## ETAPA 2 — GitHub + primeiro deploy na Vercel

### 1. Crie um repositório novo

Exemplo:

```text
pedro-momentos
```

Envie todos os arquivos deste projeto para ele.

### 2. Importe na Vercel

Na Vercel:

```text
Add New
→ Project
→ importe pedro-momentos
```

A Vercel deve reconhecer Vite automaticamente.

### 3. Antes do primeiro deploy, adicione só estas variáveis

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
VITE_EVENT_TITLE=PEDRO 18
VITE_EVENT_SUBTITLE=Momentos da festa
```

Faça o deploy.

Ao terminar, você terá algo como:

```text
https://pedro-momentos.vercel.app
```

Guarde essa URL. Vamos chamá-la de `APP_URL`.

---

## ETAPA 3 — Google Cloud / Google Drive API

Use de preferência uma **Conta Google separada apenas para as fotos da festa**.

### 1. Crie um projeto no Google Cloud

No Google Cloud Console, crie um projeto chamado, por exemplo:

```text
Pedro Momentos
```

### 2. Ative a Google Drive API

Procure por:

```text
Google Drive API
```

Abra e clique em **Enable / Ativar**.

### 3. Configure a tela de consentimento OAuth

Crie/configure o aplicativo OAuth.

Para teste, pode usar tipo **External** e adicionar a própria conta Google que guardará as fotos como usuário de teste.

O aplicativo solicita somente:

```text
https://www.googleapis.com/auth/drive.file
```

Esse escopo permite trabalhar apenas com arquivos usados/criados por este aplicativo, em vez de conceder acesso amplo a todo o Drive.

### 4. Crie uma credencial OAuth

Crie:

```text
OAuth Client ID
→ Web application
```

Em **Authorized redirect URIs**, coloque EXATAMENTE:

```text
SUA_APP_URL/api/admin-drive-callback
```

Exemplo:

```text
https://pedro-momentos.vercel.app/api/admin-drive-callback
```

Copie:

```text
Client ID
Client Secret
```

---

## ETAPA 4 — Variáveis privadas na Vercel

Agora volte à Vercel:

```text
Project
→ Settings
→ Environment Variables
```

Adicione:

```text
SUPABASE_SERVICE_ROLE_KEY
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
APP_URL
ADMIN_KEY
```

### Valores

`SUPABASE_SERVICE_ROLE_KEY`
: a chave secreta/service role do Supabase.

`GOOGLE_CLIENT_ID`
: Client ID criado no Google Cloud.

`GOOGLE_CLIENT_SECRET`
: Client Secret criado no Google Cloud.

`APP_URL`
: URL de produção da Vercel, sem `/` no final.

`ADMIN_KEY`
: invente uma senha grande, por exemplo 32+ caracteres aleatórios. Essa chave protege a tela que conecta o Google Drive.

Depois clique em **Redeploy**.

---

## ETAPA 5 — Conectar o Google Drive

Abra:

```text
SUA_APP_URL/?admin=drive
```

Exemplo:

```text
https://pedro-momentos.vercel.app/?admin=drive
```

Digite a `ADMIN_KEY` que você colocou na Vercel.

Clique:

```text
CONECTAR / RECONECTAR GOOGLE DRIVE
```

O Google abrirá a autorização.

Entre com a conta que guardará as fotos e permita o acesso.

Depois você voltará à página administrativa. Clique em:

```text
VERIFICAR CONEXÃO
```

Deve aparecer algo parecido com:

```text
Google Drive conectado. Pasta: Pedro Momentos.
```

No Drive serão criadas automaticamente:

```text
Pedro Momentos/
├── Originais/
└── Prévias/
```

Você NÃO precisa criar essas pastas manualmente.

---

## ETAPA 6 — Teste

Abra a URL normal:

```text
SUA_APP_URL
```

Faça nesta ordem:

1. informe seu nome;
2. tire uma foto pequena;
3. publique;
4. confira se apareceu no feed;
5. confira as duas pastas no Google Drive;
6. depois teste uma foto de 10–15 MB;
7. teste uma curtida em outro navegador/celular.

Use também o roteiro de `docs/TESTES.md`.

---

# Observação importante sobre OAuth em modo Testing

Se o app OAuth do Google estiver com publicação **Testing / Teste** e tipo externo, o refresh token pode expirar em poucos dias. Durante desenvolvimento isso é aceitável: basta abrir `/?admin=drive` e reconectar.

Antes da festa, não deixe essa verificação para a última hora. Faça um teste alguns dias antes e confirme que a conexão continua ativa.

---

# Variáveis finais — checklist

Na Vercel devem existir:

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
```

No GitHub NÃO devem existir valores reais dessas chaves.
