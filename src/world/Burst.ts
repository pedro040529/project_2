import * as THREE from "three";

interface Particle {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
}

const GEO = new THREE.IcosahedronGeometry(0.08, 0);

/** Estallido de partículas reutilizable (recoger, destruir, explotar). Se limpia solo. */
export class BurstSystem {
  private particles: Particle[] = [];

  constructor(private parent: THREE.Object3D) {}

  emit(origin: THREE.Vector3, color: number, count = 24, speed = 4, size = 1): void {
    for (let i = 0; i < count; i++) {
      const mat = new THREE.MeshBasicMaterial({ color, transparent: true });
      const mesh = new THREE.Mesh(GEO, mat);
      mesh.position.copy(origin);
      mesh.scale.setScalar(size * (0.6 + Math.random() * 0.9));
      const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.9 + 0.1, Math.random() - 0.5).normalize();
      this.parent.add(mesh);
      this.particles.push({ mesh, vel: dir.multiplyScalar(speed * (0.4 + Math.random())), life: 0, maxLife: 0.5 + Math.random() * 0.5 });
    }
  }

  update(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;
      p.vel.y -= 6 * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      const k = 1 - p.life / p.maxLife;
      (p.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, k);
      if (k <= 0) {
        p.mesh.removeFromParent();
        (p.mesh.material as THREE.Material).dispose();
        this.particles.splice(i, 1);
      }
    }
  }

  dispose(): void {
    for (const p of this.particles) {
      p.mesh.removeFromParent();
      (p.mesh.material as THREE.Material).dispose();
    }
    this.particles = [];
  }
}
