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
      legitimaPequena: 100,
      legitimaEspecial: 250,
      legitimaRara: 400,
      enganosaRecogida: -100,
      ambiguaBuena: 150,
      ambiguaMala: -100
    },
    respawnCooldown: 6.5
  },

  cazaenganos: {
    durationSeconds: 80,
    targetsOnScreen: 8,
    minTargetSeparation: 4.2, // separación mínima entre objetivos, para que no se amontonen ni se rocen
    totalPoolPerMatch: 12,
    composition: { legitima: 4, enganosa: 5, ambigua: 3 },
    points: {
      enganosoDestruido: 200,
      legitimoDestruido: -100,
      ambiguoDestruidoBien: 180,
      ambiguoDestruidoMal: -120
    },
    streak: {
      enabled: true,
      bonuses: [100, 150, 200],
      breakOnWrongHit: true
    },
    aimAssist: {
      radius: 0.9, // radio de "imán" del cursor sobre objetivos, en unidades de pantalla normalizadas*10
      snapStrength: 0.35
    },
    respawnCooldown: 3.2,
    projectileSpeed: 30
  },

  bajoPresion: {
    durationSeconds: 80,
    situationsPerMatch: 15,
    baseChargeSeconds: 9, // tiempo total desde que se recibe hasta que "puede" explotar
    explosionsTarget: 3,
    // probabilidad de que explote incluso tras una decisión correcta (mantiene la incertidumbre)
    explodeDespiteGoodDecisionChance: 0.22,
    // probabilidad de que explote si la decisión fue mala
    explodeAfterBadDecisionChance: 0.55,
    decisionWindowSeconds: 5.5,
    points: {
      buenaDecision: 120,
      malaDecision: -80,
      neutra: 0,
      explosionPenalty: -150,
      passBonus: 20
    },
    passSpeed: 60,
    // retraso extra al pase si la decisión fue mala
    badDecisionExtraDelay: 1.2
  },

  npc: {
    // radios de detección / interacción usados por AIController.
    // Deliberadamente menor al radio de la arena (26): los NPC NO tienen
    // conciencia omnisciente de toda la arena, para que el humano pueda
    // encontrar recompensas que ellos todavía no "vieron".
    detectionRadius: 16,
    pickupRadius: 1.1,
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
