// Todos los valores de balance del juego en un solo lugar editable.
// Nada de "números mágicos" repartidos por la lógica de los minijuegos.

export const Config = {
  match: {
    minigameOrder: ["atrapa_o_evita", "cazaenganos", "bajo_presion"] as const
  },

  arena: {
    // Arena compartida por Atrapa o Evita y Cazaengaños (radio aprox. en unidades del mundo)
    sharedRadius: 26,
    // Arena circular de Bajo Presión (más pequeña, todos alrededor del objeto)
    hotPotatoRadius: 12
  },

  atrapaOEvita: {
    durationSeconds: 90,
    // recompensas (mensajes) simultáneas en la plaza
    simultaneous: 14,
    minSpawnDistance: 3.2,
    points: { correcta: 100, incorrecta: -50 },
    respawnCooldown: 4,
    // progreso (0..1) en que llueven recompensas nuevas de golpe
    rainAtProgress: [0.3, 0.65]
  },

  cazaenganos: {
    durationSeconds: 90,
    targetsOnScreen: 8,
    points: { correcta: 100, incorrecta: -50 },
    respawnCooldown: 3.2,
    projectileSpeed: 30,
    shotCooldownSeconds: 0.45,
    // progreso (0..1) de la ronda al que arranca cada oleada y cuánto dura
    waveAtProgress: [0.3, 0.6, 0.85],
    waveSeconds: 9
  },

  bajoPresion: {
    // Duración aproximada de la partida (el orbe NO tiene cronómetro propio: explota por energía).
    durationSeconds: 180,
    // Energía del orbe, en porcentaje. Valores iniciales: deben probarse y ajustarse.
    initialEnergy: 40,
    energyOnCorrect: -10,
    energyOnWrong: 25,
    energyOnTimeout: 25,
    decisionSeconds: 15,
    // pausa para leer el feedback tras responder el humano; los bots pasan casi de inmediato
    feedbackSeconds: 2.6,
    npcFeedbackSeconds: 0.9,
    npcThinkSeconds: { min: 2.2, max: 6 },
    flightSeconds: 0.55,
    // pausa tras explotar o estabilizarse, antes de que reaparezca un orbe nuevo
    roundBreakSeconds: 2.4,
    maxNpcHolds: 2,
    points: {
      correcta: 100,
      incorrecta: -50,
      sinRespuesta: -50,
      // PENDIENTES DE DEFINIR en el documento de contenido: valores provisionales a validar.
      explosionExtra: -100,
      estabilizacionBono: 50
    }
  },

  npc: {
    // radios de detección / interacción usados por AIController.
    // Deliberadamente menor al radio de la arena (26): los NPC NO tienen
    // conciencia omnisciente de toda la arena, para que el humano pueda
    // encontrar recompensas que ellos todavía no "vieron".
    detectionRadius: 16,
    pickupRadius: 1.4,
    reachThreshold: 0.6
  },

  camera: {
    followDistance: 6.5,
    followHeight: 4.2,
    shoulderOffset: 0.9, // desplaza la cámara a la derecha: la mira queda libre del personaje
    lookHeight: 1.4,
    smoothing: 6.5,
    mouseSensitivity: 0.0015, // más suave: el valor viejo (0.0022) se sentía brusco
    minPitch: -0.35,
    maxPitch: 0.75
  },

  player: {
    moveSpeed: 7.2,
    turnSmoothing: 12,
    acceleration: 22
  },

  results: {
    summingDurationSeconds: 2.2,
    podiumRevealStagger: 0.35
  },

  accessibility: {
    defaultReducedMotion: false,
    defaultHighContrast: false
  }
} as const;

export type MinigameOrderId = (typeof Config.match.minigameOrder)[number];
