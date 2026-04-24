// Match the portal's 22 px "Thyleads" wordmark so the Gmail GIF/WebP reads at the same visual size.
// Canvas width sized to the text so there's no dead space pushing it away from the divider.
export const SHINE_W = 108;
export const SHINE_H = 30;
export const SHINE_FONT_SIZE = 22;

export interface ShineFrame {
  reveal: number;
  shine: number;
  delay: number;
}

export function easeInOutCubic(p: number): number {
  return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
}

export function shineFrameSvg(reveal: number, shine: number): string {
  const x1 = (150 - 300 * shine).toFixed(2);
  const x2 = (250 - 300 * shine).toFixed(2);
  const clipW = Math.max(0, Math.min(SHINE_W, Math.round(SHINE_W * reveal)));
  // The portal uses font-extrabold (800). Matching that here keeps stroke weights consistent.
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SHINE_W}" height="${SHINE_H}" viewBox="0 0 ${SHINE_W} ${SHINE_H}">` +
    `<defs>` +
    `<linearGradient id="g" x1="${x1}%" y1="0" x2="${x2}%" y2="0">` +
    `<stop offset="0" stop-color="#0f172a"/>` +
    `<stop offset="0.38" stop-color="#0f172a"/>` +
    `<stop offset="0.47" stop-color="#b48bff"/>` +
    `<stop offset="0.50" stop-color="#ffffff"/>` +
    `<stop offset="0.53" stop-color="#b48bff"/>` +
    `<stop offset="0.62" stop-color="#0f172a"/>` +
    `<stop offset="1" stop-color="#0f172a"/>` +
    `</linearGradient>` +
    `<clipPath id="rev"><rect x="0" y="0" width="${clipW}" height="${SHINE_H}"/></clipPath>` +
    `</defs>` +
    // text-anchor="start" at x=0 so the "T" sits flush with the left edge — no dead space.
    // font-weight 800 is the real portal weight; resvg now ships Inter so we don't need to
    // compensate for a heavier Helvetica fallback like before.
    `<text clip-path="url(#rev)" x="0" y="${Math.round(SHINE_H * 0.74)}" font-family="Inter" font-size="${SHINE_FONT_SIZE}" font-weight="800" letter-spacing="0.22" fill="url(#g)" text-anchor="start">Thyleads</text>` +
    `</svg>`;
}

function buildSchedule({
  revealCount,
  revealMs,
  holdMs,
  shineCount,
  shineMs,
  restMs,
}: {
  revealCount: number;
  revealMs: number;
  holdMs: number;
  shineCount: number;
  shineMs: number;
  restMs: number;
}): ShineFrame[] {
  const revealSteps = Array.from({ length: revealCount }, (_, i) =>
    easeInOutCubic((i + 1) / revealCount)
  );
  const lastReveal = revealSteps[revealSteps.length - 1];
  return [
    ...revealSteps.map<ShineFrame>((r) => ({
      reveal: r,
      shine: 0,
      delay: r === lastReveal ? holdMs : revealMs,
    })),
    ...Array.from({ length: shineCount }, (_, i) => {
      const p = (i + 1) / (shineCount + 1);
      return { reveal: 1, shine: easeInOutCubic(p), delay: shineMs };
    }),
    { reveal: 1, shine: 1, delay: restMs },
  ];
}

// Compact schedule — used for the inline GIF data URI so it fits under Gmail's ~10 KB signature cap.
export function buildShineFramesCompact(): ShineFrame[] {
  return buildSchedule({
    revealCount: 8,
    revealMs: 55,
    holdMs: 900,
    shineCount: 18,
    shineMs: 45,
    restMs: 2200,
  });
}

// Smooth schedule — used for the server-rendered animated WebP. No inline size limit so we can
// push to ~30 fps motion which reads as portal-level smoothness in Gmail.
export function buildShineFramesSmooth(): ShineFrame[] {
  return buildSchedule({
    revealCount: 18,
    revealMs: 36,
    holdMs: 900,
    shineCount: 40,
    shineMs: 28,
    restMs: 2200,
  });
}

// Default export kept for legacy callers.
export function buildShineFrames(): ShineFrame[] {
  return buildShineFramesCompact();
}
