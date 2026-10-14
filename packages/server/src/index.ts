import { SIM_TICK_RATE } from '@mini-arena/shared';

export function getServerStatus(): string {
  return `Mini Arena server initialized at ${SIM_TICK_RATE} Hz tick rate.`;
}
