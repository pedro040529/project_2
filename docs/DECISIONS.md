# Decisiones de diseño abiertas — resueltas para esta entrega

El brief pedía decidir y documentar varios puntos que quedaban a criterio
propio. Quedaron así (todo ajustable después en `src/core/Config.ts`, sin
tocar lógica):

## Estilo del objeto de Bajo Presión
Una esferita de fieltro coral con costuras blancas cruzadas (estética
"pelota de trapo casera"), coherente con el resto del diorama. Se pasa con
un arco parabólico simple (no con física completa) entre quien la tiene y
el rival más cercano.

## Mapas / arenas
- **Atrapa o Evita** y **Cazaengaños** comparten literalmente la misma
  arena circular (radio 26u), tal como pide el brief ("reutilizando
  arena..."). Props en 3 anillos de profundidad (arbustos cerca, árboles y
  troncos en el medio, farolitos lejos).
- **Bajo Presión** usa una arena circular más chica (radio 12u) con 4
  cojines marcando los puestos, ambientada con farolitos de papel.
- No se hicieron mapas alternativos por minijuego (fuera de alcance
  explícito del brief: "varios mapas por minijuego").

## Valores finales de puntaje/tiempo
Quedaron en `Config.ts` con estos valores de partida (fácilmente
ajustables sin tocar lógica):
- Atrapa o Evita (75s): legítima pequeña +100, especial +250, rara +400,
  engañosa recogida −100, ambigua bien/mal +150/−100.
- Cazaengaños (80s): engañoso destruido +200, legítimo destruido −100,
  racha +100/+150/+200.
- Bajo Presión (80s): buena decisión +120, mala −80, explosión −150, pase
  +20.

## Dificultad
Sube por diseño de contenido, no por velocidad: las 24/40/15 situaciones
incluyen niveles de dificultad 1–3 mezclados dentro de cada sorteo, con
señales cada vez más sutiles (confianza progresiva, mensajes sin errores
ortográficos, ofertas legítimas grandes) en vez de simplemente acelerar el
reloj. Los NPC ya aportan dificultad por sí mismos: Nova es rápida y
arriesgada, Pixel es lenta pero casi no falla.

## Detección de NPC (ajuste post-playtest)
El primer playtest automatizado mostró que con radio de detección = radio
de arena, los NPC jugaban de forma casi omnisciente (una IA terminó un
minijuego con 8750 puntos). Se bajó `Config.npc.detectionRadius` de 30 a 16
para que los NPC **no** conozcan toda la arena de entrada — deben
literalmente estar cerca para "ver" una recompensa u objetivo, igual que
un jugador real. Balance fino adicional (curvas de dificultad por partida,
handicap dinámico, etc.) queda como trabajo futuro razonable.

## Selección de rival al pasar en Bajo Presión
El brief permite explícitamente que el valor por defecto sea "el más
cercano"; se implementó siempre así (no hay UI de selección manual de
rival). Es una simplificación consciente, no un punto pendiente: el propio
brief la habilita como comportamiento válido por defecto.
