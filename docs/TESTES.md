# Testes — Filtros V3

Faça pelo menos um ciclo completo em Android e outro em iPhone antes de considerar esta fase pronta.

## 1. Migração e painel

- se a Filtros V1 já está funcionando, não execute SQL novo; se estiver vindo da versão FINAL, execute `supabase/upgrade_final_to_filters_v1.sql` uma única vez;
- abra `/?admin=drive`;
- confirme que **ATUALIZAR PAINEL** funciona;
- confirme que o Google Drive contém `Originais`, `Prévias` e `Publicados`.

## 2. Câmera interna

- abra a aba Câmera;
- permita acesso;
- confirme imagem ao vivo;
- troque entre traseira e frontal;
- altere vários efeitos antes da foto;
- confirme que o overlay ao vivo muda sem recarregar a página;
- saia da aba Câmera e confirme que a câmera do aparelho desliga.

## 3. Fallback da câmera nativa

- teste o botão **CÂMERA NATIVA**;
- em um aparelho onde a permissão da câmera interna for negada, confirme que o fallback continua permitindo tirar foto;
- a interface do app não deve oferecer botão próprio de galeria.

## 4. Todos os efeitos

Publique pelo menos uma foto com cada efeito:

- Original;
- Dourado;
- Quente;
- Âmbar;
- Champagne;
- Rosé;
- Frio;
- Blue Hour;
- Noturno;
- Arquivo 18;
- Flagra da Festa;
- A família NÃO vai ver;
- Memória Desbloqueada;
- Raridade da Foto;
- Detector de Histórias;
- Câmera Descartável 18;
- Primeira Noite dos 18;
- Editorial 26.12;
- Filme 35;
- Garça · 26.12.

Confirme que molduras e textos aparecem também na foto final, não apenas na câmera ao vivo.

## 5. Efeitos aleatórios

Faça duas ou três capturas separadas com:

- Raridade da Foto;
- Detector de Histórias;
- Memória Desbloqueada.

Os resultados podem variar entre capturas. Depois de tirar uma foto, o resultado daquela captura deve permanecer igual durante o upload e após recuperação da página.

## 6. Troca de efeito depois da foto

- tire uma foto;
- na tela de prévia, selecione outro efeito;
- aguarde o processamento;
- troque novamente;
- publique somente o resultado final escolhido.

O arquivo original não deve ser alterado.

## 7. Drive

Para uma foto com efeito, confirme:

```text
Originais/   → arquivo original
Publicados/  → JPEG com efeito
Prévias/     → JPEG leve para o feed
```

Para `Original`, a pasta `Publicados` não precisa receber uma cópia duplicada; o feed utiliza uma prévia criada do original.

## 8. Meus cliques e downloads

- no feed geral não deve existir download;
- em Meus cliques, **Baixar foto** deve baixar a versão publicada;
- abra uma foto com efeito e confirme o botão **Baixar original**;
- compare os dois arquivos: o original não deve conter moldura/filtro e a foto publicada deve conter o efeito.

## 9. Recuperação

- tire uma foto com efeito;
- antes de publicar, recarregue a página;
- o app deve recuperar original, efeito escolhido e versão processada;
- continue a publicação.

## 10. Falha de internet e idempotência

- inicie uma publicação;
- interrompa a internet durante o envio;
- restabeleça e tente novamente;
- a foto deve aparecer uma única vez no feed;
- não devem surgir cópias extras do mesmo tipo no Drive.

## 11. Feed

Confirme:

- preview correta do efeito;
- nome do efeito abaixo do autor quando não for `Original`;
- curtidas;
- modal;
- ordenação por data, curtidas e usuário.

## 12. Administração

- armazenamento usado deve contabilizar original + publicado + prévia;
- ocultar/restaurar continua funcionando;
- ao excluir uma foto com efeito, os três arquivos devem ser removidos do Drive;
- limpeza de abandonados continua funcionando.

## 13. Desempenho móvel

Teste especialmente fotos grandes e celulares intermediários:

- trocar efeitos na prévia não deve travar permanentemente a página;
- durante o processamento, deve aparecer a tela de preparação;
- após publicar ou tirar outra foto, a câmera deve continuar funcionando;
- teste 10 a 20 capturas seguidas para verificar memória.

## 14. Regressão

Também confirme que continuam funcionando:

- entrada por nome;
- Realtime;
- curtidas;
- paginação;
- offline banner;
- QR Code;
- painel administrativo;
- OAuth/Drive já conectado;
- limite de 12 funções da estrutura Hobby.


## Testes específicos da V2

- Ao ativar a câmera interna, confirmar que a câmera ocupa toda a área acima da navegação inferior e que a barra inferior continua utilizável.
- Percorrer a lista até os últimos filtros, selecionar um deles e confirmar que a lista não volta para o início.
- Em Raridade e Detector de Histórias, confirmar que o resultado aparece antes do clique e é o mesmo na foto gerada.
- Conferir em tempo real Arquivo 18, Flagra, Confidencial, Memória, Descartável, Primeira Noite, Editorial, Filme 35 e Garça 26.12.
- Testar Dourado, Quente, Âmbar, Champagne, Rosé, Frio, Blue Hour e Noturno nas câmeras frontal e traseira.
- Repetir os testes em Android e iPhone, incluindo orientação vertical e retorno do app após bloquear/desbloquear a tela.


## Testes específicos da V3

- abrir a câmera e confirmar que cada capa mostra nome e explicação curta;
- rolar até filtros distantes, selecionar e confirmar que a faixa não volta ao início;
- testar Mel, Tungstênio, Gelo e Crepúsculo;
- testar Flagra com um rosto central e mover o rosto para os lados;
- repetir Flagra em aparelho sem FaceDetector e confirmar que o fallback não quebra a captura;
- capturar Raridade várias vezes e confirmar elixir independente da raridade;
- encontrar/forçar teste de Lendária e conferir formato hexagonal + aura multicolorida;
- publicar Arquivo, Flagra, Confidencial, Memória, Raridade, Detector, Descartável e Primeira Noite e confirmar movimento no feed;
- abrir cada uma no modal e confirmar que a camada animada acompanha a imagem;
- verificar que o download continua sendo JPEG estático com o desenho principal do filtro;
- testar Android/Chrome e iPhone/Safari, especialmente o Flagra.
