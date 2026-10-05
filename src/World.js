import * as THREE from "three";

const PLATFORM_COUNT = 42;
const HEIGHT_STEP = 1.75;
const BASE_Y = 2.3;
const ANGLE_STEP = 0.5;
const BASE_RADIUS = 5.5;
const RADIUS_JITTER = 1.4;
const CHECKPOINT_EVERY = 5;

function makeRockTexture() {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#8a7e72";
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 900; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = Math.random() * 3 + 0.5;
    const shade = Math.random() * 60 - 30;
    ctx.fillStyle = `rgba(${90 + shade}, ${80 + shade}, ${70 + shade}, 0.5)`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

function makeGroundTexture() {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#2e4a2f";
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 1400; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const shade = Math.random() * 40 - 20;
    ctx.fillStyle = `rgba(${46 + shade}, ${74 + shade}, ${47 + shade}, 0.6)`;
    ctx.fillRect(x, y, 2, 2);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(40, 40);
  return texture;
}

function buildSky(scene) {
  scene.background = new THREE.Color(0xbcd4f2);
}

function heightColor(fraction) {
  const low = new THREE.Color(0x7a5230);
  const mid = new THREE.Color(0x8d8d8d);
  const high = new THREE.Color(0xe8f1ff);
  if (fraction < 0.5) return low.clone().lerp(mid, fraction / 0.5);
  return mid.clone().lerp(high, (fraction - 0.5) / 0.5);
}

export class World {
  constructor(scene) {
    this.scene = scene;
    this.platforms = [];
    this.checkpoints = [];
    this.finish = null;
    this.rockTexture = makeRockTexture();

    this._buildLights();
    buildSky(scene);
    this._buildGround();
    this._buildCentralColumn();
    this._buildPlatforms();
    this._buildFinish();
    this._buildDecor();
  }

  _buildLights() {
    const hemi = new THREE.HemisphereLight(0xcfe3ff, 0x5a4a38, 1.1);
    this.scene.add(hemi);

    const ambient = new THREE.AmbientLight(0x6b7280, 0.5);
    this.scene.add(ambient);

    const sun = new THREE.DirectionalLight(0xfff3df, 1.3);
    sun.position.set(40, 70, 20);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 200;
    sun.shadow.camera.left = -60;
    sun.shadow.camera.right = 60;
    sun.shadow.camera.top = 60;
    sun.shadow.camera.bottom = -60;
    this.scene.add(sun);

    this.scene.fog = new THREE.Fog(0xbcd4f2, 40, 180);
  }

  _buildGround() {
    const geo = new THREE.PlaneGeometry(400, 400);
    const mat = new THREE.MeshStandardMaterial({ map: makeGroundTexture(), roughness: 1 });
    const ground = new THREE.Mesh(geo, mat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);
  }

  _buildCentralColumn() {
    const topY = PLATFORM_COUNT * HEIGHT_STEP + 4;
    const geo = new THREE.CylinderGeometry(1.4, 1.9, topY, 12, 1, true);
    const mat = new THREE.MeshStandardMaterial({
      map: this.rockTexture,
      roughness: 0.95,
      side: THREE.DoubleSide,
    });
    const column = new THREE.Mesh(geo, mat);
    column.position.y = topY / 2;
    column.castShadow = true;
    column.receiveShadow = true;
    this.scene.add(column);
  }

  _buildPlatforms() {
    for (let i = 0; i < PLATFORM_COUNT; i++) {
      const fraction = i / (PLATFORM_COUNT - 1);
      const angle = i * ANGLE_STEP;
      const radius = BASE_RADIUS + Math.sin(i * 0.9) * RADIUS_JITTER;
      const y = BASE_Y + i * HEIGHT_STEP;
      const width = 2.6 - fraction * 1.1 + (i % 3 === 0 ? 0.4 : 0);
      const depth = width * 0.85;
      const thickness = 0.5;

      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;

      const geo = new THREE.BoxGeometry(width, thickness, depth);
      const mat = new THREE.MeshStandardMaterial({
        map: this.rockTexture,
        color: heightColor(fraction),
        roughness: 0.9,
      });
      const block = new THREE.Mesh(geo, mat);
      block.position.set(x, y, z);
      block.rotation.y = angle + Math.PI / 5;
      block.castShadow = true;
      block.receiveShadow = true;
      this.scene.add(block);

      const halfW = width / 2;
      const halfD = depth / 2;
      const cos = Math.cos(block.rotation.y);
      const sin = Math.sin(block.rotation.y);
      const extent = Math.abs(halfW * cos) + Math.abs(halfD * sin);
      const extentZ = Math.abs(halfW * sin) + Math.abs(halfD * cos);

      this.platforms.push({
        mesh: block,
        minX: x - extent,
        maxX: x + extent,
        minZ: z - extentZ,
        maxZ: z + extentZ,
        top: y + thickness / 2,
        bottom: y - thickness / 2,
        index: i,
      });

      if (i > 0 && i % CHECKPOINT_EVERY === 0) {
        this._addCheckpoint(x, y + 1.6, z, i);
      }
    }
  }

  _addCheckpoint(x, y, z, platformIndex) {
    const geo = new THREE.TorusGeometry(0.55, 0.12, 12, 24);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffd34d,
      emissive: 0xffa500,
      emissiveIntensity: 0.6,
      metalness: 0.4,
      roughness: 0.3,
    });
    const ring = new THREE.Mesh(geo, mat);
    ring.position.set(x, y, z);
    ring.rotation.x = Math.PI / 2;
    this.scene.add(ring);
    this.checkpoints.push({ mesh: ring, x, y, z, collected: false, platformIndex, points: 50 });
  }

  _buildFinish() {
    const i = PLATFORM_COUNT - 1;
    const angle = i * ANGLE_STEP;
    const radius = BASE_RADIUS + Math.sin(i * 0.9) * RADIUS_JITTER;
    const y = BASE_Y + i * HEIGHT_STEP;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;

    const beaconGeo = new THREE.ConeGeometry(0.4, 2.2, 8);
    const beaconMat = new THREE.MeshStandardMaterial({
      color: 0xff4d6d,
      emissive: 0xff2d4d,
      emissiveIntensity: 0.9,
    });
    const beacon = new THREE.Mesh(beaconGeo, beaconMat);
    beacon.position.set(x, y + 2.4, z);
    this.scene.add(beacon);
    this._beacon = beacon;

    const light = new THREE.PointLight(0xff4d6d, 2.5, 12);
    light.position.set(x, y + 3, z);
    this.scene.add(light);

    this.finish = { x, y: y + 1.2, z, radius: 1.2 };
  }

  _buildDecor() {
    const rockGeo = new THREE.IcosahedronGeometry(0.4, 0);
    for (let i = 0; i < this.platforms.length; i += 4) {
      const p = this.platforms[i];
      if (!p) continue;
      const mat = new THREE.MeshStandardMaterial({ map: this.rockTexture, roughness: 1 });
      const rock = new THREE.Mesh(rockGeo, mat);
      const offsetX = (Math.random() - 0.5) * 0.6;
      const offsetZ = (Math.random() - 0.5) * 0.6;
      rock.position.set(p.mesh.position.x + offsetX, p.top + 0.25, p.mesh.position.z + offsetZ);
      rock.rotation.set(Math.random(), Math.random(), Math.random());
      rock.scale.setScalar(0.5 + Math.random() * 0.6);
      rock.castShadow = true;
      this.scene.add(rock);
    }
  }

  update(delta, elapsed) {
    for (const cp of this.checkpoints) {
      if (!cp.collected) {
        cp.mesh.rotation.z += delta * 1.2;
        cp.mesh.position.y = cp.y + Math.sin(elapsed * 2 + cp.x) * 0.08;
      }
    }
    if (this._beacon) {
      this._beacon.rotation.y += delta;
    }
  }

  get spawnPoint() {
    const first = this.platforms[0];
    if (!first) return new THREE.Vector3(BASE_RADIUS, 0, 4);
    return new THREE.Vector3(first.mesh.position.x, 0, first.mesh.position.z + 4);
  }

  get topY() {
    return BASE_Y + (PLATFORM_COUNT - 1) * HEIGHT_STEP;
  }
}
