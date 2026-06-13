// The family's streaming providers — the single frontend source of truth for
// the provider filter chips and the default selection. Names match both the
// serviceColors palette keys and the server's PROVIDER_NAMES (api watch.ts),
// so a title's `services` entries line up with these for filtering + badges.
// Order mirrors the server's canonical provider order.
export const FAMILY_PROVIDERS = [
  'Netflix',
  'Disney+',
  'Max',
  'Prime',
  'Paramount+',
  'Hulu',
  'Apple TV+',
] as const

export type FamilyProvider = (typeof FAMILY_PROVIDERS)[number]
