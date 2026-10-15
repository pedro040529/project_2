import { GameManager } from "./core/GameManager";

const game = new GameManager();
game.start().catch((err) => {
  console.error("NEXORA: error fatal al iniciar", err);
  const label = document.getElementById("loading-label");
  if (label) label.textContent = "Ocurrió un error al cargar. Recarga la página.";
});
