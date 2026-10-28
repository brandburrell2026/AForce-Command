export function isTravelCacheForOwner(key: readonly unknown[], owner: string): boolean {
  return (key[0] === 'travel-journey-v1' || key[0] === 'travel-flight-status-v1') && key[1] === owner;
}
