# Proteção de captura de tela — sem marca d'água

Esta versão mantém a proteção **100% no frontend** e **não adiciona nenhuma Serverless Function**.

## O que mudou

- a marca d'água foi removida completamente;
- durante o uso normal, não há nenhum elemento visual de proteção sobre o site;
- quando a página perde foco ou fica oculta, o conteúdo é borrado imediatamente;
- `PrintScreen` também dispara o blur quando a tecla é entregue ao navegador;
- impressão continua bloqueada;
- arraste e menu de contexto de fotos continuam dificultados;
- a pasta `api/` continua com exatamente 12 funções.

## Limitação real de navegador

Um site não possui acesso ao mesmo mecanismo nativo de apps de “visualização única”. Em iOS/Android e em alguns atalhos do sistema, o sistema operacional pode fazer a captura sem avisar a página. Portanto, esta implementação é uma proteção de melhor esforço: ela funciona especialmente quando a ferramenta de captura tira o foco/visibilidade da página, mas não pode garantir bloqueio absoluto de screenshots pelo SO.
