# Correção do limite de funções da Vercel Hobby

Esta versão foi reorganizada para manter **exatamente 12 Serverless Functions** dentro de `api/`, que é o limite do plano Hobby.

O que mudou:

- `api/health.js` foi removido porque não era usado pelo frontend; servia apenas como diagnóstico redundante.
- os módulos compartilhados que estavam em `api/_lib/` foram movidos para `server/`:
  - `server/http.js`
  - `server/supabase-admin.js`
  - `server/google-drive.js`
- todos os imports das funções foram atualizados para apontar para `../server/...`.
- a proteção contra screenshots continua totalmente no frontend e não cria nenhuma função Serverless.
- `scripts/check.mjs` agora falha localmente se a pasta `api/` voltar a passar de 12 funções.

Funções em `api/`: 12.
