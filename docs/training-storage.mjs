export function scopedStorage(storage, prefix = 'rangers-training:') {
  return {
    getItem: key => storage.getItem(prefix + key),
    setItem: (key, value) => storage.setItem(prefix + key, value),
    removeItem: key => storage.removeItem(prefix + key),
    key: index => Object.keys(storage).filter(key => key.startsWith(prefix))[index]?.slice(prefix.length) ?? null,
    get length() { return Object.keys(storage).filter(key => key.startsWith(prefix)).length; },
    clear() { for (const key of Object.keys(storage)) if (key.startsWith(prefix)) storage.removeItem(key); }
  };
}
export const trainingStorage = scopedStorage(globalThis.localStorage);
