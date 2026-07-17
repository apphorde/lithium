export const FF: any = {};

Object.assign(FF, (globalThis as any).li3FeatureFlags || {});

export function setFeatureFlag(flag: string, v = true) {
  FF[flag] = v;
}

(globalThis as any).name?.split(',').map((k: string) => (FF[k.trim()] = true));