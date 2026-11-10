import type { DefSala } from '../../tipos';
import { PUEBLO } from './pueblo';
import { LONJA } from './lonja';
import { BODEGA } from './bodega';
import { TOROS } from './toros';
import { HOTEL } from './hotel';

export const SALAS: Record<string, DefSala> = {};
for (const s of [...PUEBLO, ...LONJA, ...BODEGA, ...TOROS, ...HOTEL]) {
  if (SALAS[s.id]) throw new Error(`sala repetida: ${s.id}`);
  SALAS[s.id] = s;
}
