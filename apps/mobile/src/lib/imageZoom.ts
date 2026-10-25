// Pure maths for the full-screen image viewer, kept out of the component so it can be unit-tested (reanimated can't load under
// Jest). Every function is a worklet because the viewer calls them from gesture callbacks running on the UI thread.

export const MIN_SCALE = 1;
export const MAX_SCALE = 5;
export const DOUBLE_TAP_SCALE = 2.5;
/** Past this much downward drag (dp), or this fast a flick (dp/s), an un-zoomed image is dismissed. */
export const DISMISS_DISTANCE = 120;
export const DISMISS_VELOCITY = 900;

export function clampScale(scale: number): number {
  'worklet';
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}

/**
 * Keeps a zoomed image from being dragged off screen: the most it can move from centre is half of how much bigger than the
 * container it now is. An image no bigger than the container can't move at all.
 */
export function clampTranslate(translate: number, scale: number, imageSize: number, containerSize: number): number {
  'worklet';
  const limit = Math.max(0, (imageSize * scale - containerSize) / 2);
  // `+ 0` turns a negative zero into 0.
  return Math.min(limit, Math.max(-limit, translate)) + 0;
}

/** Double-tap zooms in from rest, and back out when already zoomed. */
export function nextDoubleTapScale(current: number): number {
  'worklet';
  return current > MIN_SCALE + 0.01 ? MIN_SCALE : DOUBLE_TAP_SCALE;
}

/** Swipe down to close — only when the image isn't zoomed, so panning a zoomed image never closes it by accident. */
export function shouldDismiss(translateY: number, velocityY: number, scale: number): boolean {
  'worklet';
  if (scale > MIN_SCALE + 0.01) return false;
  return translateY > DISMISS_DISTANCE || velocityY > DISMISS_VELOCITY;
}

/** The size an image takes when contained in the container at scale 1 (what the viewer lays out), for `clampTranslate`. */
export function containedSize(imageWidth: number, imageHeight: number, containerWidth: number, containerHeight: number): { width: number; height: number } {
  'worklet';
  if (imageWidth <= 0 || imageHeight <= 0) return { width: containerWidth, height: containerHeight };
  const ratio = Math.min(containerWidth / imageWidth, containerHeight / imageHeight);
  return { width: imageWidth * ratio, height: imageHeight * ratio };
}
