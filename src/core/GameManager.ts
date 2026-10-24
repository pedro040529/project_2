import * as THREE from "three";
import {
  EffectComposer,
  RenderPass,
  EffectPass,
  BloomEffect,
  VignetteEffect,
  ToneMappingEffect,
  ToneMappingMode
} from "postprocessing";
import { UIManager } from "./UIManager";
import { QualityMonitor, readQualityOverride, type QualityTier } from "./Quality";
import { AudioManager } from "../audio/AudioManager";
import { InputManager } from "../world/InputManager";
import { LabelRenderer } from "../world/LabelRenderer";
import { MatchManager } from "./MatchManager";
import { NexoraDebug } from "../utils/DebugHook";
import { LobbyShowcase } from "../world/LobbyShowcase";

/**
 * Punto de entrada del runtime: crea renderer/escena/cámara UNA sola vez
 * (se reutilizan entre minijuegos — solo el contenido de la escena cambia),
 * monta el bucle de render y delega todo el flujo de partida a MatchManager.
 */
/** Cielo nocturno de NEXORA: degradado vertical azul noche → violeta. */
function makeSkyTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 4;
  c.height = 256;
  const ctx = c.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, "#0a0e2a");
  g.addColorStop(0.6, "#2a2670");
  g.addColorStop(1, "#7a4fa0");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 4, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class GameManager {
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private labelRenderer!: LabelRenderer;
  private input!: InputManager;
  private ui = new UIManager();
  private audio = new AudioManager();
  private matchManager!: MatchManager;
  private timer = new THREE.Timer();
  private lobbyShowcase: LobbyShowcase | null = null;
  private composerHigh!: EffectComposer;
  private composerMedium!: EffectComposer;
  private sun!: THREE.DirectionalLight;
  private quality!: QualityMonitor;
  private tier: QualityTier = "high";

  async start(): Promise<void> {
    const canvas = document.getElementById("scene") as HTMLCanvasElement;
    const labelsContainer = document.getElementById("labels") as HTMLElement;

    this.ui.setLoadingProgress(0.15, "Preparando el motor 3D…");

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.scene.background = makeSkyTexture();
    this.scene.fog = new THREE.Fog(0x2a2670, 40, 90);

    this.camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 200);

    this.setupLights();
    this.setupPostFX();

    this.labelRenderer = new LabelRenderer(labelsContainer);
    this.input = new InputManager(canvas);
    NexoraDebug.setCameraAndRenderer(this.camera, this.renderer);

    this.ui.setLoadingProgress(0.55, "Armando el diorama…");

    this.matchManager = new MatchManager({
      scene: this.scene,
      camera: this.camera,
      renderer: this.renderer,
      labelRenderer: this.labelRenderer,
      input: this.input,
      ui: this.ui,
      audio: this.audio,
      disposeLobbyShowcase: () => this.disposeLobbyShowcase()
    });

    window.addEventListener("resize", this.handleResize);
    this.mountPersistentControls();

    this.ui.setLoadingProgress(1, "¡Listo!");
    await wait(280);
    this.ui.hideLoadingScreen();

    this.startRenderLoop();
    await this.runFlow();
  }

  /** Dos cadenas de postprocesado (alta y media); la baja renderiza directo. */
  private setupPostFX(): void {
    const make = (effects: ConstructorParameters<typeof EffectPass>[1][]): EffectComposer => {
      const c = new EffectComposer(this.renderer, { multisampling: 0 });
      c.addPass(new RenderPass(this.scene, this.camera));
      c.addPass(new EffectPass(this.camera, ...effects));
      return c;
    };
    const tone = () => new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC });
    const vignette = () => new VignetteEffect({ offset: 0.35, darkness: 0.45 });
    this.composerHigh = make([
      new BloomEffect({ intensity: 0.45, luminanceThreshold: 0.82, luminanceSmoothing: 0.25, mipmapBlur: true }),
      vignette(),
      tone()
    ]);
    this.composerMedium = make([vignette(), tone()]);

    const forced = readQualityOverride(window.location.search);
    const start = forced ?? (this.isWeakDevice() ? "medium" : "high");
    this.quality = new QualityMonitor((t) => this.applyQuality(t), start, forced === null);
    this.applyQuality(start);
  }

  /** GPU integrada/por software o pocos núcleos: arranca directamente en calidad media. */
  private isWeakDevice(): boolean {
    const gl = this.renderer.getContext();
    const info = gl.getExtension("WEBGL_debug_renderer_info");
    const name = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : "";
    const weakGpu = /swiftshader|llvmpipe|software|intel\(r\) (uhd|hd)|mali|adreno|powervr/i.test(name);
    return weakGpu || (navigator.hardwareConcurrency ?? 8) <= 4;
  }

  private applyQuality(tier: QualityTier): void {
    this.tier = tier;
    const dpr = window.devicePixelRatio || 1;
    const ratio = tier === "high" ? Math.min(dpr, 1.5) : tier === "medium" ? Math.min(dpr, 1.25) : 1;
    this.renderer.setPixelRatio(ratio);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.composerHigh.setSize(window.innerWidth, window.innerHeight);
    this.composerMedium.setSize(window.innerWidth, window.innerHeight);

    const shadows = tier !== "low";
    this.renderer.shadowMap.enabled = shadows;
    this.sun.castShadow = shadows;
    const size = tier === "high" ? 1024 : 512;
    if (this.sun.shadow.mapSize.x !== size) {
      this.sun.shadow.mapSize.set(size, size);
      this.sun.shadow.map?.dispose();
      this.sun.shadow.map = null;
    }
    // sin postprocesado, el tono de película lo aplica el renderer directamente
    this.renderer.toneMapping = tier === "low" ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping;
    this.scene.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
      if (m) (Array.isArray(m) ? m : [m]).forEach((x) => (x.needsUpdate = true));
    });
    console.info(`[NEXORA] calidad gráfica: ${tier}`);
  }

  private setupLights(): void {
    const hemi = new THREE.HemisphereLight(0xd6dcff, 0x5b4a8f, 1.1);
    this.scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xfff1cf, 1.35);
    this.sun = sun;
    sun.position.set(14, 22, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -32;
    sun.shadow.camera.right = 32;
    sun.shadow.camera.top = 32;
    sun.shadow.camera.bottom = -32;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 70;
    sun.shadow.bias = -0.0015;
    this.scene.add(sun);

    const fill = new THREE.DirectionalLight(0xffe0c2, 0.25);
    fill.position.set(-10, 8, -14);
    this.scene.add(fill);
  }

  /**
   * Botón de silenciar (RNF de arte/sonido): vive FUERA de #ui-root a
   * propósito, para sobrevivir a cada UIManager.clear() y estar siempre
   * visible sin que cada pantalla tenga que volver a montarlo.
   */
  private mountPersistentControls(): void {
    const app = document.getElementById("app")!;
    const wrap = document.createElement("div");
    wrap.className = "corner-controls";

    const muteBtn = document.createElement("button");
    muteBtn.className = "icon-btn";
    muteBtn.type = "button";
    muteBtn.setAttribute("aria-pressed", "false");
    muteBtn.setAttribute("aria-label", "Silenciar sonido");
    muteBtn.textContent = "🔊";
    muteBtn.onclick = () => {
      const muted = this.audio.toggleMute();
      muteBtn.textContent = muted ? "🔇" : "🔊";
      muteBtn.setAttribute("aria-pressed", String(muted));
      muteBtn.setAttribute("aria-label", muted ? "Activar sonido" : "Silenciar sonido");
    };
    wrap.appendChild(muteBtn);
    app.appendChild(wrap);
  }

  private handleResize = () => {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.composerHigh.setSize(window.innerWidth, window.innerHeight);
    this.composerMedium.setSize(window.innerWidth, window.innerHeight);
    this.labelRenderer.setSize(window.innerWidth, window.innerHeight);
  };

  private startRenderLoop(): void {
    this.timer.connect(document);
    const tick = () => {
      requestAnimationFrame(tick);
      this.timer.update();
      const rawDt = this.timer.getDelta();
      this.quality.sample(rawDt);
      // Tope de 0.1 s: con FPS bajos el juego avanza a velocidad real (antes se veía en cámara lenta).
      const dt = Math.min(0.1, rawDt);
      if (this.lobbyShowcase) this.lobbyShowcase.update(dt);
      else this.matchManager.frame(dt);
      if (this.tier === "high") this.composerHigh.render(dt);
      else if (this.tier === "medium") this.composerMedium.render(dt);
      else this.renderer.render(this.scene, this.camera);
      this.labelRenderer.render(this.scene, this.camera);
    };
    tick();
  }

  private disposeLobbyShowcase(): void {
    this.lobbyShowcase?.dispose();
    this.lobbyShowcase = null;
  }

  private async runFlow(): Promise<void> {
    this.lobbyShowcase = new LobbyShowcase(this.scene, this.camera);
    const lobby = await this.ui.showLobby();
    this.audio.unlock();
    this.audio.playLobbyMusic();
    const avatarOption = await this.ui.showCharacterSelect();
    this.audio.uiClick();
    this.audio.stopMusic();
    await this.matchManager.runMatch(lobby.nickname, avatarOption);
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
