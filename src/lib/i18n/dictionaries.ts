// 네 사전을 한 자리에 모은다. 사전을 늘리는 곳은 여기가 아니라 ko.ts 다.

import { en } from './en.ts';
import { ja } from './ja.ts';
import { ko } from './ko.ts';
import type { Lang } from './lang.ts';
import type { Dictionary } from './types.ts';
import { zh } from './zh.ts';

export const DICTS: Record<Lang, Dictionary> = { ko, en, zh, ja };
