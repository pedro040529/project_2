import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { AIController } from '../src/entities/controllers/AIController';
import { CameraRig } from '../src/world/CameraRig';
import { Cazaenganos } from '../src/minigames/Cazaenganos';
import { NPC_AVATARS } from '../src/data/characters';

describe('Controles y lectura de rivales', () => {
  it('un NPC que llega a su punto de lectura se detiene', () => {
    const position = new THREE.Vector3(2, 0, 3);
    const ai = new AIController(NPC_AVATARS.nova.traits!, () => position, 26);
    ai.setTarget(position.clone(), 0.8);
    for (let i = 0; i < 120; i++) ai.update(1 / 60);
    expect(ai.moveIntent).toEqual({x: 0, z: 0});
  });

  it('la cámara conserva su rumbo cuando el jugador camina y no gira el mouse', () => {
    const camera = new THREE.PerspectiveCamera();
    const input = {consumeMouseDelta: () => ({dx: 0, dy: 0})};
    const rig = new CameraRig(camera, input as any);
    rig.snapTo(new THREE.Vector3());
    const yaw = rig.getYaw();
    for(let i=0;i<240;i++) rig.update(1/60, new THREE.Vector3(i/60,0,0), [], {heading: 0, active:true});
    expect(rig.getYaw()).toBe(yaw);
    const before = camera.position.clone();
    rig.update(1/60, new THREE.Vector3(4,0,0));
    expect(camera.position.x - before.x).toBeCloseTo(1/60);
  });

  it('ningún disparo de NPC resuelve un mensaje antes de siete segundos', () => {
    const game = new Cazaenganos() as any;
    const participant = {id:'nova', position:[0,0,0], state:'idle', avatar:NPC_AVATARS.nova};
    const slot = {filled:true, claimed:false, age:0, instanceId:1, position:new THREE.Vector3(1,0,0), current:{texto:'Revisa el mensaje antes de disparar.', accionCorrecta:"disparar"}};
    game.slots=[slot]; game.rand=()=>0;
    game.arenaRuntime={getAIControllers:()=>[{participant,controller:{setTarget:vi.fn()},rig:{faceTarget:vi.fn()}}]};
    game.fire=vi.fn();
    for(let i=0;i<69;i++){slot.age+=0.1;game.updateAI(0.1);}
    expect(game.fire).not.toHaveBeenCalled();
    for(let i=0;i<50;i++){slot.age+=0.1;game.updateAI(0.1);}
    expect(game.fire).toHaveBeenCalled();
  });

  it('cancela una lectura si otro jugador gana el objetivo', () => {
    const game = new Cazaenganos() as any;
    const participant = {id:'nova', position:[0,0,0], state:'deciding', avatar:NPC_AVATARS.nova};
    const controller = {setTarget:vi.fn()};
    game.slots=[{filled:false,instanceId:1}];
    game.pendingAiShots=[{participantId:'nova',slotIndex:0,instanceId:1,timeLeft:1}];
    game.arenaRuntime={getAIControllers:()=>[{participant,controller,rig:{}}]};
    game.fire=vi.fn();game.updateAI(0.1);
    expect(game.pendingAiShots).toHaveLength(0);
    expect(participant.state).toBe('idle');
    expect(controller.setTarget).toHaveBeenCalledWith(null);
    expect(game.fire).not.toHaveBeenCalled();
  });
});

import { orderForPodium } from '../src/core/UIManager';
it('el podio conserva a los cuatro participantes cuando hay empate', () => {
  const entries: import("../src/core/ScoreManager").RankingEntry[] = [
    {participantId:'human',name:'A',score:400,rank:1},
    {participantId:'nova',name:'B',score:400,rank:1},
    {participantId:'kiro',name:'C',score:100,rank:3},
    {participantId:'pixel',name:'D',score:0,rank:4}
  ];
  expect(orderForPodium(entries).map(e=>e.participantId).sort()).toEqual(['human','kiro','nova','pixel']);
});

it('el primer giro horizontal no cambia la altura de la cámara', () => {
  const camera = new THREE.PerspectiveCamera();
  const input = {consumeMouseDelta: () => ({dx: 5, dy: 0})};
  const rig = new CameraRig(camera, input as any);
  rig.snapTo(new THREE.Vector3());
  const height = camera.position.y;
  rig.update(1/60, new THREE.Vector3());
  expect(camera.position.y).toBeCloseTo(height, 10);
});

import { CharacterRig } from '../src/world/CharacterRig';
it('al caminar y disparar conserva el rumbo del objetivo durante el retroceso', () => {
  const rig = Object.create(CharacterRig.prototype) as any;
  const root = new THREE.Group();
  rig.character = {root, setHeading: (angle: number) => {root.rotation.y = angle;}, update: vi.fn()};
  rig.participant = {id:'human',state:'running',heading:0,setPosition:vi.fn()};
  rig.physics = {getBody:()=>({interpolatedPosition:{x:0,z:0},velocity:{x:0,z:7.2}})};
  rig.maxSpeed=7.2; rig.lastSpeed01=0; rig.aimTime=0; rig.currentHeading=0;
  rig.faceTarget(new THREE.Vector3(10,0,0));
  for(let i=0;i<15;i++) rig.postStep(1/60);
  expect(root.rotation.y).toBeCloseTo(Math.PI/2);
  for(let i=0;i<60;i++) rig.postStep(1/60);
  expect(root.rotation.y).toBeLessThan(0.1);
});
