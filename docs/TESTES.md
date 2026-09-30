# Roteiro final de testes — Pedro Momentos

Faça os testes antes da festa em Android e iPhone.

## 1. Painel e Drive

Abra `/?admin=drive`.

Confirme:

- Drive conectado;
- pasta `Pedro Momentos` existente;
- estatísticas carregando;
- QR Code aparecendo;
- botão de limpeza funcionando.

Se você usou versões antigas, execute **PRIVATIZAR ORIGINAIS ANTIGOS**.

## 2. Entrada

- informe um nome;
- recarregue;
- a sessão deve continuar;
- mudar o nome no topo não deve alterar o nome das fotos antigas.

## 3. Câmera

- `ABRIR CÂMERA` deve abrir a câmera do aparelho;
- não deve existir botão de galeria;
- cancelar a câmera não deve gerar erro.

Observação: o comportamento exato do seletor é controlado pelo navegador/sistema operacional; a interface do aplicativo não oferece publicação pela galeria.

## 4. Publicação

Teste uma foto de 1–3 MB e outra de 10–15 MB.

Confirme:

- barra e porcentagem de progresso;
- original em `Originais`;
- JPEG leve em `Prévias`;
- apenas uma publicação no feed;
- original não é recomprimido.

## 5. Nova tentativa sem duplicar

1. inicie uma publicação;
2. interrompa a internet depois do original;
3. restabeleça;
4. toque em publicar novamente.

Resultado esperado:

- o original anterior é reaproveitado;
- não é criada outra cópia;
- a foto aparece somente uma vez no feed.

Também toque várias vezes rapidamente em publicar. Apenas um envio deve existir.

## 6. Recuperação após recarregar

1. tire uma foto;
2. antes de concluir a publicação, recarregue a página;
3. o aplicativo deve avisar que encontrou uma foto pendente;
4. abra a aba Câmera e continue a publicação.

Essa recuperação usa armazenamento local do navegador e é uma camada de segurança adicional; sistemas móveis ainda podem limpar dados locais em situações extremas.

## 7. Feed e ordenação

Teste todos:

- Mais recentes;
- Mais antigas;
- Mais curtidas;
- Menos curtidas;
- Usuários A–Z;
- Usuários Z–A.

Carregue mais de 20 fotos para validar o botão **CARREGAR MAIS**.

## 8. Meus cliques

- somente suas próprias fotos devem aparecer;
- teste os mesmos tipos de ordenação;
- o botão **Baixar original** deve existir somente aqui.

## 9. Download privado

Em `Meus cliques`:

- baixe uma foto original;
- confirme tamanho e qualidade.

No feed geral:

- não deve existir download do original.

Tente manualmente usar o ID de uma foto de outra pessoa no endpoint de download. O backend deve negar, porque o original só pode ser baixado pelo dono da publicação.

## 10. Privacidade

No Google Drive, abra as propriedades de compartilhamento de um original novo.

Resultado esperado:

- ele não deve estar como “qualquer pessoa com o link”.

## 11. Moderação

No painel admin:

- oculte uma publicação;
- após a atualização do feed, ela deve desaparecer;
- restaure e confira que volta;
- crie uma foto descartável e teste excluir;
- confirme que original e prévia também desapareceram do Drive.

## 12. Limpeza de arquivos abandonados

Para um teste controlado, envie um arquivo e interrompa antes da publicação final. A limpeza automática só remove arquivos com mais de 8 horas.

O botão manual e o Cron devem responder sem erro. Não reduza o limite para produção apenas para testar.

## 13. Offline

- desligue a internet;
- deve aparecer um aviso visível;
- tente publicar e confirme mensagem clara;
- religue e continue.

## 14. Realtime

Com dois celulares:

- A publica;
- B fica no feed;
- a foto deve aparecer via Realtime ou no refresh de segurança.

## 15. Curtidas

- curtir/descurtir deve funcionar;
- ao ordenar por mais/menos curtidas, o feed deve se reorganizar após sincronizar.

## 16. Teste de carga

Antes da festa, faça no mínimo:

- 3 a 5 celulares;
- 50 a 100 uploads;
- várias fotos de 10 MB ou mais;
- 200+ interações de curtida;
- Wi‑Fi e 4G/5G;
- abrir/fechar/recarregar durante uploads.

## 17. Checklist de véspera

- Google OAuth em **Em produção**;
- Drive conectado;
- espaço livre suficiente no Drive;
- `/api/health` responde `driveConnected: true`;
- painel administrativo acessível;
- QR Code impresso/testado;
- uma publicação real feita por Android;
- uma publicação real feita por iPhone.
