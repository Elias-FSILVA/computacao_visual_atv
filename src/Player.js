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

const HAND_BASE_Y = -0.28;
const HAND_BASE_Z = -0.35;
const WALL_CONTACT_MARGIN = 0.6;

const SPRINT_RAMP_TIME = 0.8;
const SPRINT_DECAY_TIME = 0.9;
const SPRINT_SPEED_MULT = 3;
const SPRINT_FOV_BOOST = 18;

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

    this.input = { forward: false, back: false, left: false, right: false, jump: false, sprint: false };
    this.maxHeightReached = this.position.y;
    this._baseFov = camera.fov;
    this._sprintFactor = 0;

    this._forward = new THREE.Vector3();
    this._right = new THREE.Vector3();
    this._worldUp = new THREE.Vector3(0, 1, 0);

    this._handTime = 0;
    this._buildHands();

    this._bindKeys();
    this._syncCamera();
  }

  _buildHands() {
    const mat = new THREE.MeshStandardMaterial({ color: 0xcf9d7c, roughness: 0.6 });

    const makeArm = (side) => {
      const arm = new THREE.Group();

      const forearm = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.32, 4, 8), mat);
      forearm.rotation.x = -Math.PI / 2.4;
      forearm.position.set(0, 0.04, -0.16);
      arm.add(forearm);

      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), mat);
      hand.position.set(0, -0.02, -0.34);
      hand.scale.set(1, 0.85, 1.3);
      arm.add(hand);

      arm.position.set(side * 0.22, HAND_BASE_Y, HAND_BASE_Z);
      arm.rotation.z = side * 0.15;
      return arm;
    };

    this.leftArm = makeArm(-1);
    this.rightArm = makeArm(1);

    const handGroup = new THREE.Group();
    handGroup.add(this.leftArm, this.rightArm);
    handGroup.frustumCulled = false;
    this.camera.add(handGroup);
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
      case "ShiftLeft":
      case "ShiftRight":
        this.input.sprint = pressed;
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
    const wantsMove = wish.lengthSq() > 0;
    if (wantsMove) wish.normalize();

    const sprinting = this.input.sprint && wantsMove && this.grounded;
    this._sprintFactor = sprinting
      ? Math.min(1, this._sprintFactor + delta / SPRINT_RAMP_TIME)
      : Math.max(0, this._sprintFactor - delta / SPRINT_DECAY_TIME);

    const sprintBoost = 1 + this._sprintFactor * (SPRINT_SPEED_MULT - 1);
    const currentMaxSpeed = MAX_SPEED * sprintBoost;
    const currentAccel = MOVE_ACCEL * sprintBoost;

    this.velocity.x += wish.x * currentAccel * delta;
    this.velocity.z += wish.z * currentAccel * delta;

    const horizSpeed = Math.hypot(this.velocity.x, this.velocity.z);
    if (horizSpeed > currentMaxSpeed) {
      const scale = currentMaxSpeed / horizSpeed;
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
    this._updateHands(delta, horizSpeed);
    this._updateSpeedFov();
  }

  _updateSpeedFov() {
    this.camera.fov = this._baseFov + this._sprintFactor * SPRINT_FOV_BOOST;
    this.camera.updateProjectionMatrix();
  }

  _updateHands(delta, horizSpeed) {
    this._handTime += delta;

    // Nenhuma mecânica de escalada ainda: usamos a proximidade da coluna
    // central como "mão na parede" provisória para simular o alcance.
    const distToColumn = Math.hypot(this.position.x, this.position.z);
    const touchingWall = distToColumn < COLUMN_RADIUS + WALL_CONTACT_MARGIN;

    let targetLY = HAND_BASE_Y;
    let targetLZ = HAND_BASE_Z;
    let targetRY = HAND_BASE_Y;
    let targetRZ = HAND_BASE_Z;
    let lerpSpeed = 6;

    if (touchingWall) {
      const cycle = this._handTime * 3.2;
      targetLY = HAND_BASE_Y + Math.sin(cycle) * 0.07;
      targetLZ = HAND_BASE_Z - Math.max(0, Math.sin(cycle)) * 0.1;
      targetRY = HAND_BASE_Y + Math.sin(cycle + Math.PI) * 0.07;
      targetRZ = HAND_BASE_Z - Math.max(0, Math.sin(cycle + Math.PI)) * 0.1;
      lerpSpeed = 10;
    } else if (this.grounded && horizSpeed > 0.3) {
      const cycle = this._handTime * 9;
      targetLY = HAND_BASE_Y + Math.sin(cycle) * 0.025;
      targetRY = HAND_BASE_Y + Math.sin(cycle + Math.PI) * 0.025;
      lerpSpeed = 10;
    }

    const t = Math.min(1, delta * lerpSpeed);
    this.leftArm.position.y += (targetLY - this.leftArm.position.y) * t;
    this.leftArm.position.z += (targetLZ - this.leftArm.position.z) * t;
    this.rightArm.position.y += (targetRY - this.rightArm.position.y) * t;
    this.rightArm.position.z += (targetRZ - this.rightArm.position.z) * t;
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
