/**
 * WEJI's colours around the pictures: Deep ocean, chosen by the owner.
 *
 * `ink` is the dark of the tunnel, `accent` colours buttons and the drifting
 * specks of light, and the two glows are the soft light at the tunnel's far
 * end. Pictures always keep their own colours.
 */
export interface Palette {
  ink: string;
  accent: string;
  glowA: string;
  glowB: string;
}

export const THEME: Palette = { ink: "#04090f", accent: "#3de0d0", glowA: "#2fb6ff", glowB: "#3de0d0" };
