export function freezeDeep<T>(value: T): T {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  // Internal model data is plain records/arrays. Copy mutable input, share existing immutable subtrees.
  const copy: unknown = Array.isArray(value)
    ? value.map(child => freezeDeep(child))
    : Object.fromEntries(Object.entries(value).map(([key, child]) => [key, freezeDeep(child)]));
  return Object.freeze(copy) as T;
}
