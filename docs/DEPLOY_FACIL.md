# Deploy fácil — Filtros V1

Este roteiro considera que a versão FINAL compatível com Vercel Hobby já está funcionando.

## 1. Atualize o Supabase primeiro

Abra:

```text
Supabase → SQL Editor → New query
```

Cole e execute somente:

```text
supabase/upgrade_final_to_filters_v1.sql
```

A migração preserva os dados existentes e apenas acrescenta:

```text
published_drive_id
published_name
published_mime_type
published_size_bytes
effect_id
effect_meta
```

**Não execute `schema.sql` novamente.**

## 2. Atualize o GitHub

Substitua o conteúdo atual do repositório pelo conteúdo desta versão.

Confirme que a raiz contém diretamente:

```text
api/
server/
src/
supabase/
package.json
vercel.json
```

A pasta `api/` deve continuar com exatamente 12 arquivos `.js`.

Faça o commit/push.

## 3. Aguarde a Vercel

A Vercel deve fazer o deployment automaticamente.

Não há nenhuma variável de ambiente nova para os filtros.

Quando aparecer `Ready`, abra o aplicativo com `Ctrl + F5` ou numa aba anônima para evitar cache antigo.

## 4. Abra o painel administrativo

Acesse:

```text
SUA_APP_URL/?admin=drive
```

Informe a `ADMIN_KEY` e clique em **ATUALIZAR PAINEL**.

Nesse momento o backend também garante que exista a nova pasta:

```text
Pedro Momentos/Publicados
```

Não é necessário desconectar ou recriar a integração do Google Drive.

## 5. Teste a câmera

Entre normalmente no aplicativo e abra **Câmera**.

Teste:

```text
Original
Dourado
Quente
Frio
Arquivo 18
Flagra da Festa
A família NÃO vai ver
Memória Desbloqueada
Raridade da Foto
Detector de Histórias
Câmera Descartável 18
Primeira Noite dos 18
```

Depois siga o roteiro completo em `docs/TESTES.md`.

---

## Instalação nova

Para uma instalação do zero:

1. ative Anonymous Sign-Ins no Supabase;
2. execute `supabase/schema.sql`;
3. configure as variáveis existentes da Vercel;
4. configure Google Drive API/OAuth;
5. conecte o Drive por `/?admin=drive`.

A instalação nova já cria o esquema com suporte a filtros, portanto não execute os arquivos de upgrade.
