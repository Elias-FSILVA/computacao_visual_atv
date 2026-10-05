import * as THREE from "three";
import { PointerLockControls } from "three/addons/controls/PointerLockControls.js";

const GRAVITY = 22;
const JUMP_SPEED = 11.8;
const MOVE_ACCEL = 28;
const MOVE_DAMP = 8;
const MAX_SPEED = 6.2;
const PLAYER_HEIGHT = 1.7;
const PLAYER_RADIUS = 0.35;
const COLUMN_RADIUS = 1.9 + PLAYER_RADIUS;

const HANDLED_CODES = new Set([
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Space",
]);

export class Player {
  constructor(camera, domElement, world) {
    this.world = world;
    this.controls = new PointerLockControls(camera, domElement);
    this.camera = camera;

    this.velocity = new THREE.Vector3();
    this.position = world.spawnPoint;
    this.grounded = false;
    this.fellOff = false;

    this.input = { forward: false, back: false, left: false, right: false, jump: false };
    this.maxHeightReached = this.position.y;

    this._forward = new THREE.Vector3();
    this._right = new THREE.Vector3();
    this._worldUp = new THREE.Vector3(0, 1, 0);

    this._bindKeys();
    this._syncCamera();
  }

  _bindKeys() {
    this._onKeyDown = (e) => {
      if (HANDLED_CODES.has(e.code)) e.preventDefault();
      this._setKey(e.code, true);
    };
    this._onKeyUp = (e) => this._setKey(e.code, false);
    document.addEventListener("keydown", this._onKeyDown);
    document.addEventListener("keyup", this._onKeyUp);
  }

  dispose() {
    document.removeEventListener("keydown", this._onKeyDown);
    document.removeEventListener("keyup", this._onKeyUp);
  }

  _setKey(code, pressed) {
    switch (code) {
      case "KeyW":
      case "ArrowUp":
        this.input.forward = pressed;
        break;
      case "KeyS":
      case "ArrowDown":
        this.input.back = pressed;
        break;
      case "KeyA":
      case "ArrowLeft":
        this.input.left = pressed;
        break;
      case "KeyD":
      case "ArrowRight":
        this.input.right = pressed;
        break;
      case "Space":
        this.input.jump = pressed;
        break;
    }
  }

  reset() {
    this.position.copy(this.world.spawnPoint);
    this.velocity.set(0, 0, 0);
    this.grounded = false;
    this.fellOff = false;
    this.maxHeightReached = this.position.y;
    this._syncCamera();
  }

  respawnAt(point) {
    this.position.copy(point);
    this.velocity.set(0, 0, 0);
    this.grounded = false;
    this._syncCamera();
  }

  _syncCamera() {
    this.camera.position.set(this.position.x, this.position.y + PLAYER_HEIGHT, this.position.z);
  }

  update(delta) {
    this.camera.getWorldDirection(this._forward);
    this._forward.y = 0;
    if (this._forward.lengthSq() < 1e-6) this._forward.set(0, 0, -1);
    this._forward.normalize();
    this._right.crossVectors(this._forward, this._worldUp).normalize();

    const wish = new THREE.Vector3();
    if (this.input.forward) wish.add(this._forward);
    if (this.input.back) wish.sub(this._forward);
    if (this.input.right) wish.add(this._right);
    if (this.input.left) wish.sub(this._right);
    if (wish.lengthSq() > 0) wish.normalize();

    this.velocity.x += wish.x * MOVE_ACCEL * delta;
    this.velocity.z += wish.z * MOVE_ACCEL * delta;

    const horizSpeed = Math.hypot(this.velocity.x, this.velocity.z);
    if (horizSpeed > MAX_SPEED) {
      const scale = MAX_SPEED / horizSpeed;
      this.velocity.x *= scale;
      this.velocity.z *= scale;
    }

    const damp = Math.max(0, 1 - MOVE_DAMP * delta);
    this.velocity.x *= damp;
    this.velocity.z *= damp;

    if (this.input.jump && this.grounded) {
      this.velocity.y = JUMP_SPEED;
      this.grounded = false;
    }

    this.velocity.y -= GRAVITY * delta;
    if (this.velocity.y < -40) this.velocity.y = -40;

    const prevY = this.position.y;
    this.position.x += this.velocity.x * delta;
    this.position.z += this.velocity.z * delta;
    this._resolveColumn();

    this.position.y += this.velocity.y * delta;
    this.grounded = false;
    this._resolvePlatforms(prevY);

    if (this.position.y <= 0.001 && this.velocity.y <= 0) {
      this.position.y = 0;
      this.velocity.y = 0;
      this.grounded = true;
    }

    if (this.position.y > this.maxHeightReached) {
      this.maxHeightReached = this.position.y;
    }

    if (this.position.y < -8) {
      this.fellOff = true;
    }

    this._syncCamera();
  }

  _resolveColumn() {
    const dist = Math.hypot(this.position.x, this.position.z);
    if (dist < COLUMN_RADIUS && dist > 0.0001) {
      const scale = COLUMN_RADIUS / dist;
      this.position.x *= scale;
      this.position.z *= scale;
    }
  }

  _resolvePlatforms(prevY) {
    const feet = this.position.y;
    const prevFeet = prevY;

    for (const p of this.world.platforms) {
      const overlapX = this.position.x + PLAYER_RADIUS > p.minX && this.position.x - PLAYER_RADIUS < p.maxX;
      const overlapZ = this.position.z + PLAYER_RADIUS > p.minZ && this.position.z - PLAYER_RADIUS < p.maxZ;
      if (!overlapX || !overlapZ) continue;

      const fallingOntoTop = this.velocity.y <= 0 && prevFeet >= p.top - 0.1 && feet <= p.top + 0.4;
      if (fallingOntoTop) {
        this.position.y = p.top;
        this.velocity.y = 0;
        this.grounded = true;
      }
    }
  }
}
