import { get } from 'lodash';
import { helper } from 'missing-lib';

export function run() {
  return get({ a: 1 }, 'a') + helper();
}
