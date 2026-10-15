# NEXORA

Party competitivo 3D para cuatro participantes (un humano + tres NPC) que
corre **en el navegador**, sin instalar nada. Tres minijuegos cortos, un
ranking general y una regla de diseño: la acción del personaje es la
respuesta. Nada de cuestionarios.

NEXORA enseña a reconocer comportamientos engañosos de videojuegos
multijugador (recompensas o mensajes trampa, intercambios no recíprocos,
suplantación, urgencia falsa, solicitudes de credenciales) corriendo,
decidiendo y compitiendo — nunca respondiendo un examen.

## Requisitos

- Node.js `^22.12.0 || ^24.0.0 || >=26.0.0` (el repo trae `.nvmrc` con `24.21.0`; `nvm use` alcanza).
- Un navegador reciente (Chrome, Edge, Firefox o Safari) con WebGL2.

## Correr en desarrollo

```bash
npm install
npm run dev
```

Abre la URL que imprime Vite (por defecto `http://localhost:5173`).

## Generar el build de producción

```bash
npm run build     # tipa con tsc y arma dist/ con vite build
npm run preview   # sirve dist/ localmente para probarlo tal cual se va a publicar
```

`dist/` es 100% estático (HTML/CSS/JS/WebP) y se puede subir a cualquier
hosting estático (Netlify, Vercel, GitHub Pages, S3+CloudFront, nginx, etc.)
sin configuración de servidor especial.

## Tests

```bash
npm test          # vitest run — puntuación, ranking, sorteo de escenarios
npm run typecheck # tsc --noEmit
```

## Controles

| Tecla / acción | Efecto |
|---|---|
| `WASD` | Moverse |
| Mouse | Apuntar con cursor libre |
| Mover el mouse | Girar la cámara (el primer clic captura el mouse; `Esc` lo libera) |
| Clic izquierdo | Disparar (Cazaengaños); también puedes hacer clic en el mensaje visible |
| `E` | Pasar el objeto (Bajo Presión) |
| `1` `2` `3` | Elegir opción bajo presión |

## Estructura del código

```
src/
  core/        GameManager, MatchManager, ScoreManager, ScenarioManager,
               UIManager, ResultsManager, Config (balance), types
  entities/    Participant + controladores (Human/AI/Network)
  world/       Arena, personajes, cámara, física, input, materiales, labels
  minigames/   AtrapaOEvita, Cazaenganos, BajoPresion + ArenaRuntime común
  audio/       AudioManager (síntesis Web Audio, sin archivos de sonido)
  data/        rewards.json, messages.json, pressureSituations.json, characters.ts
scripts/       descarga/procesado de texturas CC0 + playtest automatizado
tests/         pruebas unitarias (vitest)
docs/playtest/ capturas y video del playtest automatizado
```

Ver `LICENSES.md` para el detalle de licencias de cada pieza de terceros
(todas MIT/Apache-2.0/CC0/OFL).

## Revisión final

Cambios y comprobaciones en [docs/FINAL-CHANGES.md](docs/FINAL-CHANGES.md).
