import { createBcmsMost } from '@becomes/cms-most';
import type { BCMSMost, BCMSMostConfig } from '@becomes/cms-most/types';

let most: BCMSMost;

export async function __createBcmsMost(config: BCMSMostConfig): Promise<void> {
  most = createBcmsMost({ config });
  await most.socketConnect();
  await most.template.pull();
  await most.content.pull();
  await most.media.pull();
  await most.typeConverter.pull();
}

export function getBcmsMost(): BCMSMost {
  return most;
}
