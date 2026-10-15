import * as CANNON from "cannon-es";

/**
 * Envoltorio delgado sobre cannon-es. Se usa para colisión física real entre
 * los 4 personajes y contra los props estáticos de la arena (choques al
 * correr contra un árbol de cartón, empujones entre participantes), NO para
 * detectar recolección de objetivos: eso lo hacen los minijuegos por
 * distancia (más fiable y predecible para gameplay competitivo).
 */
export class PhysicsWorld {
  readonly world: CANNON.World;
  private bodies = new Map<string, CANNON.Body>();

  constructor(private arenaRadius: number) {
    this.world = new CANNON.World({ gravity: new CANNON.Vec3(0, 0, 0) });
    this.world.broadphase = new CANNON.SAPBroadphase(this.world);
    this.world.allowSleep = false;

    // Los personajes son esferas con fixedRotation (no pueden "rodar"), así
    // que la fricción por defecto de cannon-es (0.3) las frena en seco y las
    // deja pegadas al tocar un prop o a otro personaje — nada de deslizar.
    // Para un controller arcade top-down no hace falta fricción realista:
    // se baja a casi cero para que el roce con bordes/props se sienta como
    // un deslizamiento suave en vez de una traba.
    this.world.defaultContactMaterial.friction = 0.01;
    this.world.defaultContactMaterial.restitution = 0;
  }

  addCharacterBody(id: string, radius = 0.38): CANNON.Body {
    const body = new CANNON.Body({
      mass: 1,
      shape: new CANNON.Sphere(radius),
      linearDamping: 0.88,
      angularDamping: 1,
      fixedRotation: true,
      position: new CANNON.Vec3(0, radius, 0)
    });
    this.world.addBody(body);
    this.bodies.set(id, body);
    return body;
  }

  addStaticBox(halfExtents: { x: number; y: number; z: number }, position: { x: number; y: number; z: number }): void {
    const body = new CANNON.Body({
      mass: 0,
      shape: new CANNON.Box(new CANNON.Vec3(halfExtents.x, halfExtents.y, halfExtents.z)),
      position: new CANNON.Vec3(position.x, position.y, position.z)
    });
    this.world.addBody(body);
  }

  addStaticCylinder(radius: number, height: number, position: { x: number; y: number; z: number }): void {
    const shape = new CANNON.Cylinder(radius, radius, height, 10);
    const body = new CANNON.Body({ mass: 0, position: new CANNON.Vec3(position.x, position.y, position.z) });
    body.addShape(shape);
    this.world.addBody(body);
  }

  getBody(id: string): CANNON.Body | undefined {
    return this.bodies.get(id);
  }

  /** Aplica la intención de movimiento (dirección normalizada) como velocidad directa — patrón estándar de "kinematic-ish" arcade controller sobre un body dinámico. */
  driveVelocity(id: string, dirX: number, dirZ: number, speed: number): void {
    const body = this.bodies.get(id);
    if (!body) return;
    body.velocity.x = dirX * speed;
    body.velocity.z = dirZ * speed;
  }

  step(dt: number): void {
    this.world.step(1 / 60, dt, 5);
    // límite circular de la arena: clamp manual (más simple/robusto que un muro físico segmentado)
    for (const body of this.bodies.values()) {
      const distSq = body.position.x * body.position.x + body.position.z * body.position.z;
      const maxR = this.arenaRadius - 0.6;
      if (distSq > maxR * maxR) {
        const dist = Math.sqrt(distSq);
        const scale = maxR / dist;
        body.position.x *= scale;
        body.position.z *= scale;
        body.velocity.x *= 0.2;
        body.velocity.z *= 0.2;
      }
      body.position.y = 0.38;
      body.velocity.y = 0;
    }
  }

  dispose(): void {
    for (const body of this.bodies.values()) this.world.removeBody(body);
    this.bodies.clear();
  }
}
