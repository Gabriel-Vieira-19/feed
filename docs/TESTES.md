# Roteiro de testes — Pedro Momentos / Google Drive

Faça estes testes antes de compartilhar o aplicativo.

## 1. Conexão

Abra:

```text
/?admin=drive
```

- `VERIFICAR CONEXÃO` deve dizer que o Drive está conectado.
- No Drive devem existir `Pedro Momentos/Originais` e `Pedro Momentos/Prévias`.

Também teste:

```text
/api/health
```

Resultado esperado:

```json
{"ok":true,"driveConnected":true}
```

## 2. Entrada

Em janela anônima:

- informe um nome;
- feche e reabra a página;
- a sessão deve permanecer enquanto o armazenamento do navegador existir;
- alterar o nome no topo não deve alterar o nome das fotos antigas.

## 3. Câmera

Em Android e iPhone:

- `ABRIR CÂMERA` deve abrir a câmera normal do aparelho;
- `ESCOLHER DA GALERIA` deve abrir o seletor do sistema;
- cancelar a câmera/galeria não deve produzir erro.

## 4. Foto pequena

Use uma foto de 1–3 MB.

Depois de publicar:

- deve aparecer no feed;
- `Originais` deve receber o arquivo original;
- `Prévias` deve receber um JPEG menor;
- o tamanho do original no Drive deve ser igual ao arquivo selecionado;
- o feed não deve carregar o original para cada card.

## 5. Foto grande

Use uma foto entre 10 e 15 MB.

Observe a barra de progresso.

O upload é enviado em blocos de 4 MB diretamente ao Google Drive.

Resultado esperado:

- Vercel não recebe o arquivo grande no corpo de uma Function;
- o original chega completo ao Drive;
- a publicação só aparece depois que original e prévia terminaram.

## 6. Interrupção de rede

Durante uma foto grande:

- desligue o Wi‑Fi por alguns segundos ou use as ferramentas de rede do navegador;
- religue;
- o app deve tentar consultar o progresso e continuar;
- se a sessão do Drive realmente expirar, o app deve pedir para publicar novamente, sem criar uma linha falsa no feed.

## 7. Dois dispositivos

Celular A:

- publique uma foto.

Celular B:

- mantenha o feed aberto.

A nova foto deve aparecer via Supabase Realtime ou no refresh de segurança.

## 8. Curtidas

- curta no celular A;
- atualize o celular B;
- o contador deve refletir a curtida;
- clicar novamente deve remover a própria curtida;
- o mesmo usuário não deve gerar duas curtidas na mesma foto.

## 9. Meus cliques

- publique 2 fotos;
- abra `Meus cliques`;
- somente as fotos da sessão/usuário atual devem aparecer.

## 10. Original

- toque em uma foto no feed;
- a prévia ampliada deve abrir;
- `ABRIR FOTO ORIGINAL` deve abrir o visualizador do Google Drive sem pedir login ao convidado.

Se pedir login, confira se a API conseguiu criar a permissão `anyone / reader` para o original.

## 11. Limites

- arquivo acima de 30 MB deve ser recusado antes do upload;
- arquivo que não seja imagem deve ser recusado;
- prévia acima de 2 MB não deve ser aceita pelo backend.

## 12. Teste de carga simples

Antes da festa, faça pelo menos:

- 50 uploads distribuídos entre 2 ou 3 celulares;
- rolagem do feed por alguns minutos;
- 100+ curtidas alternadas;
- teste em Wi‑Fi e 4G/5G.

Para o protótipo, o Google Drive é o storage. Se o teste mostrar que a festa exigirá muito mais que 15 GB, a camada de armazenamento pode ser trocada depois sem redesenhar o feed, usuários e curtidas.
