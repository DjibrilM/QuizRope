import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TouchableOpacity, View } from "react-native";
import {
  Canvas,
  Circle as SkiaCircle,
  Fill,
  Group,
  interpolatePaths,
  Path as SkiaPath,
  RadialGradient as SkiaRadialGradient,
  Shader,
  Skia,
  type SkPath,
} from "@shopify/react-native-skia";
import Svg, {
  Circle,
  ClipPath,
  Defs,
  Ellipse,
  G,
  Path as SvgPath,
  RadialGradient,
  Stop,
} from "react-native-svg";
import * as Haptics from "expo-haptics";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useDerivedValue,
  useFrameCallback,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

const VIEWBOX = 100;
const CENTER = VIEWBOX / 2;
const EYE_OFFSET = 15.5;
const EYE_CENTER_Y = 55;
const EYE_WIDTH = 10.5;
const EYE_HEIGHT = 24;
const GAZE_RANGE = 5.5;
const ORB_RADIUS = 47;
const TAU = Math.PI * 2;
const DEG_TO_RAD = Math.PI / 180;
const FEATURE_INK = "#1B1528";

const BLINK_EASE_IN = Easing.bezier(0.4, 0, 1, 1);
const BLINK_EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
const GAZE_SPRING = { damping: 24, stiffness: 240 } as const;
const MORPH_SPRING = { damping: 16, stiffness: 210 } as const;

const SACCADE_TARGETS = [
  { x: -1, y: -0.95 },
  { x: 1, y: -0.95 },
  { x: -0.65, y: -0.45 },
  { x: 0.8, y: -0.85 },
  { x: -0.25, y: -1 },
  { x: 0.3, y: -0.55 },
] as const;

const clamp = (value: number, min: number, max: number) => {
  "worklet";
  return Math.max(min, Math.min(max, value));
};

export type OrbState =
  | "idle"
  | "listening"
  | "thinking"
  | "streaming"
  | "done"
  | "error";

export interface EyeShape {
  arch?: number;
  botArch?: number;
  dy?: number;
  h: number;
  rotate?: number;
  topArch?: number;
  w: number;
}

export interface Expression {
  left: EyeShape;
  right: EyeShape;
}

const EYE = (
  h: number,
  w = 1,
  rotate = 0,
  dy = 0,
  topArch = 0,
  botArch = topArch,
): EyeShape => ({
  arch: topArch,
  botArch,
  dy,
  h,
  rotate,
  topArch,
  w,
});

const symmetric = (
  h: number,
  w = 1,
  rotate = 0,
  dy = 0,
  topArch = 0,
  botArch = topArch,
): Expression => ({
  left: EYE(h, w, rotate, dy, topArch, botArch),
  right: EYE(h, w, -rotate, dy, topArch, botArch),
});

export const ORB_EXPRESSIONS = {
  alert: symmetric(1.18, 1.06, 0, -1),
  content: symmetric(0.28, 1.28, 0, 1, -5.0),
  cozy: symmetric(0.52, 1.12, 0, 1.4, -2.2),
  cross: symmetric(0.85, 1, 18),
  curious: {
    left: EYE(1.12, 1.04, 4, -1.0, -0.5),
    right: EYE(0.9, 1.0, -7, 0.4, 0.4),
  },
  curiousRight: {
    left: EYE(0.9, 1.0, 7, 0.4, 0.4),
    right: EYE(1.12, 1.04, -4, -1.0, -0.5),
  },
  deadpan: symmetric(0.14, 1.35),
  doubtful: { left: EYE(1, 1), right: EYE(0.45, 1.1, -14) },
  eager: symmetric(1.26, 1.15, 0, -1.8, -1.2),
  focused: symmetric(0.6, 1.06),
  giggle: symmetric(0.19, 1.38, 0, 1.2, -6.8),
  hopeful: {
    left: EYE(1.24, 1.12, 4, -2.4, -2.0, -0.4),
    right: EYE(1.24, 1.12, -4, -2.4, -2.0, -0.4),
  },
  joy: symmetric(0.24, 1.32, 0, 1, -6.0),
  mildSad: {
    left: EYE(0.62, 1.04, 11, 1.8, 1.4, -0.4),
    right: EYE(0.62, 1.04, -11, 1.8, 1.4, -0.4),
  },
  mischief: {
    left: EYE(0.48, 1.18, -5, 0.4, -1.4, -3.4),
    right: EYE(0.64, 1.12, 8, 0, -2.2),
  },
  neutral: symmetric(1),
  sad: {
    left: EYE(0.24, 1.24, -18, 2.5, 4.5),
    right: EYE(0.24, 1.24, 18, 2.5, 4.5),
  },
  shy: {
    left: EYE(0.78, 0.96, 9, 1.4),
    right: EYE(0.78, 0.96, -9, 1.4),
  },
  skeptical: {
    left: EYE(0.36, 1.18, 0, 0.5, 0.8),
    right: EYE(0.62, 1.08, -6, 0.2, 0.5),
  },
  sleepy: symmetric(0.4, 1.16, 0, 2.0, 2.6, 0.4),
  surprised: symmetric(0.5, 0.62, 0, -3.0),
  wink: {
    left: EYE(1.04, 1.0, 2),
    right: EYE(0.2, 1.26, 0, 1.4, -4.8),
  },
  winkLeft: {
    left: EYE(0.2, 1.26, 0, 1.4, -4.8),
    right: EYE(1.04, 1.0, -2),
  },
} satisfies Record<string, Expression>;

export type OrbExpressionName = keyof typeof ORB_EXPRESSIONS;

const STATE_EXPRESSION: Record<OrbState, OrbExpressionName> = {
  done: "joy",
  error: "sad",
  idle: "neutral",
  listening: "alert",
  streaming: "focused",
  thinking: "doubtful",
};

interface StateShaderConfig {
  colors: [string, string, string];
  flow: number;
  rim: number;
  specular: number;
  speed: number;
  turbulence: number;
  wobble: number;
}

// Monochromatic tonal stops of QuizRope Primary Purple (#6C5CE7)
const DEFAULT_ORB_COLORS: [string, string, string] = [
  "#5242CC",
  "#6C5CE7",
  "#8779F2",
];

// Monochromatic tonal stops for Sad/Error state
const ERROR_ORB_COLORS: [string, string, string] = [
  "#A63448",
  "#C9485C",
  "#DF7485",
];

const STATE_SHADER: Record<OrbState, StateShaderConfig> = {
  done: {
    colors: DEFAULT_ORB_COLORS,
    flow: 0.78,
    rim: 0.56,
    specular: 0.34,
    speed: 1.25,
    turbulence: 0.42,
    wobble: 0.22,
  },
  error: {
    colors: ERROR_ORB_COLORS,
    flow: 0.24,
    rim: 0.32,
    specular: 0.16,
    speed: 0.32,
    turbulence: 0.2,
    wobble: 0.04,
  },
  idle: {
    colors: DEFAULT_ORB_COLORS,
    flow: 0.62,
    rim: 0.44,
    specular: 0.28,
    speed: 0.7,
    turbulence: 0.38,
    wobble: 0.03,
  },
  listening: {
    colors: DEFAULT_ORB_COLORS,
    flow: 0.74,
    rim: 0.52,
    specular: 0.32,
    speed: 1.15,
    turbulence: 0.46,
    wobble: 0.12,
  },
  streaming: {
    colors: DEFAULT_ORB_COLORS,
    flow: 0.85,
    rim: 0.5,
    specular: 0.3,
    speed: 1.45,
    turbulence: 0.56,
    wobble: 0.14,
  },
  thinking: {
    colors: DEFAULT_ORB_COLORS,
    flow: 0.92,
    rim: 0.48,
    specular: 0.28,
    speed: 2.2,
    turbulence: 0.78,
    wobble: 0.08,
  },
};

const STATE_CODE: Record<OrbState, number> = {
  idle: 0,
  listening: 1,
  thinking: 2,
  streaming: 3,
  done: 4,
  error: 5,
};

function hexToOklab(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const r8 = parseInt(clean.slice(0, 2), 16) / 255;
  const g8 = parseInt(clean.slice(2, 4), 16) / 255;
  const b8 = parseInt(clean.slice(4, 6), 16) / 255;

  const toLinear = (u: number) =>
    u <= 0.04045 ? u / 12.92 : ((u + 0.055) / 1.055) ** 2.4;

  const r = toLinear(r8);
  const g = toLinear(g8);
  const b = toLinear(b8);

  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);

  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

/**
 * Monochromatic Skia SkSL sphere-impostor fragment shader preserving AlgoVault's
 * seamless flow-field marbling, spherical normals, subsurface scatter, Fresnel rim,
 * and specular catchlight inside a single purple (#6C5CE7) hue family.
 */
const ORB_SKSL = `
uniform float2 uRes;
uniform float uPhase;
uniform float3 uLab0;
uniform float3 uLab1;
uniform float3 uLab2;
uniform float uFlow;
uniform float uTurb;
uniform float uRim;
uniform float uSpec;
uniform float uWobble;
uniform float3 uLight;

const float TAU = 6.28318530718;
const float RAD = 0.94;
const float SCALE_N = 0.70;
const float SHIFT = 0.21;
const float BALANCE = 1.05;
const float CHROMA = 0.0;
const float INNER = 0.24;
const float SHADING = 0.24;
const float REFRACT = 0.25;
const float ABERR = 0.0;
const float GRAIN = 0.05;

float hash2(float2 p) {
  float3 p3 = fract(float3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + float3(33.33));
  return fract((p3.x + p3.y) * p3.z);
}

float vnoise(float2 p) {
  float2 i = floor(p);
  float2 f = fract(p);
  float2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash2(i), hash2(i + float2(1.0, 0.0)), u.x),
    mix(hash2(i + float2(0.0, 1.0)), hash2(i + float2(1.0, 1.0)), u.x),
    u.y
  );
}

float fbm(float2 p) {
  float s = 0.0;
  float a = 0.5;
  for (int k = 0; k < 3; k++) {
    s += a * vnoise(p);
    p *= 2.03;
    a *= 0.5;
  }
  return s / 0.875;
}

float2 flowField(float2 p, float phase) {
  float ang = TAU * vnoise(p + float2(11.3)) + phase;
  float mag = 0.35 + 0.65 * vnoise(p + float2(27.9));
  return float2(cos(ang), sin(ang)) * mag;
}

float3 labRamp3(float x) {
  float xx = clamp(x, 0.0, 1.0) * 2.0;
  float3 c = mix(uLab0, uLab1, clamp(xx, 0.0, 1.0));
  return mix(c, uLab2, clamp(xx - 1.0, 0.0, 1.0));
}

float3 paletteLab(float t) {
  float x = pow(clamp(0.5 + 0.5 * cos(TAU * t), 0.0, 1.0), BALANCE);
  float3 lab = labRamp3(x);
  float ang = TAU * (t * 2.0 + 0.123);
  lab.yz += 0.17 * CHROMA * length(lab.yz) * float2(sin(ang), cos(ang * 1.37 + 1.1));
  float ch = length(lab.yz);
  if (ch > 0.33) {
    lab.yz *= 0.33 / ch;
  }
  return lab;
}

float3 oklabToLinear(float3 c) {
  float l_ = c.x + 0.3963377774 * c.y + 0.2158037573 * c.z;
  float m_ = c.x - 0.1055613458 * c.y - 0.0638541728 * c.z;
  float s_ = c.x - 0.0894841775 * c.y - 1.2914855480 * c.z;
  float l = l_ * l_ * l_;
  float m = m_ * m_ * m_;
  float s = s_ * s_ * s_;
  return float3(
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
   -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
   -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
  );
}

float3 linearToSrgb(float3 c) {
  c = clamp(c, float3(0.0), float3(1.0));
  float3 lo = c * 12.92;
  float3 hi = 1.055 * pow(max(c, float3(0.0001)), float3(1.0 / 2.4)) - float3(0.055);
  return mix(lo, hi, step(float3(0.0031308), c));
}

half4 main(float2 fragCoord) {
  float minRes = min(uRes.x, uRes.y);
  float2 uv = (fragCoord * 2.0 - uRes) / max(minRes, 1.0);
  uv /= RAD;

  if (uWobble > 0.0) {
    float r0 = length(uv);
    float th = atan(uv.y, uv.x + 1e-5);
    float wob = 0.60 * sin(3.0 * th + uPhase)
              + 0.40 * sin(5.0 * th - 2.0 * uPhase)
              + 0.25 * sin(7.0 * th + 3.0 * uPhase);
    uv *= 1.0 - uWobble * 0.055 * wob * smoothstep(0.0, 0.5, r0);
  }

  float r = length(uv);
  float2 pd = uv / max(r, 1.0);
  float z = sqrt(max(1.0 - dot(pd, pd), 0.0));
  float3 n = float3(pd, z);

  float2 p0 = (pd - n.xy * REFRACT) * SCALE_N;
  float2 p1 = p0 + uFlow * flowField(p0, uPhase);
  float2 p2 = p1 + uTurb * flowField(p1 * 1.7 + float2(5.2), uPhase);
  float t = mix(0.5, fbm(p2 + float2(3.7)), 1.55) + SHIFT;

  float d = ABERR * 0.05 * r * r;
  float3 base = float3(
    oklabToLinear(paletteLab(t - d)).r,
    oklabToLinear(paletteLab(t)).g,
    oklabToLinear(paletteLab(t + d)).b
  );
  base = max(base, float3(0.0));

  float3 L = normalize(uLight);
  float ndl = dot(n, L);
  float halfLambert = pow(clamp(ndl * 0.5 + 0.5, 0.0, 1.0), 1.55);
  float3 shadowBase = base * float3(0.42, 0.36, 0.54);
  float3 col = mix(shadowBase, base * 1.1, mix(0.35, halfLambert, SHADING * 3.6));

  // Subtle subsurface warmth and cool lower floor bounce for spherical volume
  float2 op = pd + L.xy * 0.45;
  col += INNER * exp(-dot(op, op) * 2.1) * base;
  float bounce = pow(clamp(n.y, 0.0, 1.0), 1.9) * 0.14;
  col += mix(base, float3(0.55, 0.48, 0.92), 0.35) * bounce;

  // Dual-lobe glossy specular + crisp Fresnel rim light
  float3 halfVec = normalize(L + float3(0.0, 0.0, 1.0));
  float rimFactor = pow(clamp(1.0 - n.z, 0.0, 1.0), 4.2);
  float softSpec = pow(max(dot(n, halfVec), 0.0001), 16.0);
  float crispSpec = pow(max(dot(n, halfVec), 0.0001), 88.0);
  col += mix(base, float3(1.0), 0.78) * (rimFactor * uRim)
       + float3(softSpec * uSpec * 0.45 + crispSpec * uSpec * 1.55);

  col = col / (float3(1.0) + col * 0.18);
  float3 lit = linearToSrgb(col);
  float feather = clamp(1.6 / max(minRes, 1.0), 0.005, 0.028);
  float body = 1.0 - smoothstep(1.0 - feather, 1.0, r);

  float grainNoise = hash2(floor(fragCoord * 2.0) + float2(floor(uPhase * 4.0)));
  float3 outCol = lit + float3((grainNoise - 0.5) * (GRAIN * 0.07 + 1.0 / 255.0));
  outCol = clamp(outCol, float3(0.0), float3(1.0));

  return half4(half3(outCol * body), half(body));
}
`;

let ORB_RUNTIME_EFFECT: ReturnType<typeof Skia.RuntimeEffect.Make> = null;
try {
  ORB_RUNTIME_EFFECT = Skia.RuntimeEffect.Make(ORB_SKSL);
} catch {
  ORB_RUNTIME_EFFECT = null;
}

/**
 * Generates an eye silhouette centered at `(0, 0)` with the exact 6-cubic
 * Bezier topology from AlgoVault's AIOrbFace so every expression morphs
 * continuously into any other via Skia `interpolatePaths`.
 */
function buildEyePath(shape: EyeShape): string {
  const width = EYE_WIDTH * shape.w;
  const height = Math.max(EYE_HEIGHT * shape.h, 1.4);
  const hw = width / 2;
  const hh = height / 2;
  const r = Math.min(hw, hh);
  const capY = Math.max(0, hh - r);
  const flatX = Math.max(0, hw - r);
  const k = 0.5523;
  const kx = flatX * 0.52 + k * r;

  const tArch = shape.topArch ?? shape.arch ?? 0;
  const bArch = shape.botArch ?? shape.arch ?? 0;
  const meanArch = (tArch + bArch) * 0.5;
  const edgeDrop = -meanArch * 0.42;

  const endSlope = clamp(-meanArch / Math.max(hw, 1), -0.75, 0.75);
  const ky = k * r * (1 - Math.abs(endSlope) * 0.45);
  const tipOutX = r * 0.35 * Math.abs(endSlope);

  const sideTopY = -capY + edgeDrop;
  const sideBotY = capY + edgeDrop;
  const topPeakY = -hh + tArch + edgeDrop;
  const botTroughY = hh + bArch + edgeDrop;

  const topTipDelta = tipOutX * (tArch < 0 ? 0.5 : -0.5);
  const botTipDelta = tipOutX * (bArch > 0 ? 0.5 : -0.5);

  const f = (n: number) => n.toFixed(2);

  return [
    `M ${f(-hw)} ${f(sideTopY)}`,
    `C ${f(-hw - topTipDelta)} ${f(sideTopY - ky)} ${f(-kx)} ${f(topPeakY)} 0.00 ${f(topPeakY)}`,
    `C ${f(kx)} ${f(topPeakY)} ${f(hw + topTipDelta)} ${f(sideTopY - ky)} ${f(hw)} ${f(sideTopY)}`,
    `C ${f(hw)} ${f(sideTopY + capY * 0.33)} ${f(hw)} ${f(sideBotY - capY * 0.33)} ${f(hw)} ${f(sideBotY)}`,
    `C ${f(hw + botTipDelta)} ${f(sideBotY + ky)} ${f(kx)} ${f(botTroughY)} 0.00 ${f(botTroughY)}`,
    `C ${f(-kx)} ${f(botTroughY)} ${f(-hw - botTipDelta)} ${f(sideBotY + ky)} ${f(-hw)} ${f(sideBotY)}`,
    `C ${f(-hw)} ${f(sideBotY - capY * 0.33)} ${f(-hw)} ${f(sideTopY + capY * 0.33)} ${f(-hw)} ${f(sideTopY)}`,
    "Z",
  ].join(" ");
}

function compileSkiaPath(svgString: string): SkPath {
  return Skia.Path.MakeFromSVGString(svgString) ?? Skia.Path.Make();
}

interface LivingBeatConfig {
  mood: OrbExpressionName;
  holdMs: number;
  gx: number;
  gy: number;
  tiltDeg: number;
  hopY: number;
}

function pickLivingBeat(lastCategory: number): {
  category: number;
  sequence: LivingBeatConfig[];
} {
  const choices = [0, 1, 2, 3, 4, 5].filter((c) => c !== lastCategory);
  const category = choices[Math.floor(Math.random() * choices.length)];

  switch (category) {
    case 0: {
      const lookLeft = Math.random() < 0.5;
      return {
        category,
        sequence: [
          {
            mood: lookLeft ? "curious" : "curiousRight",
            holdMs: 1200 + Math.random() * 500,
            gx: (lookLeft ? -0.68 : 0.68) * GAZE_RANGE,
            gy: -0.46 * GAZE_RANGE,
            tiltDeg: lookLeft ? -5.5 : 5.5,
            hopY: -1.4,
          },
        ],
      };
    }
    case 1: {
      const enthusiastic = Math.random() < 0.45;
      return {
        category,
        sequence: [
          {
            mood: enthusiastic ? "giggle" : "content",
            holdMs: 950 + Math.random() * 450,
            gx: 0,
            gy: -0.18 * GAZE_RANGE,
            tiltDeg: (Math.random() - 0.5) * 6,
            hopY: enthusiastic ? -3.0 : -1.8,
          },
        ],
      };
    }
    case 2: {
      const winkLeft = Math.random() < 0.35;
      return {
        category,
        sequence: [
          {
            mood: winkLeft ? "winkLeft" : "wink",
            holdMs: 750 + Math.random() * 250,
            gx: (winkLeft ? -0.25 : 0.25) * GAZE_RANGE,
            gy: -0.1 * GAZE_RANGE,
            tiltDeg: winkLeft ? -4.5 : 4.5,
            hopY: -1.0,
          },
        ],
      };
    }
    case 3:
      return {
        category,
        sequence: [
          {
            mood: "surprised",
            holdMs: 280,
            gx: (Math.random() - 0.5) * 0.4 * GAZE_RANGE,
            gy: -0.4 * GAZE_RANGE,
            tiltDeg: 0,
            hopY: -2.4,
          },
          {
            mood: Math.random() < 0.5 ? "eager" : "hopeful",
            holdMs: 1050,
            gx: 0.1 * GAZE_RANGE,
            gy: -0.32 * GAZE_RANGE,
            tiltDeg: 3.0,
            hopY: -1.6,
          },
        ],
      };
    case 4:
      return {
        category,
        sequence: [
          {
            mood: Math.random() < 0.5 ? "sleepy" : "cozy",
            holdMs: 1150 + Math.random() * 450,
            gx: (Math.random() - 0.5) * 0.25 * GAZE_RANGE,
            gy: 0.28 * GAZE_RANGE,
            tiltDeg: -2.5,
            hopY: 1.5,
          },
        ],
      };
    default: {
      const variants: OrbExpressionName[] = ["doubtful", "skeptical", "shy", "mischief"];
      const mood = variants[Math.floor(Math.random() * variants.length)];
      const sign = Math.random() < 0.5 ? -1 : 1;
      return {
        category,
        sequence: [
          {
            mood,
            holdMs: 1000 + Math.random() * 400,
            gx: sign * 0.52 * GAZE_RANGE,
            gy: (mood === "shy" ? 0.35 : -0.28) * GAZE_RANGE,
            tiltDeg: sign * 4.5,
            hopY: mood === "shy" ? 1.0 : -0.8,
          },
        ],
      };
    }
  }
}

interface OrbEyeLayerProps {
  projTransform: React.ComponentProps<typeof Group>["transform"];
  lidTransform: React.ComponentProps<typeof Group>["transform"];
  poseTransform: React.ComponentProps<typeof Group>["transform"];
  path: React.ComponentProps<typeof SkiaPath>["path"];
  catchlightOpacity: React.ComponentProps<typeof Group>["opacity"];
}

function OrbEyeLayer({
  projTransform,
  lidTransform,
  poseTransform,
  path,
  catchlightOpacity,
}: OrbEyeLayerProps) {
  return (
    <Group transform={projTransform}>
      <Group transform={lidTransform}>
        <Group transform={poseTransform}>
          {/* Recessed socket shadow for embedded 3D eye depth */}
          <Group transform={[{ translateY: 1.0 }, { scale: 1.09 }]}>
            <SkiaPath path={path} color="rgba(14, 7, 32, 0.34)" />
          </Group>
          {/* Glossy cornea gradient & studio catchlights clipped to eye aperture */}
          <Group clip={path}>
            <SkiaPath path={path} color={FEATURE_INK} />
            <SkiaCircle cx={0} cy={0} r={18}>
              <SkiaRadialGradient
                c={{ x: -2.8, y: -5.2 }}
                r={18}
                colors={["#3A2863", "#1A1130", "#0E081A"]}
                positions={[0, 0.55, 1]}
              />
            </SkiaCircle>
            <Group opacity={catchlightOpacity}>
              <SkiaCircle
                cx={-2.1}
                cy={-4.8}
                r={1.85}
                color="rgba(255, 255, 255, 0.92)"
              />
              <SkiaCircle
                cx={2.0}
                cy={4.4}
                r={0.85}
                color="rgba(196, 181, 253, 0.48)"
              />
            </Group>
          </Group>
        </Group>
      </Group>
    </Group>
  );
}

interface MascotProps {
  size?: number;
  variant?: "floatUp" | "headSideBounce" | "splashPop" | "welcome";
  speed?: number;
  state?: OrbState;
  expression?: OrbExpressionName | Expression;
  showFloorShadow?: boolean;
  interactive?: boolean;
}

/**
 * Floating single-color (#6C5CE7) 3D-lit marbled orb mascot rendered with a Skia
 * SkSL shader and an organic living-creature facial engine: smooth GPU SkPath
 * morphing across 22 expressions, autonomous idle micro-moods, physiological micro-
 * saccades, spherical gaze projection with perspective tilt, asymmetric elastic
 * blinks, coupled head follow-through, and optional tap reaction.
 */
export function BrainMascot({
  size = 150,
  variant = "floatUp",
  speed = 1,
  state = "idle",
  expression,
  showFloorShadow = false,
  interactive = false,
}: MascotProps) {
  const uid = React.useId().replace(/[^a-zA-Z0-9]/g, "");
  const isError = state === "error";
  const isDone = state === "done";
  const isThinking = state === "thinking";
  const isIdleAuto = state === "idle" && !expression;
  const stateConfig = STATE_SHADER[state] ?? STATE_SHADER.idle;
  const pxScale = Math.max(0.24, size / 100);

  const [ambientMood, setAmbientMood] = useState<OrbExpressionName>("neutral");

  const activeExpression: Expression = useMemo(() => {
    if (typeof expression === "object") return expression;
    if (expression) return ORB_EXPRESSIONS[expression];
    if (state === "idle") return ORB_EXPRESSIONS[ambientMood];
    return ORB_EXPRESSIONS[STATE_EXPRESSION[state] ?? "neutral"];
  }, [ambientMood, expression, state]);

  const targetLeftSvg = useMemo(
    () => buildEyePath(activeExpression.left),
    [activeExpression.left],
  );
  const targetRightSvg = useMemo(
    () => buildEyePath(activeExpression.right),
    [activeExpression.right],
  );

  // Maintain previous & target SkPaths so every expression change morphs on GPU
  const [morphPair, setMorphPair] = useState(() => {
    const initialLeftSk = compileSkiaPath(targetLeftSvg);
    const initialRightSk = compileSkiaPath(targetRightSvg);
    return {
      fromLeftSk: initialLeftSk,
      fromRightSk: initialRightSk,
      toLeftSk: initialLeftSk,
      toRightSk: initialRightSk,
      toLeftSvg: targetLeftSvg,
      toRightSvg: targetRightSvg,
    };
  });

  const morphProgress = useSharedValue(1);
  const leftDySV = useSharedValue(activeExpression.left.dy ?? 0);
  const rightDySV = useSharedValue(activeExpression.right.dy ?? 0);
  const leftRotRadSV = useSharedValue((activeExpression.left.rotate ?? 0) * DEG_TO_RAD);
  const rightRotRadSV = useSharedValue((activeExpression.right.rotate ?? 0) * DEG_TO_RAD);
  const leftEyeHeightSV = useSharedValue(activeExpression.left.h);
  const rightEyeHeightSV = useSharedValue(activeExpression.right.h);

  useEffect(() => {
    setMorphPair((prev) => {
      if (prev.toLeftSvg === targetLeftSvg && prev.toRightSvg === targetRightSvg) {
        return prev;
      }
      const nextLeftSk = compileSkiaPath(targetLeftSvg);
      const nextRightSk = compileSkiaPath(targetRightSvg);
      return {
        fromLeftSk: prev.toLeftSk,
        fromRightSk: prev.toRightSk,
        toLeftSk: nextLeftSk,
        toRightSk: nextRightSk,
        toLeftSvg: targetLeftSvg,
        toRightSvg: targetRightSvg,
      };
    });

    morphProgress.value = 0;
    morphProgress.value = withSpring(1, MORPH_SPRING);
    leftDySV.value = withSpring(activeExpression.left.dy ?? 0, MORPH_SPRING);
    rightDySV.value = withSpring(activeExpression.right.dy ?? 0, MORPH_SPRING);
    leftEyeHeightSV.value = withSpring(activeExpression.left.h, MORPH_SPRING);
    rightEyeHeightSV.value = withSpring(activeExpression.right.h, MORPH_SPRING);
    leftRotRadSV.value = withSpring(
      (activeExpression.left.rotate ?? 0) * DEG_TO_RAD,
      MORPH_SPRING,
    );
    rightRotRadSV.value = withSpring(
      (activeExpression.right.rotate ?? 0) * DEG_TO_RAD,
      MORPH_SPRING,
    );
  }, [
    activeExpression.left.dy,
    activeExpression.left.h,
    activeExpression.left.rotate,
    activeExpression.right.dy,
    activeExpression.right.h,
    activeExpression.right.rotate,
    leftDySV,
    leftEyeHeightSV,
    leftRotRadSV,
    morphProgress,
    rightDySV,
    rightEyeHeightSV,
    rightRotRadSV,
    targetLeftSvg,
    targetRightSvg,
  ]);

  const lab0 = useMemo(
    () => hexToOklab(stateConfig.colors[0]),
    [stateConfig.colors],
  );
  const lab1 = useMemo(
    () => hexToOklab(stateConfig.colors[1]),
    [stateConfig.colors],
  );
  const lab2 = useMemo(
    () => hexToOklab(stateConfig.colors[2]),
    [stateConfig.colors],
  );

  const phase = useSharedValue(0);

  // Outer discrete choreography layer (done double-bounce / error slump)
  const gestureX = useSharedValue(0);
  const gestureY = useSharedValue(0);
  const gestureScaleX = useSharedValue(1);
  const gestureScaleY = useSharedValue(1);
  const gestureRotate = useSharedValue(0);

  // Continuous 60fps coupled head-follow, breathing & fixation tremor
  const liveX = useSharedValue(0);
  const liveY = useSharedValue(0);
  const liveScaleX = useSharedValue(1);
  const liveScaleY = useSharedValue(1);
  const liveRotate = useSharedValue(0);
  const microGazeX = useSharedValue(0);
  const microGazeY = useSharedValue(0);

  // Living mood posture impulses
  const moodTiltSV = useSharedValue(0);
  const moodHopSV = useSharedValue(0);

  // Synced SharedValue params for UI-thread frame callback
  const stateCodeSV = useSharedValue(STATE_CODE[state] ?? 0);
  const speedSV = useSharedValue(speed);
  const pxScaleSV = useSharedValue(pxScale);
  const sideBounceSV = useSharedValue(variant === "headSideBounce" ? 1 : 0);

  useEffect(() => {
    stateCodeSV.value = STATE_CODE[state] ?? 0;
    speedSV.value = Math.max(speed, 0.1);
    pxScaleSV.value = pxScale;
    sideBounceSV.value = variant === "headSideBounce" ? 1 : 0;
  }, [pxScale, pxScaleSV, sideBounceSV, speed, speedSV, state, stateCodeSV, variant]);

  // Eyes gaze & asymmetric elastic lids
  const gazeX = useSharedValue(isError ? -0.24 * GAZE_RANGE : 0);
  const gazeY = useSharedValue(
    isError ? 0.68 * GAZE_RANGE : isDone ? -0.22 * GAZE_RANGE : 0,
  );

  const leftLidScaleY = useSharedValue(1);
  const leftLidScaleX = useSharedValue(1);
  const leftLidOffsetY = useSharedValue(0);

  const rightLidScaleY = useSharedValue(1);
  const rightLidScaleX = useSharedValue(1);
  const rightLidOffsetY = useSharedValue(0);

  const shadowScale = useSharedValue(1);
  const shadowOpacity = useSharedValue(0.85);

  const prevStateRef = useRef<OrbState>(state);
  const lastSaccadeIdxRef = useRef(-1);
  const lastMoodCategoryRef = useRef(-1);
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Seamless periodic flow-field phase loop (0 -> TAU) on GPU shader
  useEffect(() => {
    cancelAnimation(phase);
    const loopDuration = Math.round(
      7000 / Math.max(stateConfig.speed * speed, 0.2),
    );
    phase.value = 0;
    phase.value = withRepeat(
      withTiming(TAU, { duration: loopDuration, easing: Easing.linear }),
      -1,
      false,
    );
  }, [phase, speed, stateConfig.speed]);

  // Continuous 60fps coupled body follow-through, breathing & living fixation drift
  useFrameCallback((frameInfo) => {
    "worklet";
    const dtSec = Math.min((frameInfo.timeSincePreviousFrame ?? 16.6) / 1000, 0.05);
    const alpha = 1 - Math.exp(-dtSec * 8.5);
    const t = frameInfo.timeSinceFirstFrame / 1000;
    const sc = stateCodeSV.value;
    const pxs = pxScaleSV.value;
    const spd = speedSV.value;

    // Subtle organic fixation micro-saccade drift so eyes never freeze dead still
    const tremorAmt = sc === 5 ? 0.12 : 1.0;
    microGazeX.value =
      (Math.sin(t * 0.85) * 0.28 + Math.sin(t * 2.15 + 0.7) * 0.12) * tremorAmt;
    microGazeY.value =
      (Math.cos(t * 0.65) * 0.2 + Math.sin(t * 1.65 + 1.3) * 0.08) * tremorAmt;

    const gx = (gazeX.value + microGazeX.value) / GAZE_RANGE;
    const gy = (gazeY.value + microGazeY.value) / GAZE_RANGE;

    const followX = gx * 2.2 * pxs;
    const followY = gy * 2.0 * pxs;
    const followRot = gx * 3.2;

    let tx = followX;
    let ty = followY + moodHopSV.value * pxs;
    let tsx = 1;
    let tsy = 1;
    let trot = followRot + moodTiltSV.value;

    if (sc === 0) {
      const breath =
        Math.sin(t * 1.45 * spd) * 0.65 +
        Math.sin(t * 2.35 * spd + 1.1) * 0.35;
      ty = followY - breath * 1.6 * pxs + moodHopSV.value * pxs;
      tsx = 1 + breath * 0.011;
      tsy = 1 - breath * 0.008;
      trot = followRot + Math.sin(t * 0.9 * spd) * 1.1 + moodTiltSV.value;

      if (sideBounceSV.value === 1) {
        const sway = Math.sin(t * 2.6 * spd);
        tx += sway * 4.5 * pxs;
        ty -= Math.abs(sway) * 1.8 * pxs;
        trot += sway * 5.5;
      }
    } else if (sc === 1) {
      const pulse = 0.5 + 0.5 * Math.sin(t * 3.2 * spd);
      ty = followY - pulse * 2.2 * pxs;
      tsx = 1 + pulse * 0.022;
      tsy = 1 + pulse * 0.028;
    } else if (sc === 2) {
      const sway = Math.sin(t * 1.6 * spd);
      tx = followX + sway * 1.1 * pxs;
      ty = followY - Math.abs(Math.cos(t * 1.2 * spd)) * 1.2 * pxs;
      tsx = 1.012;
      tsy = 0.99;
      trot = followRot - 3.5 + sway * 2.2;
    } else if (sc === 3) {
      const nod = Math.sin(t * 4.2 * spd) * 0.5 + 0.5;
      ty = followY - nod * 2.2 * pxs;
      tsx = 1 + nod * 0.025;
      tsy = 1 + nod * 0.032;
      trot = followRot + Math.sin(t * 2.6 * spd) * 1.8;
    } else if (sc === 4) {
      const happyBob = Math.sin(t * 4.8) * 1.1;
      ty = followY - happyBob * pxs;
      tsx = 1.02;
      tsy = 1.02;
    } else if (sc === 5) {
      const sigh = 0.5 - 0.5 * Math.cos(t * 2.1);
      tx = 0;
      ty = sigh * 1.8 * pxs;
      tsx = 1 + sigh * 0.025;
      tsy = 1 - sigh * 0.025;
      trot = Math.sin(t * 1.1) * 1.2;
    }

    liveX.value += (tx - liveX.value) * alpha;
    liveY.value += (ty - liveY.value) * alpha;
    liveScaleX.value += (tsx - liveScaleX.value) * alpha;
    liveScaleY.value += (tsy - liveScaleY.value) * alpha;
    liveRotate.value += (trot - liveRotate.value) * alpha;
  });

  // Discrete emotional choreographies (`done` joyful leaps, `error` dejected slump)
  useEffect(() => {
    cancelAnimation(gestureX);
    cancelAnimation(gestureY);
    cancelAnimation(gestureScaleX);
    cancelAnimation(gestureScaleY);
    cancelAnimation(gestureRotate);
    cancelAnimation(shadowScale);
    cancelAnimation(shadowOpacity);

    if (isError) {
      gestureX.value = withSequence(
        withTiming(-3.5 * pxScale, { duration: 100 }),
        withTiming(3.5 * pxScale, { duration: 110 }),
        withTiming(-2 * pxScale, { duration: 140 }),
        withTiming(0, { duration: 220 }),
      );
      gestureY.value = withSequence(
        withTiming(-1 * pxScale, { duration: 100 }),
        withTiming(4 * pxScale, { duration: 240 }),
        withSpring(6.5 * pxScale, { damping: 20, stiffness: 110 }),
      );
      gestureScaleX.value = withSpring(1.04, { damping: 20, stiffness: 110 });
      gestureScaleY.value = withSpring(0.94, { damping: 20, stiffness: 110 });
      gestureRotate.value = withSpring(-4.5, { damping: 20, stiffness: 110 });
      shadowScale.value = 0.94;
      shadowOpacity.value = 0.92;
      return;
    }

    if (isDone) {
      const jumpPeak = -16 * pxScale;
      const hopPeak = -8 * pxScale;
      const crouchY = 2.5 * pxScale;
      gestureX.value = withTiming(0, { duration: 150 });
      gestureY.value = withRepeat(
        withSequence(
          withTiming(crouchY, { duration: 115, easing: Easing.out(Easing.quad) }),
          withTiming(jumpPeak, { duration: 260, easing: BLINK_EASE_OUT }),
          withTiming(crouchY * 0.7, { duration: 210, easing: Easing.in(Easing.quad) }),
          withTiming(hopPeak, { duration: 200, easing: BLINK_EASE_OUT }),
          withTiming(0, { duration: 220, easing: Easing.inOut(Easing.ease) }),
          withDelay(1200, withTiming(0, { duration: 0 })),
        ),
        -1,
        false,
      );
      gestureScaleX.value = withRepeat(
        withSequence(
          withTiming(1.12, { duration: 115 }),
          withTiming(0.89, { duration: 260 }),
          withTiming(1.11, { duration: 210 }),
          withTiming(0.93, { duration: 200 }),
          withTiming(1, { duration: 220 }),
          withDelay(1200, withTiming(1, { duration: 0 })),
        ),
        -1,
        false,
      );
      gestureScaleY.value = withRepeat(
        withSequence(
          withTiming(0.86, { duration: 115 }),
          withTiming(1.14, { duration: 260 }),
          withTiming(0.88, { duration: 210 }),
          withTiming(1.08, { duration: 200 }),
          withTiming(1, { duration: 220 }),
          withDelay(1200, withTiming(1, { duration: 0 })),
        ),
        -1,
        false,
      );
      gestureRotate.value = withRepeat(
        withSequence(
          withTiming(-2, { duration: 115 }),
          withTiming(-6, { duration: 260 }),
          withTiming(5, { duration: 210 }),
          withTiming(-2, { duration: 200 }),
          withTiming(0, { duration: 220 }),
          withDelay(1200, withTiming(0, { duration: 0 })),
        ),
        -1,
        false,
      );
      shadowScale.value = withRepeat(
        withSequence(
          withTiming(1.12, { duration: 115 }),
          withTiming(0.62, { duration: 260 }),
          withTiming(1.06, { duration: 210 }),
          withTiming(0.76, { duration: 200 }),
          withTiming(1, { duration: 220 }),
          withDelay(1200, withTiming(1, { duration: 0 })),
        ),
        -1,
        false,
      );
      shadowOpacity.value = withRepeat(
        withSequence(
          withTiming(0.95, { duration: 115 }),
          withTiming(0.38, { duration: 260 }),
          withTiming(0.9, { duration: 210 }),
          withTiming(0.55, { duration: 200 }),
          withTiming(0.85, { duration: 220 }),
          withDelay(1200, withTiming(0.85, { duration: 0 })),
        ),
        -1,
        false,
      );
      return;
    }

    if (variant === "welcome") {
      // Gentle rise into frame, squash settle, joyful left-right greeting sway/wave, and polite nod
      gestureX.value = withSequence(
        withTiming(0, { duration: 640 }),
        withTiming(-8 * pxScale, {
          duration: 320,
          easing: Easing.inOut(Easing.ease),
        }),
        withTiming(8 * pxScale, {
          duration: 380,
          easing: Easing.inOut(Easing.ease),
        }),
        withSpring(0, { damping: 14, stiffness: 130 }),
      );
      gestureY.value = withSequence(
        withTiming(18 * pxScale, { duration: 40 }),
        withTiming(-8 * pxScale, {
          duration: 380,
          easing: Easing.out(Easing.cubic),
        }),
        withTiming(4 * pxScale, {
          duration: 220,
          easing: Easing.inOut(Easing.quad),
        }),
        withTiming(-11 * pxScale, {
          duration: 280,
          easing: Easing.out(Easing.cubic),
        }),
        withTiming(-9 * pxScale, {
          duration: 360,
          easing: Easing.inOut(Easing.ease),
        }),
        withSpring(0, { damping: 14, stiffness: 140 }),
        withDelay(
          160,
          withSequence(
            withTiming(4 * pxScale, {
              duration: 160,
              easing: Easing.inOut(Easing.quad),
            }),
            withSpring(0, { damping: 15, stiffness: 160 }),
          ),
        ),
      );
      gestureScaleX.value = withSequence(
        withTiming(0.84, { duration: 220, easing: Easing.out(Easing.quad) }),
        withTiming(1.08, { duration: 200, easing: Easing.inOut(Easing.quad) }),
        withTiming(0.95, { duration: 220, easing: Easing.inOut(Easing.quad) }),
        withSpring(1, { damping: 15, stiffness: 150 }),
      );
      gestureScaleY.value = withSequence(
        withTiming(1.14, { duration: 220, easing: Easing.out(Easing.quad) }),
        withTiming(0.92, { duration: 200, easing: Easing.inOut(Easing.quad) }),
        withTiming(1.05, { duration: 220, easing: Easing.inOut(Easing.quad) }),
        withSpring(1, { damping: 15, stiffness: 150 }),
      );
      gestureRotate.value = withSequence(
        withTiming(-6, { duration: 420, easing: Easing.out(Easing.ease) }),
        withTiming(-11, { duration: 300, easing: Easing.inOut(Easing.ease) }),
        withTiming(11, { duration: 380, easing: Easing.inOut(Easing.ease) }),
        withSpring(0, { damping: 14, stiffness: 140 }),
      );
      shadowScale.value = 1;
      shadowOpacity.value = 0.85;
      return;
    }

    if (variant === "splashPop") {
      gestureX.value = 0;
      gestureY.value = withSequence(
        withTiming(-20 * pxScale, { duration: 40 }),
        withTiming(5 * pxScale, {
          duration: 380,
          easing: Easing.out(Easing.cubic),
        }),
        withTiming(-5 * pxScale, {
          duration: 280,
          easing: Easing.inOut(Easing.ease),
        }),
        withSpring(0, { damping: 16, stiffness: 130 }),
      );
      gestureScaleX.value = withSequence(
        withTiming(0.86, { duration: 160, easing: Easing.out(Easing.quad) }),
        withTiming(1.11, { duration: 240, easing: Easing.inOut(Easing.quad) }),
        withTiming(0.96, { duration: 260, easing: Easing.inOut(Easing.quad) }),
        withSpring(1, { damping: 16, stiffness: 140 }),
      );
      gestureScaleY.value = withSequence(
        withTiming(1.14, { duration: 160, easing: Easing.out(Easing.quad) }),
        withTiming(0.89, { duration: 240, easing: Easing.inOut(Easing.quad) }),
        withTiming(1.04, { duration: 260, easing: Easing.inOut(Easing.quad) }),
        withSpring(1, { damping: 16, stiffness: 140 }),
      );
      gestureRotate.value = withSequence(
        withTiming(-6, { duration: 240, easing: Easing.out(Easing.ease) }),
        withTiming(4, { duration: 300, easing: Easing.inOut(Easing.ease) }),
        withSpring(0, { damping: 16, stiffness: 140 }),
      );
      shadowScale.value = 1;
      shadowOpacity.value = 0.85;
      return;
    }

    gestureX.value = withSpring(0, { damping: 18, stiffness: 180 });
    gestureY.value = withSpring(0, { damping: 18, stiffness: 180 });
    gestureScaleX.value = withSpring(1, { damping: 18, stiffness: 180 });
    gestureScaleY.value = withSpring(1, { damping: 18, stiffness: 180 });
    gestureRotate.value = withSpring(0, { damping: 18, stiffness: 180 });
    shadowScale.value = 1;
    shadowOpacity.value = 0.85;
  }, [
    gestureRotate,
    gestureScaleX,
    gestureScaleY,
    gestureX,
    gestureY,
    isDone,
    isError,
    pxScale,
    shadowOpacity,
    shadowScale,
    variant,
  ]);

  // Autonomous living-creature expression & curiosity beats when idle
  useEffect(() => {
    if (!isIdleAuto) {
      setAmbientMood("neutral");
      moodTiltSV.value = withSpring(0, GAZE_SPRING);
      moodHopSV.value = withSpring(0, GAZE_SPRING);
      return;
    }

    let mounted = true;
    const timers: ReturnType<typeof setTimeout>[] = [];

    const runBeat = (initial = false) => {
      const wait = initial
        ? 750 + Math.random() * 550
        : 2100 + Math.random() * 1900;

      const tId = setTimeout(() => {
        if (!mounted) return;

        // 35% quick natural curiosity glance without leaving neutral,
        // 65% expressive living mood beat
        if (Math.random() < 0.35) {
          const angle = Math.random() * TAU;
          const radius = (0.3 + Math.random() * 0.4) * GAZE_RANGE;
          gazeX.value = withSpring(Math.cos(angle) * radius, GAZE_SPRING);
          gazeY.value = withSpring(Math.sin(angle) * radius * 0.7, GAZE_SPRING);

          const retId = setTimeout(() => {
            if (!mounted) return;
            gazeX.value = withSpring(0, GAZE_SPRING);
            gazeY.value = withSpring(0, GAZE_SPRING);
            runBeat(false);
          }, 950 + Math.random() * 600);
          timers.push(retId);
          return;
        }

        const picked = pickLivingBeat(lastMoodCategoryRef.current);
        lastMoodCategoryRef.current = picked.category;

        let elapsed = 0;
        picked.sequence.forEach((step) => {
          const stepTimer = setTimeout(() => {
            if (!mounted) return;
            setAmbientMood(step.mood);
            gazeX.value = withSpring(step.gx, GAZE_SPRING);
            gazeY.value = withSpring(step.gy, GAZE_SPRING);
            moodTiltSV.value = withSpring(step.tiltDeg, { damping: 16, stiffness: 180 });
            moodHopSV.value = withSpring(step.hopY, { damping: 14, stiffness: 220 });
          }, elapsed);
          timers.push(stepTimer);
          elapsed += step.holdMs;
        });

        const settleTimer = setTimeout(() => {
          if (!mounted) return;
          setAmbientMood("neutral");
          gazeX.value = withSpring(0, GAZE_SPRING);
          gazeY.value = withSpring(0, GAZE_SPRING);
          moodTiltSV.value = withSpring(0, { damping: 16, stiffness: 180 });
          moodHopSV.value = withSpring(0, { damping: 16, stiffness: 180 });
          runBeat(false);
        }, elapsed);
        timers.push(settleTimer);
      }, wait);

      timers.push(tId);
    };

    runBeat(true);
    return () => {
      mounted = false;
      timers.forEach(clearTimeout);
    };
  }, [gazeX, gazeY, isIdleAuto, moodHopSV, moodTiltSV]);

  // Non-idle gaze behaviors (thinking saccades, error downcast, done perk, splash glance)
  useEffect(() => {
    if (isIdleAuto) return;

    if (variant === "welcome") {
      // Glance playfully at the wordmark below, then greet the user warmly
      gazeX.value = withSequence(
        withTiming(-0.4 * GAZE_RANGE, { duration: 280 }),
        withDelay(
          360,
          withSequence(
            withTiming(-0.55 * GAZE_RANGE, { duration: 260 }),
            withTiming(0.55 * GAZE_RANGE, { duration: 340 }),
            withSpring(0, GAZE_SPRING),
          ),
        ),
      );
      gazeY.value = withSequence(
        withTiming(0.45 * GAZE_RANGE, { duration: 280 }),
        withDelay(
          360,
          withSpring(-0.18 * GAZE_RANGE, GAZE_SPRING),
        ),
      );
      return;
    }

    if (variant === "splashPop") {
      // Glance gently down toward the QUIZROPE wordmark, then settle looking forward
      gazeX.value = withSequence(
        withTiming(0.22 * GAZE_RANGE, { duration: 280 }),
        withDelay(520, withSpring(0, GAZE_SPRING)),
      );
      gazeY.value = withSequence(
        withTiming(0.55 * GAZE_RANGE, { duration: 280 }),
        withDelay(520, withSpring(-0.15 * GAZE_RANGE, GAZE_SPRING)),
      );
      return;
    }

    if (isError) {
      gazeX.value = withSpring(-0.24 * GAZE_RANGE, GAZE_SPRING);
      gazeY.value = withSpring(0.68 * GAZE_RANGE, GAZE_SPRING);
      return;
    }
    if (isDone) {
      gazeX.value = withSpring(0, GAZE_SPRING);
      gazeY.value = withSpring(-0.22 * GAZE_RANGE, GAZE_SPRING);
      return;
    }

    if (!isThinking) {
      gazeX.value = withSpring(0, GAZE_SPRING);
      gazeY.value = withSpring(0, GAZE_SPRING);
      return;
    }

    let mounted = true;
    let glanceTimer: ReturnType<typeof setTimeout>;

    const scheduleSaccade = () => {
      const delay = 550 + Math.random() * 900;
      glanceTimer = setTimeout(() => {
        if (!mounted) return;
        let nextIdx = Math.floor(Math.random() * SACCADE_TARGETS.length);
        if (nextIdx === lastSaccadeIdxRef.current) {
          nextIdx = (nextIdx + 1) % SACCADE_TARGETS.length;
        }
        lastSaccadeIdxRef.current = nextIdx;
        const target = SACCADE_TARGETS[nextIdx];
        gazeX.value = withSpring(target.x * GAZE_RANGE, GAZE_SPRING);
        gazeY.value = withSpring(target.y * GAZE_RANGE, GAZE_SPRING);
        scheduleSaccade();
      }, delay);
    };

    scheduleSaccade();
    return () => {
      mounted = false;
      clearTimeout(glanceTimer);
    };
  }, [gazeX, gazeY, isDone, isError, isIdleAuto, isThinking, variant]);

  // Asymmetric elastic, volume-preserving blink with micro-overshoot & double-blink
  useEffect(() => {
    const prev = prevStateRef.current;
    prevStateRef.current = state;

    if (isDone) {
      cancelAnimation(leftLidScaleY);
      cancelAnimation(leftLidScaleX);
      cancelAnimation(leftLidOffsetY);
      cancelAnimation(rightLidScaleY);
      cancelAnimation(rightLidScaleX);
      cancelAnimation(rightLidOffsetY);
      leftLidScaleY.value = 1;
      leftLidScaleX.value = 1;
      leftLidOffsetY.value = 0;
      rightLidScaleY.value = 1;
      rightLidScaleX.value = 1;
      rightLidOffsetY.value = 0;
      return;
    }

    let mounted = true;
    let timer: ReturnType<typeof setTimeout>;

    const blinkCurve = (
      shut: number,
      peek: number,
      overshoot: number,
      rest: number,
      double: boolean,
      delayMs: number,
    ) => {
      const seq = double
        ? withSequence(
            withTiming(shut, { duration: 65, easing: BLINK_EASE_IN }),
            withTiming(peek, { duration: 65, easing: BLINK_EASE_OUT }),
            withTiming(shut, { duration: 65, easing: BLINK_EASE_IN }),
            withTiming(overshoot, { duration: 85, easing: BLINK_EASE_OUT }),
            withTiming(rest, { duration: 80, easing: BLINK_EASE_OUT }),
          )
        : withSequence(
            withTiming(shut, { duration: 65, easing: BLINK_EASE_IN }),
            withTiming(overshoot, { duration: 85, easing: BLINK_EASE_OUT }),
            withTiming(rest, { duration: 80, easing: BLINK_EASE_OUT }),
          );
      return delayMs > 0 ? withDelay(delayMs, seq) : seq;
    };

    const triggerBlink = (double = false) => {
      if (!mounted) return;
      leftLidScaleY.value = blinkCurve(0.08, 0.88, 1.05, 1, double, 0);
      leftLidScaleX.value = blinkCurve(1.14, 1.0, 0.97, 1, double, 0);
      leftLidOffsetY.value = blinkCurve(1.1, 0, -0.35, 0, double, 0);

      rightLidScaleY.value = blinkCurve(0.08, 0.88, 1.05, 1, double, 14);
      rightLidScaleX.value = blinkCurve(1.14, 1.0, 0.97, 1, double, 14);
      rightLidOffsetY.value = blinkCurve(1.1, 0, -0.35, 0, double, 14);
    };

    if (prev !== state && (state === "listening" || state === "streaming")) {
      triggerBlink(false);
    }

    const schedule = (initial = false) => {
      const wait = initial
        ? (isError ? 2400 : 1200) + Math.random() * 1200
        : (isError ? 4200 : 3000) + Math.random() * 2600;
      timer = setTimeout(() => {
        triggerBlink(!isError && Math.random() < 0.28);
        schedule(false);
      }, wait);
    };

    schedule(true);
    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, [
    isDone,
    isError,
    leftLidOffsetY,
    leftLidScaleX,
    leftLidScaleY,
    rightLidOffsetY,
    rightLidScaleX,
    rightLidScaleY,
    state,
  ]);

  const handleTap = useCallback(() => {
    if (!interactive || !isIdleAuto) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const tapMoods: OrbExpressionName[] = ["giggle", "wink", "eager", "joy"];
    const next = tapMoods[Math.floor(Math.random() * tapMoods.length)];
    setAmbientMood(next);
    moodHopSV.value = withSequence(
      withTiming(-3.5, { duration: 110, easing: BLINK_EASE_OUT }),
      withSpring(0, { damping: 14, stiffness: 220 }),
    );
    moodTiltSV.value = withSequence(
      withTiming((Math.random() < 0.5 ? -1 : 1) * 7, { duration: 140 }),
      withSpring(0, { damping: 14, stiffness: 180 }),
    );
    if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
    tapTimerRef.current = setTimeout(() => {
      setAmbientMood("neutral");
    }, 1050);
  }, [interactive, isIdleAuto, moodHopSV, moodTiltSV]);

  useEffect(() => {
    return () => {
      if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
    };
  }, []);

  const shaderUniforms = useDerivedValue(() => {
    "worklet";
    const gx = gazeX.value + microGazeX.value;
    const gy = gazeY.value + microGazeY.value;
    return {
      uRes: [size, size] as const,
      uPhase: phase.value,
      uLab0: lab0,
      uLab1: lab1,
      uLab2: lab2,
      uFlow: stateConfig.flow,
      uTurb: stateConfig.turbulence,
      uRim: stateConfig.rim,
      uSpec: stateConfig.specular,
      uWobble: stateConfig.wobble,
      uLight: [-0.6 + (gx / GAZE_RANGE) * 0.22, -1.0 + (gy / GAZE_RANGE) * 0.22, 0.65] as const,
    };
  });

  // GPU Bezier path morphing for left & right eyes
  const morphedLeftPath = useDerivedValue(() => {
    "worklet";
    const fromP = morphPair.fromLeftSk;
    const toP = morphPair.toLeftSk;
    if (!toP.isInterpolatable(fromP)) return toP;
    return interpolatePaths(morphProgress.value, [0, 1], [fromP, toP]);
  }, [morphPair]);

  const morphedRightPath = useDerivedValue(() => {
    "worklet";
    const fromP = morphPair.fromRightSk;
    const toP = morphPair.toRightSk;
    if (!toP.isInterpolatable(fromP)) return toP;
    return interpolatePaths(morphProgress.value, [0, 1], [fromP, toP]);
  }, [morphPair]);

  // Spherical gaze projection including perspective tilt (`projRotate`)
  const leftEyeProjTransform = useDerivedValue(() => {
    "worklet";
    const gx = gazeX.value + microGazeX.value;
    const gy = gazeY.value + microGazeY.value;
    const normX = gx / GAZE_RANGE;
    const normY = gy / GAZE_RANGE;
    const compression = Math.max(0, -normX);
    const lead = clamp(-normX, -0.25, 1);
    const edgeDrop = Math.abs(normX) * 0.55 * (gy >= 0 ? 1 : -0.6);
    const projRotate = normX * normY * -3.5 * DEG_TO_RAD;

    return [
      { translateX: CENTER - EYE_OFFSET + gx * (1 - compression * 0.14) },
      { translateY: EYE_CENTER_Y + gy + edgeDrop },
      { scaleX: 1 - Math.max(0, lead) * 0.15 },
      { rotate: projRotate },
    ];
  });

  const leftEyeLidTransform = useDerivedValue(() => {
    "worklet";
    return [
      { translateY: leftLidOffsetY.value },
      { scaleX: leftLidScaleX.value },
      { scaleY: leftLidScaleY.value },
    ];
  });

  const leftEyePoseTransform = useDerivedValue(() => {
    "worklet";
    return [
      { translateY: leftDySV.value },
      { rotate: leftRotRadSV.value },
    ];
  });

  const rightEyeProjTransform = useDerivedValue(() => {
    "worklet";
    const gx = gazeX.value + microGazeX.value;
    const gy = gazeY.value + microGazeY.value;
    const normX = gx / GAZE_RANGE;
    const normY = gy / GAZE_RANGE;
    const compression = Math.max(0, normX);
    const lead = clamp(normX, -0.25, 1);
    const edgeDrop = Math.abs(normX) * 0.55 * (gy >= 0 ? 1 : -0.6);
    const projRotate = normX * normY * 3.5 * DEG_TO_RAD;

    return [
      { translateX: CENTER + EYE_OFFSET + gx * (1 - compression * 0.14) },
      { translateY: EYE_CENTER_Y + gy + edgeDrop },
      { scaleX: 1 - Math.max(0, lead) * 0.15 },
      { rotate: projRotate },
    ];
  });

  const rightEyeLidTransform = useDerivedValue(() => {
    "worklet";
    return [
      { translateY: rightLidOffsetY.value },
      { scaleX: rightLidScaleX.value },
      { scaleY: rightLidScaleY.value },
    ];
  });

  const rightEyePoseTransform = useDerivedValue(() => {
    "worklet";
    return [
      { translateY: rightDySV.value },
      { rotate: rightRotRadSV.value },
    ];
  });

  const leftCatchlightOpacity = useDerivedValue(() => {
    "worklet";
    const openness = leftEyeHeightSV.value * leftLidScaleY.value;
    return clamp((openness - 0.42) / 0.22, 0, 1);
  });

  const rightCatchlightOpacity = useDerivedValue(() => {
    "worklet";
    const openness = rightEyeHeightSV.value * rightLidScaleY.value;
    return clamp((openness - 0.42) / 0.22, 0, 1);
  });

  const gestureAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: gestureX.value },
      { translateY: gestureY.value },
      { scaleX: gestureScaleX.value },
      { scaleY: gestureScaleY.value },
      { rotate: `${gestureRotate.value}deg` },
    ],
  }));

  const liveAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: liveX.value },
      { translateY: liveY.value },
      { scaleX: liveScaleX.value },
      { scaleY: liveScaleY.value },
      { rotate: `${liveRotate.value}deg` },
    ],
  }));

  const shadowAnimatedStyle = useAnimatedStyle(() => ({
    opacity: shadowOpacity.value,
    transform: [{ scaleX: shadowScale.value }],
  }));

  const shadowWidth = Math.round(size * 0.64);
  const shadowHeight = Math.max(6, Math.round(size * 0.09));
  const svgLeftDy = activeExpression.left.dy ?? 0;
  const svgRightDy = activeExpression.right.dy ?? 0;

  const orbBody = (
    <Animated.View style={gestureAnimatedStyle}>
      <Animated.View style={liveAnimatedStyle}>
        {ORB_RUNTIME_EFFECT ? (
          <Canvas style={{ width: size, height: size }}>
            <Fill>
              <Shader source={ORB_RUNTIME_EFFECT} uniforms={shaderUniforms} />
            </Fill>

            <Group transform={[{ scale: size / VIEWBOX }]}>
              <OrbEyeLayer
                projTransform={leftEyeProjTransform}
                lidTransform={leftEyeLidTransform}
                poseTransform={leftEyePoseTransform}
                path={morphedLeftPath}
                catchlightOpacity={leftCatchlightOpacity}
              />
              <OrbEyeLayer
                projTransform={rightEyeProjTransform}
                lidTransform={rightEyeLidTransform}
                poseTransform={rightEyePoseTransform}
                path={morphedRightPath}
                catchlightOpacity={rightCatchlightOpacity}
              />

              {/* Soft overhead softbox glass glaze */}
              <SkiaCircle cx={CENTER} cy={CENTER} r={ORB_RADIUS}>
                <SkiaRadialGradient
                  c={{ x: 33, y: 24 }}
                  r={58}
                  colors={[
                    "rgba(255, 255, 255, 0.26)",
                    "rgba(255, 255, 255, 0.05)",
                    "rgba(18, 8, 38, 0.0)",
                    "rgba(18, 8, 38, 0.26)",
                  ]}
                  positions={[0, 0.32, 0.7, 1]}
                />
              </SkiaCircle>
            </Group>
          </Canvas>
        ) : (
          <Svg width={size} height={size} viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`} fill="none">
            <Defs>
              <ClipPath id={`orbClip-${uid}`}>
                <Circle cx={CENTER} cy={CENTER} r={ORB_RADIUS} />
              </ClipPath>
              <RadialGradient id={`orbBase-${uid}`} cx="36%" cy="30%" r="74%" fx="34%" fy="28%">
                <Stop offset="0%" stopColor={isError ? "#DF7485" : "#9B8EF6"} />
                <Stop offset="48%" stopColor={isError ? "#C9485C" : "#6C5CE7"} />
                <Stop offset="100%" stopColor={isError ? "#6F2232" : "#372A96"} />
              </RadialGradient>
            </Defs>
            <G clipPath={`url(#orbClip-${uid})`}>
              <Circle cx={CENTER} cy={CENTER} r={ORB_RADIUS} fill={`url(#orbBase-${uid})`} />
            </G>
            <G x={CENTER - EYE_OFFSET} y={EYE_CENTER_Y + svgLeftDy} rotation={activeExpression.left.rotate ?? 0} origin="0, 0">
              <SvgPath d={targetLeftSvg} fill={FEATURE_INK} />
              {activeExpression.left.h >= 0.45 && (
                <Circle cx={-2.1} cy={-4.6} r={1.85} fill="#FFFFFF" opacity={0.9} />
              )}
            </G>
            <G x={CENTER + EYE_OFFSET} y={EYE_CENTER_Y + svgRightDy} rotation={activeExpression.right.rotate ?? 0} origin="0, 0">
              <SvgPath d={targetRightSvg} fill={FEATURE_INK} />
              {activeExpression.right.h >= 0.45 && (
                <Circle cx={-2.1} cy={-4.6} r={1.85} fill="#FFFFFF" opacity={0.9} />
              )}
            </G>
            <Ellipse cx={34} cy={26} rx={11} ry={5} fill="#FFFFFF" opacity={0.22} transform={`rotate(-28 34 26)`} />
          </Svg>
        )}
      </Animated.View>
    </Animated.View>
  );

  return (
    <View style={{ alignItems: "center" }}>
      {interactive ? (
        <TouchableOpacity activeOpacity={0.95} onPress={handleTap}>
          {orbBody}
        </TouchableOpacity>
      ) : (
        orbBody
      )}

      {showFloorShadow && (
        <Animated.View
          pointerEvents="none"
          style={[
            {
              width: shadowWidth,
              height: shadowHeight,
              borderRadius: 999,
              marginTop: Math.max(2, Math.round(size * 0.03)),
              backgroundColor: isError
                ? "rgba(0, 0, 0, 0.35)"
                : "rgba(108, 92, 231, 0.2)",
            },
            shadowAnimatedStyle,
          ]}
        />
      )}
    </View>
  );
}

export function SadBrainMascot({ size = 150 }: { size?: number }) {
  return <BrainMascot size={size} state="error" showFloorShadow />;
}
