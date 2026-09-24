import { SlotId } from './carModel';

export type PartKind =
  | 'door_fl' | 'door_fr' | 'door_rl' | 'door_rr' | 'hood' | 'trunk' | 'wheel' | 'engine' | 'battery' | 'radiator'
  | 'headlight' | 'bumper_f' | 'bumper_r' | 'seat_f' | 'seat_r';

export const SLOT_KIND: Record<SlotId, PartKind> = {
  door_fl: 'door_fl', door_fr: 'door_fr', door_rl: 'door_rl', door_rr: 'door_rr', hood: 'hood', trunk: 'trunk',
  wheel_fl: 'wheel', wheel_fr: 'wheel', wheel_rl: 'wheel', wheel_rr: 'wheel', engine: 'engine', battery: 'battery',
  radiator: 'radiator', headlight_l: 'headlight', headlight_r: 'headlight', bumper_f: 'bumper_f', bumper_r: 'bumper_r',
  seat_d: 'seat_f', seat_p: 'seat_f', seat_r: 'seat_r',
};

/** Which slot geometry to use when building a loose part of this kind. */
export const KIND_SLOT: Record<PartKind, SlotId> = {
  door_fl: 'door_fl', door_fr: 'door_fr', door_rl: 'door_rl', door_rr: 'door_rr', hood: 'hood', trunk: 'trunk', wheel: 'wheel_fl',
  engine: 'engine', battery: 'battery', radiator: 'radiator', headlight: 'headlight_l', bumper_f: 'bumper_f', bumper_r: 'bumper_r',
  seat_f: 'seat_d', seat_r: 'seat_r',
};

export interface PartInfo {
  mass: number;
  bolted: boolean; // needs a wrench to detach
  painted: boolean;
  heavy: boolean;
}
export const PART_INFO: Record<PartKind, PartInfo> = {
  door_fl: { mass: 22, bolted: true, painted: true, heavy: false },
  door_fr: { mass: 22, bolted: true, painted: true, heavy: false },
  door_rl: { mass: 19, bolted: true, painted: true, heavy: false },
  door_rr: { mass: 19, bolted: true, painted: true, heavy: false },
  hood: { mass: 14, bolted: true, painted: true, heavy: false },
  trunk: { mass: 11, bolted: true, painted: true, heavy: false },
  wheel: { mass: 14, bolted: true, painted: false, heavy: false },
  engine: { mass: 110, bolted: true, painted: false, heavy: true },
  battery: { mass: 13, bolted: false, painted: false, heavy: false },
  radiator: { mass: 7, bolted: true, painted: false, heavy: false },
  headlight: { mass: 1.5, bolted: false, painted: false, heavy: false },
  bumper_f: { mass: 9, bolted: true, painted: false, heavy: false },
  bumper_r: { mass: 9, bolted: true, painted: false, heavy: false },
  seat_f: { mass: 12, bolted: true, painted: false, heavy: false },
  seat_r: { mass: 16, bolted: true, painted: false, heavy: false },
};

export interface PartState {
  id: number;
  kind: PartKind;
  cond: number; // 0..1
  paint?: string;
  rust?: number;
  oil?: number; // engine, litres
  coolant?: number; // radiator, litres
  charge?: number; // battery 0..1
  flat?: boolean; // wheel
}

export const ENGINE_OIL_CAP = 3.5;
export const RADIATOR_CAP = 5;
export const FUEL_CAP = 40;

let nextPartId = 1;
export function newPartId() {
  return nextPartId++;
}
export function bumpPartId(min: number) {
  if (nextPartId <= min) nextPartId = min + 1;
}

export function makePart(kind: PartKind, cond: number, extra: Partial<PartState> = {}): PartState {
  const p: PartState = { id: newPartId(), kind, cond, ...extra };
  if (kind === 'engine' && p.oil === undefined) p.oil = ENGINE_OIL_CAP * 0.8;
  if (kind === 'radiator' && p.coolant === undefined) p.coolant = RADIATOR_CAP * 0.9;
  if (kind === 'battery' && p.charge === undefined) p.charge = 0.8;
  return p;
}
