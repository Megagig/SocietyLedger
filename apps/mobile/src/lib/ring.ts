/** Stroke geometry for a circular progress ring: how much of the circumference to leave un-drawn for `percent`. */
export function ringDash(percent: number, radius: number): { circumference: number; offset: number; percent: number } {
  const clamped = Number.isFinite(percent) ? Math.min(100, Math.max(0, percent)) : 0;
  const circumference = 2 * Math.PI * radius;
  return { circumference, offset: circumference * (1 - clamped / 100), percent: clamped };
}
