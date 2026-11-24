// Use um PNG transparente em public/ e informe size e position em cm da cabeça canônica.
// As rotações opcionais usam radianos. Substitua meme-aniversariante.png pelo seu recorte.
export const filtrosConfig = [
  {
    id: "oculos",
    label: "Óculos da festa",
    parts: [
      { png: "/meme-oculos.png", size: [15.6, 5.1], position: [0, 2.65, 5.9] },
      { box: [0.55, 0.64, 7.1], color: "#eeac32", position: [-7.1, 2.8, 2.55], rotation: [0, 0.08, 0] },
      { box: [0.55, 0.64, 7.1], color: "#eeac32", position: [7.1, 2.8, 2.55], rotation: [0, -0.08, 0] },
    ],
  },
  {
    id: "chapeu",
    label: "Chapéu de festa",
    parts: [
      { png: "/meme-chapeu.png", size: [13, 13], position: [0.4, 13.6, 3.9], rotation: [0, 0, -0.14] },
    ],
  },
  {
    id: "aniversariante",
    label: "Reação do aniversariante",
    parts: [
      { png: "/meme-aniversariante.png", size: [10.5, 10.5], position: [8.9, 8.1, 1.35], rotation: [0, -0.24, -0.17] },
    ],
  },
];
