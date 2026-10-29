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

## Flujo de la competencia

Menú principal → Personalización → Presentación de participantes → (Instrucciones → Partida → Resultados) × 3 → Ranking final → Volver al menú o Nueva competencia.

El orden de los desafíos es obligatorio: **Atrapa o evita → Cazaengaños → Bajo Presión**. No hay selección libre.

## Tests

```bash
npm test          # vitest run — puntuación, ranking, banco educativo, orbe, calidad, ajustes
npm run typecheck # tsc --noEmit
npm run build && npx vite preview --port 4199 &
node scripts/full-playtest.mjs   # competencia completa en un navegador real (usa ?ts=0.12 para acortar las rondas)
node scripts/perf-fps.mjs        # FPS del menú y del primer desafío
```

`?q=high|medium|low` fuerza la calidad gráfica y `?ts=0.12` acorta las rondas (solo para pruebas).

## Controles

| Tecla / acción | Efecto |
|---|---|
| `W` `A` `S` `D` | Moverse (arriba / izquierda / abajo / derecha) |
| Mover el mouse | Girar la cámara (el primer clic captura el mouse; `Esc` lo libera) |
| Clic | Disparar (Cazaengaños) |
| `1` `2` `3` | Elegir respuesta (Bajo Presión) |

## Reglas de puntuación

- **Atrapa o evita** y **Cazaengaños**: +100 por la acción correcta, −50 por la incorrecta; dejar pasar un mensaje no cuesta nada.
- **Bajo Presión**: +100 por respuesta correcta (−10 % de energía del orbe), −50 por incorrecta o sin responder (+25 %). El orbe parte en 40 %, explota al 100 % y se estabiliza al 0 %. La penalización extra por explosión y el bono por estabilización (`Config.bajoPresion.points`) son valores provisionales pendientes de definir.
- Piso de −200 por minijuego. La dificultad no multiplica los puntos.

## Contenido educativo

El banco de 72 situaciones (24 por minijuego, v2.1) está en `src/data/*Situations.json`; el feedback por categoría en `src/data/feedback.ts`. **CA-20 y CA-22** están marcadas `pendienteRevision` y no entran al juego hasta su revisión editorial.

## Estructura del código

```
src/
  core/        GameManager, MatchManager, ScoreManager, ScenarioManager, OrbCircuit (lógica pura del orbe),
               UIManager, Settings, Profile, Quality, Config (balance), types
  entities/    Participant + controladores (Human/AI/Network)
  world/       Guardián Digital (CharacterFactory), escenarios de menú (Stages), arenas temáticas
               (ThemedArenas), cámara, física, input, partículas
  minigames/   AtrapaOEvita, Cazaenganos, BajoPresion + ArenaRuntime común
  audio/       AudioManager (síntesis Web Audio, sin archivos de sonido)
  data/        atrapaSituations.json, cazaSituations.json, bajoPresionSituations.json, feedback.ts, characters.ts
  styles/      main.css (base) + nexora.css (sistema visual común)
scripts/       texturas CC0, playtest de competencia completa y medición de FPS
tests/         pruebas unitarias (vitest)
docs/playtest/ capturas y video del playtest automatizado
```

Ver `LICENSES.md` para el detalle de licencias de cada pieza de terceros
(todas MIT/Apache-2.0/CC0/OFL).

## Revisión final

Cambios y comprobaciones en [docs/FINAL-CHANGES.md](docs/FINAL-CHANGES.md).
