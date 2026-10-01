# Pedro 18 — Momentos / Filtros V2

## Novidades da V2

- câmera interna em modo imersivo, ocupando toda a tela acima da navegação inferior;
- filtros de temperatura visíveis em tempo real: Dourado, Quente, Âmbar, Champagne, Rosé, Frio, Blue Hour e Noturno;
- molduras também visíveis antes do clique;
- Raridade, Detector de Histórias, Arquivo 18, Flagra e Memória geram o resultado na câmera e preservam o mesmo resultado na foto capturada;
- novas molduras Editorial 26.12, Filme 35 e Garça · 26.12;
- capas dos filtros redesenhadas para representar visualmente o resultado;
- posição horizontal da lista de filtros é preservada ao trocar efeitos, inclusive na prévia;
- não há desbloqueios, horários ou categorias progressivas: todos os efeitos ficam disponíveis.

**Quem já executou `upgrade_final_to_filters_v1.sql` não precisa executar nenhum SQL adicional para a V2.**

Aplicativo web de fotos da festa usando **Google Drive** para arquivos, **Supabase** para usuários/feed/curtidas e **Vercel** para o frontend + API.

Esta edição adiciona a primeira versão da **câmera personalizada com filtros e molduras próprias da festa**, sem categorias bloqueadas e sem desbloqueio por horário: todos os efeitos ficam disponíveis o tempo todo.

## Efeitos disponíveis nesta versão

- Original;
- Dourado;
- Quente;
- Frio;
- Arquivo 18;
- Flagra da Festa;
- A família NÃO vai ver;
- Memória Desbloqueada;
- Raridade da Foto;
- Detector de Histórias;
- Câmera Descartável 18;
- Primeira Noite dos 18.

Os efeitos **Raridade da Foto**, **Detector de Histórias**, **Memória Desbloqueada**, **Arquivo 18** e **Flagra da Festa** geram detalhes aleatórios no momento da captura. O resultado fica congelado na foto publicada.

## Câmera

Ao entrar na aba Câmera, o aplicativo tenta abrir uma câmera interna via navegador. O convidado pode:

- visualizar o efeito antes da captura;
- trocar entre câmera frontal e traseira;
- fotografar dentro do app;
- trocar o efeito depois da foto, antes de publicar;
- usar a câmera nativa do celular como fallback quando a câmera interna não estiver disponível ou a permissão for negada.

A interface não possui botão de galeria.

## Original preservado + versão publicada

A arquitetura agora separa três arquivos:

```text
CELULAR
  │
  ├─ original privado ─────────→ Google Drive / Originais
  │
  ├─ foto com efeito ──────────→ Google Drive / Publicados
  │                               (somente quando existe efeito)
  │
  └─ prévia de até 2 MB ───────→ Google Drive / Prévias
                                   │
                                   ↓
                               feed do site
```

O arquivo original **não recebe o filtro**. Quando um efeito é usado, o app gera separadamente um JPEG de alta qualidade, limitado a 2600 px no maior lado, para a versão publicada. A prévia continua sendo um arquivo leve para o feed.

Em **Meus cliques** o dono da publicação pode baixar:

- **Baixar foto**: versão publicada com efeito; se a foto não tiver efeito, usa o original;
- no modal, quando houver efeito: **Baixar original**.

Outros convidados não têm acesso ao download privado.

## Google Drive

O aplicativo cria ou reaproveita:

```text
Pedro Momentos/
├── Originais/
├── Publicados/
└── Prévias/
```

Os arquivos continuam privados. Não é criada permissão pública “qualquer pessoa com o link”.

## Atualização da versão FINAL/Hobby que já está funcionando

**Não rode `schema.sql` novamente.**

Antes de publicar este código, execute no SQL Editor do Supabase:

```text
supabase/upgrade_final_to_filters_v1.sql
```

Essa migração apenas acrescenta os campos necessários para a versão publicada e para os efeitos; usuários, fotos, curtidas, conexão do Drive e configurações existentes são preservados.

Depois substitua o código no GitHub e aguarde o novo deploy da Vercel.

Não existem novas variáveis de ambiente nesta versão.

## Vercel Hobby

A pasta `api/` continua contendo exatamente **12 funções**. Os módulos compartilhados ficam em `server/`, portanto esta versão preserva a estrutura que já funcionou no plano Hobby do projeto.

## Recuperação e duplicação

- uma captura pendente é salva localmente no navegador;
- o efeito escolhido e seu resultado aleatório também são preservados;
- uma nova tentativa reaproveita arquivos já enviados;
- o `upload_group_id` inclui a variação do efeito para evitar conflito se a mesma captura for publicada com outro resultado;
- uploads abandonados continuam sendo removidos após 8 horas.

## Ainda não incluído

Esta é a **Fase 1** dos filtros. Ainda não entram nesta versão:

- colagens;
- boomerang;
- filtros faciais/rastreamento de rosto;
- recortes/fotos do Pedro;
- efeitos com IA.

A estrutura foi mantida modular para essas próximas etapas.

## Implantação

Para atualizar a versão que já está online, siga:

```text
docs/DEPLOY_FACIL.md
```

Depois execute:

```text
docs/TESTES.md
```

## Estrutura principal

```text
api/                         # 12 Serverless Functions
server/                      # módulos backend compartilhados
docs/
public/
scripts/
src/
├── lib/
│   ├── drive.js
│   ├── effects.js           # motor dos efeitos
│   ├── pending-upload.js
│   ├── supabase.js
│   └── utils.js
├── config.js
├── main.js
└── styles.css
supabase/
├── schema.sql
├── upgrade_v2_2_to_final.sql
└── upgrade_final_to_filters_v1.sql
index.html
package.json
vercel.json
```

## Verificação local

```bash
npm install
npm run check
npm run build
```
