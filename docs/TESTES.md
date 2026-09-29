# Roteiro de testes antes da festa

Marque os itens somente depois que Supabase, Worker, Vercel e TeraBox estiverem configurados com credenciais reais.

## Acesso e identidade

- [ ] Primeiro acesso pede apenas o nome.
- [ ] Nome com menos de 2 caracteres é rejeitado.
- [ ] Recarregar a página mantém a sessão e o nome.
- [ ] Editar o nome atualiza o perfil.
- [ ] Fotos antigas mantêm o nome com que foram publicadas.

## Câmera e galeria

- [ ] Android: **ABRIR CÂMERA** abre a câmera normal.
- [ ] iPhone: **ABRIR CÂMERA** oferece a câmera corretamente.
- [ ] **ESCOLHER DA GALERIA** abre o seletor nativo.
- [ ] Cancelar o seletor não causa erro.
- [ ] Foto acima de 30 MB é rejeitada antes do upload.
- [ ] A prévia mostra a foto escolhida sem aplicar filtro.
- [ ] **SALVAR NO CELULAR** gera o arquivo sem alterar a foto.
- [ ] **ESCOLHER OUTRA** limpa a seleção anterior.

## Upload TeraBox

- [ ] Publicar foto de aproximadamente 2 MB.
- [ ] Publicar foto de aproximadamente 8–10 MB.
- [ ] Publicar foto de aproximadamente 15 MB.
- [ ] O original no TeraBox tem o mesmo tamanho em bytes do arquivo escolhido.
- [ ] O Worker não registra `client_secret`, `private_secret`, access token ou refresh token no navegador.
- [ ] Duplo toque rápido em **PUBLICAR** não cria duas fotos.
- [ ] Interromper a rede durante um fragmento mostra erro compreensível.
- [ ] Repetir o upload depois da falha funciona.

## Feed

- [ ] Foto recém-publicada aparece no mesmo aparelho.
- [ ] Foto recém-publicada aparece em outro aparelho sem recarregar manualmente.
- [ ] Rolagem não baixa originais de 10–15 MB automaticamente.
- [ ] Fotos verticais e horizontais ficam visualmente corretas.
- [ ] Tocar na foto abre o original.
- [ ] Fechar a visualização do original libera a tela corretamente.
- [ ] Thumbnail expirada é renovada automaticamente.

## Curtidas

- [ ] Curtir incrementa uma vez.
- [ ] Descurtir decrementa uma vez.
- [ ] A mesma identidade não consegue inserir duas curtidas para a mesma foto.
- [ ] Curtir em **Meus cliques** atualiza também o estado do Feed.
- [ ] Após alguns segundos/recarregar, a contagem permanece correta em outro aparelho.

## Meus cliques

- [ ] Mostra apenas fotos publicadas pela sessão atual.
- [ ] Uma nova publicação aparece nessa aba.
- [ ] Curtidas funcionam nessa aba.

## Administração TeraBox

- [ ] `?admin=terabox` rejeita ADMIN_KEY errada.
- [ ] **VERIFICAR CONEXÃO** mostra o estado real.
- [ ] Reconectar TeraBox troca os tokens com sucesso.
- [ ] Nenhuma chave administrativa é salva em localStorage pelo aplicativo.

## Rede e dispositivos

- [ ] Android + Chrome em Wi‑Fi.
- [ ] Android + Chrome em 4G/5G.
- [ ] iPhone + Safari em Wi‑Fi.
- [ ] iPhone + Safari em 4G/5G.
- [ ] Tela pequena (~360 px de largura).
- [ ] Tela grande/tablet.
