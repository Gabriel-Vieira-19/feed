import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import * as THREE from "three";

const WASM = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.3/wasm";
const MODEL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const FACE_VERTICES = 468;
// Índices e coordenadas (cm) da malha canônica do MediaPipe.
const ANCHORS = [
  [4, 0, -0.46317, 7.58658],
  [10, 0, 8.261778, 4.481535],
  [33, -4.445859, 2.663991, 3.173422],
  [152, 0, -9.403378, 4.264492],
  [263, 4.445859, 2.663991, 3.173422],
];

function createDepthMesh() {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(FACE_VERTICES * 3), 3)
    .setUsage(THREE.DynamicDrawUsage));
  const edges = FaceLandmarker.FACE_LANDMARKS_TESSELATION;
  const indices = [];
  for (let i = 0; i < edges.length; i += 3) {
    indices.push(edges[i].start, edges[i].end, edges[i + 1].end);
  }
  geometry.setIndex(indices);
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
    colorWrite: false, depthWrite: true, side: THREE.DoubleSide,
  }));
  mesh.frustumCulled = false;
  mesh.renderOrder = -1;
  return mesh;
}

export class FaceFilterEngine {
  constructor(canvas) {
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, preserveDrawingBuffer: true });
    this.renderer.setClearColor(0x000000, 0);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
    this.head = new THREE.Group();
    this.head.matrixAutoUpdate = false;
    this.depthMesh = createDepthMesh();
    this.scene.add(this.head, this.depthMesh);
    this.effects = new Map();
    this.textureLoader = new THREE.TextureLoader();
    this.point = new THREE.Vector3();
    this.input = document.createElement("canvas");
    this.inputContext = this.input.getContext("2d", { alpha: false });
    this.nextDetection = 0;
    this.reset();
  }

  async loadTracker() {
    const fileset = await FilesetResolver.forVisionTasks(WASM);
    if (this.disposed) return;
    const tracker = await FaceLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MODEL, delegate: "CPU" },
      runningMode: "VIDEO",
      numFaces: 1,
      outputFacialTransformationMatrixes: true,
    });
    if (this.disposed) tracker.close();
    else this.tracker = tracker;
  }

  async loadEffect(effect) {
    this.effect?.removeFromParent();
    this.effect = null;
    this.requestedEffect = effect;
    if (!effect) return;

    if (!this.effects.has(effect.id)) {
      const group = new THREE.Group();
      const ready = Promise.all(effect.parts.map(async part => {
        const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
        const geometry = part.png ? new THREE.PlaneGeometry(...part.size) : new THREE.BoxGeometry(...part.box);
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.fromArray(part.position);
        if (part.rotation) mesh.rotation.fromArray(part.rotation);
        group.add(mesh);
        if (part.png) {
          const texture = await this.textureLoader.loadAsync(part.png);
          if (this.disposed) return texture.dispose();
          texture.colorSpace = THREE.SRGBColorSpace;
          material.map = texture;
          material.transparent = true;
          material.alphaTest = 0.04;
          material.depthWrite = false;
        } else {
          material.color.set(part.color);
        }
      })).then(() => group);
      this.effects.set(effect.id, { group, ready });
    }
    const group = await this.effects.get(effect.id).ready;
    if (!this.disposed && this.requestedEffect === effect) {
      this.head.add(group);
      this.effect = group;
    }
  }

  reset() {
    this.head.visible = false;
    this.depthMesh.visible = false;
    this.lastFrame = undefined;
    this.nextDetection = 0;
    this.renderer.clear();
  }

  track(video, now, frame, force = false) {
    if (!this.effect || !this.tracker || frame === this.lastFrame || (!force && now < this.nextDetection)) return;
    this.lastFrame = frame;
    const scale = Math.min(1, 480 / Math.max(video.videoWidth, video.videoHeight));
    const width = Math.round(video.videoWidth * scale);
    const height = Math.round(video.videoHeight * scale);
    if (this.input.width !== width || this.input.height !== height) {
      this.input.width = width;
      this.input.height = height;
    }
    this.inputContext.drawImage(video, 0, 0, width, height);
    const start = performance.now();
    const result = this.tracker.detectForVideo(this.input, start);
    this.nextDetection = now + Math.max(33, (performance.now() - start) * 3);
    const matrix = result.facialTransformationMatrixes[0]?.data;
    const landmarks = result.faceLandmarks[0];
    this.head.visible = this.depthMesh.visible = !!(matrix && landmarks && this.updatePose(matrix, landmarks, width / height));
  }

  updatePose(matrix, landmarks, aspect) {
    this.head.matrix.fromArray(matrix);
    this.head.matrixWorldNeedsUpdate = true;
    const { point, camera } = this;
    let xx = 0, yy = 0, ux = 0, vy = 0;
    let sx = 0, sy = 0, su = 0, sv = 0;
    let noseDepth;
    for (const [index, x, y, z] of ANCHORS) {
      point.set(x, y, z).applyMatrix4(this.head.matrix);
      const depth = -point.z;
      if (depth <= camera.near) return false;
      if (index === 4) noseDepth = depth;
      const ax = point.x / depth;
      const ay = -point.y / depth;
      const { x: u, y: v } = landmarks[index];
      sx += ax;
      sy += ay;
      su += u;
      sv += v;
      xx += ax * ax;
      ux += u * ax;
      yy += ay * ay;
      vy += v * ay;
    }
    // Ajusta a projeção aos landmarks no frame inteiro, inclusive em retrato.
    const n = ANCHORS.length;
    const fx = THREE.MathUtils.clamp((n * ux - su * sx) / (n * xx - sx * sx), 0.3, 5);
    const fy = THREE.MathUtils.clamp((n * vy - sv * sy) / (n * yy - sy * sy), 0.3 * aspect, 5 * aspect);
    const cx = (su - fx * sx) / n;
    const cy = (sv - fy * sy) / n;
    if (!Number.isFinite(cx) || !Number.isFinite(cy)) return false;
    const { near, far } = camera;
    camera.projectionMatrix.makePerspective(-cx * near / fx, (1 - cx) * near / fx,
      cy * near / fy, (cy - 1) * near / fy, near, far);
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();

    const positions = this.depthMesh.geometry.attributes.position;
    for (let i = 0; i < FACE_VERTICES; i++) {
      const { x, y, z } = landmarks[i];
      const depth = Math.max(near, noseDepth * (1 + (z - landmarks[4].z) / fx));
      positions.setXYZ(i, (x - cx) * depth / fx, (cy - y) * depth / fy, -depth);
    }
    positions.needsUpdate = true;
    return true;
  }

  render(width, height) {
    const { renderer } = this;
    if (renderer.domElement.width !== width || renderer.domElement.height !== height) {
      renderer.setSize(width, height, false);
    }
    renderer.render(this.scene, this.camera);
  }

  get hasEffect() {
    return this.head.visible && !!this.effect;
  }

  dispose() {
    this.disposed = true;
    this.tracker?.close();
    this.depthMesh.geometry.dispose();
    this.depthMesh.material.dispose();
    for (const { group } of this.effects.values()) {
      for (const mesh of group.children) {
        mesh.geometry.dispose();
        mesh.material.map?.dispose();
        mesh.material.dispose();
      }
    }
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}
