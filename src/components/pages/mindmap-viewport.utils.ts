export interface ViewportPoint {
  x: number;
  y: number;
}

export interface ViewportBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

export function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function distanceBetweenPoints(start: ViewportPoint, end: ViewportPoint) {
  return Math.hypot(end.x - start.x, end.y - start.y);
}

export function midpointBetweenPoints(first: ViewportPoint, second: ViewportPoint): ViewportPoint {
  return {
    x: (first.x + second.x) / 2,
    y: (first.y + second.y) / 2
  };
}
