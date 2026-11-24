export const colorPresets = [
  { label: "Original", warmth: 0, contrast: 1, brightness: 0, saturation: 1, fade: 0 },
  { label: "Vintage Festa", warmth: 0.35, contrast: 0.9, brightness: 0.02, saturation: 0.67, fade: 0.13 },
  { label: "Quente/Golden", warmth: 0.74, contrast: 1.07, brightness: 0.035, saturation: 1.12, fade: 0 },
  { label: "Frio/Neon", warmth: -0.63, contrast: 1.23, brightness: 0.025, saturation: 1.34, fade: 0 },
  { label: "P&B Clássico", warmth: 0, contrast: 1.18, brightness: 0, saturation: 0, fade: 0 },
];

const VERTEX = `
attribute vec2 position;
varying vec2 uv;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
  uv = vec2(position.x + 1.0, 1.0 - position.y) * 0.5;
}`;

const FRAGMENT = `
precision mediump float;
uniform sampler2D frame;
uniform vec4 adjustments;
uniform float fade;
varying vec2 uv;
void main() {
  vec3 color = texture2D(frame, uv).rgb;
  float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
  color += adjustments.x * vec3(0.15, 0.033, -0.17) * smoothstep(0.0, 0.35, luma);
  luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
  color = mix(vec3(luma), color, adjustments.w);
  color = (color - 0.5) * adjustments.y + 0.5 + adjustments.z;
  color = mix(color, vec3(0.12, 0.078, 0.041) + color * 0.83, fade);
  gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
}`;

function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const error = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(error);
  }
  return shader;
}

export class ColorPipeline {
  constructor(canvas) {
    this.canvas = canvas;
    const gl = canvas.getContext("webgl", { alpha: false, antialias: false, depth: false });
    if (!gl) throw new Error("Este navegador não conseguiu iniciar a câmera com filtros.");
    this.gl = gl;
    const vertex = compileShader(gl, gl.VERTEX_SHADER, VERTEX);
    const fragment = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT);
    this.program = gl.createProgram();
    gl.attachShader(this.program, vertex);
    gl.attachShader(this.program, fragment);
    gl.linkProgram(this.program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(this.program));
    }
    gl.useProgram(this.program);
    this.adjustments = gl.getUniformLocation(this.program, "adjustments");
    this.fade = gl.getUniformLocation(this.program, "fade");

    this.buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(this.program, "position");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    this.texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  render(video, width, height, preset, sliders) {
    const { canvas, gl } = this;
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);
    }
    if (this.videoWidth !== video.videoWidth || this.videoHeight !== video.videoHeight) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
      this.videoWidth = video.videoWidth;
      this.videoHeight = video.videoHeight;
    } else {
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, video);
    }
    gl.uniform4f(this.adjustments, preset.warmth + sliders.warmth,
      preset.contrast + sliders.contrast, preset.brightness + sliders.brightness, preset.saturation);
    gl.uniform1f(this.fade, preset.fade);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  dispose() {
    const { gl } = this;
    gl.deleteTexture(this.texture);
    gl.deleteBuffer(this.buffer);
    gl.deleteProgram(this.program);
    gl.getExtension("WEBGL_lose_context")?.loseContext();
  }
}
