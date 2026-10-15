import * as THREE from "three";
import { CSS2DObject, CSS2DRenderer } from "three/addons/renderers/CSS2DRenderer.js";

/**
 * Burbujas de texto en el mundo 3D (mensajes de Cazaengaños, contexto de
 * recompensas de Atrapa o Evita). Misma clase visual para TODOS los tipos de
 * contenido — la neutralidad visual (RNF06) se cumple porque nunca se
 * cambia estilo/color según si el escenario es legítimo o engañoso.
 */
export class LabelRenderer {
  readonly renderer = new CSS2DRenderer();

  constructor(container: HTMLElement) {
    this.renderer.domElement.style.position = "absolute";
    this.renderer.domElement.style.top = "0";
    this.renderer.domElement.style.left = "0";
    this.renderer.domElement.style.pointerEvents = "none";
    container.appendChild(this.renderer.domElement);
    this.setSize(container.clientWidth, container.clientHeight);
  }

  setSize(w: number, h: number): void {
    this.renderer.setSize(w, h);
  }

  render(scene: THREE.Scene, camera: THREE.Camera): void {
    this.renderer.render(scene, camera);
    // Descartar etiquetas fuera del encuadre y priorizar las cercanas al centro.
    // Se conservan los objetivos 3D: acercarse o girar permite leer los demás.
    const width = this.renderer.domElement.clientWidth;
    const height = this.renderer.domElement.clientHeight;
    const labels: { element: HTMLElement; rect: DOMRect; score: number }[] = [];
    const hudRects = Array.from(document.querySelectorAll(".hud-top, .hud-ranking")).map(el => el.getBoundingClientRect());
    scene.traverse(obj => {
      if (!(obj instanceof CSS2DObject)) return;
      const element = obj.element;
      const projected = obj.getWorldPosition(new THREE.Vector3()).project(camera);
      const rect = element.getBoundingClientRect();
      const eligible = projected.z >= -1 && projected.z <= 1 && rect.left >= 12 && rect.right <= width - 12 && rect.top >= 12 && rect.bottom <= height - 65 && !hudRects.some(hud => rect.left < hud.right + 8 && rect.right > hud.left - 8 && rect.top < hud.bottom + 8 && rect.bottom > hud.top - 8);
      element.style.visibility = "hidden";
      if (eligible) labels.push({ element, rect, score: Math.hypot((rect.left + rect.right) / 2 - width / 2, (rect.top + rect.bottom) / 2 - height / 2) });
    });
    labels.sort((a, b) => a.score - b.score);
    const occupied: DOMRect[] = [];
    for (const { element, rect } of labels) {
      if (occupied.some(other => rect.left < other.right + 12 && rect.right + 12 > other.left && rect.top < other.bottom + 12 && rect.bottom + 12 > other.top)) continue;
      element.style.visibility = "visible";
      occupied.push(rect);
    }
  }

  createLabel(tag: string, text: string): CSS2DObject {
    const el = document.createElement("div");
    el.className = "world-label";
    const tagEl = document.createElement("span");
    tagEl.className = "label-tag";
    tagEl.textContent = tag;
    const textEl = document.createElement("span");
    textEl.textContent = text;
    el.appendChild(tagEl);
    el.appendChild(textEl);
    return new CSS2DObject(el);
  }

  dispose(): void {
    this.renderer.domElement.remove();
  }
}
