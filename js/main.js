import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import {
  NOISE_GLSL,
  VERT_FULL,
  ATMOSPHERE_VERT,
  ATMOSPHERE_FRAG,
  SOLAR_CORONA_VERT,
  SOLAR_CORONA_FRAG,
  ECLIPSE_SHADOW_VERT,
  ECLIPSE_SHADOW_FRAG,
  CLOUD_TEX_VERT,
  CLOUD_TEX_FRAG
} from './shaders.js';

// ─────────────────────────────────────────────────────────────
// Escala de escena
// 1 unidad = 1 AU (para distancias orbitales)
// Radios planetarios exagerados para visibilidad (factor ~ 200-800)
const AU = 1;
// Radios en km → unidades de escena (AU). Exageración ~800× para visibilidad
const SIZE_SCALE = 800 / 149597870;

// ─────────────────────────────────────────────────────────────
// Datos Keplerianos aproximados (JPL, válidos ~1800-2050)
// a (AU), e, i (deg), L0 (deg), ϖ (deg), Ω (deg), rates por siglo
// Periodo orbital sidéreo en días terrestres
const PLANET_DATA = {
  mercury: {
    name: 'Mercurio',
    a: 0.38709927, e: 0.20563593, i: 7.00497902,
    L0: 252.25032350, varpi: 77.45779628, Omega: 48.33076593,
    period: 87.969, radiusKm: 2439.7, tilt: 0.034,
    rotationPeriod: 58.646,
    color: 0xb5b5b5,
    type: 'rocky',
    tex: 'textures/2k_mercury.jpg'
  },
  venus: {
    name: 'Venus',
    a: 0.72333566, e: 0.00677672, i: 3.39467605,
    L0: 181.97909950, varpi: 131.60246718, Omega: 76.67984255,
    period: 224.701, radiusKm: 6051.8, tilt: 177.36,
    rotationPeriod: -243.025,
    color: 0xe6c89c,
    type: 'venus',
    tex: 'textures/2k_venus_surface.jpg'
  },
  earth: {
    name: 'Tierra',
    a: 1.00000261, e: 0.01671123, i: -0.00001531,
    L0: 100.46457166, varpi: 102.93768193, Omega: 0.0,
    period: 365.256, radiusKm: 6371.0, tilt: 23.44,
    rotationPeriod: 0.997269,
    color: 0x2a6bb5,
    type: 'earth',
    tex: 'textures/2k_earth_daymap.jpg',
    clouds: 'textures/2k_earth_clouds.jpg'
  },
  mars: {
    name: 'Marte',
    a: 1.52371034, e: 0.09339410, i: 1.84969142,
    L0: -4.55343205, varpi: -23.94362959, Omega: 49.55953891,
    period: 686.980, radiusKm: 3389.5, tilt: 25.19,
    rotationPeriod: 1.025957,
    color: 0xc1440e,
    type: 'mars',
    tex: 'textures/2k_mars.jpg'
  },
  jupiter: {
    name: 'Júpiter',
    a: 5.20288700, e: 0.04838624, i: 1.30439695,
    L0: 34.39644051, varpi: 14.72847983, Omega: 100.47390909,
    period: 4332.59, radiusKm: 69911, tilt: 3.13,
    rotationPeriod: 0.41354,
    color: 0xc88b3a,
    type: 'gas',
    tex: 'textures/2k_jupiter.jpg'
  },
  saturn: {
    name: 'Saturno',
    a: 9.53667594, e: 0.05386179, i: 2.48599187,
    L0: 49.95424423, varpi: 92.59887831, Omega: 113.66242448,
    period: 10759.22, radiusKm: 58232, tilt: 26.73,
    rotationPeriod: 0.44401,
    color: 0xe4d191,
    type: 'gas',
    hasRings: true,
    tex: 'textures/2k_saturn.jpg',
    ring: 'textures/2k_saturn_ring_alpha.png'
  },
  uranus: {
    name: 'Urano',
    a: 19.18916464, e: 0.04725744, i: 0.77263783,
    L0: 313.23810451, varpi: 170.95427630, Omega: 74.01692503,
    period: 30688.5, radiusKm: 25362, tilt: 97.77,
    rotationPeriod: -0.71833,
    color: 0x9db4c0,
    type: 'ice',
    tex: 'textures/2k_uranus.jpg'
  },
  neptune: {
    name: 'Neptuno',
    a: 30.06992276, e: 0.00859048, i: 1.77004347,
    L0: -55.12002969, varpi: 44.96476227, Omega: 131.78405702,
    period: 60182, radiusKm: 24622, tilt: 28.32,
    rotationPeriod: 0.67125,
    color: 0x3f54ba,
    type: 'ice',
    tex: 'textures/2k_neptune.jpg'
  }
};

// Lunas principales (órbitas circulares simplificadas relativas al planeta)
const MOON_DATA = {
  moon: {
    parent: 'earth', name: 'Luna',
    a: 0.00257, period: 27.321661, radiusKm: 1737.4, tilt: 6.68,
    color: 0xaaaaaa, type: 'moon',
    tex: 'textures/2k_moon.jpg'
  },
  phobos: {
    parent: 'mars', name: 'Fobos',
    a: 0.0000627, period: 0.31891, radiusKm: 11.3, color: 0x888888, type: 'rocky'
  },
  deimos: {
    parent: 'mars', name: 'Deimos',
    a: 0.0001568, period: 1.26244, radiusKm: 6.2, color: 0x777777, type: 'rocky'
  },
  io: {
    parent: 'jupiter', name: 'Ío',
    a: 0.002819, period: 1.769, radiusKm: 1821.6, color: 0xf4d03f, type: 'io'
  },
  europa: {
    parent: 'jupiter', name: 'Europa',
    a: 0.004486, period: 3.551, radiusKm: 1560.8, color: 0xd5c4a1, type: 'ice'
  },
  ganymede: {
    parent: 'jupiter', name: 'Ganímedes',
    a: 0.007155, period: 7.155, radiusKm: 2634.1, color: 0xb0a090, type: 'rocky'
  },
  callisto: {
    parent: 'jupiter', name: 'Calisto',
    a: 0.012585, period: 16.69, radiusKm: 2410.3, color: 0x6b5b4b, type: 'rocky'
  },
  titan: {
    parent: 'saturn', name: 'Titán',
    a: 0.008168, period: 15.945, radiusKm: 2574.7, color: 0xd4a574, type: 'titan'
  },
  enceladus: {
    parent: 'saturn', name: 'Encélado',
    a: 0.001591, period: 1.370, radiusKm: 252.1, color: 0xeeeeff, type: 'ice'
  },
  triton: {
    parent: 'neptune', name: 'Tritón',
    a: 0.002371, period: -5.877, radiusKm: 1353.4, color: 0xc0d0e0, type: 'ice'
  }
};

// ─────────────────────────────────────────────────────────────
// Utilidades de tiempo y Kepler
function julianDate(date) {
  // JD desde Date de JS
  return date.getTime() / 86400000 + 2440587.5;
}

function centuriesSinceJ2000(jd) {
  return (jd - 2451545.0) / 36525.0;
}

function deg2rad(d) { return d * Math.PI / 180; }
function rad2deg(r) { return r * 180 / Math.PI; }
function mod360(x) { return ((x % 360) + 360) % 360; }

// Resuelve la ecuación de Kepler (E - e sin E = M) con Newton-Raphson
function solveKepler(M, e, tol = 1e-8) {
  let E = e < 0.8 ? M : Math.PI;
  for (let i = 0; i < 30; i++) {
    const dE = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    E -= dE;
    if (Math.abs(dE) < tol) break;
  }
  return E;
}

// Posición heliocéntrica eclíptica (AU) a partir de elementos
function keplerPosition(data, T) {
  // Elementos a la época T (siglos desde J2000)
  // Usamos valores medios aproximados (sin rates para simplificar, suficiente para visualización)
  const a = data.a;
  const e = data.e;
  const i = deg2rad(data.i);
  const L = deg2rad(mod360(data.L0 + (360 / data.period) * (T * 36525))); // approx mean longitude
  // Mejor: usar mean anomaly
  const n = 360 / data.period; // deg/día
  const daysSinceJ2000 = T * 36525;
  const M0 = mod360(data.L0 - data.varpi); // mean anomaly at epoch approx
  const M = deg2rad(mod360(M0 + n * daysSinceJ2000));
  const E = solveKepler(M, e);
  const nu = 2 * Math.atan2(
    Math.sqrt(1 + e) * Math.sin(E / 2),
    Math.sqrt(1 - e) * Math.cos(E / 2)
  );
  const r = a * (1 - e * Math.cos(E));
  const Omega = deg2rad(data.Omega);
  const omega = deg2rad(data.varpi - data.Omega); // argument of periapsis

  // Coordenadas en plano orbital
  const x_orb = r * Math.cos(nu);
  const y_orb = r * Math.sin(nu);

  // Rotación a eclíptica
  const cosO = Math.cos(Omega), sinO = Math.sin(Omega);
  const cosi = Math.cos(i), sini = Math.sin(i);
  const cosw = Math.cos(omega), sinw = Math.sin(omega);

  const x = (cosO * cosw - sinO * sinw * cosi) * x_orb + (-cosO * sinw - sinO * cosw * cosi) * y_orb;
  const y = (sinO * cosw + cosO * sinw * cosi) * x_orb + (-sinO * sinw + cosO * cosw * cosi) * y_orb;
  const z = (sini * sinw) * x_orb + (sini * cosw) * y_orb;

  return new THREE.Vector3(x, z, -y); // Y-up, Z hacia nosotros aproximado
}

// ─────────────────────────────────────────────────────────────
// Escena
const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000005);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.0001, 500);
camera.position.set(0, 8, 25);

const renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
container.appendChild(renderer.domElement);

const labelRenderer = new CSS2DRenderer();
labelRenderer.setSize(window.innerWidth, window.innerHeight);
labelRenderer.domElement.style.position = 'absolute';
labelRenderer.domElement.style.top = '0';
labelRenderer.domElement.style.pointerEvents = 'none';
container.appendChild(labelRenderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 0.001;
controls.maxDistance = 120;
controls.target.set(0, 0, 0);
// Ratón: izquierdo = rotar, derecho = traslar (pan), rueda = zoom
controls.mouseButtons = {
  LEFT: THREE.MOUSE.ROTATE,
  MIDDLE: THREE.MOUSE.DOLLY,
  RIGHT: THREE.MOUSE.PAN
};
// Táctil: 1 dedo = rotar, 2 dedos = pan+zoom
controls.touches = {
  ONE: THREE.TOUCH.ROTATE,
  TWO: THREE.TOUCH.DOLLY_PAN
};
controls.screenSpacePanning = true;

// Luces
const ambient = new THREE.AmbientLight(0x334455, 0.55);
scene.add(ambient);

const sunLight = new THREE.PointLight(0xffffff, 4.5, 0, 0);
sunLight.position.set(0, 0, 0);
scene.add(sunLight);
const sunLight2 = new THREE.PointLight(0xfff0dd, 1.2, 0, 0);
sunLight2.position.set(0, 0, 0);
scene.add(sunLight2);

// ─────────────────────────────────────────────────────────────
// Campo estelar con paralaje (varias capas a distinta profundidad)
// ─────────────────────────────────────────────────────────────
const starLayers = [];

function createParallaxStarfield() {
  // parallax: 0 = fijo en el mundo (infinito); >0 = se desplaza con la cámara
  const layers = [
    { count: 1200, minR: 22,  maxR: 48,  size: 0.28, opacity: 0.95, parallax: 0.42, colorSpread: true },
    { count: 2800, minR: 55,  maxR: 95,  size: 0.16, opacity: 0.80, parallax: 0.18, colorSpread: true },
    { count: 5500, minR: 110, maxR: 200, size: 0.11, opacity: 0.65, parallax: 0.0,  colorSpread: false }
  ];

  for (const cfg of layers) {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(cfg.count * 3);
    const col = new Float32Array(cfg.count * 3);

    for (let i = 0; i < cfg.count; i++) {
      const r = cfg.minR + Math.random() * (cfg.maxR - cfg.minR);
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      pos[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = r * Math.cos(phi);

      // Variación de color: blanco, azulado, amarillento
      if (cfg.colorSpread) {
        const t = Math.random();
        if (t < 0.15) {       // azul-blanco
          col[i * 3] = 0.75; col[i * 3 + 1] = 0.85; col[i * 3 + 2] = 1.0;
        } else if (t < 0.30) { // amarillo-naranja
          col[i * 3] = 1.0; col[i * 3 + 1] = 0.88; col[i * 3 + 2] = 0.65;
        } else {
          const b = 0.85 + Math.random() * 0.15;
          col[i * 3] = b; col[i * 3 + 1] = b; col[i * 3 + 2] = b;
        }
      } else {
        const b = 0.7 + Math.random() * 0.3;
        col[i * 3] = b; col[i * 3 + 1] = b; col[i * 3 + 2] = b;
      }
    }

    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));

    const mat = new THREE.PointsMaterial({
      size: cfg.size,
      sizeAttenuation: true,
      vertexColors: true,
      transparent: true,
      opacity: cfg.opacity,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    scene.add(points);
    starLayers.push({ points, parallax: cfg.parallax });
  }
}

function updateStarParallax() {
  // Las capas cercanas se desplazan parcialmente con la cámara → paralaje
  // relativo respecto a las capas lejanas (fijas en el mundo).
  for (const layer of starLayers) {
    if (layer.parallax > 0) {
      layer.points.position.copy(camera.position).multiplyScalar(layer.parallax);
    }
  }
  // Paralaje de nebulosas
  for (const neb of nebulaLayers) {
    if (neb.parallax > 0) {
      neb.mesh.position.copy(neb.basePos).add(
        camera.position.clone().multiplyScalar(neb.parallax)
      );
    }
  }
}

createParallaxStarfield();

// ─────────────────────────────────────────────────────────────
// Nebulosas interestelares procedurales
// ─────────────────────────────────────────────────────────────
const nebulaLayers = [];
const nebulaMaterials = [];

const NEBULA_NOISE = /* glsl */ `
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
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j  = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x  = x_ * ns.x + ns.yyyy;
  vec4 y  = y_ * ns.x + ns.yyyy;
  vec4 h  = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}
float fbm(vec3 p, int oct){
  float v = 0.0, a = 0.5;
  for(int i = 0; i < 6; i++){
    if(i >= oct) break;
    v += a * snoise(p);
    p *= 2.1; a *= 0.5;
  }
  return v;
}
`;

function createNebulaMaterial(colorA, colorB, colorC, densityScale, speed) {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime:    { value: 0 },
      uColorA:  { value: new THREE.Color(colorA) },
      uColorB:  { value: new THREE.Color(colorB) },
      uColorC:  { value: new THREE.Color(colorC) },
      uScale:   { value: densityScale },
      uSpeed:   { value: speed },
      uOpacity: { value: 0.35 }
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vPos;
      void main(){
        vUv = uv;
        vPos = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: NEBULA_NOISE + /* glsl */ `
      varying vec2 vUv;
      varying vec3 vPos;
      uniform float uTime, uScale, uSpeed, uOpacity;
      uniform vec3 uColorA, uColorB, uColorC;

      void main(){
        // Coordenadas centradas en el plano
        vec2 uv = vUv * 2.0 - 1.0;
        float dist = length(uv);

        // Máscara suave circular (evita bordes duros del plano)
        float mask = 1.0 - smoothstep(0.35, 1.0, dist);
        if (mask < 0.01) discard;

        // Ruido 3D animado para la densidad de gas
        vec3 p = vec3(uv * uScale, uTime * uSpeed);
        float n1 = fbm(p, 5);
        float n2 = fbm(p * 1.7 + vec3(3.1, 1.4, 0.0), 4);
        float n3 = fbm(p * 0.6 - vec3(0.0, uTime * uSpeed * 0.3, 2.0), 3);

        float density = n1 * 0.5 + n2 * 0.35 + n3 * 0.15;
        density = smoothstep(-0.15, 0.55, density);

        // Filamentos más finos
        float filaments = smoothstep(0.2, 0.7, n2 * n1 + 0.3);
        density *= mix(0.6, 1.2, filaments);

        // Mezcla de colores
        vec3 col = mix(uColorA, uColorB, smoothstep(-0.2, 0.5, n1));
        col = mix(col, uColorC, smoothstep(0.0, 0.6, n2) * 0.5);

        float alpha = density * mask * uOpacity;
        // Núcleo un poco más brillante
        col += col * density * 0.3;

        gl_FragColor = vec4(col, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending
  });
  nebulaMaterials.push(mat);
  return mat;
}

function createNebulae() {
  // Definición: posición base, tamaño, colores, escala de ruido, velocidad, paralaje
  const defs = [
    {
      pos: [60, 25, -80], scale: 90,
      colors: [0x4a2080, 0x2080c0, 0xc040a0],
      noiseScale: 2.2, speed: 0.015, parallax: 0.08
    },
    {
      pos: [-70, -15, 50], scale: 70,
      colors: [0x802020, 0xc06020, 0x401060],
      noiseScale: 2.8, speed: 0.012, parallax: 0.12
    },
    {
      pos: [30, -40, 90], scale: 110,
      colors: [0x104080, 0x20a0a0, 0x6030a0],
      noiseScale: 1.8, speed: 0.01, parallax: 0.05
    },
    {
      pos: [-40, 50, -60], scale: 55,
      colors: [0xa03060, 0x6030c0, 0x20c0c0],
      noiseScale: 3.2, speed: 0.018, parallax: 0.15
    },
    {
      pos: [90, 10, 40], scale: 75,
      colors: [0x206040, 0x40a080, 0x8030a0],
      noiseScale: 2.4, speed: 0.011, parallax: 0.06
    },
    {
      pos: [-20, -55, -90], scale: 95,
      colors: [0x301080, 0x8050c0, 0xc05080],
      noiseScale: 2.0, speed: 0.009, parallax: 0.04
    }
  ];

  for (const d of defs) {
    const geo = new THREE.PlaneGeometry(1, 1, 1, 1);
    const mat = createNebulaMaterial(d.colors[0], d.colors[1], d.colors[2], d.noiseScale, d.speed);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.scale.set(d.scale, d.scale, 1);
    mesh.position.set(d.pos[0], d.pos[1], d.pos[2]);
    // Orientar hacia el origen (aprox. billboard estático)
    mesh.lookAt(0, 0, 0);
    mesh.frustumCulled = false;
    scene.add(mesh);
    nebulaLayers.push({
      mesh,
      basePos: mesh.position.clone(),
      parallax: d.parallax
    });
  }
}

createNebulae();

// ─────────────────────────────────────────────────────────────
// Shaders procedurales completos (Simplex + FBM + bump + lighting)
// ─────────────────────────────────────────────────────────────

// NOISE_GLSL importado desde shaders.js

// VERT_FULL importado desde shaders.js

const shaderMaterials = [];

function makeProcMaterial(fragmentShader, uniforms = {}, opts = {}) {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime:     { value: 0 },
      uLightDir: { value: new THREE.Vector3(1, 0.2, 0.4).normalize() },
      ...uniforms
    },
    vertexShader: VERT_FULL,
    fragmentShader: NOISE_GLSL + fragmentShader,
    transparent: !!opts.transparent,
    depthWrite: opts.depthWrite !== false,
    side: opts.side || THREE.FrontSide
  });
  shaderMaterials.push(mat);
  return mat;
}

// ── Sol ──────────────────────────────────────────────────────
function createSunMaterial() {
  return makeProcMaterial(/* glsl */ `
    varying vec3 vPos;
    varying vec3 vNormal;
    varying vec3 vViewDir;
    uniform float uTime;

    void main(){
      vec3 p = normalize(vPos);
      float n1 = fbm(p * 3.5 + uTime * 0.06, 5);
      float n2 = fbm(p * 8.0  - uTime * 0.10, 4);
      float n3 = fbm(p * 16.0 + uTime * 0.15, 3);
      float gran = n1 * 0.5 + n2 * 0.35 + n3 * 0.15;

      vec3 dark  = vec3(0.85, 0.30, 0.02);
      vec3 mid   = vec3(1.00, 0.60, 0.10);
      vec3 bright= vec3(1.00, 0.92, 0.55);
      vec3 col = mix(dark, mid, smoothstep(-0.3, 0.3, gran));
      col = mix(col, bright, smoothstep(0.2, 0.7, gran));

      // Limb darkening
      float mu = max(dot(vNormal, vViewDir), 0.0);
      float limb = 0.55 + 0.45 * mu;
      col *= limb;

      // Corona / rim
      float fres = pow(1.0 - mu, 2.5);
      col += vec3(1.0, 0.55, 0.15) * fres * 0.5;

      gl_FragColor = vec4(col, 1.0);
    }
  `);
}

// ── Rocoso genérico (Mercurio, Fobos, etc.) ──────────────────
function createRockyMaterial(base, dark, craterScale = 6.0) {
  return makeProcMaterial(/* glsl */ `
    varying vec3 vPos;
    varying vec3 vNormal;
    varying vec3 vViewDir;
    uniform vec3 uBase, uDark;
    uniform float uScale;
    uniform vec3 uLightDir;

    void main(){
      vec3 p = normalize(vPos);
      float n  = fbm(p * uScale, 5);
      float n2 = fbm(p * uScale * 2.5, 3);
      float crater = smoothstep(0.10, 0.50, n);
      vec3 albedo = mix(uDark, uBase, crater);
      albedo = mix(albedo, uDark * 0.7, smoothstep(0.4, 0.8, n2) * 0.4);

      vec3 N = bumpNormal(p, normalize(vNormal), uScale, 0.35);
      vec3 L = normalize(uLightDir);
      vec3 V = normalize(vViewDir);
      vec3 col = lightSurface(albedo, N, L, V, 16.0, 0.08);
      gl_FragColor = vec4(col, 1.0);
    }
  `, {
    uBase:  { value: new THREE.Color(base) },
    uDark:  { value: new THREE.Color(dark) },
    uScale: { value: craterScale }
  });
}

// ── Venus ────────────────────────────────────────────────────
function createVenusMaterial() {
  return makeProcMaterial(/* glsl */ `
    varying vec3 vPos;
    varying vec3 vNormal;
    varying vec3 vViewDir;
    uniform float uTime;
    uniform vec3 uLightDir;

    void main(){
      vec3 p = normalize(vPos);
      float n  = fbm(p * 3.0 + uTime * 0.015, 5);
      float n2 = fbm(p * 7.0 - uTime * 0.012, 4);
      vec3 albedo = mix(vec3(0.78, 0.58, 0.28), vec3(0.95, 0.82, 0.50), n * 0.5 + 0.5);
      albedo = mix(albedo, vec3(0.65, 0.48, 0.25), smoothstep(-0.2, 0.45, n2));

      vec3 N = bumpNormal(p, normalize(vNormal), 4.0, 0.15);
      vec3 L = normalize(uLightDir);
      vec3 V = normalize(vViewDir);
      vec3 col = lightSurface(albedo, N, L, V, 24.0, 0.12);

      // Bruma densa en el limbo
      float mu = max(dot(normalize(vNormal), V), 0.0);
      col = mix(col, vec3(0.95, 0.85, 0.55), pow(1.0 - mu, 2.0) * 0.45);
      gl_FragColor = vec4(col, 1.0);
    }
  `);
}

// ── Tierra ───────────────────────────────────────────────────
function createEarthMaterial() {
  return makeProcMaterial(/* glsl */ `
    varying vec3 vPos;
    varying vec3 vNormal;
    varying vec3 vViewDir;
    uniform vec3 uLightDir;

    void main(){
      vec3 p = normalize(vPos);
      float n = fbm(p * 5.0, 6);
      float land = smoothstep(0.04, 0.22, n);

      vec3 ocean = mix(vec3(0.02, 0.10, 0.40), vec3(0.08, 0.30, 0.62), n * 0.5 + 0.5);
      vec3 cont  = mix(vec3(0.15, 0.32, 0.10), vec3(0.42, 0.35, 0.18), fbm(p * 9.0, 4) * 0.5 + 0.5);
      vec3 albedo = mix(ocean, cont, land);

      // Casquetes polares
      float polar = smoothstep(0.62, 0.82, abs(p.y));
      albedo = mix(albedo, vec3(0.92, 0.95, 1.0), polar);

      vec3 N = bumpNormal(p, normalize(vNormal), 6.0, land * 0.3);
      vec3 L = normalize(uLightDir);
      vec3 V = normalize(vViewDir);

      // Océanos más especulares
      float shin = mix(48.0, 12.0, land);
      float spc  = mix(0.35, 0.05, land);
      vec3 col = lightSurface(albedo, N, L, V, shin, spc);

      // Atmósfera azul en el limbo
      float mu = max(dot(normalize(vNormal), V), 0.0);
      col += vec3(0.25, 0.45, 0.95) * pow(1.0 - mu, 3.0) * 0.4;
      gl_FragColor = vec4(col, 1.0);
    }
  `);
}

// ── Nubes Tierra ─────────────────────────────────────────────
/** Nubes procedurales dinámicas: varias capas + viento */
function createCloudMaterial() {
  return makeProcMaterial(/* glsl */ `
    varying vec3 vPos;
    varying vec3 vNormal;
    varying vec3 vViewDir;
    uniform float uTime;
    uniform vec3 uLightDir;

    void main(){
      vec3 p = normalize(vPos);

      // Viento: deriva distinta por capa
      vec3 wind1 = vec3(uTime * 0.018, uTime * 0.004, uTime * 0.012);
      vec3 wind2 = vec3(-uTime * 0.011, uTime * 0.006, uTime * 0.009);
      vec3 wind3 = vec3(uTime * 0.007, -uTime * 0.003, -uTime * 0.014);

      // Capas de nubes a distintas escalas
      float c1 = fbm(p * 3.2 + wind1, 5);
      float c2 = fbm(p * 6.5 + wind2, 4);
      float c3 = fbm(p * 12.0 + wind3, 3);

      // Combinación tipo cúmulos / cirros
      float clouds = c1 * 0.55 + c2 * 0.30 + c3 * 0.15;
      // Bandas ecuatoriales un poco más densas
      float latBand = 1.0 - abs(p.y) * 0.35;
      clouds *= latBand;

      float alpha = smoothstep(0.28, 0.55, clouds);
      alpha = pow(alpha, 1.15) * 0.72;

      // Iluminación suave + borde dorado al terminador
      vec3 N = normalize(vNormal);
      vec3 L = normalize(uLightDir);
      float ndl = max(dot(N, L), 0.0);
      float day = smoothstep(-0.05, 0.4, ndl);
      float term = exp(-pow(ndl * 4.0, 2.0));

      vec3 col = mix(vec3(0.55, 0.58, 0.65), vec3(1.0, 1.0, 1.0), day);
      col = mix(col, vec3(1.0, 0.75, 0.55), term * 0.5);

      // Alpha menor en la noche
      alpha *= mix(0.25, 1.0, day * 0.85 + 0.15);

      gl_FragColor = vec4(col, alpha);
    }
  `, {}, { transparent: true, depthWrite: false });
}

/** Nubes con textura bitmap + desplazamiento UV animado */
function createDynamicCloudTextureMaterial(map) {
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.colorSpace = THREE.SRGBColorSpace;
  return new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: map },
      uTime: { value: 0 },
      uLightDir: { value: new THREE.Vector3(1, 0, 0) },
      uOpacity: { value: 0.55 }
    },
    vertexShader: CLOUD_TEX_VERT,
    fragmentShader: CLOUD_TEX_FRAG,
    transparent: true,
    depthWrite: false,
    side: THREE.FrontSide
  });
}

/** Atmósfera terrestre: halo Fresnel + scattering diurno/atardecer */
function createAtmosphereMaterial() {
  return new THREE.ShaderMaterial({
    vertexShader: ATMOSPHERE_VERT,
    fragmentShader: ATMOSPHERE_FRAG,
    uniforms: {
      uLightDir: { value: new THREE.Vector3(1, 0, 0) },
      uCamPos: { value: new THREE.Vector3() },
      uIntensity: { value: 1.15 }
    },
    transparent: true,
    depthWrite: false,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending
  });
}

// ── Marte ────────────────────────────────────────────────────
function createMarsMaterial() {
  return makeProcMaterial(/* glsl */ `
    varying vec3 vPos;
    varying vec3 vNormal;
    varying vec3 vViewDir;
    uniform vec3 uLightDir;

    void main(){
      vec3 p = normalize(vPos);
      float n  = fbm(p * 5.5, 5);
      float n2 = fbm(p * 13.0, 3);
      vec3 albedo = mix(vec3(0.50, 0.18, 0.06), vec3(0.82, 0.42, 0.18), n * 0.5 + 0.5);
      albedo = mix(albedo, vec3(0.30, 0.14, 0.08), smoothstep(0.25, 0.65, n2));

      float polar = smoothstep(0.68, 0.88, abs(p.y));
      albedo = mix(albedo, vec3(0.90, 0.90, 0.95), polar);

      vec3 N = bumpNormal(p, normalize(vNormal), 7.0, 0.4);
      vec3 L = normalize(uLightDir);
      vec3 V = normalize(vViewDir);
      vec3 col = lightSurface(albedo, N, L, V, 14.0, 0.06);
      gl_FragColor = vec4(col, 1.0);
    }
  `);
}

// ── Gigantes gaseosos ────────────────────────────────────────
function createGasMaterial(c1, c2, c3, bandScale = 12.0, turb = 1.5) {
  return makeProcMaterial(/* glsl */ `
    varying vec3 vPos;
    varying vec3 vNormal;
    varying vec3 vViewDir;
    uniform float uTime;
    uniform vec3 uC1, uC2, uC3;
    uniform float uBand, uTurb;
    uniform vec3 uLightDir;

    void main(){
      vec3 p = normalize(vPos);
      float lat = p.y;
      float warp = fbm(p * 2.5 + uTime * 0.04, 4) * uTurb;
      float bands = sin(lat * uBand + warp);
      float n = fbm(p * 5.5 + vec3(uTime * 0.03, 0.0, 0.0), 4);

      vec3 albedo = mix(uC1, uC2, bands * 0.5 + 0.5);
      albedo = mix(albedo, uC3, smoothstep(-0.25, 0.45, n));

      vec3 N = bumpNormal(p, normalize(vNormal), 5.0, 0.12);
      vec3 L = normalize(uLightDir);
      vec3 V = normalize(vViewDir);
      vec3 col = lightSurface(albedo, N, L, V, 32.0, 0.18);

      float mu = max(dot(normalize(vNormal), V), 0.0);
      col *= 0.7 + 0.3 * mu;
      gl_FragColor = vec4(col, 1.0);
    }
  `, {
    uC1:   { value: new THREE.Color(c1) },
    uC2:   { value: new THREE.Color(c2) },
    uC3:   { value: new THREE.Color(c3) },
    uBand: { value: bandScale },
    uTurb: { value: turb }
  });
}

// ── Mundos de hielo ──────────────────────────────────────────
function createIceMaterial(base, accent) {
  return makeProcMaterial(/* glsl */ `
    varying vec3 vPos;
    varying vec3 vNormal;
    varying vec3 vViewDir;
    uniform vec3 uBase, uAccent;
    uniform float uTime;
    uniform vec3 uLightDir;

    void main(){
      vec3 p = normalize(vPos);
      float n = fbm(p * 4.0 + uTime * 0.015, 4);
      float bands = sin(p.y * 9.0 + n * 1.8) * 0.5 + 0.5;
      vec3 albedo = mix(uBase, uAccent, bands);

      vec3 N = bumpNormal(p, normalize(vNormal), 5.0, 0.1);
      vec3 L = normalize(uLightDir);
      vec3 V = normalize(vViewDir);
      vec3 col = lightSurface(albedo, N, L, V, 40.0, 0.25);
      gl_FragColor = vec4(col, 1.0);
    }
  `, {
    uBase:   { value: new THREE.Color(base) },
    uAccent: { value: new THREE.Color(accent) }
  });
}

// ── Ío ───────────────────────────────────────────────────────
function createIoMaterial() {
  return makeProcMaterial(/* glsl */ `
    varying vec3 vPos;
    varying vec3 vNormal;
    varying vec3 vViewDir;
    uniform vec3 uLightDir;

    void main(){
      vec3 p = normalize(vPos);
      float n  = fbm(p * 5.5, 5);
      float n2 = fbm(p * 14.0, 3);
      vec3 albedo = mix(vec3(0.65, 0.40, 0.08), vec3(0.95, 0.85, 0.30), n * 0.5 + 0.5);
      albedo = mix(albedo, vec3(0.20, 0.08, 0.03), smoothstep(0.35, 0.75, n2));

      vec3 N = bumpNormal(p, normalize(vNormal), 8.0, 0.35);
      vec3 L = normalize(uLightDir);
      vec3 V = normalize(vViewDir);
      vec3 col = lightSurface(albedo, N, L, V, 20.0, 0.1);
      gl_FragColor = vec4(col, 1.0);
    }
  `);
}

// ── Titán ────────────────────────────────────────────────────
function createTitanMaterial() {
  return makeProcMaterial(/* glsl */ `
    varying vec3 vPos;
    varying vec3 vNormal;
    varying vec3 vViewDir;
    uniform float uTime;
    uniform vec3 uLightDir;

    void main(){
      vec3 p = normalize(vPos);
      float n = fbm(p * 3.5 + uTime * 0.008, 5);
      vec3 albedo = mix(vec3(0.48, 0.30, 0.12), vec3(0.72, 0.52, 0.28), n * 0.5 + 0.5);

      vec3 N = bumpNormal(p, normalize(vNormal), 4.0, 0.12);
      vec3 L = normalize(uLightDir);
      vec3 V = normalize(vViewDir);
      vec3 col = lightSurface(albedo, N, L, V, 18.0, 0.08);

      float mu = max(dot(normalize(vNormal), V), 0.0);
      col = mix(col, vec3(0.90, 0.68, 0.35), pow(1.0 - mu, 2.0) * 0.5);
      gl_FragColor = vec4(col, 1.0);
    }
  `);
}

function createMoonMaterial() {
  return createRockyMaterial(0xc8c8c8, 0x4a4a4a, 7.5);
}

// ── Anillos de Saturno ───────────────────────────────────────
function createRingMaterial() {
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vPos;
      varying vec3 vWorldPos;
      void main(){
        vUv = uv;
        vPos = position;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: NOISE_GLSL + /* glsl */ `
      varying vec2 vUv;
      varying vec3 vPos;
      varying vec3 vWorldPos;
      uniform float uTime;

      void main(){
        float t = vUv.x; // 0 = interior, 1 = exterior
        float bands = sin(t * 48.0) * 0.5 + 0.5;
        float n = fbm(vec3(vPos.xy * 18.0, uTime * 0.008), 3);

        float alpha = smoothstep(0.0, 0.05, t) * smoothstep(1.0, 0.90, t);
        alpha *= (0.45 + bands * 0.40 + n * 0.18);

        // División de Cassini
        if (t > 0.42 && t < 0.51) alpha *= 0.12;
        // Encke gap aprox
        if (t > 0.78 && t < 0.81) alpha *= 0.25;

        vec3 col = mix(vec3(0.60, 0.50, 0.35), vec3(0.95, 0.90, 0.78), bands);
        // Iluminación básica desde el Sol (origen)
        vec3 L = normalize(-vWorldPos);
        float lit = 0.55 + 0.45 * max(L.y * 0.3 + 0.7, 0.0);
        col *= lit;

        gl_FragColor = vec4(col, alpha * 0.93);
      }
    `,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false
  });
  shaderMaterials.push(mat);
  return mat;
}

function getMaterialForType(type, data) {
  switch (type) {
    case 'rocky': return createRockyMaterial(data.color, 0x2a2a2a, 6.0);
    case 'venus': return createVenusMaterial();
    case 'earth': return createEarthMaterial();
    case 'mars':  return createMarsMaterial();
    case 'gas':
      if (data.name === 'Júpiter')
        return createGasMaterial(0xc88b3a, 0xe8c070, 0x8b5a2b, 14.0, 2.2);
      return createGasMaterial(0xe4d191, 0xc9b070, 0xa08050, 11.0, 1.3);
    case 'ice':
      if (data.name === 'Urano') return createIceMaterial(0x9db4c0, 0xc5dce8);
      if (data.name === 'Neptuno') return createIceMaterial(0x3a50b0, 0x6a90d8);
      return createIceMaterial(data.color || 0xc0d0e0, 0xe8f0ff);
    case 'moon':  return createMoonMaterial();
    case 'io':    return createIoMaterial();
    case 'titan': return createTitanMaterial();
    default:      return createRockyMaterial(data.color || 0x888888, 0x333333);
  }
}

function createLabel(text, isMoon = false) {
  const div = document.createElement('div');
  div.className = 'label' + (isMoon ? ' moon' : '');
  div.textContent = text;
  const obj = new CSS2DObject(div);
  return obj;
}

// Crear órbita elíptica
function createOrbitLine(data, color = 0x334466) {
  const points = [];
  const segments = 256;
  for (let i = 0; i <= segments; i++) {
    const M = (i / segments) * Math.PI * 2;
    const E = solveKepler(M, data.e);
    const nu = 2 * Math.atan2(Math.sqrt(1 + data.e) * Math.sin(E / 2), Math.sqrt(1 - data.e) * Math.cos(E / 2));
    const r = data.a * (1 - data.e * Math.cos(E));
    const Omega = deg2rad(data.Omega);
    const omega = deg2rad(data.varpi - data.Omega);
    const iAng = deg2rad(data.i);
    const x_orb = r * Math.cos(nu);
    const y_orb = r * Math.sin(nu);
    const cosO = Math.cos(Omega), sinO = Math.sin(Omega);
    const cosi = Math.cos(iAng), sini = Math.sin(iAng);
    const cosw = Math.cos(omega), sinw = Math.sin(omega);
    const x = (cosO * cosw - sinO * sinw * cosi) * x_orb + (-cosO * sinw - sinO * cosw * cosi) * y_orb;
    const y = (sinO * cosw + cosO * sinw * cosi) * x_orb + (-sinO * sinw + cosO * cosw * cosi) * y_orb;
    const z = (sini * sinw) * x_orb + (sini * cosw) * y_orb;
    points.push(new THREE.Vector3(x, z, -y));
  }
  const geo = new THREE.BufferGeometry().setFromPoints(points);
  const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.45 });
  return new THREE.Line(geo, mat);
}

// ─────────────────────────────────────────────────────────────
// Sol (procedural)
const sunGroup = new THREE.Group();
scene.add(sunGroup);
const sunGeo = new THREE.SphereGeometry(0.09, 64, 64);
const sunMat = createSunMaterial();
const sunMesh = new THREE.Mesh(sunGeo, sunMat);
sunGroup.add(sunMesh);

// Corona solar detallada (varias capas + rayos)
function createSolarCoronaMaterial(layer) {
  // layer: 0 = interna caliente, 1 = media, 2 = externa tenue
  const intensity = [1.2, 0.7, 0.35][layer] || 0.5;
  const rayCount = [11.0, 17.0, 7.0][layer] || 11.0;
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uIntensity: { value: intensity },
      uRayCount: { value: rayCount },
      uLayer: { value: layer }
    },
    vertexShader: SOLAR_CORONA_VERT,
    fragmentShader: SOLAR_CORONA_FRAG
  });
}

const sunCoronaMats = [];
const sunCoronaLayers = [
  { scale: 1.55, layer: 0 },
  { scale: 2.2, layer: 1 },
  { scale: 3.4, layer: 2 }
];
for (const cfg of sunCoronaLayers) {
  const mat = createSolarCoronaMaterial(cfg.layer);
  sunCoronaMats.push(mat);
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.09 * cfg.scale, 48, 48),
    mat
  );
  mesh.renderOrder = -1;
  sunGroup.add(mesh);
}

// Halo suave de fondo
const sunGlow = new THREE.Mesh(
  new THREE.SphereGeometry(0.42, 32, 32),
  new THREE.MeshBasicMaterial({
    color: 0xffcc66,
    transparent: true,
    opacity: 0.08,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  })
);
sunGroup.add(sunGlow);

const sunLabel = createLabel('Sol');
sunGroup.add(sunLabel);
sunLabel.position.y = 0.22;

// Guardar material procedural del Sol para el toggle
sunMesh.userData.procMat = sunMat;
sunMesh.userData.imgMat = null;

// Texture loader (modo imagen)
const texLoader = new THREE.TextureLoader();
function loadTexture(url) {
  return new Promise((resolve) => {
    if (!url) { resolve(null); return; }
    texLoader.load(
      url,
      (tex) => { tex.colorSpace = THREE.SRGBColorSpace; resolve(tex); },
      undefined,
      () => resolve(null)
    );
  });
}

// Cuerpos
const bodies = {};
const allPickables = [];
let useImageTextures = false;
let imageTexturesLoaded = false;

function createPlanet(id, data) {
  const group = new THREE.Group();
  scene.add(group);

  const radius = Math.max(data.radiusKm * SIZE_SCALE, 0.008);
  const geo = new THREE.SphereGeometry(radius, 64, 64);

  const procMat = getMaterialForType(data.type, data);
  const mesh = new THREE.Mesh(geo, procMat);
  mesh.userData = { id, type: 'planet', name: data.name, procMat, imgMat: null };

  // Eje: group → axialGroup (inclinación) → mesh (rotación sidérea en Y)
  // Así rotation.y del mesh no se mezcla con el tilt al mapear lat/lon
  const axialGroup = new THREE.Group();
  axialGroup.rotation.z = deg2rad(data.tilt || 0);
  axialGroup.add(mesh);
  group.add(axialGroup);

  // Nubes dinámicas (2 capas) + atmósfera para Tierra
  if (data.type === 'earth') {
    const cloudsLow = new THREE.Mesh(
      new THREE.SphereGeometry(radius * 1.012, 64, 64),
      createCloudMaterial()
    );
    const cloudsHigh = new THREE.Mesh(
      new THREE.SphereGeometry(radius * 1.022, 48, 48),
      createCloudMaterial()
    );
    // Capa alta más transparente / distinta fase
    if (cloudsHigh.material.uniforms && cloudsHigh.material.uniforms.uTime) {
      cloudsHigh.material = cloudsHigh.material.clone();
      // makeProcMaterial may push to shaderMaterials — clone keeps own uniforms
    }
    cloudsLow.material.transparent = true;
    cloudsHigh.material.transparent = true;
    if (cloudsHigh.material.opacity !== undefined) cloudsHigh.material.opacity = 0.5;
    mesh.add(cloudsLow);
    mesh.add(cloudsHigh);
    mesh.userData.clouds = cloudsLow;
    mesh.userData.cloudsHigh = cloudsHigh;
    mesh.userData.cloudsProcMat = cloudsLow.material;
    mesh.userData.cloudsHighProcMat = cloudsHigh.material;
    mesh.userData.cloudsImgMat = null;
    mesh.userData.cloudsHighImgMat = null;
    // Velocidades angulares relativas (rad/s a 1x tiempo real, se escalan en animate)
    mesh.userData.cloudSpinLow = 0.000012;
    mesh.userData.cloudSpinHigh = -0.000008;

    // Cáscara atmosférica (BackSide + aditivo)
    const atmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(radius * 1.08, 64, 64),
      createAtmosphereMaterial()
    );
    atmosphere.renderOrder = 1;
    axialGroup.add(atmosphere);
    mesh.userData.atmosphere = atmosphere;
  }

  // Anillos procedurales de Saturno
  if (data.hasRings) {
    const ringGeo = new THREE.RingGeometry(radius * 1.35, radius * 2.35, 96);
    const rings = new THREE.Mesh(ringGeo, createRingMaterial());
    rings.rotation.x = Math.PI / 2;
    mesh.add(rings);
    mesh.userData.rings = rings;
    mesh.userData.ringsProcMat = rings.material;
    mesh.userData.ringsImgMat = null;
  }

  const label = createLabel(data.name);
  label.position.y = radius * 1.6;
  group.add(label);

  const orbitLine = createOrbitLine(data);
  scene.add(orbitLine);

  bodies[id] = {
    id, group, mesh, axialGroup, data, orbitLine, label,
    moons: [], radius
  };
  allPickables.push(mesh);

  const opt = document.createElement('option');
  opt.value = id;
  opt.textContent = data.name;
  document.getElementById('followSelect').appendChild(opt);
}

/** Radio orbital visual: las distancias reales quedan dentro del planeta exagerado */
function visualMoonOrbit(parent, moonData) {
  const parentR = parent.radius;
  const earthMoonReal = 0.00257; // AU Luna
  // Luna de la Tierra ~ 4× el radio visual de la Tierra
  const targetEarthMoon = (bodies.earth ? bodies.earth.radius : parentR) * 4.2;
  const boost = targetEarthMoon / earthMoonReal;
  const scaled = moonData.a * boost;
  // Nunca por debajo de 2.6 × radio del planeta padre
  return Math.max(scaled, parentR * 2.6);
}

function createMoon(id, data) {
  const parent = bodies[data.parent];
  if (!parent) return;

  const moonGroup = new THREE.Group();
  parent.group.add(moonGroup);

  // Radios de lunas más visibles (mínimo relativo al planeta)
  const radius = Math.max(data.radiusKm * SIZE_SCALE * 2.2, parent.radius * 0.12, 0.0035);
  const geo = new THREE.SphereGeometry(radius, 32, 32);
  const procMat = getMaterialForType(data.type || 'rocky', data);
  const mesh = new THREE.Mesh(geo, procMat);
  mesh.userData = { id, type: 'moon', name: data.name, parent: data.parent, procMat, imgMat: null };
  moonGroup.add(mesh);

  const label = createLabel(data.name, true);
  label.position.y = radius * 2.2;
  moonGroup.add(label);

  const orbitR = visualMoonOrbit(parent, data);

  // Órbita de la luna (radio visual)
  const orbitPoints = [];
  for (let i = 0; i <= 128; i++) {
    const ang = (i / 128) * Math.PI * 2;
    orbitPoints.push(new THREE.Vector3(
      Math.cos(ang) * orbitR, 0, Math.sin(ang) * orbitR
    ));
  }
  const orbitGeo = new THREE.BufferGeometry().setFromPoints(orbitPoints);
  const orbitMat = new THREE.LineBasicMaterial({ color: 0x8899aa, transparent: true, opacity: 0.45 });
  const orbitLine = new THREE.Line(orbitGeo, orbitMat);
  parent.group.add(orbitLine);

  const moonObj = { id, group: moonGroup, mesh, data, label, orbitLine, radius, visualOrbit: orbitR };
  parent.moons.push(moonObj);
  bodies[id] = moonObj;
  allPickables.push(mesh);

  const opt = document.createElement('option');
  opt.value = id;
  opt.textContent = `  ${data.name} (${PLANET_DATA[data.parent].name})`;
  document.getElementById('followSelect').appendChild(opt);
}

async function ensureImageMaterials() {
  if (imageTexturesLoaded) return;

  // Sol
  const sunTex = await loadTexture('textures/2k_sun.jpg');
  if (sunTex) {
    sunMesh.userData.imgMat = new THREE.MeshBasicMaterial({ map: sunTex });
  } else {
    sunMesh.userData.imgMat = new THREE.MeshBasicMaterial({ color: 0xffcc66 });
  }

  for (const [id, body] of Object.entries(bodies)) {
    const data = body.data;
    const mesh = body.mesh;
    if (!mesh || !mesh.userData) continue;

    if (data.tex) {
      const tex = await loadTexture(data.tex);
      if (tex) {
        mesh.userData.imgMat = new THREE.MeshStandardMaterial({
          map: tex, roughness: 0.85, metalness: 0.05
        });
      } else {
        mesh.userData.imgMat = new THREE.MeshStandardMaterial({
          color: data.color || 0x888888, roughness: 0.85
        });
      }
    } else {
      mesh.userData.imgMat = new THREE.MeshStandardMaterial({
        color: data.color || 0x888888, roughness: 0.9
      });
    }

    // Nubes Tierra dinámicas (bitmap + scroll UV)
    if (mesh.userData.clouds && data.clouds) {
      const ctex = await loadTexture(data.clouds);
      if (ctex) {
        const ctex2 = ctex.clone();
        ctex2.needsUpdate = true;
        mesh.userData.cloudsImgMat = createDynamicCloudTextureMaterial(ctex);
        mesh.userData.cloudsHighImgMat = createDynamicCloudTextureMaterial(ctex2);
        if (mesh.userData.cloudsHighImgMat.uniforms) {
          mesh.userData.cloudsHighImgMat.uniforms.uOpacity.value = 0.38;
        }
      }
    }

    // Anillos Saturno
    if (mesh.userData.rings && data.ring) {
      const rtex = await loadTexture(data.ring);
      const radius = body.radius;
      const ringMat = new THREE.MeshBasicMaterial({
        map: rtex || null,
        color: rtex ? 0xffffff : 0xc9b896,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85,
        depthWrite: false
      });
      mesh.userData.ringsImgMat = ringMat;
    }
  }
  imageTexturesLoaded = true;
}

function applyTextureMode(useImages) {
  useImageTextures = useImages;

  // Sol
  if (useImages && sunMesh.userData.imgMat) {
    sunMesh.material = sunMesh.userData.imgMat;
  } else if (sunMesh.userData.procMat) {
    sunMesh.material = sunMesh.userData.procMat;
  }

  for (const body of Object.values(bodies)) {
    const mesh = body.mesh;
    if (!mesh || !mesh.userData) continue;

    if (useImages && mesh.userData.imgMat) {
      mesh.material = mesh.userData.imgMat;
    } else if (mesh.userData.procMat) {
      mesh.material = mesh.userData.procMat;
    }

    if (mesh.userData.clouds) {
      if (useImages && mesh.userData.cloudsImgMat) {
        mesh.userData.clouds.material = mesh.userData.cloudsImgMat;
      } else if (mesh.userData.cloudsProcMat) {
        mesh.userData.clouds.material = mesh.userData.cloudsProcMat;
      }
    }
    if (mesh.userData.cloudsHigh) {
      if (useImages && mesh.userData.cloudsHighImgMat) {
        mesh.userData.cloudsHigh.material = mesh.userData.cloudsHighImgMat;
      } else if (mesh.userData.cloudsHighProcMat) {
        mesh.userData.cloudsHigh.material = mesh.userData.cloudsHighProcMat;
      }
    }

    if (mesh.userData.rings) {
      if (useImages && mesh.userData.ringsImgMat) {
        mesh.userData.rings.material = mesh.userData.ringsImgMat;
      } else if (mesh.userData.ringsProcMat) {
        mesh.userData.rings.material = mesh.userData.ringsProcMat;
      }
    }
  }
}

function initBodies() {
  for (const [id, data] of Object.entries(PLANET_DATA)) {
    createPlanet(id, data);
  }
  for (const [id, data] of Object.entries(MOON_DATA)) {
    createMoon(id, data);
  }
}

/** Texturas bitmap por defecto; procedural solo como respaldo */
async function initDefaultTextures() {
  await ensureImageMaterials();
  applyTextureMode(true);
  const cb = document.getElementById('useTextures');
  if (cb) cb.checked = true;
}

// ─────────────────────────────────────────────────────────────
// Estado de simulación
let simDate = new Date();
let timeScale = 1; // 1 = tiempo real (1 s simulado / 1 s real)
let paused = false;
let followId = 'sun';
let lastTime = performance.now();
let eclipseActive = false;
let eclipseYawOffset = 0; // desfase de rotación terrestre en t0
let moonPhaseOffset = 0;  // desfase orbital lunar (rad); en t0 ≈ luna nueva
// Objetivo de umbra (lat, lon) cuando hay eclipse localizado; null = eje Sol-Tierra
let eclipseTarget = null; // { lat, lon, elevDeg }

// Sombra de eclipse de alta calidad (shader: umbra + penumbra con degradado)
const eclipseShadowGroup = new THREE.Group();
eclipseShadowGroup.visible = false;

// ECLIPSE_SHADOW_VERT desde shaders.js
// ECLIPSE_SHADOW_FRAG desde shaders.js
// Umbra (núcleo) + penumbra (anillo) — materiales simples y visibles
const eclipseUmbraMat = new THREE.MeshBasicMaterial({
  color: 0x000000,
  transparent: true,
  opacity: 0.82,
  depthWrite: false,
  depthTest: true,
  side: THREE.DoubleSide,
  polygonOffset: true,
  polygonOffsetFactor: -4,
  polygonOffsetUnits: -4
});
const eclipsePenumbraMat = new THREE.MeshBasicMaterial({
  color: 0x0a0818,
  transparent: true,
  opacity: 0.45,
  depthWrite: false,
  depthTest: true,
  side: THREE.DoubleSide,
  polygonOffset: true,
  polygonOffsetFactor: -2,
  polygonOffsetUnits: -2
});
// Compat: alias para uniforms opcionales
const eclipseShadowMat = { uniforms: { uUmbra: { value: 0.35 }, uPenumbra: { value: 0.85 }, uIntensity: { value: 1.35 } } };

const eclipsePenumbraMesh = new THREE.Mesh(new THREE.CircleGeometry(1, 64), eclipsePenumbraMat);
const eclipseShadowMesh = new THREE.Mesh(new THREE.CircleGeometry(1, 64), eclipseUmbraMat);
eclipsePenumbraMesh.scale.setScalar(1.0);
eclipseShadowMesh.scale.setScalar(0.42);
eclipseShadowGroup.add(eclipsePenumbraMesh);
eclipseShadowGroup.add(eclipseShadowMesh);
let eclipseShadowParent = null;

/** Tiempo sidéreo medio de Greenwich (radianes) */
function gmstRadians(jd) {
  const T = (jd - 2451545.0) / 36525.0;
  let gmst =
    280.46061837 +
    360.98564736629 * (jd - 2451545.0) +
    0.000387933 * T * T -
    (T * T * T) / 38710000.0;
  return deg2rad(mod360(gmst));
}

/**
 * Punto en la esfera unitaria (espacio del mesh, sin rotación)
 * coincidente con SphereGeometry de Three.js + textura equirectangular
 * donde u=0 → lon −180° y u=0.5 → lon 0° (Greenwich).
 *
 * Three.js SphereGeometry:
 *   phi = ángulo polar desde +Y (0 = norte)
 *   theta = alrededor de Y
 *   x = −cos(theta)·sin(phi)
 *   y =  cos(phi)
 *   z =  sin(theta)·sin(phi)
 *   u = theta / (2π)  →  theta = (lon+180)·π/180
 */
function latLonToMeshLocal(latDeg, lonDeg) {
  const phi = deg2rad(90 - latDeg);       // 0 en el polo norte
  const theta = deg2rad(lonDeg + 180);    // 0 en lon −180°
  const sinPhi = Math.sin(phi);
  const x = -Math.cos(theta) * sinPhi;
  const y = Math.cos(phi);
  const z = Math.sin(theta) * sinPhi;
  return new THREE.Vector3(x, y, z).normalize();
}

/** Rotación Y (GMST) para orientación normal de la Tierra */
function earthRotationY(jd) {
  // Con la convención de latLonToMeshLocal, el meridiano de Greenwich (lon=0)
  // queda en theta=π → punto (+sin phi, …) sobre +X cuando rotation.y = 0.
  // GMST gira ese meridiano respecto al cielo.
  return -gmstRadians(jd);
}

/**
 * Orienta la Tierra (solo yaw del mesh) para que el punto (lat,lon)
 * quede lo más alineado posible con la dirección al Sol.
 * Con elevación baja (atardecer) el punto queda cerca del terminador.
 */
function orientEarthPointToSun(earthMesh, lat, lon, toSun, elevDeg) {
  const local = latLonToMeshLocal(lat, lon);
  const lx = local.x, lz = local.z;
  if (Math.hypot(lx, lz) < 1e-6) return;

  const sx = toSun.x, sz = toSun.z;
  if (Math.hypot(sx, sz) < 1e-6) return;

  // R_y(angle) en Three.js: (x',z') = (x cosθ + z sinθ, −x sinθ + z cosθ)
  // Queremos que el azimut del punto coincida con el del Sol
  const aLocal = Math.atan2(lz, lx);
  const aSun = Math.atan2(sz, sx);
  earthMesh.rotation.y = aSun - aLocal;

  // Elevación: offset moderado hacia el atardecer, sin pasar a la noche
  const elev = elevDeg != null ? elevDeg : 15;
  if (elev < 85) {
    const termOffset = deg2rad(Math.min(90 - elev, 70)) * 0.5;
    earthMesh.rotation.y -= termOffset;
  }
}

function updatePositions(jd) {
  const T = centuriesSinceJ2000(jd);

  for (const [id, body] of Object.entries(bodies)) {
    if (body.data.parent) continue;

    const pos = keplerPosition(body.data, T);
    body.group.position.copy(pos);

    // Rotación propia (GMST + offset de eclipse si aplica)
    if (id === 'earth') {
      body.mesh.rotation.y = earthRotationY(jd) + (eclipseActive ? eclipseYawOffset : 0);
    } else {
      const rotDays = jd - 2451545.0;
      const rotAngle = (rotDays / body.data.rotationPeriod) * Math.PI * 2;
      body.mesh.rotation.y = rotAngle;
    }

    // Nubes: rotación independiente (no bloquear al spin de la Tierra)


    // Lunas: traslación orbital + rotación síncrona (mismo periodo → cara fija)
    for (const moon of body.moons) {
      const orbitR = moon.visualOrbit || moon.data.a;
      const moonDays = jd - 2451545.0;
      const period = Math.abs(moon.data.period) || 1;
      const sign = Math.sign(moon.data.period || 1);
      // Ángulo orbital: 2π * (días / periodo sidéreo)
      let moonAngle = (moonDays / period) * Math.PI * 2 * sign;
      // Desfase solo para la Luna terrestre (ajustar fase en efemérides)
      if (moon.id === 'moon') moonAngle += moonPhaseOffset;
      moon.group.position.set(
        Math.cos(moonAngle) * orbitR,
        0,
        Math.sin(moonAngle) * orbitR
      );
      // Rotación síncrona (periodación = traslación): siempre la misma cara a la Tierra
      moon.mesh.rotation.y = moonAngle + Math.PI;
      moon.mesh.scale.setScalar(1);
    }
  }

  updateEclipseShadow();
}

function ensureEclipseShadowOnEarth(earthMesh) {
  if (eclipseShadowParent === earthMesh) return;
  if (eclipseShadowParent) {
    eclipseShadowParent.remove(eclipseShadowGroup);
  }
  earthMesh.add(eclipseShadowGroup);
  eclipseShadowParent = earthMesh;
}

function updateEclipseShadow() {
  const earth = bodies.earth;
  const moon = bodies.moon;
  if (!earth || !moon) {
    eclipseShadowGroup.visible = false;
    return;
  }

  // Sin modo eclipse → sin umbra educativa
  if (!eclipseActive) {
    eclipseShadowGroup.visible = false;
    return;
  }

  ensureEclipseShadowOnEarth(earth.mesh);
  earth.group.updateMatrixWorld(true);
  moon.group.updateMatrixWorld(true);

  const epos = new THREE.Vector3();
  earth.group.getWorldPosition(epos);
  const toSun = epos.clone().negate().normalize(); // Tierra → Sol
  const er = earth.radius;

  // Dirección Tierra → Luna (espacio mundo)
  const mpos = new THREE.Vector3();
  moon.mesh.getWorldPosition(mpos);
  const toMoon = mpos.clone().sub(epos);
  const moonDist = toMoon.length();
  if (moonDist < 1e-12) {
    eclipseShadowGroup.visible = false;
    return;
  }
  toMoon.multiplyScalar(1 / moonDist);

  // Alineación: solo hay eclipse solar si la Luna está aproximadamente
  // entre el Sol y la Tierra (mismo hemisferio hacia el Sol)
  const align = toMoon.dot(toSun);
  if (align < 0.85) {
    // Luna fuera de la zona de luna nueva → no umbra
    eclipseShadowGroup.visible = false;
    return;
  }

  // Umbra en la intersección del eje Tierra→Luna con la superficie
  // (alineada con la Luna; se mueve al orbitar y al rotar la Tierra)
  const inv = new THREE.Matrix4().copy(earth.mesh.matrixWorld).invert();
  const localHit = toMoon.clone().transformDirection(inv).normalize();

  const surfaceLocal = localHit.clone().multiplyScalar(er * 1.03);
  eclipseShadowGroup.position.copy(surfaceLocal);
  eclipseShadowGroup.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 0, 1),
    localHit
  );
  eclipseShadowGroup.renderOrder = 10;

  // Intensidad según alineación (1 = perfecta)
  const intensity = Math.min(1, (align - 0.85) / 0.15);
  const discR = er * 0.22 * (0.7 + 0.3 * intensity);
  if (typeof eclipsePenumbraMesh !== 'undefined') {
    eclipsePenumbraMesh.scale.set(discR, discR, 1);
    eclipsePenumbraMesh.material.opacity = 0.45 * intensity;
    eclipsePenumbraMesh.visible = true;
  }
  eclipseShadowMesh.scale.set(discR * 0.42, discR * 0.42, 1);
  eclipseShadowMesh.material.opacity = 0.82 * intensity;
  eclipseShadowGroup.visible = true;
  eclipseShadowMesh.visible = true;
}

// Cámara de seguimiento
function updateFollow() {
  if (followId === 'sun') {
    // no forzar target
    return;
  }
  const body = bodies[followId];
  if (!body) return;

  const worldPos = new THREE.Vector3();
  body.mesh.getWorldPosition(worldPos);
  controls.target.lerp(worldPos, 0.12);

  // Ajustar distancia mínima según tamaño
  const dist = camera.position.distanceTo(worldPos);
  const minD = body.radius * 3;
  if (dist < minD) {
    const dir = camera.position.clone().sub(worldPos).normalize();
    camera.position.copy(worldPos).add(dir.multiplyScalar(minD));
  }
}

// ─────────────────────────────────────────────────────────────
// UI
const dateInput = document.getElementById('dateInput');
const speedSlider = document.getElementById('speedSlider');
const speedValue = document.getElementById('speedValue');
const timeDisplay = document.getElementById('timeDisplay');
const followSelect = document.getElementById('followSelect');
const showOrbitsCb = document.getElementById('showOrbits');
const showLabelsCb = document.getElementById('showLabels');
const showMoonsCb = document.getElementById('showMoons');

function formatDate(d) {
  return d.toISOString().slice(0, 19).replace('T', ' ') + ' UTC';
}

/** datetime-local siempre en UTC (sin conversión del navegador) */
function syncDateInput() {
  const y = simDate.getUTCFullYear();
  const m = String(simDate.getUTCMonth() + 1).padStart(2, '0');
  const d = String(simDate.getUTCDate()).padStart(2, '0');
  const h = String(simDate.getUTCHours()).padStart(2, '0');
  const min = String(simDate.getUTCMinutes()).padStart(2, '0');
  dateInput.value = `${y}-${m}-${d}T${h}:${min}`;
}

function readDateInputUTC() {
  const val = dateInput.value;
  if (!val) return null;
  // Interpretar el valor del input como UTC explícito
  const d = new Date(val.length === 16 ? val + ':00Z' : val + 'Z');
  return isNaN(d.getTime()) ? null : d;
}

function updateSpeedLabel() {
  const v = parseFloat(speedSlider.value);
  // 1x = tiempo real; 86400x ≈ 1 día/segundo
  timeScale = Math.pow(10, v);
  if (timeScale >= 86400) {
    speedValue.textContent = (timeScale / 86400).toFixed(timeScale >= 864000 ? 0 : 1) + ' d/s';
  } else if (timeScale >= 3600) {
    speedValue.textContent = (timeScale / 3600).toFixed(1) + ' h/s';
  } else if (timeScale >= 60) {
    speedValue.textContent = (timeScale / 60).toFixed(1) + ' min/s';
  } else if (timeScale >= 1) {
    speedValue.textContent = timeScale.toFixed(timeScale >= 10 ? 0 : 1) + 'x';
  } else {
    speedValue.textContent = timeScale.toFixed(3) + 'x';
  }
}

speedSlider.addEventListener('input', updateSpeedLabel);
updateSpeedLabel();

document.getElementById('setDateBtn').addEventListener('click', () => {
  const d = readDateInputUTC();
  if (d) {
    simDate = d;
    // Mantener modo eclipse si seguimos cerca (±2 h) del evento seleccionado
    if (eclipseActive && ephemerisSelect && ephemerisSelect.value !== '') {
      const item = ephemerisList[parseInt(ephemerisSelect.value, 10)];
      if (item) {
        const eventDate = parseEphemerisDate(item);
        if (eventDate && Math.abs(d.getTime() - eventDate.getTime()) < 2 * 3600 * 1000) {
          // seguir en modo eclipse
        } else {
          eclipseActive = false;
          eclipseYawOffset = 0;
    moonPhaseOffset = 0;
          eclipseTarget = null;
        }
      }
    } else {
      eclipseActive = false;
      eclipseYawOffset = 0;
    moonPhaseOffset = 0;
      eclipseTarget = null;
    }
    updatePositions(julianDate(simDate));
  }
});

document.getElementById('nowBtn').addEventListener('click', () => {
  simDate = new Date();
  syncDateInput();
  updatePositions(julianDate(simDate));
});

// ── Efemérides ───────────────────────────────────────────────
let ephemerisList = [];
const ephemerisSelect = document.getElementById('ephemerisSelect');
const ephemerisInfo = document.getElementById('ephemerisInfo');
const ephemerisGoBtn = document.getElementById('ephemerisGoBtn');

function formatFechaLabel(fecha, hora) {
  // fecha: YYYYMMDD
  if (!fecha || fecha.length !== 8) return fecha + (hora ? ' ' + hora : '');
  const y = fecha.slice(0, 4);
  const m = fecha.slice(4, 6);
  const d = fecha.slice(6, 8);
  return `${d}/${m}/${y} ${hora || ''}`.trim();
}

function parseEphemerisDate(item) {
  const f = String(item.fecha || '');
  // Preferir hora UTC explícita; si no, interpretar hora local España
  let h = String(item.horaUTC || '');
  if (!h) {
    h = String(item.hora || '12:00');
    // Sin horaUTC: asumir peninsular verano (UTC+2) si tz CEST, else UTC+1
    const tz = (item.tz || 'CEST').toUpperCase();
    const offset = tz === 'CET' ? 1 : 2;
    const [hh, mm] = h.split(':').map(Number);
    let utcH = hh - offset;
    let dayAdj = 0;
    if (utcH < 0) { utcH += 24; dayAdj = -1; }
    h = `${String(utcH).padStart(2, '0')}:${String(mm || 0).padStart(2, '0')}`;
    if (dayAdj && f.length === 8) {
      // ajuste de día omitido por simplicidad; horaUTC debería venir en el JSON
    }
  }
  if (f.length !== 8) return null;
  const iso = `${f.slice(0, 4)}-${f.slice(4, 6)}-${f.slice(6, 8)}T${h.length === 5 ? h + ':00' : h}Z`;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

/** Coordenadas desde el JSON de efemérides (lat, lon, elevDeg) */
function targetFromEphemerisItem(item) {
  if (!item) return null;
  const lat = parseFloat(item.lat);
  const lon = parseFloat(item.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const elev = parseFloat(item.elevDeg);
  return {
    lat,
    lon,
    elevDeg: Number.isFinite(elev) ? elev : 15
  };
}

function applyEphemeris(index) {
  const item = ephemerisList[index];
  if (!item) return;
  const d = parseEphemerisDate(item);
  if (!d) return;
  simDate = d;
  syncDateInput();
  eclipseActive = !!item.eclipse;

  // Coordenadas del JSON
  eclipseTarget = eclipseActive ? targetFromEphemerisItem(item) : null;
  eclipseYawOffset = 0;
  moonPhaseOffset = 0;

  if (eclipseActive && bodies.earth && bodies.moon) {
    const jd0 = julianDate(simDate);
    const T0 = centuriesSinceJ2000(jd0);
    const pos = keplerPosition(bodies.earth.data, T0);
    const toSun = pos.clone().negate().normalize();

    // 1) Fase lunar: en t0 la Luna debe estar entre Sol y Tierra (luna nueva)
    //    posición orbital (cos θ, 0, sin θ) ∥ toSun en el plano XZ del group
    const moonDays = jd0 - 2451545.0;
    const period = Math.abs(bodies.moon.data.period) || 27.321661;
    const baseAngle = (moonDays / period) * Math.PI * 2;
    const desiredAngle = Math.atan2(toSun.z, toSun.x); // cosθ≈toSun.x, sinθ≈toSun.z
    moonPhaseOffset = desiredAngle - baseAngle;

    // 2) Rotación terrestre: en t0 el lugar del JSON bajo el eje de sombra
    if (eclipseTarget) {
      const baseY = earthRotationY(jd0);
      const local = latLonToMeshLocal(eclipseTarget.lat, eclipseTarget.lon);
      const lx = local.x, lz = local.z;
      const sx = toSun.x, sz = toSun.z;
      if (Math.hypot(lx, lz) > 1e-6 && Math.hypot(sx, sz) > 1e-6) {
        let desiredY = Math.atan2(sz, sx) - Math.atan2(lz, lx);
        const elev = eclipseTarget.elevDeg != null ? eclipseTarget.elevDeg : 15;
        if (elev < 85) {
          desiredY -= deg2rad(Math.min(90 - elev, 70)) * 0.5;
        }
        eclipseYawOffset = desiredY - baseY;
      }
    }
  }

  updatePositions(julianDate(simDate));
  paused = true;

  if (eclipseActive && bodies.earth) {
    followId = 'earth';
    followSelect.value = 'earth';
    bodies.earth.mesh.updateMatrixWorld(true);
    const wp = new THREE.Vector3();
    bodies.earth.mesh.getWorldPosition(wp);
    // Mirar el punto del eclipse (Avilés, etc.) según la rotación real (GMST)
    let lookDir = wp.clone().negate().normalize(); // hacia el Sol por defecto
    if (eclipseTarget) {
      const local = latLonToMeshLocal(eclipseTarget.lat, eclipseTarget.lon);
      lookDir = local.clone().transformDirection(bodies.earth.mesh.matrixWorld).normalize();
    }
    const viewDist = bodies.earth.radius * 9;
    const surface = wp.clone().add(lookDir.clone().multiplyScalar(bodies.earth.radius));
    controls.target.copy(surface);
    camera.position.copy(surface)
      .add(lookDir.clone().multiplyScalar(viewDist * 0.85))
      .add(new THREE.Vector3(0, viewDist * 0.25, 0));
    controls.update();
  }

  const link = item.link || '';
  const localH = item.hora || '';
  const utcH = item.horaUTC || '';
  const tz = item.tz || '';
  ephemerisInfo.hidden = false;
  ephemerisInfo.innerHTML =
    `<strong>${item.tipo || 'Evento'}</strong><br>` +
    (localH ? `${formatFechaLabel(item.fecha, localH)} ${tz || 'local'}<br>` : '') +
    (utcH ? `${formatFechaLabel(item.fecha, utcH)} UTC<br>` : '') +
    `Simulación: ${formatDate(simDate)}<br>` +
    (loc ? `📍 ${loc}<br>` : '') +
    (item.nota ? `<em>${item.nota}</em><br>` : '') +
    (link ? `<a href="${link}" target="_blank" rel="noopener">Más información</a>` : '');
}

async function loadEphemerides() {
  try {
    const res = await fetch('efemerides.json');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    ephemerisList = Array.isArray(data) ? data : [];
    ephemerisSelect.innerHTML = '<option value="">— Seleccionar momento —</option>';
    ephemerisList.forEach((item, i) => {
      const loc = item.localizacion || item['localización'] || '';
      const opt = document.createElement('option');
      opt.value = String(i);
      opt.textContent = `${item.tipo || 'Evento'} · ${formatFechaLabel(item.fecha, item.hora)}${loc ? ' · ' + loc : ''}`;
      ephemerisSelect.appendChild(opt);
    });
  } catch (err) {
    console.warn('No se pudieron cargar las efemérides:', err);
    ephemerisSelect.innerHTML = '<option value="">(Sin efemérides)</option>';
  }
}

ephemerisSelect.addEventListener('change', () => {
  const v = ephemerisSelect.value;
  if (v === '') {
    ephemerisInfo.hidden = true;
    eclipseActive = false;
    eclipseYawOffset = 0;
    moonPhaseOffset = 0;
    if (typeof updateEclipseShadow === 'function') updateEclipseShadow();
    return;
  }
  applyEphemeris(parseInt(v, 10));
});

ephemerisGoBtn.addEventListener('click', () => {
  const v = ephemerisSelect.value;
  if (v !== '') applyEphemeris(parseInt(v, 10));
});

loadEphemerides();

document.getElementById('pauseBtn').addEventListener('click', () => { paused = true; });
document.getElementById('playBtn').addEventListener('click', () => { paused = false; });

followSelect.addEventListener('change', () => {
  followId = followSelect.value;
  if (followId === 'sun') {
    controls.target.set(0, 0, 0);
  }
});

document.getElementById('resetCamBtn').addEventListener('click', () => {
  followId = 'sun';
  followSelect.value = 'sun';
  controls.target.set(0, 0, 0);
  camera.position.set(0, 8, 25);
  controls.update();
});

showOrbitsCb.addEventListener('change', () => {
  for (const b of Object.values(bodies)) {
    if (b.orbitLine) b.orbitLine.visible = showOrbitsCb.checked;
  }
});

showLabelsCb.addEventListener('change', () => {
  for (const b of Object.values(bodies)) {
    if (b.label) b.label.visible = showLabelsCb.checked;
  }
  sunLabel.visible = showLabelsCb.checked;
});

showMoonsCb.addEventListener('change', () => {
  for (const b of Object.values(bodies)) {
    if (b.data && b.data.parent) {
      b.group.visible = showMoonsCb.checked;
      if (b.orbitLine) b.orbitLine.visible = showMoonsCb.checked && showOrbitsCb.checked;
    }
  }
});

// Toggle texturas procedurales ↔ imagen
const useTexturesCb = document.getElementById('useTextures');
useTexturesCb.addEventListener('change', async () => {
  if (useTexturesCb.checked) {
    useTexturesCb.disabled = true;
    await ensureImageMaterials();
    useTexturesCb.disabled = false;
    applyTextureMode(true);
  } else {
    applyTextureMode(false);
  }
});

// Modal Acerca de
const aboutModal = document.getElementById('aboutModal');
const aboutBtn = document.getElementById('aboutBtn');
const aboutClose = document.getElementById('aboutClose');
const aboutBackdrop = document.getElementById('aboutBackdrop');

function openAbout() {
  aboutModal.classList.add('open');
  aboutModal.setAttribute('aria-hidden', 'false');
}
function closeAbout() {
  aboutModal.classList.remove('open');
  aboutModal.setAttribute('aria-hidden', 'true');
}
aboutBtn.addEventListener('click', openAbout);
aboutClose.addEventListener('click', closeAbout);
aboutBackdrop.addEventListener('click', closeAbout);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && aboutModal.classList.contains('open')) closeAbout();
});

// Panel lateral plegable (pantalla completa)
const togglePanelBtn = document.getElementById('togglePanelBtn');
const closePanelBtn = document.getElementById('closePanelBtn');
function setPanelCollapsed(collapsed) {
  document.body.classList.toggle('panel-collapsed', collapsed);
  if (togglePanelBtn) {
    togglePanelBtn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
  }
}
if (closePanelBtn) {
  closePanelBtn.addEventListener('click', () => setPanelCollapsed(true));
}
if (togglePanelBtn) {
  togglePanelBtn.addEventListener('click', () => {
    setPanelCollapsed(!document.body.classList.contains('panel-collapsed'));
  });
}
// En pantallas estrechas, empezar con el panel plegado para ver el canvas
if (window.matchMedia('(max-width: 700px)').matches) {
  setPanelCollapsed(true);
}

// Evitar menú contextual al usar botón derecho para pan
renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());

// Raycaster para clic
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

renderer.domElement.addEventListener('click', (event) => {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  const hits = raycaster.intersectObjects(allPickables, false);
  if (hits.length > 0) {
    const id = hits[0].object.userData.id;
    if (id) {
      followId = id;
      followSelect.value = id;
    }
  }
});

// ─────────────────────────────────────────────────────────────
// Loop
let shaderTime = 0;
function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;

  if (!paused) {
    // 1x = tiempo real (dt segundos → dt * timeScale segundos de simulación)
    simDate = new Date(simDate.getTime() + dt * timeScale * 1000);
  }

  // Animar shaders (Sol, gas, nubes, anillos, nebulosas…)
  shaderTime += dt;
  for (const m of shaderMaterials) {
    if (m.uniforms && m.uniforms.uTime) m.uniforms.uTime.value = shaderTime;
  }
  for (const m of nebulaMaterials) {
    if (m.uniforms && m.uniforms.uTime) m.uniforms.uTime.value = shaderTime;
  }
  for (const m of sunCoronaMats) {
    if (m.uniforms && m.uniforms.uTime) m.uniforms.uTime.value = shaderTime;
  }

  // Nubes dinámicas: spin relativo + uTime en materiales de textura
  const earthBody = bodies.earth;
  if (earthBody && earthBody.mesh) {
    const em = earthBody.mesh;
    // Factor de velocidad: más rápido si el tiempo simulado está acelerado
    const cloudRate = Math.min(Math.max(timeScale, 0.2), 500);
    if (em.userData.clouds) {
      em.userData.clouds.rotation.y += (em.userData.cloudSpinLow || 0.000012) * cloudRate * dt * 60;
      if (em.userData.clouds.material && em.userData.clouds.material.uniforms && em.userData.clouds.material.uniforms.uTime) {
        em.userData.clouds.material.uniforms.uTime.value = shaderTime;
      }
    }
    if (em.userData.cloudsHigh) {
      em.userData.cloudsHigh.rotation.y += (em.userData.cloudSpinHigh || -0.000008) * cloudRate * dt * 60;
      if (em.userData.cloudsHigh.material && em.userData.cloudsHigh.material.uniforms && em.userData.cloudsHigh.material.uniforms.uTime) {
        em.userData.cloudsHigh.material.uniforms.uTime.value = shaderTime * 1.15;
      }
    }
  }

  const jd = julianDate(simDate);
  updatePositions(jd);

  // Luz desde el Sol (origen) hacia cada cuerpo + atmósfera
  for (const body of Object.values(bodies)) {
    if (!body.mesh) continue;
    const wp = new THREE.Vector3();
    body.mesh.getWorldPosition(wp);
    if (wp.lengthSq() <= 1e-12) continue;
    const L = wp.clone().normalize().negate();

    if (body.mesh.material && body.mesh.material.uniforms && body.mesh.material.uniforms.uLightDir) {
      body.mesh.material.uniforms.uLightDir.value.copy(L);
    }
    // Nubes / anillos hijos del mesh
    body.mesh.traverse(child => {
      if (child.material && child.material.uniforms && child.material.uniforms.uLightDir) {
        child.material.uniforms.uLightDir.value.copy(L);
      }
    });
    // Atmósfera (hija del axialGroup)
    const atmo = body.mesh.userData.atmosphere;
    if (atmo && atmo.material && atmo.material.uniforms) {
      if (atmo.material.uniforms.uLightDir) atmo.material.uniforms.uLightDir.value.copy(L);
      if (atmo.material.uniforms.uCamPos) atmo.material.uniforms.uCamPos.value.copy(camera.position);
    }
  }

  updateFollow();
  controls.update();
  updateStarParallax();

  timeDisplay.textContent = formatDate(simDate);

  renderer.render(scene, camera);
  labelRenderer.render(scene, camera);
}

// Resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  labelRenderer.setSize(window.innerWidth, window.innerHeight);
});

// Arranque
initBodies();
simDate = new Date();
syncDateInput();
updatePositions(julianDate(simDate));
animate(performance.now());
// Bitmap por defecto (procedural solo si falla la carga)
initDefaultTextures().catch((e) => console.warn('Texturas:', e));
