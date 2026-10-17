import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadMono } from "@remotion/google-fonts/JetBrainsMono";
import { Easing } from "remotion";

// The app's own palette (apps/web/src/styles/tokens.css): clinical white, one calm blue, status colours
// always paired with a word.
export const C = {
  bg: "#f3f6f9",
  surface: "#ffffff",
  line: "rgba(17, 38, 66, 0.12)",
  ink: "#0f1c2b",
  ink2: "#3a4a5c",
  ink3: "#5a6a7d",
  blue: "#1f5fae",
  blueSoft: "#e7f0fb",
  high: "#d1242f",
  highInk: "#a3161b",
  highBg: "#fdecec",
  medium: "#e07b16",
  access: "#12663b",
  accessBg: "#e5f5ec",
  watch: "#765400",
  watchBg: "#fdf4d6",
  dot: "#9fb3c8",
};

export const { fontFamily: sans } = loadInter("normal", { weights: ["400", "500", "600", "700"], subsets: ["latin", "latin-ext"] });
export const { fontFamily: mono } = loadMono("normal", { weights: ["400", "500"], subsets: ["latin"] });

/** Exponential ease-out, the motion used everywhere. */
export const out = Easing.bezier(0.16, 1, 0.3, 1);
export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
