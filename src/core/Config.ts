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
    durationSeconds: 75,
    countInLegitima: 12,
    countInEspecial: 4,
    countInRara: 2,
    countInEnganosa: 8,
    countInAmbigua: 6,
    // separación mínima entre spawns para que no queden amontonados
    minSpawnDistance: 3.2,
    points: {
      legitimaPequena: 25,
      legitimaEspecial: 60,
      legitimaRara: 100,
      enganosaRecogida: -30,
      ambiguaBuena: 40,
      ambiguaMala: -30
    },
    respawnCooldown: 5,
    // progreso (0..1) en que se disparan los eventos: lluvia de recompensas y apuestas dobles
    eventAtProgress: [0.25, 0.55, 0.8],
    stakesSeconds: 10
  },

  cazaenganos: {
    durationSeconds: 80,
    targetsOnScreen: 8,
    minTargetSeparation: 4.2, // separación mínima entre objetivos, para que no se amontonen ni se rocen
    totalPoolPerMatch: 12,
    composition: { legitima: 4, enganosa: 5, ambigua: 3 },
    points: {
      enganosoDestruido: 300,
      legitimoDestruido: -150,
      ambiguoDestruidoBien: 250,
      ambiguoDestruidoMal: -150
    },
    streak: {
      enabled: true,
      bonuses: [150, 250, 350],
      breakOnWrongHit: true
    },
    aimAssist: {
      radius: 0.9, // radio de "imán" del cursor sobre objetivos, en unidades de pantalla normalizadas*10
      snapStrength: 0.35
    },
    respawnCooldown: 3.2,
    projectileSpeed: 30,
    shotCooldownSeconds: 0.45,
    // progreso (0..1) de la ronda al que arranca cada oleada y cuánto dura
    waveAtProgress: [0.3, 0.6, 0.85],
    waveSeconds: 9
  },

  bajoPresion: {
    durationSeconds: 80,
    situationsPerMatch: 15,
    // El orbe explota cuando su carga llega a 1; la mecha se sortea en este rango (segundos
    // acumulados, incluso entre pases). No depende de si las respuestas fueron correctas.
    minFuseSeconds: 12,
    maxFuseSeconds: 20,
    decisionWindowSeconds: 7,
    feedbackSeconds: 1.5,
    npcHoldSeconds: { min: 1.1, max: 2.0 },
    flightSeconds: 0.5,
    explosionPauseSeconds: 1.5,
    // una buena decisión calma el orbe (ventaja): reduce esta fracción de la carga
    stabilizeOnGood: 0.12,
    // máximo de NPC seguidos con el orbe antes de que le toque al humano
    maxNpcHolds: 2,
    points: {
      buenaDecision: 180,
      malaDecision: -120,
      neutra: 0,
      tiempoAgotado: -60,
      explosionPenalty: -150,
      passBonus: 0
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
