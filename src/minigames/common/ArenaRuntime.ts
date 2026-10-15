import * as THREE from "three";
import { Config } from "../../core/Config";
import type { Participant } from "../../entities/Participant";
import { HumanController } from "../../entities/controllers/HumanController";
import { AIController } from "../../entities/controllers/AIController";
import { CameraRig } from "../../world/CameraRig";
import { CharacterRig } from "../../world/CharacterRig";
import { PhysicsWorld } from "../../world/PhysicsWorld";
import { buildSharedArena, type ArenaBuild } from "../../world/ArenaFactory";
import type { MinigameContext } from "../IMinigame";
import { NexoraDebug } from "../../utils/DebugHook";

/**
 * Arena + movimiento + cámara + NPC compartidos por Atrapa o Evita y
 * Cazaengaños (misma base física y visual, tal como pide la arquitectura:
 * "reutilizando arena, movimiento, NPC, objetivos y puntuación").
 */
export class ArenaRuntime {
  readonly physics: PhysicsWorld;
  readonly arena: ArenaBuild;
  readonly cameraRig: CameraRig;
  readonly rigs: Map<string, CharacterRig> = new Map();
  readonly group = new THREE.Group();

  constructor(
    private ctx: MinigameContext,
    radius: number = Config.arena.sharedRadius,
    arenaBuilder: (radius: number, physics: PhysicsWorld) => ArenaBuild = buildSharedArena,
    spawnRadiusScale = 0.55
  ) {
    this.physics = new PhysicsWorld(radius);
    this.arena = arenaBuilder(radius, this.physics);
    this.group.add(this.arena.group);
    ctx.scene.add(this.group);

    this.cameraRig = new CameraRig(ctx.camera, ctx.input);

    const spawnAngles = [0, Math.PI / 2, Math.PI, (Math.PI * 3) / 2];
    ctx.participants.forEach((p, i) => {
      const rig = this.createRig(p);
      const angle = spawnAngles[i];
      const spawnR = radius * spawnRadiusScale;
      rig.setSpawn(Math.cos(angle) * spawnR, Math.sin(angle) * spawnR);
      rig.character.setHeading(angle + Math.PI);
      this.group.add(rig.root);
      this.rigs.set(p.id, rig);
    });

    const human = this.getHumanRig();
    if (human) this.cameraRig.snapTo(new THREE.Vector3(...human.participant.position));

    NexoraDebug.setParticipantsSource({
      listIds: () => ctx.participants.map((p) => p.id),
      getWorldPos: (id) => {
        const rig = this.rigs.get(id);
        return rig ? new THREE.Vector3(...rig.participant.position) : null;
      }
    });
    NexoraDebug.setYawGetter(() => this.cameraRig.getYaw());
  }

  private createRig(participant: Participant): CharacterRig {
    if (participant.controllerKind === "human") {
      const controller = new HumanController(this.ctx.input, () => this.cameraRig.getYaw());
      return new CharacterRig(participant, controller, this.physics, Config.player.moveSpeed);
    }
    const traits = participant.avatar.traits!;
    const controller = new AIController(
      traits,
      () => new THREE.Vector3(...participant.position),
      this.arena.radius
    );
    return new CharacterRig(participant, controller, this.physics, traits.movementSpeed);
  }

  getHumanRig(): CharacterRig | undefined {
    return [...this.rigs.values()].find((r) => r.controller.kind === "human");
  }

  getAIControllers(): { participant: Participant; controller: AIController; rig: CharacterRig }[] {
    return [...this.rigs.values()]
      .filter((r) => r.controller.kind === "ai")
      .map((r) => ({ participant: r.participant, controller: r.controller as AIController, rig: r }));
  }

  getHumanController(): HumanController | undefined {
    const rig = this.getHumanRig();
    return rig?.controller instanceof HumanController ? rig.controller : undefined;
  }

  update(dt: number): void {
    for (const rig of this.rigs.values()) rig.preStep(dt);
    this.physics.step(dt);
    for (const rig of this.rigs.values()) rig.postStep(dt);

    const human = this.getHumanRig();
    if (human) {
      const isMoving = human.controller.moveIntent.x !== 0 || human.controller.moveIntent.z !== 0;
      this.cameraRig.update(dt, new THREE.Vector3(...human.participant.position), this.arena.collidables, {
        heading: human.participant.heading,
        active: isMoving
      });
    }
  }

  dispose(): void {
    this.ctx.input.exitPointerLock();
    for (const rig of this.rigs.values()) rig.dispose();
    this.physics.dispose();
    this.ctx.scene.remove(this.group);
    NexoraDebug.setParticipantsSource(null);
    NexoraDebug.setYawGetter(null);
  }
}
