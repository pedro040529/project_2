# Licencias de NEXORA

NEXORA se construyó exclusivamente con software y contenido de fuentes
abiertas y permisivas. No se copió ni reutilizó ningún asset (arte, música,
código de gameplay) de otro videojuego comercial. Este documento lista cada
pieza de terceros usada, su licencia y dónde verificarla.

## 1. Stack de software (dependencias npm)

| Paquete | Versión | Licencia | Uso en NEXORA |
|---|---|---|---|
| [three](https://www.npmjs.com/package/three) | 0.186.1 | MIT | Motor de render 3D (WebGL), escena, cámara, geometría, materiales, CSS2DRenderer para las burbujas de texto. |
| [cannon-es](https://www.npmjs.com/package/cannon-es) | 0.20.0 | MIT | Física de colisión de los 4 personajes contra props estáticos y entre sí. |
| [vite](https://www.npmjs.com/package/vite) | 8.3.1 | MIT | Dev server + build de producción (dependencia de desarrollo). |
| [typescript](https://www.npmjs.com/package/typescript) | 5.9.3 | Apache-2.0 | Tipado estático (dependencia de desarrollo). |
| [vitest](https://www.npmjs.com/package/vitest) | 5.0.3 | MIT | Test runner de las pruebas unitarias (dependencia de desarrollo). |
| [@types/three](https://www.npmjs.com/package/@types/three) | 0.186.0 | MIT | Tipos de TypeScript para three.js (dependencia de desarrollo). |
| [playwright](https://www.npmjs.com/package/playwright) | 1.63.0 | Apache-2.0 | Usado solo para el playtest automatizado (capturas y video) que se relata en la entrega — no se incluye en el juego publicado (dependencia de desarrollo). |

Ninguna dependencia usa licencias copyleft (GPL/AGPL/LGPL). Todas son MIT o
Apache-2.0, compatibles con distribución comercial y modificación libre.

## 2. Texturas (arte del "diorama artesanal")

Todas las texturas base son **CC0 1.0 Universal** (dominio público), tomadas
de [ambientCG.com](https://ambientcg.com). Se descargaron por terminal con
`scripts/download-textures.sh`, se verificó que cada archivo fuera un ZIP
válido (no una página de error) antes de descomprimir, y luego se
redimensionaron a 512×512 y se convirtieron a WebP con `cwebp`
(`scripts/process-textures.sh`) para mantener la carga liviana. Los
archivos fuente originales (1K JPG, ~30 MB en total) se conservan sin
publicar en `assets-src/textures/ambientcg-raw/` como respaldo de licencia;
solo los WebP procesados (372 KB en total) viajan en `public/textures/` y
en el build.

| Textura | Asset ambientCG | Licencia | Uso |
|---|---|---|---|
| Fieltro | [Fabric034](https://ambientcg.com/view?id=Fabric034) | CC0 1.0 | Suelo de las arenas, cojines, acentos. |
| Cartón | [Cardboard004](https://ambientcg.com/view?id=Cardboard004) | CC0 1.0 | Anillo exterior de la arena, troncos, lazos de las bolsitas. |
| Madera | [Wood060](https://ambientcg.com/view?id=Wood060) | CC0 1.0 | Borde de las arenas, troncos, palitos de farolito. |
| Papel | [Paper002](https://ambientcg.com/view?id=Paper002) | CC0 1.0 | Farolitos decorativos, bolsitas de recompensa. |

CC0 1.0 no exige atribución, pero se documenta igual por transparencia. Cada
mapa de color se usa siempre tintado con los colores propios de la paleta
de NEXORA (nunca en su tono original), y el mapa de rugosidad/normal se usa
para dar textura táctil sin cambiar el significado de ningún objeto.

## 3. Tipografías

| Fuente | Fuente/origen | Licencia | Uso |
|---|---|---|---|
| [Baloo 2](https://fonts.google.com/specimen/Baloo+2) | Google Fonts | SIL Open Font License 1.1 | Títulos, HUD, botones (tipografía redondeada, cálida, pensada para público joven). |
| [Nunito](https://fonts.google.com/specimen/Nunito) | Google Fonts | SIL Open Font License 1.1 | Cuerpo de texto, mensajes, descripciones. |

Se cargan vía `<link>` a Google Fonts (no se auto-hospedan los archivos), lo
que respeta la OFL y evita distribuir binarios de fuente en el repositorio.

## 4. Audio

Todo el audio de NEXORA (efectos de recoger, error, disparo, destrucción,
globo, cuenta regresiva, explosión, transición, victoria, música de lobby y
música de minijuego) es **sintetizado en tiempo real con la Web Audio API**
(osciladores + ruido blanco filtrado + envolventes), ver
`src/audio/AudioManager.ts`. No se descargó ni se usa ningún archivo de
audio de terceros, por lo que no hay licencias de audio que declarar.

## 5. Arte 3D (personajes, arena, recompensas, objetivos)

Todos los modelos 3D (los 4 personajes, los árboles/troncos/farolitos de
cartón, las bolsitas de recompensa, los orbes de mensaje, la "papa
caliente") son **geometría procedural generada por código** con primitivas
de three.js (esferas, cápsulas, conos, toros, cilindros) — ver
`src/world/CharacterFactory.ts`, `src/world/ArenaFactory.ts`,
`src/world/HotPotatoArena.ts`. No se usó ningún modelo, sprite ni paquete de
assets de terceros (ni de Kenney, Quaternius, Poly Haven ni de ningún otro
sitio): esas fuentes se evaluaron para el brief, pero se optó por geometría
procedural para garantizar consistencia estética total, cero riesgo de
licencias y cero peso de archivos `.glb/.fbx` en el build.

## 6. Contenido de texto (recompensas, mensajes, situaciones)

Los 24 escenarios de `src/data/rewards.json`, los 40 de
`src/data/messages.json` y las 15 de `src/data/pressureSituations.json` son
**contenido original**, escrito específicamente para este proyecto según
las reglas de diseño del brief (neutralidad visual, credibilidad para 13–15
años, sin marcas reales, sin enlaces reales).
