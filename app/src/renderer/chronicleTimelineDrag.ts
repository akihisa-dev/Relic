import {
  CHRONICLE_FAST_DRAG_MULTIPLIER,
  CHRONICLE_FAST_DRAG_SPEED,
  CHRONICLE_FINE_DRAG_MULTIPLIER,
  CHRONICLE_FINE_DRAG_SPEED
} from "./chronicleTimelineConstants";

export function createStablePointerDelta(startClientX: number, unitWidth: number): (clientX: number, _timeStamp?: number) => number {
  let delta = 0;

  return (clientX: number): number => {
    if (!Number.isFinite(clientX) || !Number.isFinite(startClientX) || unitWidth <= 0) return delta;

    const rawDelta = (clientX - startClientX) / unitWidth;

    if (rawDelta >= delta + 0.65) {
      delta = Math.floor(rawDelta + 0.35);
    } else if (rawDelta <= delta - 0.65) {
      delta = Math.ceil(rawDelta - 0.35);
    }

    return delta;
  };
}

export function createAdaptiveChroniclePointerDelta(
  startClientX: number,
  unitWidth: number,
  startTimeStamp: number
): (clientX: number, timeStamp?: number) => number {
  let effectiveDelta = 0;
  let lastClientX = startClientX;
  let lastTimeStamp = Number.isFinite(startTimeStamp) ? startTimeStamp : 0;

  return (clientX: number, timeStamp = lastTimeStamp + 16): number => {
    if (!Number.isFinite(clientX) || !Number.isFinite(lastClientX) || unitWidth <= 0) {
      return Math.round(effectiveDelta);
    }

    const movement = clientX - lastClientX;

    if (movement !== 0) {
      const currentTimeStamp = Number.isFinite(timeStamp) ? timeStamp : lastTimeStamp + 16;
      const elapsed = Math.max(8, currentTimeStamp - lastTimeStamp);
      const speed = Math.abs(movement) / elapsed;
      effectiveDelta += (movement / unitWidth) * chronicleDragSpeedMultiplier(speed);
      lastTimeStamp = currentTimeStamp;
      lastClientX = clientX;
    }

    return Math.round(effectiveDelta);
  };
}

function chronicleDragSpeedMultiplier(speed: number): number {
  if (!Number.isFinite(speed)) return 1;
  if (speed <= CHRONICLE_FINE_DRAG_SPEED) return CHRONICLE_FINE_DRAG_MULTIPLIER;
  if (speed >= CHRONICLE_FAST_DRAG_SPEED) return CHRONICLE_FAST_DRAG_MULTIPLIER;

  const progress = (speed - CHRONICLE_FINE_DRAG_SPEED) / (CHRONICLE_FAST_DRAG_SPEED - CHRONICLE_FINE_DRAG_SPEED);

  return CHRONICLE_FINE_DRAG_MULTIPLIER + progress * (CHRONICLE_FAST_DRAG_MULTIPLIER - CHRONICLE_FINE_DRAG_MULTIPLIER);
}
