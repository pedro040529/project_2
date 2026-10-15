import { gsap } from "gsap";
import type { Participant } from "../entities/Participant";
import type { RankingEntry } from "./ScoreManager";
import type { MatchSummaryStats, PressureOption } from "./types";
import { PLAYER_AVATAR_OPTIONS, type PlayerAvatarOption } from "../data/characters";

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

function colorHex(n: number): string {
  return `#${n.toString(16).padStart(6, "0")}`;
}

export interface InstructionsSpec {
  title: string;
  goal: string;
  controls: { key: string; label: string }[];
}

export interface HudHandle {
  setTimer(seconds: number): void;
  setRanking(entries: RankingEntry[], colorOf: (id: string) => number): void;
  showEventBanner(text: string, durationMs?: number): void;
  setObjective(text: string): void;
  showScorePopup(clientX: number, clientY: number, text: string, positive: boolean): void;
  showRivalPing(name: string, text: string): void;
  setStreak(count: number, bonus: number): void;
  hideStreak(): void;
  showCrosshair(show: boolean): void;
  showPointerHint(text: string | null): void;
  unmount(): void;
}

export interface DecisionHandle {
  update(situationText: string, options: PressureOption[], onPick: (opt: PressureOption) => void): void;
  setCharge(progress01: number): void;
  hide(): void;
}

/**
 * Toda la UI 2D (DOM) de NEXORA: pantallas de flujo (lobby, selección,
 * instrucciones, resultados) + HUD en vivo durante los minijuegos. Vive
 * separada de Three.js a propósito: el "mundo" nunca sabe de menús ni el
 * revés, y los estilos de UI nunca codifican si algo es legítimo o
 * engañoso (esa regla vive en main.css).
 */
/** Entrada escalonada del podio (se omite con "reducir movimiento"). */
function revealPodium(podium: HTMLElement): void {
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  gsap.from(podium.children, { y: 60, opacity: 0, duration: 0.6, ease: "back.out(1.6)", stagger: 0.18 });
}

export class UIManager {
  private root: HTMLElement;

  constructor(rootId = "ui-root") {
    this.root = document.getElementById(rootId)!;
  }

  private clear(): void {
    this.root.innerHTML = "";
  }

  hideLoadingScreen(): void {
    document.getElementById("loading-screen")?.classList.add("hidden");
  }

  setLoadingProgress(pct: number, label: string): void {
    const fill = document.getElementById("loading-bar-fill");
    const lbl = document.getElementById("loading-label");
    if (fill) fill.style.width = `${Math.round(pct * 100)}%`;
    if (lbl) lbl.textContent = label;
  }

  // ---------------- Lobby ----------------

  showLobby(): Promise<{ nickname: string }> {
    this.clear();
    return new Promise((resolve) => {
      const screen = el("div", "screen lobby-screen");

      const badges = el("div", "lobby-badges");
      badges.appendChild(el("span", "lobby-badge", "🎮 Tú + 3 rivales"));
      badges.appendChild(el("span", "lobby-badge", "⚡ 3 minijuegos"));
      badges.appendChild(el("span", "lobby-badge", "🧠 Piensa rápido"));

      const card = el("div", "panel lobby-card");
      const logoWrap = el("div", "lobby-logo-wrap");
      const title = el("div", "lobby-title", "NEXORA");
      logoWrap.appendChild(title);
      logoWrap.appendChild(el("div", "lobby-title-shine"));
      card.appendChild(el("div", "lobby-eyebrow", "LA ARENA DE LAS GRANDES DECISIONES"));
      card.appendChild(logoWrap);
      card.appendChild(badges);
      card.appendChild(
        el(
          "div",
          "lobby-sub",
          "Corre, decide rápido y aprende a leer las señales antes que los demás. ¿Listo para competir?"
        )
      );

      const input = el("input", "nickname-input") as HTMLInputElement;
      input.maxLength = 14;
      input.placeholder = "Tu nombre de jugador";
      input.setAttribute("aria-label", "Tu nombre de jugador");
      input.value = localStorage.getItem("nexora_nickname") ?? "";
      const rounds = el("div", "lobby-rounds");
      for (const [icon, title, subtitle] of [["✦", "Atrapa o evita", "Corre por las recompensas"], ["◎", "Cazaengaños", "Apunta. Lee. Decide."], ["⚡", "Bajo presión", "Piensa antes de pasar"]]) {
        const round = el("div", "lobby-round");
        round.append(el("span", "round-icon", icon), el("strong", undefined, title), el("small", undefined, subtitle));
        rounds.appendChild(round);
      }
      card.appendChild(rounds);
      card.appendChild(input);

      const startBtn = el("button", "btn lobby-play-btn", "▶ Jugar") as HTMLButtonElement;
      const go = () => {
        const nickname = input.value.trim().slice(0, 14) || "Jugador";
        localStorage.setItem("nexora_nickname", nickname);
        resolve({ nickname });
      };
      startBtn.onclick = go;
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") go();
      });
      card.appendChild(startBtn);

      screen.appendChild(card);
      this.root.appendChild(screen);
      input.focus();
    });
  }

  // ---------------- Character select ----------------

  showCharacterSelect(): Promise<PlayerAvatarOption> {
    this.clear();
    return new Promise((resolve) => {
      const screen = el("div", "screen");
      const card = el("div", "panel select-card");
      card.appendChild(el("div", "select-title", "Elige tu personaje"));

      const grid = el("div", "avatar-grid");
      let selected: PlayerAvatarOption = PLAYER_AVATAR_OPTIONS[0];
      const cards: HTMLDivElement[] = [];

      PLAYER_AVATAR_OPTIONS.forEach((opt, i) => {
        const c = el("div", "avatar-card") as HTMLDivElement;
        c.setAttribute("aria-pressed", i === 0 ? "true" : "false");
        c.tabIndex = 0;
        const swatch = el("div", "avatar-swatch");
        swatch.style.background = `radial-gradient(circle at 35% 30%, ${colorHex(opt.accentColor)}, ${colorHex(opt.primaryColor)})`;
        c.appendChild(swatch);
        c.appendChild(el("div", "avatar-name", opt.name));
        c.appendChild(el("div", "avatar-desc", opt.tagline));
        c.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); c.click(); } };
        c.onclick = () => {
          selected = opt;
          cards.forEach((cc) => cc.setAttribute("aria-pressed", "false"));
          c.setAttribute("aria-pressed", "true");
        };
        cards.push(c);
        grid.appendChild(c);
      });

      card.appendChild(grid);
      const confirmBtn = el("button", "btn", "Confirmar") as HTMLButtonElement;
      confirmBtn.onclick = () => resolve(selected);
      card.appendChild(confirmBtn);

      screen.appendChild(card);
      this.root.appendChild(screen);
    });
  }

  // ---------------- Roster intro ----------------

  showRosterIntro(participants: Participant[]): Promise<void> {
    this.clear();
    return new Promise((resolve) => {
      const screen = el("div", "screen");
      const wrap = el("div", "panel", undefined) as HTMLDivElement;
      wrap.style.padding = "28px 30px";
      wrap.style.display = "flex";
      wrap.style.flexDirection = "column";
      wrap.style.alignItems = "center";
      wrap.style.gap = "18px";
      wrap.appendChild(el("div", "select-title", "Los 4 participantes"));

      const grid = el("div", "roster-grid");
      participants.forEach((p, i) => {
        const c = el("div", "roster-card") as HTMLDivElement;
        c.style.animationDelay = `${i * 0.12}s`;
        const swatch = el("div", "avatar-swatch");
        swatch.style.width = "64px";
        swatch.style.height = "64px";
        swatch.style.background = `radial-gradient(circle at 35% 30%, ${colorHex(p.avatar.accentColor)}, ${colorHex(p.avatar.primaryColor)})`;
        c.appendChild(swatch);
        c.appendChild(el("div", "avatar-name", p.name));
        c.appendChild(el("div", "avatar-desc", p.controllerKind === "human" ? "Tú" : p.avatar.tagline));
        grid.appendChild(c);
      });
      wrap.appendChild(grid);

      const btn = el("button", "btn", "Empezar la partida") as HTMLButtonElement;
      btn.onclick = () => resolve();
      wrap.appendChild(btn);

      screen.appendChild(wrap);
      this.root.appendChild(screen);
    });
  }

  // ---------------- Instructions + countdown ----------------

  async showInstructions(spec: InstructionsSpec): Promise<void> {
    this.clear();
    await new Promise<void>((resolve) => {
      const screen = el("div", "screen");
      const card = el("div", "panel instructions-card");
      card.appendChild(el("div", "instructions-title", spec.title));
      card.appendChild(el("div", "instructions-goal", spec.goal));

      const controls = el("div", "instructions-controls");
      for (const c of spec.controls) {
        const chip = el("div", "control-chip");
        chip.appendChild(el("div", "key-badge", c.key));
        chip.appendChild(el("span", undefined, c.label));
        controls.appendChild(chip);
      }
      card.appendChild(controls);

      const btn = el("button", "btn", "Listo") as HTMLButtonElement;
      btn.onclick = () => resolve();
      card.appendChild(btn);

      screen.appendChild(card);
      this.root.appendChild(screen);
    });
    await this.showCountdown();
  }

  showCountdown(): Promise<void> {
    this.clear();
    return new Promise((resolve) => {
      const screen = el("div", "screen");
      const num = el("div", "countdown-num", "3");
      screen.appendChild(num);
      this.root.appendChild(screen);
      let n = 3;
      const tick = () => {
        n--;
        if (n <= 0) {
          num.textContent = "¡YA!";
          setTimeout(() => {
            this.clear();
            resolve();
          }, 420);
          return;
        }
        num.textContent = String(n);
        setTimeout(tick, 700);
      };
      setTimeout(tick, 700);
    });
  }

  // ---------------- HUD ----------------

  mountHUD(): HudHandle {
    this.clear();
    const hud = el("div", "hud");
    const top = el("div", "hud-top");
    const timer = el("div", "hud-timer", "0:00");
    timer.setAttribute("aria-label", "Tiempo restante");
    top.appendChild(timer);
    const objective = el("div", "hud-objective", "");
    top.appendChild(objective);
    hud.appendChild(top);

    const ranking = el("div", "hud-ranking");
    hud.appendChild(ranking);

    const crosshair = el("div", "hud-crosshair");
    crosshair.style.display = "none";
    hud.appendChild(crosshair);

    const streak = el("div", "hud-streak");
    hud.appendChild(streak);

    const pointerHint = el("div", "pointer-hint", "WASD · Moverte   |   Mouse · Cámara (clic para capturar, Esc libera)");
    hud.appendChild(pointerHint);

    this.root.appendChild(hud);

    let eventBannerTimeout: number | null = null;

    return {
      setTimer: (seconds: number) => {
        const s = Math.max(0, Math.ceil(seconds));
        const m = Math.floor(s / 60);
        const r = s % 60;
        timer.textContent = `${m}:${r.toString().padStart(2, "0")}`;
        timer.classList.toggle("low", s <= 10);
      },
      setRanking: (entries: RankingEntry[], colorOf: (id: string) => number) => {
        ranking.innerHTML = "";
        for (const entry of entries) {
          const row = el("div", "hud-ranking-row");
          const dot = el("span", "hud-ranking-dot");
          dot.style.background = colorHex(colorOf(entry.participantId));
          row.appendChild(dot);
          row.appendChild(el("span", "hud-ranking-name", entry.name));
          row.appendChild(el("span", undefined, String(entry.score)));
          ranking.appendChild(row);
        }
      },
      showEventBanner: (text: string, durationMs = 4200) => {
        const existing = hud.querySelector(".hud-event-banner");
        existing?.remove();
        if (eventBannerTimeout) window.clearTimeout(eventBannerTimeout);
        const banner = el("div", "hud-event-banner", text);
        hud.appendChild(banner);
        eventBannerTimeout = window.setTimeout(() => banner.remove(), durationMs);
      },
      setObjective: (text: string) => {
        objective.textContent = text;
      },
      showScorePopup: (clientX: number, clientY: number, text: string, positive: boolean) => {
        const popup = el("div", `score-popup ${positive ? "positive" : "negative"}`, text);
        popup.style.left = `${clientX}px`;
        popup.style.top = `${clientY}px`;
        hud.appendChild(popup);
        setTimeout(() => popup.remove(), 1050);
      },
      showRivalPing: (name: string, text: string) => {
        const ping = el("div", "rival-ping", `${name}: ${text}`);
        hud.appendChild(ping);
        setTimeout(() => ping.remove(), 1650);
      },
      setStreak: (count: number, bonus: number) => {
        if (count < 2) {
          streak.classList.remove("show");
          return;
        }
        streak.textContent = `RACHA x${count} · +${bonus}`;
        streak.classList.add("show");
      },
      hideStreak: () => streak.classList.remove("show"),
      showCrosshair: (show: boolean) => {
        crosshair.style.display = show ? "block" : "none";
      },
      showPointerHint: (text: string | null) => {
        pointerHint.style.display = text ? "block" : "none";
        if (text) pointerHint.textContent = text;
      },
      unmount: () => hud.remove()
    };
  }

  // ---------------- Decision panel (Bajo Presión) ----------------

  mountDecisionPanel(): DecisionHandle {
    const panel = el("div", "decision-panel");
    panel.style.display = "none";
    const situation = el("div", "decision-situation", "");
    panel.appendChild(situation);
    const optionsWrap = el("div", "decision-options");
    panel.appendChild(optionsWrap);
    const chargeTrack = el("div", "charge-meter-track");
    const chargeFill = el("div", "charge-meter-fill");
    chargeTrack.appendChild(chargeFill);
    panel.appendChild(chargeTrack);
    this.root.appendChild(panel);

    return {
      update: (situationText, options, onPick) => {
        panel.style.display = "flex";
        situation.textContent = situationText;
        optionsWrap.innerHTML = "";
        options.forEach((opt, i) => {
          const btn = el("button", "decision-btn") as HTMLButtonElement;
          const keyBadge = el("span", "key-badge", String(i + 1));
          keyBadge.style.width = "22px";
          keyBadge.style.height = "22px";
          keyBadge.style.fontSize = "12px";
          btn.appendChild(keyBadge);
          btn.appendChild(el("span", undefined, opt.texto));
          btn.onclick = () => onPick(opt);
          optionsWrap.appendChild(btn);
        });
      },
      setCharge: (progress01: number) => {
        chargeFill.style.width = `${Math.round(THREE_clamp01(progress01) * 100)}%`;
      },
      hide: () => {
        panel.style.display = "none";
      }
    };
  }

  // ---------------- Results ----------------

  async showMinigameResults(opts: {
    minigameTitle: string;
    roundRanking: RankingEntry[];
    totalRanking: RankingEntry[];
    colorOf: (id: string) => number;
    isLast: boolean;
  }): Promise<void> {
    this.clear();
    return new Promise((resolve) => {
      const screen = el("div", "screen");
      const card = el("div", "panel results-card");
      card.appendChild(el("div", "results-title", `Resultados · ${opts.minigameTitle}`));

      const podium = el("div", "podium");
      const order = orderForPodium(opts.roundRanking);
      // aseguremos que el 1° quede al centro visualmente: reordenamos a [2,1,3,4]
      for (const entry of order) {
        const step = el("div", "podium-step");
        const block = el("div", `podium-block rank-${entry.rank}`, `#${entry.rank}`);
        const swatch = el("div", "podium-avatar");
        swatch.style.background = colorHex(opts.colorOf(entry.participantId));
        step.appendChild(swatch);
        step.appendChild(el("div", "podium-name", entry.name));
        step.appendChild(el("div", "podium-score", `${entry.score} pts`));
        step.appendChild(block);
        podium.appendChild(step);
      }
      card.appendChild(podium);
      revealPodium(podium);

      const summing = el("div", "summing-label", "SUMANDO AL TOTAL…");
      card.appendChild(summing);

      const table = el("div", "ranking-table");
      table.style.display = "none";
      for (const entry of opts.totalRanking) {
        const row = el("div", "ranking-row");
        row.appendChild(el("span", "rank-num", `#${entry.rank}`));
        row.appendChild(el("span", "rank-name", entry.name));
        row.appendChild(el("span", "rank-score", `${entry.score} pts`));
        table.appendChild(row);
      }
      card.appendChild(table);

      const btn = el("button", "btn", opts.isLast ? "Ver ranking final" : "Continuar") as HTMLButtonElement;
      btn.style.display = "none";
      card.appendChild(btn);
      btn.onclick = () => resolve();

      screen.appendChild(card);
      this.root.appendChild(screen);

      setTimeout(() => {
        summing.style.display = "none";
        table.style.display = "flex";
        btn.style.display = "inline-block";
      }, 1900);
    });
  }

  async showFinalResults(finalRanking: RankingEntry[], colorOf: (id: string) => number, stats: MatchSummaryStats): Promise<void> {
    this.clear();
    return new Promise((resolve) => {
      const screen = el("div", "screen");
      const card = el("div", "panel results-card");
      card.appendChild(el("div", "results-title", "🏆 Ranking final"));

      const podium = el("div", "podium");
      const order = orderForPodium(finalRanking);
      for (const entry of order) {
        const step = el("div", "podium-step");
        const block = el("div", `podium-block rank-${entry.rank}`, `#${entry.rank}`);
        const swatch = el("div", "podium-avatar");
        swatch.style.background = colorHex(colorOf(entry.participantId));
        step.appendChild(swatch);
        step.appendChild(el("div", "podium-name", entry.name));
        step.appendChild(el("div", "podium-score", `${entry.score} pts`));
        step.appendChild(block);
        podium.appendChild(step);
      }
      card.appendChild(podium);
      revealPodium(podium);

      const btn = el("button", "btn", "Ver tu resumen") as HTMLButtonElement;
      btn.onclick = () => resolve();
      card.appendChild(btn);

      screen.appendChild(card);
      this.root.appendChild(screen);
      void stats;
    });
  }

  showMatchSummary(stats: MatchSummaryStats): Promise<"replay"> {
    this.clear();
    return new Promise((resolve) => {
      const screen = el("div", "screen");
      const card = el("div", "panel summary-card");
      card.appendChild(el("div", "results-title", "Tu partida"));

      const det = stats.detections;
      card.appendChild(
        summaryStat(`Detectaste ${det.correct}/${det.total} señales engañosas o ambiguas`)
      );

      const categories = Object.entries(stats.categoryPerformance)
        .filter(([, v]) => v.total > 0)
        .sort((a, b) => b[1].correct / b[1].total - a[1].correct / a[1].total);
      if (categories.length > 0) {
        const best = categories[0];
        const worst = categories[categories.length - 1];
        card.appendChild(summaryStat(`Mejor categoría: ${prettyCategory(best[0])} (${best[1].correct}/${best[1].total})`));
        if (categories.length > 1) {
          card.appendChild(summaryStat(`Para reforzar: ${prettyCategory(worst[0])} (${worst[1].correct}/${worst[1].total})`));
        }
      }

      const pa = stats.pressureAccuracy;
      card.appendChild(summaryStat(`Bajo presión: ${pa.correct}/${pa.total} buenas decisiones`));

      const msg = el(
        "div",
        "summary-message",
        "Recuerda: si algo te incomoda, no es tu culpa. Puedes bloquear, reportar y contárselo a un adulto de confianza."
      );
      card.appendChild(msg);

      const btn = el("button", "btn coral", "Jugar otra partida") as HTMLButtonElement;
      btn.onclick = () => resolve("replay");
      card.appendChild(btn);

      screen.appendChild(card);
      this.root.appendChild(screen);
    });
  }
}

function summaryStat(text: string): HTMLDivElement {
  return el("div", "summary-stat", text);
}

function prettyCategory(cat: string): string {
  return cat
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function THREE_clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

/** Reordena personas, no números de puesto: los empates conservan a todos. */
export function orderForPodium(entries: RankingEntry[]): RankingEntry[] {
  const sorted = [...entries].sort((a, b) => a.rank - b.rank);
  if (sorted.length > 1) [sorted[0], sorted[1]] = [sorted[1], sorted[0]];
  return sorted;
}
