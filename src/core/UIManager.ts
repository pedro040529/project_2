import { gsap } from "gsap";
import type { Participant } from "../entities/Participant";
import type { RankingEntry } from "./ScoreManager";
import type { MatchSummaryStats } from "./types";
import { CATEGORY_LABEL } from "../data/feedback";
import type { CategoryId } from "./types";
import { BODY_COLORS, EXTRA_ACCESSORIES, HEAD_ACCESSORIES, colorDef } from "../data/characters";
import { Settings, type QualitySetting } from "./Settings";
import type { PlayerProfile } from "./Profile";
import type { Appearance, MinigameId } from "./types";

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

function colorHex(n: number): string {
  return `#${n.toString(16).padStart(6, "0")}`;
}

/** Dibuja la tecla como se ve en el teclado; WASD y 1-3 se muestran como grupo con flechas de dirección. */
function keyVisual(key: string): HTMLElement {
  const cap = (label: string, arrow?: string): HTMLElement => {
    const k = el("div", "key-badge keycap");
    k.appendChild(el("span", "keycap-label", label));
    if (arrow) k.appendChild(el("span", "keycap-arrow", arrow));
    return k;
  };
  if (key === "WASD") {
    const pad = el("div", "key-cluster");
    pad.appendChild(el("span", "key-spacer"));
    pad.appendChild(cap("W", "▲"));
    pad.appendChild(el("span", "key-spacer"));
    pad.appendChild(cap("A", "◀"));
    pad.appendChild(cap("S", "▼"));
    pad.appendChild(cap("D", "▶"));
    return pad;
  }
  if (key === "1-3") {
    const row = el("div", "key-row");
    ["1", "2", "3"].forEach((n) => row.appendChild(cap(n)));
    return row;
  }
  if (key === "Mouse") return el("div", "key-badge mouse-icon", "🖱️");
  return el("div", "key-badge", key);
}

export interface InstructionsSpec {
  id: MinigameId;
  /** 1..3 */
  step: number;
  title: string;
  goal: string;
  /** cómo se obtienen y se pierden puntos, en chips de un vistazo */
  rules: { points: string; text: string; tone: "good" | "bad" | "neutral" }[];
  controls: { key: string; label: string }[];
}

export interface HudHandle {
  setTimer(seconds: number): void;
  setRanking(entries: RankingEntry[], colorOf: (id: string) => number): void;
  showEventBanner(text: string, durationMs?: number): void;
  /** Retroalimentación breve DESPUÉS de una acción; no bloquea los controles. */
  showFeedback(text: string, good: boolean, durationMs?: number): void;
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
  /** Muestra una situación con sus opciones; `onPick` recibe el índice elegido (0..2). */
  show(sender: string, question: string, options: string[], onPick: (index: number) => void): void;
  /** Panel sin opciones (turno de un bot, pausas): solo texto y las barras. */
  showStatus(text: string): void;
  /** Energía del orbe en porcentaje (0..100). */
  setEnergy(percent: number): void;
  /** Tiempo para decidir: 1 = todo, 0 = agotado; null oculta la barra. */
  setTimeLeft(progress01: number | null, seconds?: number): void;
  /** Marca la opción correcta (verde) y la elegida si fue errónea (roja), con el feedback. */
  reveal(correctIndex: number, pickedIndex: number | null, feedback: string): void;
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

  // ---------------- Menú principal ----------------

  showLobby(profile: PlayerProfile): Promise<{ nickname: string }> {
    this.clear();
    return new Promise((resolve) => {
      const screen = el("div", "screen lobby-screen");
      const card = el("div", "panel lobby-card");
      card.appendChild(el("div", "lobby-eyebrow", "GUARDIANES DIGITALES"));
      card.appendChild(el("div", "lobby-title", "NEXORA"));
      card.appendChild(
        el("div", "lobby-sub", "Aprende a tomar mejores decisiones en el mundo digital. Compite contra 3 rivales y descubre qué hacer cuando algo no cuadra.")
      );

      const route = el("div", "lobby-route");
      [["1", "Atrapa o evita"], ["2", "Cazaengaños"], ["3", "Bajo Presión"]].forEach(([n, name], i) => {
        if (i > 0) route.appendChild(el("span", "route-arrow", "›"));
        const step = el("div", "route-step");
        step.append(el("span", "route-num", n), el("span", "route-name", name));
        route.appendChild(step);
      });
      card.appendChild(route);

      const input = el("input", "nickname-input") as HTMLInputElement;
      input.maxLength = 14;
      input.placeholder = "Tu nombre de jugador";
      input.setAttribute("aria-label", "Tu nombre de jugador");
      input.value = profile.nickname;
      card.appendChild(input);

      const go = () => resolve({ nickname: input.value.trim().slice(0, 14) || "Jugador" });
      card.appendChild(button("▶ Jugar", "primary lobby-play-btn", go));
      card.appendChild(button("⚙ Configuración", "ghost", () => void this.showSettings()));
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") go();
      });

      screen.appendChild(card);
      this.root.appendChild(screen);
      input.focus();
    });
  }

  /** Ajustes reales: volumen, sensibilidad del mouse y calidad gráfica. */
  showSettings(): Promise<void> {
    return new Promise((resolve) => {
      const overlay = el("div", "modal-overlay");
      const card = el("div", "panel settings-card");
      card.appendChild(el("div", "select-title", "Configuración"));
      const cur = Settings.get();

      const row = (label: string, control: HTMLElement, value: HTMLElement): HTMLElement => {
        const r = el("label", "settings-row");
        r.append(el("span", "settings-label", label), control, value);
        return r;
      };
      const slider = (min: number, max: number, step: number, v: number): HTMLInputElement => {
        const i = el("input", "settings-range") as HTMLInputElement;
        i.type = "range";
        i.min = String(min);
        i.max = String(max);
        i.step = String(step);
        i.value = String(v);
        return i;
      };

      const vol = slider(0, 1, 0.05, cur.volume);
      const volVal = el("span", "settings-value", `${Math.round(cur.volume * 100)} %`);
      vol.oninput = () => {
        Settings.update({ volume: Number(vol.value) });
        volVal.textContent = `${Math.round(Number(vol.value) * 100)} %`;
      };
      card.appendChild(row("Volumen", vol, volVal));

      const sens = slider(0.4, 2, 0.1, cur.mouseSensitivity);
      const sensVal = el("span", "settings-value", `${cur.mouseSensitivity.toFixed(1)}×`);
      sens.oninput = () => {
        Settings.update({ mouseSensitivity: Number(sens.value) });
        sensVal.textContent = `${Number(sens.value).toFixed(1)}×`;
      };
      card.appendChild(row("Sensibilidad del mouse", sens, sensVal));

      const quality = el("select", "settings-select") as HTMLSelectElement;
      for (const [v, label] of [["auto", "Automática (recomendada)"], ["high", "Alta"], ["medium", "Media"], ["low", "Baja (más fluida)"]]) {
        const o = el("option", undefined, label) as HTMLOptionElement;
        o.value = v;
        quality.appendChild(o);
      }
      quality.value = cur.quality;
      quality.onchange = () => Settings.update({ quality: quality.value as QualitySetting });
      card.appendChild(row("Calidad gráfica", quality, el("span", "settings-value", "")));

      card.appendChild(
        button("Listo", "primary", () => {
          overlay.remove();
          resolve();
        })
      );
      overlay.appendChild(card);
      this.root.appendChild(overlay);
    });
  }

  // ---------------- Personalización ----------------

  showCharacterSelect(opts: {
    initial: Appearance;
    onChange: (a: Appearance) => void;
    onRotate: (dir: -1 | 1) => void;
  }): Promise<{ action: "confirm"; appearance: Appearance } | { action: "back" }> {
    this.clear();
    return new Promise((resolve) => {
      const screen = el("div", "screen customize-screen");
      const card = el("div", "panel customize-card");
      card.appendChild(el("div", "select-title", "Personaliza a tu Guardián"));
      const current: Appearance = { ...opts.initial };
      const apply = () => opts.onChange({ ...current });

      const group = <T extends string>(
        title: string,
        items: { id: T; name: string }[],
        get: () => T,
        set: (id: T) => void,
        swatch?: (id: T) => string
      ): HTMLElement => {
        const wrap = el("div", "custom-group");
        wrap.appendChild(el("div", "custom-title", title));
        const list = el("div", swatch ? "custom-swatches" : "custom-chips");
        const btns: HTMLButtonElement[] = [];
        for (const it of items) {
          const b = el("button", swatch ? "swatch-btn" : "chip-btn") as HTMLButtonElement;
          b.type = "button";
          b.title = it.name;
          b.setAttribute("aria-label", it.name);
          if (swatch) b.style.background = swatch(it.id);
          else b.textContent = it.name;
          b.setAttribute("aria-pressed", it.id === get() ? "true" : "false");
          b.onclick = () => {
            set(it.id);
            btns.forEach((x, i) => x.setAttribute("aria-pressed", items[i].id === get() ? "true" : "false"));
            apply();
          };
          btns.push(b);
          list.appendChild(b);
        }
        wrap.appendChild(list);
        return wrap;
      };

      card.appendChild(
        group("Color del cuerpo", BODY_COLORS, () => current.color, (id) => (current.color = id), (id) => {
          const c = colorDef(id);
          return `radial-gradient(circle at 35% 30%, ${colorHex(c.shell)} 45%, ${colorHex(c.trim)} 100%)`;
        })
      );
      card.appendChild(group("Accesorio de cabeza", HEAD_ACCESSORIES, () => current.head, (id) => (current.head = id)));
      card.appendChild(group("Accesorio adicional", EXTRA_ACCESSORIES, () => current.extra, (id) => (current.extra = id)));

      const rot = el("div", "custom-rotate");
      rot.append(button("◀", "ghost small", () => opts.onRotate(-1)), el("span", undefined, "Girar"), button("▶", "ghost small", () => opts.onRotate(1)));
      card.appendChild(rot);

      const actions = el("div", "custom-actions");
      actions.append(
        button("← Volver", "ghost", () => resolve({ action: "back" })),
        button("Confirmar", "primary", () => resolve({ action: "confirm", appearance: { ...current } }))
      );
      card.appendChild(actions);
      screen.appendChild(card);
      this.root.appendChild(screen);
    });
  }

  // ---------------- Presentación de participantes ----------------

  showRosterIntro(): Promise<void> {
    this.clear();
    return new Promise((resolve) => {
      const screen = el("div", "screen roster-screen");
      const top = el("div", "roster-top panel");
      top.appendChild(el("div", "select-title", "Los participantes"));
      top.appendChild(el("div", "roster-sub", "Tres desafíos seguidos: Atrapa o evita → Cazaengaños → Bajo Presión. Gana quien sume más puntos."));
      const bottom = el("div", "roster-bottom");
      bottom.appendChild(button("Comenzar competencia", "primary big", () => resolve()));
      screen.append(top, bottom);
      this.root.appendChild(screen);
    });
  }


  // ---------------- Instrucciones + cuenta atrás ----------------

  async showInstructions(spec: InstructionsSpec): Promise<void> {
    this.clear();
    await new Promise<void>((resolve) => {
      const screen = el("div", `screen instructions-screen theme-${spec.id}`);
      const card = el("div", "panel instructions-card");
      card.appendChild(el("div", "instructions-step", `DESAFÍO ${spec.step} DE 3`));
      card.appendChild(el("div", "instructions-title", spec.title));
      card.appendChild(el("div", "instructions-goal", spec.goal));

      const rules = el("div", "instructions-rules");
      for (const r of spec.rules) {
        const chip = el("div", `rule-chip ${r.tone}`);
        chip.append(el("span", "rule-points", r.points), el("span", "rule-text", r.text));
        rules.appendChild(chip);
      }
      card.appendChild(rules);

      const controls = el("div", "instructions-controls");
      for (const c of spec.controls) {
        const chip = el("div", "control-chip");
        chip.appendChild(keyVisual(c.key));
        chip.appendChild(el("span", undefined, c.label));
        controls.appendChild(chip);
      }
      card.appendChild(controls);
      card.appendChild(button("Listo", "primary big", () => resolve()));
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

    const feedbackEl = el("div", "hud-feedback");
    hud.appendChild(feedbackEl);
    let feedbackTimeout = 0;
    let lastTimerSecond = -1;
    let lastRankingKey = "";
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
        if (s === lastTimerSecond) return; // solo toca el DOM cuando cambia el segundo
        lastTimerSecond = s;
        const m = Math.floor(s / 60);
        const r = s % 60;
        timer.textContent = `${m}:${r.toString().padStart(2, "0")}`;
        timer.classList.toggle("low", s <= 10);
      },
      setRanking: (entries: RankingEntry[], colorOf: (id: string) => number) => {
        // se llama en cada fotograma: reconstruir solo si cambió algo
        const key = entries.map((e) => `${e.participantId}:${e.score}`).join("|");
        if (key === lastRankingKey) return;
        lastRankingKey = key;
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
      showFeedback: (text: string, good: boolean, durationMs = 3600) => {
        feedbackEl.textContent = text;
        feedbackEl.className = `hud-feedback show ${good ? "good" : "bad"}`;
        if (feedbackTimeout) window.clearTimeout(feedbackTimeout);
        feedbackTimeout = window.setTimeout(() => feedbackEl.classList.remove("show"), durationMs);
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
    const sender = el("div", "decision-sender", "");
    const situation = el("div", "decision-situation", "");
    const optionsWrap = el("div", "decision-options");
    const feedback = el("div", "decision-feedback", "");
    feedback.style.display = "none";

    const energyCaption = el("div", "charge-caption", "ENERGÍA DEL ORBE");
    const energyTrack = el("div", "charge-meter-track energy");
    const energyFill = el("div", "charge-meter-fill");
    energyTrack.appendChild(energyFill);
    const timeCaption = el("div", "charge-caption", "TIEMPO PARA DECIDIR");
    const timeTrack = el("div", "charge-meter-track time");
    const timeFill = el("div", "charge-meter-fill time");
    timeTrack.appendChild(timeFill);
    timeCaption.style.display = timeTrack.style.display = "none";

    panel.append(sender, situation, optionsWrap, feedback, energyCaption, energyTrack, timeCaption, timeTrack);
    this.root.appendChild(panel);
    let buttons: HTMLButtonElement[] = [];

    return {
      show: (senderText, question, options, onPick) => {
        panel.style.display = "flex";
        sender.textContent = senderText;
        sender.style.display = senderText ? "block" : "none";
        situation.textContent = question;
        feedback.style.display = "none";
        optionsWrap.innerHTML = "";
        buttons = options.map((text, i) => {
          const btn = el("button", "decision-btn") as HTMLButtonElement;
          const keyBadge = el("span", "key-badge keycap", String(i + 1));
          btn.append(keyBadge, el("span", undefined, text));
          btn.onclick = () => onPick(i);
          optionsWrap.appendChild(btn);
          return btn;
        });
      },
      showStatus: (text) => {
        panel.style.display = "flex";
        sender.style.display = "none";
        situation.textContent = text;
        optionsWrap.innerHTML = "";
        feedback.style.display = "none";
        buttons = [];
      },
      setEnergy: (pct) => {
        const v = Math.round(Math.min(100, Math.max(0, pct)));
        energyFill.style.width = `${v}%`;
        energyCaption.textContent = `ENERGÍA DEL ORBE · ${v} %`;
      },
      setTimeLeft: (p, seconds) => {
        const show = p !== null;
        timeCaption.style.display = timeTrack.style.display = show ? "block" : "none";
        if (show) {
          timeFill.style.width = `${Math.round(THREE_clamp01(p) * 100)}%`;
          timeCaption.textContent = seconds !== undefined ? `TIEMPO PARA DECIDIR · ${Math.ceil(seconds)} s` : "TIEMPO PARA DECIDIR";
        }
      },
      reveal: (correctIndex, pickedIndex, text) => {
        buttons.forEach((b, i) => {
          b.disabled = true;
          if (i === correctIndex) b.classList.add("correct");
          else if (i === pickedIndex) b.classList.add("wrong");
        });
        feedback.textContent = text;
        feedback.style.display = "block";
      },
      hide: () => {
        panel.style.display = "none";
      }
    };
  }

  // ---------------- Resultados ----------------

  /** Resultados de un desafío: podio 3D (stage) + tabla con los mismos datos. */
  showMinigameResults(opts: {
    step: number;
    minigameTitle: string;
    /** puntos de este desafío, ya ordenados con empates compartiendo puesto */
    round: RankingEntry[];
    /** acumulado tras este desafío */
    totals: Map<string, number>;
    humanId: string;
    isLast: boolean;
  }): Promise<void> {
    this.clear();
    return new Promise((resolve) => {
      const screen = el("div", "screen results-screen");
      const card = el("div", "panel results-panel");
      card.appendChild(el("div", "instructions-step", `DESAFÍO ${opts.step} DE 3 · TERMINADO`));
      card.appendChild(el("div", "results-title", opts.minigameTitle));
      card.appendChild(
        rankingTable(
          ["#", "Jugador", "Este desafío", "Acumulado"],
          opts.round.map((e) => ({
            rank: e.rank,
            name: e.name,
            cells: [fmtPts(e.score), fmtPts(opts.totals.get(e.participantId) ?? 0)],
            human: e.participantId === opts.humanId
          }))
        )
      );
      card.appendChild(button(opts.isLast ? "Ver ranking final" : "Continuar al siguiente desafío", "primary big", () => resolve()));
      screen.appendChild(card);
      this.root.appendChild(screen);
    });
  }

  /** Ranking final: acumulado de los 3 desafíos (con desglose verificable) y ganador. */
  showFinalResults(opts: {
    ranking: RankingEntry[];
    /** puntos por desafío, en orden de juego */
    perMinigame: Map<string, number[]>;
    humanId: string;
    stats: MatchSummaryStats;
  }): Promise<"menu" | "replay"> {
    this.clear();
    return new Promise((resolve) => {
      const screen = el("div", "screen results-screen final-screen");
      const card = el("div", "panel results-panel");
      const winners = opts.ranking.filter((r) => r.rank === 1);
      const humanWon = winners.some((w) => w.participantId === opts.humanId);
      card.appendChild(el("div", "instructions-step", "COMPETENCIA TERMINADA"));
      card.appendChild(el("div", "results-title", "🏆 Ranking final"));
      card.appendChild(
        el(
          "div",
          "winner-banner",
          winners.length > 1
            ? `Empate en el primer puesto: ${winners.map((w) => w.name).join(" y ")}`
            : humanWon
              ? `¡Ganaste la competencia, ${winners[0].name}!`
              : `Ganador: ${winners[0].name}`
        )
      );
      card.appendChild(
        rankingTable(
          ["#", "Jugador", "Atrapa", "Caza", "Presión", "Total"],
          opts.ranking.map((e) => ({
            rank: e.rank,
            name: e.name,
            cells: [...(opts.perMinigame.get(e.participantId) ?? [0, 0, 0]).map(fmtPts), fmtPts(e.score)],
            human: e.participantId === opts.humanId
          }))
        )
      );

      const stats = el("div", "final-stats");
      const det = opts.stats.detections;
      stats.appendChild(summaryStat(`Mensajes evaluados bien: ${det.correct} de ${det.total}`));
      const categories = Object.entries(opts.stats.categoryPerformance)
        .filter(([, v]) => v.total > 0)
        .sort((a, b) => b[1].correct / b[1].total - a[1].correct / a[1].total);
      if (categories.length > 1) {
        const worst = categories[categories.length - 1];
        stats.appendChild(summaryStat(`Para reforzar: ${prettyCategory(worst[0])} (${worst[1].correct}/${worst[1].total})`));
      }
      const pa = opts.stats.pressureAccuracy;
      stats.appendChild(summaryStat(`Bajo Presión: ${pa.correct} de ${pa.total} respuestas correctas`));
      card.appendChild(stats);
      card.appendChild(
        el("div", "summary-message", "Recuerda: si algo te incomoda, no es tu culpa. Puedes bloquear, reportar y contárselo a un adulto de confianza.")
      );

      const actions = el("div", "custom-actions");
      actions.append(
        button("Volver al menú", "ghost", () => resolve("menu")),
        button("Nueva competencia", "primary", () => resolve("replay"))
      );
      card.appendChild(actions);
      screen.appendChild(card);
      this.root.appendChild(screen);
    });
  }

}

/** Botón reutilizable (variantes: primary, ghost, small, big…). */
function button(label: string, variant: string, onClick: () => void): HTMLButtonElement {
  const b = el("button", `btn ${variant}`, label) as HTMLButtonElement;
  b.type = "button";
  b.onclick = onClick;
  return b;
}

function fmtPts(n: number): string {
  return `${n > 0 ? "+" : ""}${n}`;
}

interface TableRow {
  rank: number;
  name: string;
  cells: string[];
  human: boolean;
}

/** Tabla de clasificación reutilizable; el jugador humano queda resaltado. */
function rankingTable(headers: string[], rows: TableRow[]): HTMLElement {
  const table = el("div", "rank-table");
  table.style.setProperty("--cols", String(headers.length));
  const head = el("div", "rank-row rank-head");
  headers.forEach((h) => head.appendChild(el("span", undefined, h)));
  table.appendChild(head);
  for (const r of rows) {
    const row = el("div", `rank-row${r.human ? " me" : ""}`);
    row.appendChild(el("span", "rank-pos", `#${r.rank}`));
    row.appendChild(el("span", "rank-who", r.human ? `${r.name} (tú)` : r.name));
    r.cells.forEach((c, i) => row.appendChild(el("span", i === r.cells.length - 1 ? "rank-total" : undefined, c)));
    table.appendChild(row);
  }
  return table;
}

function summaryStat(text: string): HTMLDivElement {
  return el("div", "summary-stat", text);
}

function prettyCategory(cat: string): string {
  return CATEGORY_LABEL[cat as CategoryId] ?? cat;
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
