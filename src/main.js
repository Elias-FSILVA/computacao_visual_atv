import * as THREE from "three";
import { World } from "./World.js";
import { Player } from "./Player.js";
import { Game } from "./Game.js";

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 500);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const world = new World(scene);
scene.add(camera);

const player = new Player(camera, document.body, world);

const game = new Game(player, world);

if (import.meta.env.DEV) {
  window.__debug = { scene, camera, renderer, world, player, game };
}

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.05);
  const elapsed = clock.elapsedTime;

  if (game.state === "playing") {
    player.update(delta);
  }
  world.update(delta, elapsed);
  game.update(delta);

  renderer.render(scene, camera);
}

animate();
