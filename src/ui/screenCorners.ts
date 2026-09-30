export type ScreenCorners = {topLeft: number; topRight: number; bottomLeft: number; bottomRight: number};

const fallback: ScreenCorners = {topLeft: 32, topRight: 32, bottomLeft: 32, bottomRight: 32};

/** Zero is a real square corner; only missing or invalid device values use the fallback. */
export function resolveScreenCorners(result: Partial<Record<keyof ScreenCorners, number | null>> | null): ScreenCorners {
  const corners = {...fallback};
  for (const key of Object.keys(corners) as (keyof ScreenCorners)[]) {
    const radius = result?.[key];
    if (typeof radius === 'number' && Number.isFinite(radius) && radius >= 0) corners[key] = radius;
  }
  return corners;
}
