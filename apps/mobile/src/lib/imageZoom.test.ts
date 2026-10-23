import { clampScale, clampTranslate, containedSize, DOUBLE_TAP_SCALE, MAX_SCALE, MIN_SCALE, nextDoubleTapScale, shouldDismiss } from './imageZoom';

describe('clampScale', () => {
  it('keeps the zoom between 1x and the maximum', () => {
    expect(clampScale(0.4)).toBe(MIN_SCALE);
    expect(clampScale(2.2)).toBe(2.2);
    expect(clampScale(12)).toBe(MAX_SCALE);
  });
});

describe('clampTranslate', () => {
  it('lets a 2x image move by half of its extra size either way', () => {
    // 300dp-wide image in a 300dp container at 2x is 600dp wide → 150dp of travel each side.
    expect(clampTranslate(500, 2, 300, 300)).toBe(150);
    expect(clampTranslate(-500, 2, 300, 300)).toBe(-150);
    expect(clampTranslate(40, 2, 300, 300)).toBe(40);
  });

  it("doesn't let an image that fits the container move at all", () => {
    expect(clampTranslate(80, 1, 300, 300)).toBe(0);
    expect(clampTranslate(-80, 1, 200, 300)).toBe(0);
  });
});

describe('nextDoubleTapScale', () => {
  it('zooms in from rest and back out when already zoomed', () => {
    expect(nextDoubleTapScale(1)).toBe(DOUBLE_TAP_SCALE);
    expect(nextDoubleTapScale(3)).toBe(1);
  });
});

describe('shouldDismiss', () => {
  it('closes on a long drag down or a fast flick when not zoomed', () => {
    expect(shouldDismiss(160, 0, 1)).toBe(true);
    expect(shouldDismiss(30, 1400, 1)).toBe(true);
  });

  it('stays open on a short, slow drag', () => {
    expect(shouldDismiss(60, 200, 1)).toBe(false);
  });

  it('never closes while zoomed in, so panning a zoomed image is safe', () => {
    expect(shouldDismiss(400, 2000, 2)).toBe(false);
  });
});

describe('containedSize', () => {
  it('fits a wide image to the width and a tall one to the height', () => {
    expect(containedSize(2000, 1000, 400, 800)).toEqual({ width: 400, height: 200 });
    expect(containedSize(1000, 3000, 400, 800)).toEqual({ width: 800 / 3, height: 800 });
  });

  it('falls back to the container while the image size is unknown', () => {
    expect(containedSize(0, 0, 400, 800)).toEqual({ width: 400, height: 800 });
  });
});
