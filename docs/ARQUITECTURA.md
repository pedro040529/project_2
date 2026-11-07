# NEXORA — Justificación de la arquitectura

## Qué es el sistema
Juego 3D de navegador, educativo, para niños de 10 a 15 años: 1 jugador humano y 3 bots compiten en 3 minijuegos consecutivos sobre engaños en juegos en línea (Bajo Presión → Cazaengaños → Atrapa o evita). Los puntajes se acumulan y gana el mejor total.

## Arquitectura elegida
**Aplicación cliente (SPA) 100 % en el navegador, sin servidor de aplicación ni base de datos, empaquetada en Docker.**

```
Navegador (TypeScript + three.js)  ◄──  nginx (archivos estáticos)  ◄──  contenedor Docker
  · escena 3D, física, IA de bots, puntajes          · sirve index.html, JS, texturas
  · ajustes y perfil en localStorage                 · escucha en $PORT
```

| Capa | Tecnología | Por qué |
|---|---|---|
| Render 3D | three.js + postprocessing | Estándar para 3D en la web; corre sin instalar nada. |
| Física | cannon-es | Física ligera en JS para colisiones y movimiento. |
| Animación | GSAP | Animaciones de interfaz y objetos con poco código. |
| Lenguaje | TypeScript | Tipado: menos errores en lógica de puntajes y estados. |
| Empaquetado | Vite | Build rápido; produce 1,3 MB de archivos estáticos. |
| Pruebas | Vitest (lógica) + Playwright (flujo completo en navegador) | 60 pruebas unitarias y una partida completa automatizada. |
| Despliegue | Docker + nginx | Mismo resultado en cualquier equipo con un comando; se puede alojar en cualquier servicio con Docker. |

## Por qué esta y no otra

| Alternativa | Por qué no |
|---|---|
| **Servidor + base de datos** (Node/Express + BD) | El juego no tiene cuentas, ni multijugador real, ni ranking global. Un servidor añadiría coste, mantenimiento y fallos sin aportar a los requisitos. Lo que se guarda (ajustes y perfil) es por-dispositivo y cabe en `localStorage`. |
| **Multijugador en tiempo real** (WebSockets) | El enunciado pide 1 humano + 3 bots. Con bots, la competencia es justa, reproducible y no depende de que haya otros jugadores conectados; además evita exponer a menores a desconocidos. |
| **Motor de escritorio** (Unity, Godot) | Exige instalar el juego o exportarlo a WebGL con mayor peso y fricción. En el navegador, un niño juega abriendo un enlace. |
| **Juego 2D** (Phaser) | El proyecto pide ambiente 3D con personajes personalizables y podio; three.js lo da de forma directa. |
| **Frameworks de UI** (React/Vue) | La interfaz son pantallas simples sobre el canvas; una capa extra no aporta y añade peso. |

## Decisiones de diseño relevantes
- **Una sola fuente de verdad de puntajes** (`ScoreManager`): podio, tabla y ranking final salen del mismo cálculo; hay pruebas que verifican que coinciden.
- **Minijuegos con interfaz común** (`IMinigame`) y un gestor de flujo (`MatchManager`): el orden es obligatorio y configurable en un solo sitio (`Config.match.minigameOrder`).
- **Contenido educativo en datos** (72 situaciones en JSON, validadas por pruebas): se puede revisar o ampliar sin tocar la lógica.
- **Calidad gráfica adaptativa**: baja efectos si el equipo va lento, para que sea jugable en equipos modestos.
- **Despliegue**: imagen Docker en dos etapas (compila con Node, sirve con nginx). Se verificó construyéndola y ejecutándola, y corriendo la competencia completa contra el contenedor sin errores.

## Limitaciones reconocidas
- Los puntajes no se comparten entre dispositivos (decisión consciente, no un olvido).
- Rendimiento medido con GPU por software; falta medirlo en una GPU real.
- Dos situaciones (CA-20 y CA-22) están excluidas del juego pendientes de revisión editorial.
