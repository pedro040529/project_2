# Revisión final — 30 de septiembre de 2026

Origen recuperado: `/Users/pedro/PROJECT_2`.
Carpeta de trabajo: `/Users/pedro/Documents/ChatGPT/PROJECT-2-FINAL`.

- Inicio con presentación de las tres rondas, escenario 3D visible y botón de juego estable. Se conservaron los personajes y la estética artesanal del proyecto.
- Sin controles de alto contraste ni reducción de movimiento en la interfaz.
- HUD creado después de las instrucciones: tiempo restante, ranking, avisos y decisiones permanecen en pantalla. La capa del HUD permite que el canvas reciba el mouse.
- Cursor libre para apuntar; botón derecho y arrastre para mover la cámara. Sin giro automático ni arrastre residual. Posiciones visuales interpoladas entre pasos físicos.
- Cazaengaños: ocho mensajes simultáneos, estaciones separadas ocho unidades, reemplazo de mensajes antiguos y reposición de los destruidos. Etiquetas que quedarían superpuestas se ocultan; acercarse o girar permite leer los demás objetivos.
- NPCs: detección local, un lector por objetivo, lectura según longitud del texto, mínimo de siete segundos de existencia del mensaje antes de un disparo de IA y pausa entre decisiones. Se detienen para leer y cancelan la lectura si alguien toma el objetivo.
- Blasters de juguete más grandes, postura de arma, retroceso y proyectiles visibles. Puntuación y desaparición del objetivo al llegar el proyectil.
- Animación de reposo sin caminar en el sitio; restablecimiento de cabeza y piernas entre reacciones; transición de velocidad independiente de los FPS.
- Corrección de expresiones pendientes a español latino.
- Música arcade con melodía, bajo y percusión, acelerada durante el último 35% de cada ronda. Se respeta el silencio activado antes de empezar.

## Verificación

`npm test`: 23 pruebas de puntuación, escenarios, cámara, pausa de NPC y tiempos/cancelación de lectura y empates en el podio.

`npm run build`: TypeScript y compilación estática.

`node scripts/final-playtest.mjs`: recorre las tres rondas en Chromium, verifica HUD, cámara, tiempo de lectura y separación visual; llega al ranking/resumen y reinicia. La comprobación de continuación recorre las rondas con sus tiempos de producción (75/80/80 segundos). Usa el servidor local en el puerto 5193. Capturas y resultados en `docs/playtest/final/`.

La valoración de comodidad de cámara y gusto musical requiere también probarlo personalmente; las comprobaciones automáticas verifican comportamiento, no esas preferencias.

También se corrigió un fallo previo del podio que omitía participantes cuando compartían puesto.

## Continuación: cámara y orientación

- Se corrigió el salto vertical del primer movimiento del mouse: la inclinación inicial ahora está dentro de los límites configurados.
- La orientación de disparo se conserva durante 0,35 segundos al caminar; después vuelve gradualmente al rumbo de movimiento.
- Los NPCs mantienen la mirada sobre el mensaje durante su lectura.
- Se agregaron regresiones para el primer giro horizontal y para apuntar mientras se camina.

- Se retiró la ayuda de cámara de Bajo Presión para despejar el panel de decisiones.
