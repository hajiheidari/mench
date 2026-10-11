const KEY = "mench-name";
/** The last display name the player typed, reused by every online mode. */
export function savedName(fallback: string): string {
  try {
    const value = localStorage.getItem(KEY)?.trim();
    if (value) return value.slice(0, 24);
  } catch {
    /* Private windows may block storage; the fallback is fine. */
  }
  return fallback;
}
export function saveName(name: string) {
  try {
    if (name.trim()) localStorage.setItem(KEY, name.trim().slice(0, 24));
  } catch {
    /* Remembering the name is a convenience only. */
  }
}
