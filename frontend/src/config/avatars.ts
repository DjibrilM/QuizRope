export interface Avatar {
  id: string;
  label: string;
}

export const AVATARS: Avatar[] = [
  { id: "lion", label: "Lion" },
  { id: "fox", label: "Fox" },
  { id: "panda", label: "Panda" },
  { id: "unicorn", label: "Unicorn" },
  { id: "dragon", label: "Dragon" },
  { id: "owl", label: "Owl" },
  { id: "dolphin", label: "Dolphin" },
  { id: "rocket", label: "Rocket" },
  { id: "star", label: "Star" },
  { id: "dino", label: "Dino" },
  { id: "cat", label: "Cat" },
  { id: "dog", label: "Dog" },
];

/**
 * Gender-neutral non-human creature/cosmic avatars available for parent profiles
 * when a Google profile photo is unavailable or when switching manually.
 */
export const PARENT_AVATARS: Avatar[] = AVATARS;

export function isRemoteAvatarUrl(avatar?: string | null): boolean {
  return !!avatar && /^https?:\/\//i.test(avatar.trim());
}

/** Deterministic non-human fallback avatar ID derived from email/id so UI never flickers. */
export function getFallbackParentAvatarId(seed?: string | null): string {
  const pool = PARENT_AVATARS;
  if (!seed) return pool[0].id;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return pool[hash % pool.length].id;
}
