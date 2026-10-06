# Proteção de captura de tela

Esta versão implementa a proteção **somente no frontend**.

- Nenhuma nova função foi adicionada à pasta `api/`.
- Nenhuma nova Serverless Function é criada na Vercel.
- A lógica foi incorporada diretamente em `src/main.js`.
- Os estilos foram incorporados diretamente em `src/styles.css`.
- O número de funções da Vercel permanece exatamente o mesmo da versão original.

Limitação técnica: navegadores não conseguem bloquear 100% capturas feitas pelo próprio sistema operacional. A proteção cobre perda de foco, impressão, PrintScreen quando detectável, arraste/menu de contexto e marca d'água visual.
