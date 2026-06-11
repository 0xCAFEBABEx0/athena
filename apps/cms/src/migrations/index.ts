import * as migration_20250522_154847_initial from './20250522_154847_initial';
import * as migration_20250527_122842 from './20250527_122842';

export const migrations = [
  {
    up: migration_20250522_154847_initial.up,
    down: migration_20250522_154847_initial.down,
    name: '20250522_154847_initial',
  },
  {
    up: migration_20250527_122842.up,
    down: migration_20250527_122842.down,
    name: '20250527_122842'
  },
];
