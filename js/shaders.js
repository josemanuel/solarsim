/**
 * shaders.js — Código GLSL completo del Sistema Solar (Three.js)
 * Autor: José Manuel Fernández Carreira
 *
 * Módulos:
 *  - NOISE_GLSL / VERT_FULL : superficies procedurales
 *  - ATMOSPHERE_*           : atmósfera terrestre
 *  - SOLAR_CORONA_*         : corona del Sol (3 capas)
 *  - ECLIPSE_SHADOW_*       : umbra / penumbra
 *  - BAILY_CORONA_*         : corona de totalidad + efecto Baily
 *  - CLOUD_TEX_*            : nubes dinámicas con textura
 */

// ═══════════════════════════════════════════════════════════════
// Ruido Simplex 3D + FBM + bump + iluminación
// ═══════════════════════════════════════════════════════════════
export const NOISE_GLSL = /* glsl */ `
// ── Simplex 3D noise (Ashima / Ian McEwan) ──────────────────
vec3 mod289(vec3 x){ return x - floor(x * (1.0/289.0)) * 289.0; }
vec4 mod289(vec4 x){ return x - floor(x * (1.0/289.0)) * 289.0; }
vec4 permute(vec4 x){ return mod289(((x*34.0)+1.0)*x); }
vec4 taylorInvSqrt(vec4 r){ return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v){
  const vec2 C = vec2(1.0/6.0, 1.0/3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i  = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g  = step(x0.yzx, x0.xyz);
  vec3 l  = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(
            i.z + vec4(0.0, i1.z, i2.z, 1.0))
          + i.y + vec4(0.0, i1.y, i2.y, 1.0))
          + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3  ns = n_ * D.wyz - D.xzx;
  vec4  j  = p - 49.0 * floor(p * ns.z * ns.z);
  vec4  x_ = floor(j * ns.z);
  vec4  y_ = floor(j - 7.0 * x_);
  vec4  x  = x_ * ns.x + ns.yyyy;
  vec4  y  = y_ * ns.x + ns.yyyy;
  vec4  h  = 1.0 - abs(x) - abs(y);
  vec4  b0 = vec4(x.xy, y.xy);
  vec4  b1 = vec4(x.zw, y.zw);
  vec4  s0 = floor(b0) * 2.0 + 1.0;
  vec4  s1 = floor(b1) * 2.0 + 1.0;
  vec4  sh = -step(h, vec4(0.0));
  vec4  a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4  a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3  p0 = vec3(a0.xy, h.x);
  vec3  p1 = vec3(a0.zw, h.y);
  vec3  p2 = vec3(a1.xy, h.z);
  vec3  p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}

float fbm(vec3 p, int oct){
  float v = 0.0, a = 0.5;
  mat3 m = mat3(0.00, 0.80, 0.60, -0.80, 0.36, -0.48, -0.60, -0.48, 0.64);
  for(int i = 0; i < 8; i++){
    if(i >= oct) break;
    v += a * snoise(p);
    p = m * p * 2.0;
    a *= 0.5;
  }
  return v;
}

// Normales por ruido (bump mapping procedural)
vec3 bumpNormal(vec3 p, vec3 N, float scale, float strength){
  float eps = 0.01;
  float n0 = fbm(p * scale, 4);
  float nx = fbm((p + vec3(eps,0.0,0.0)) * scale, 4);
  float ny = fbm((p + vec3(0.0,eps,0.0)) * scale, 4);
  float nz = fbm((p + vec3(0.0,0.0,eps)) * scale, 4);
  vec3 grad = vec3(nx - n0, ny - n0, nz - n0) / eps;
  return normalize(N - grad * strength);
}

// Iluminación Lambert + Blinn-Phong + ambient
vec3 lightSurface(vec3 albedo, vec3 N, vec3 L, vec3 V, float shininess, float specStr){
  float ndl = max(dot(N, L), 0.0);
  vec3  H   = normalize(L + V);
  float ndh = max(dot(N, H), 0.0);
  float spec = pow(ndh, shininess) * specStr * ndl;
  vec3 ambient = albedo * 0.08;
  return ambient + albedo * ndl + vec3(spec);
}
`;

// ═══════════════════════════════════════════════════════════════
// Vertex shader genérico (superficies procedurales)
// ═══════════════════════════════════════════════════════════════
export const VERT_FULL = /* glsl */ `
varying vec3 vPos;       // posición local (esfera unitaria ~)
varying vec3 vNormal;    // normal en view space
varying vec3 vWorldPos;  // posición mundo
varying vec3 vViewDir;   // dirección hacia la cámara (view space)

void main(){
  vPos = position;
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vWorldPos = worldPos.xyz;
  vNormal = normalize(normalMatrix * normal);
  vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
  vViewDir = normalize(-mvPos.xyz);
  gl_Position = projectionMatrix * mvPos;
}
`;

// ═══════════════════════════════════════════════════════════════
// Atmósfera terrestre (Fresnel + día/noche + atardecer)
// ═══════════════════════════════════════════════════════════════
export const ATMOSPHERE_VERT = /* glsl */ `
varying vec3 vNormalW;
varying vec3 vPosW;
void main() {
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vPosW = worldPos.xyz;
  vNormalW = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

export const ATMOSPHERE_FRAG = /* glsl */ `
precision highp float;
varying vec3 vNormalW;
varying vec3 vPosW;
uniform vec3 uLightDir;
uniform vec3 uCamPos;
uniform float uIntensity;

void main() {
  vec3 N = normalize(vNormalW);
  vec3 V = normalize(uCamPos - vPosW);
  vec3 L = normalize(uLightDir);

  float fresnel = pow(1.0 - max(dot(N, V), 0.0), 2.8);
  fresnel = smoothstep(0.05, 1.0, fresnel);

  float ndl = dot(N, L);
  float day = smoothstep(-0.15, 0.35, ndl);

  vec3 dayCol = vec3(0.25, 0.55, 1.0);
  float term = exp(-pow(ndl * 3.5, 2.0));
  vec3 sunsetCol = vec3(1.0, 0.45, 0.18);
  vec3 nightCol = vec3(0.05, 0.08, 0.22);

  vec3 atmos = mix(nightCol, dayCol, day);
  atmos = mix(atmos, sunsetCol, term * 0.85 * day);

  float alpha = fresnel * mix(0.15, 1.0, day * 0.7 + 0.3) * uIntensity;
  alpha += term * fresnel * 0.35 * uIntensity;

  gl_FragColor = vec4(atmos, clamp(alpha, 0.0, 0.95));
}
`;

// ═══════════════════════════════════════════════════════════════
// Corona solar (streamers, capas)
// ═══════════════════════════════════════════════════════════════
export const SOLAR_CORONA_VERT = /* glsl */ `
varying vec2 vUv;
varying vec3 vNormalW;
varying vec3 vViewDir;
void main() {
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vNormalW = normalize(mat3(modelMatrix) * normal);
  vViewDir = normalize(cameraPosition - wp.xyz);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

export const SOLAR_CORONA_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
varying vec3 vNormalW;
varying vec3 vViewDir;
uniform float uTime;
uniform float uIntensity;
uniform float uRayCount;
uniform float uLayer;

float hash(float n) { return fract(sin(n) * 43758.5453); }

void main() {
  vec3 N = normalize(vNormalW);
  vec3 V = normalize(vViewDir);
  float fres = pow(1.0 - max(dot(N, V), 0.0), 1.8 + uLayer * 0.6);

  float ang = atan(N.z, N.x);
  float polar = N.y;

  float rays = 0.0;
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float speed = 0.15 + fi * 0.08;
    float count = uRayCount + fi * 3.0;
    float phase = uTime * speed + fi * 1.7;
    float r = pow(abs(sin(ang * count * 0.5 + phase + polar * 2.0)), 3.0 + fi);
    float latFade = 1.0 - abs(polar) * 0.55;
    rays += r * latFade * (0.5 - fi * 0.12);
  }

  float turb = hash(floor(ang * 40.0 + uTime * 2.0) + floor(polar * 20.0));
  rays = mix(rays, rays * (0.7 + turb * 0.6), 0.4);

  vec3 inner = vec3(1.0, 0.75, 0.25);
  vec3 mid   = vec3(1.0, 0.9, 0.65);
  vec3 outer = vec3(0.75, 0.88, 1.0);
  vec3 col = mix(inner, mid, clamp(uLayer * 0.45, 0.0, 1.0));
  col = mix(col, outer, clamp(uLayer * 0.35 + fres * 0.3, 0.0, 1.0));

  float alpha = fres * (0.35 + rays * 0.85) * uIntensity;
  alpha *= smoothstep(0.0, 0.15, fres);

  gl_FragColor = vec4(col, clamp(alpha, 0.0, 0.9));
}
`;

// ═══════════════════════════════════════════════════════════════
// Sombra de eclipse (umbra + penumbra)
// ═══════════════════════════════════════════════════════════════
export const ECLIPSE_SHADOW_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const ECLIPSE_SHADOW_FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform float uUmbra;
  uniform float uPenumbra;
  uniform float uIntensity;
  uniform vec3 uUmbraColor;
  uniform vec3 uPenumbraColor;

  void main() {
    // Coordenadas centradas [-1,1]
    vec2 p = vUv * 2.0 - 1.0;
    float r = length(p);
    if (r > 1.0) discard;

    // Radios normalizados dentro del disco (penumbra llega al borde)
    float umbraR = clamp(uUmbra, 0.05, 0.95);
    float penR = max(uPenumbra, umbraR + 0.02);

    float alpha = 0.0;
    vec3 col = uUmbraColor;

    if (r <= umbraR) {
      // Núcleo de umbra: casi negro, borde suave
      float edge = smoothstep(umbraR, umbraR * 0.72, r);
      alpha = mix(0.92, 0.78, edge) * uIntensity;
      col = mix(uUmbraColor, uPenumbraColor * 0.35, edge * 0.4);
    } else if (r <= penR) {
      // Penumbra: degradado radial suave
      float t = smoothstep(penR, umbraR, r);
      alpha = mix(0.0, 0.55, t) * uIntensity;
      col = mix(uPenumbraColor, uUmbraColor * 0.6, t * 0.7);
      // Ligera irregularidad en el borde (más natural)
      float grain = sin(r * 40.0 + p.x * 12.0) * 0.03;
      alpha = clamp(alpha + grain * t, 0.0, 0.7);
    } else {
      // Halo exterior muy suave
      float t = smoothstep(1.0, penR, r);
      alpha = 0.12 * t * uIntensity;
      col = uPenumbraColor * 0.5;
    }

    // Viñeta circular suave en el límite del disco
    alpha *= smoothstep(1.0, 0.88, r);

    gl_FragColor = vec4(col, alpha);
  }
`;

// ═══════════════════════════════════════════════════════════════
// Corona de totalidad (efecto Baily / streamers)
// ═══════════════════════════════════════════════════════════════
export const BAILY_CORONA_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const BAILY_CORONA_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform float uIntensity;
uniform float uTime;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float r = length(p);
  float ang = atan(p.y, p.x);

  if (r < 0.42) discard;

  float k = smoothstep(0.42, 0.55, r) * (1.0 - smoothstep(0.55, 0.85, r));

  float streamers = 0.0;
  streamers += pow(abs(sin(ang * 6.0 + uTime * 0.12)), 5.0) * 0.7;
  streamers += pow(abs(sin(ang * 11.0 - uTime * 0.18 + 1.3)), 6.0) * 0.5;
  streamers += pow(abs(sin(ang * 17.0 + uTime * 0.09)), 8.0) * 0.35;
  float eq = 1.0 - abs(p.y) * 0.8;
  streamers *= eq * 0.7 + 0.3;

  float polar = pow(abs(p.y), 1.8);
  float plumes = pow(abs(sin(ang * 4.0 + uTime * 0.1)), 3.0) * polar * 0.6;

  float fhalo = smoothstep(0.7, 0.5, r) * (1.0 - smoothstep(0.85, 1.15, r)) * 0.35;

  float turb = hash(floor(p * 30.0 + uTime)) * 0.15;
  float a = (k * 0.75 + k * streamers * 0.9 + plumes * 0.5 + fhalo) * uIntensity;
  a = a * (0.9 + turb) * smoothstep(1.2, 0.5, r);

  vec3 colK = vec3(1.0, 0.95, 0.75);
  vec3 colStream = vec3(0.85, 0.92, 1.0);
  vec3 col = mix(colK, colStream, clamp(streamers * 0.4 + polar * 0.3, 0.0, 1.0));

  gl_FragColor = vec4(col, clamp(a, 0.0, 0.95));
}
`;

// ═══════════════════════════════════════════════════════════════
// Nubes dinámicas (textura + viento UV)
// ═══════════════════════════════════════════════════════════════
export const CLOUD_TEX_VERT = /* glsl */ `
varying vec2 vUv;
varying vec3 vNormalW;
varying vec3 vPosW;
void main() {
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vPosW = wp.xyz;
  vNormalW = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

export const CLOUD_TEX_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D uMap;
uniform float uTime;
uniform vec3 uLightDir;
uniform float uOpacity;
varying vec2 vUv;
varying vec3 vNormalW;
varying vec3 vPosW;

void main() {
  vec2 uv1 = vUv + vec2(uTime * 0.0035, uTime * 0.0008);
  vec2 uv2 = vUv * 1.05 + vec2(-uTime * 0.0022, uTime * 0.0011);

  vec4 t1 = texture2D(uMap, uv1);
  vec4 t2 = texture2D(uMap, fract(uv2));

  float d1 = max(t1.r, max(t1.g, t1.b));
  float d2 = max(t2.r, max(t2.g, t2.b));
  float dens = max(d1 * 0.85, d2 * 0.55);
  dens = max(dens, t1.a * 0.9);

  float alpha = smoothstep(0.15, 0.55, dens) * uOpacity;

  vec3 N = normalize(vNormalW);
  vec3 L = normalize(uLightDir);
  float ndl = max(dot(N, L), 0.0);
  float day = smoothstep(-0.05, 0.4, ndl);
  float term = exp(-pow(ndl * 4.0, 2.0));

  vec3 col = mix(vec3(0.5, 0.52, 0.58), vec3(1.0), day);
  col = mix(col, vec3(1.0, 0.72, 0.5), term * 0.45);
  alpha *= mix(0.2, 1.0, day * 0.85 + 0.15);

  if (alpha < 0.02) discard;
  gl_FragColor = vec4(col, alpha);
}
`;
