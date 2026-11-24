import assert from "node:assert/strict";
import { test } from "node:test";
import { Camera, compositePhoto } from "../src/lib/Camera.js";
import { FaceFilterEngine } from "../src/lib/FaceFilterEngine.js";
import { BufferAttribute, Group, PerspectiveCamera, Vector3 } from "three";

test("switching preserves mirroring when the browser returns the same camera without facingMode", async () => {
  const stream = deviceId => ({ getVideoTracks: () => [{ getSettings: () => ({ deviceId }) }] });
  for (const [originalId, nextId, facing, warnings] of [
    ["rear", "rear", "environment", ["Outra câmera não está disponível."]],
    ["rear", "front", "user", []],
    [undefined, undefined, "user", []],
  ]) {
    const errors = [];
    const camera = Object.assign(Object.create(Camera.prototype), {
      facing: "environment",
      stream: stream(originalId),
      async open(requested) {
        this.stream = stream(nextId);
        this.facing = requested;
      },
      onError: message => errors.push(message),
    });

    await camera.switchCamera();
    assert.equal(camera.facing, facing);
    assert.deepEqual(errors, warnings);
  }
});

test("capture encodes both layers at native size using a shared front-camera mirror", async () => {
  const color = {};
  const effects = {};
  for (const mirrored of [true, false]) {
    const calls = [];
    const canvas = {
      getContext: () => ({
        setTransform: (...args) => calls.push(["transform", ...args]),
        drawImage: (...args) => calls.push(["draw", ...args]),
      }),
      toBlob: (callback, type) => callback(new Blob(["jpeg"], { type })),
    };
    const file = await compositePhoto(canvas, color, mirrored ? effects : null, 1080, 1920, mirrored);
    assert.deepEqual([canvas.width, canvas.height], [1080, 1920]);
    assert.deepEqual(calls, mirrored ? [
      ["transform", -1, 0, 0, 1, 1080, 0],
      ["draw", color, 0, 0, 1080, 1920],
      ["draw", effects, 0, 0, 1080, 1920],
    ] : [["draw", color, 0, 0, 1080, 1920]]);
    assert.equal(file.type, "image/jpeg");
    assert.match(file.name, /^foto-\d+\.jpg$/);
    assert.equal(file.size, 4);
  }
});

test("head matrix and projected occlusion follow face landmarks and depth", () => {
  const positions = new BufferAttribute(new Float32Array(468 * 3), 3);
  const engine = Object.assign(Object.create(FaceFilterEngine.prototype), {
    head: new Group(),
    camera: new PerspectiveCamera(),
    point: new Vector3(),
    depthMesh: { geometry: { attributes: { position: positions } } },
  });
  const pose = [
    0.8, 0, -0.6, 0,
    0, 1, 0, 0,
    0.6, 0, 0.8, 0,
    1.5, -2.5, -55, 1,
  ];
  const landmarks = Array.from({ length: 468 }, () => ({ x: 0.5, y: 0.45, z: 0.1 }));
  landmarks[4] = { x: 0.55, y: 0.49, z: -0.08 };
  landmarks[10] = { x: 0.52, y: 0.28, z: 0.03 };
  landmarks[33] = { x: 0.41, y: 0.4, z: 0.06 };
  landmarks[152] = { x: 0.56, y: 0.71, z: 0.02 };
  landmarks[263] = { x: 0.69, y: 0.39, z: 0.02 };

  assert.equal(engine.updatePose(pose, landmarks, 9 / 16), true);
  assert.deepEqual(new Vector3().setFromMatrixPosition(engine.head.matrix).toArray(), [1.5, -2.5, -55]);
  for (const index of [4, 33, 152, 263]) {
    const projected = new Vector3().fromBufferAttribute(positions, index).project(engine.camera);
    assert.ok(Math.abs((projected.x + 1) / 2 - landmarks[index].x) < 1e-6);
    assert.ok(Math.abs((1 - projected.y) / 2 - landmarks[index].y) < 1e-6);
  }
  assert.ok(positions.getZ(4) > positions.getZ(33));
});
