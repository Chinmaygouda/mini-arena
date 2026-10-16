import { MapSpec } from './types';
import { WAREHOUSE_MAP } from './warehouse';
import { PLAZA_MAP } from './plaza';
import { CONTAINERYARD_MAP } from './containeryard';

export * from './types';
export * from './warehouse';
export * from './plaza';
export * from './containeryard';

export const ALL_MAPS: Record<string, MapSpec> = {
  warehouse: WAREHOUSE_MAP,
  plaza: PLAZA_MAP,
  containeryard: CONTAINERYARD_MAP,
};

export function getMapSpec(id?: string): MapSpec {
  if (id && ALL_MAPS[id]) {
    return ALL_MAPS[id];
  }
  return WAREHOUSE_MAP;
}
