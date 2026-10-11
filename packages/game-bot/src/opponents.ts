/**
 * Opponent identities for the "random online" mode, where the opponent is the
 * practice bot. Gamer-style first names from many countries; no real people.
 */
export interface Opponent {
  name: string;
  flag: string;
}

const PEOPLE: readonly (readonly [string, string[]])[] = [
  [
    "🇮🇷",
    [
      "Reza",
      "Sara",
      "Ali",
      "Maryam",
      "Amir",
      "Niloofar",
      "Hamid",
      "Parisa",
      "Mahsa",
      "Arash",
    ],
  ],
  ["🇹🇷", ["Mehmet", "Elif", "Emre", "Zeynep", "Burak", "Ayşe"]],
  ["🇦🇪", ["Omar", "Fatima", "Khalid", "Mariam"]],
  ["🇸🇦", ["Faisal", "Noura", "Abdullah", "Lama"]],
  ["🇮🇶", ["Hussein", "Zainab", "Mustafa", "Huda"]],
  ["🇦🇫", ["Ahmad", "Farida", "Wahid", "Shabnam"]],
  ["🇮🇳", ["Priya", "Rahul", "Ananya", "Arjun", "Kavya"]],
  ["🇵🇰", ["Bilal", "Ayesha", "Hamza", "Sana"]],
  ["🇪🇬", ["Youssef", "Nour", "Karim", "Salma"]],
  ["🇩🇪", ["Lukas", "Lena", "Jonas", "Mia"]],
  ["🇫🇷", ["Louis", "Chloé", "Hugo", "Léa"]],
  ["🇬🇧", ["Oliver", "Amelia", "Harry", "Isla"]],
  ["🇺🇸", ["Jake", "Emma", "Mason", "Ava"]],
  ["🇪🇸", ["Carlos", "Lucía", "Javier", "Sofía"]],
  ["🇮🇹", ["Marco", "Giulia", "Luca", "Chiara"]],
  ["🇧🇷", ["Gabriel", "Beatriz", "Rafael", "Larissa"]],
  ["🇷🇺", ["Dmitry", "Anya", "Ivan", "Polina"]],
  ["🇦🇿", ["Elvin", "Leyla", "Rashad", "Aysel"]],
  ["🇹🇯", ["Firuz", "Zarina", "Rustam", "Malika"]],
  ["🇨🇦", ["Liam", "Chloe", "Noah", "Olivia"]],
  ["🇦🇺", ["Jack", "Ruby", "Cooper", "Matilda"]],
  ["🇯🇵", ["Haruto", "Yui", "Sota", "Hina"]],
  ["🇮🇩", ["Budi", "Siti", "Rizky", "Putri"]],
  ["🇳🇬", ["Chinedu", "Amara", "Tunde", "Ngozi"]],
];

const SUFFIXES = [
  "",
  "",
  "",
  "",
  "_7",
  "_10",
  "99",
  "_x",
  "2005",
  "_pro",
  "1",
  "_88",
];

/** Picks a name and flag; `random` returns a float in [0, 1). */
export function randomOpponent(random: () => number): Opponent {
  const pick = <T>(list: readonly T[]) =>
    list[Math.floor(random() * list.length) % list.length]!;
  const [flag, names] = pick(PEOPLE);
  return { name: pick(names) + pick(SUFFIXES), flag };
}

/** Human-like pause before the bot acts, in milliseconds. */
export function thinkingDelay(
  phase: "roll" | "move",
  random: () => number,
): number {
  const base = phase === "roll" ? 700 : 900;
  // Occasionally hesitate longer, like a person deciding.
  const extra = random() < 0.15 ? 1500 + random() * 1500 : random() * 900;
  return Math.round(base + extra);
}

/** Time the "finding an opponent" screen stays up. */
export function searchDelay(random: () => number): number {
  return Math.round(2200 + random() * 3600);
}

const ZONES: Record<string, string> = {
  "Asia/Tehran": "🇮🇷",
  "Europe/Istanbul": "🇹🇷",
  "Asia/Dubai": "🇦🇪",
  "Asia/Riyadh": "🇸🇦",
  "Asia/Baghdad": "🇮🇶",
  "Asia/Kabul": "🇦🇫",
  "Asia/Kolkata": "🇮🇳",
  "Asia/Calcutta": "🇮🇳",
  "Asia/Karachi": "🇵🇰",
  "Africa/Cairo": "🇪🇬",
  "Europe/Berlin": "🇩🇪",
  "Europe/Paris": "🇫🇷",
  "Europe/London": "🇬🇧",
  "Europe/Madrid": "🇪🇸",
  "Europe/Rome": "🇮🇹",
  "America/Sao_Paulo": "🇧🇷",
  "Europe/Moscow": "🇷🇺",
  "Asia/Baku": "🇦🇿",
  "Asia/Dushanbe": "🇹🇯",
  "America/Toronto": "🇨🇦",
  "America/Vancouver": "🇨🇦",
  "Asia/Tokyo": "🇯🇵",
  "Asia/Jakarta": "🇮🇩",
  "Africa/Lagos": "🇳🇬",
  "Asia/Kuwait": "🇰🇼",
  "Asia/Qatar": "🇶🇦",
  "Asia/Muscat": "🇴🇲",
  "Asia/Bahrain": "🇧🇭",
  "Europe/Amsterdam": "🇳🇱",
  "Europe/Stockholm": "🇸🇪",
  "Asia/Yerevan": "🇦🇲",
  "Asia/Tbilisi": "🇬🇪",
};

/**
 * A best-guess flag for a real player from the device time zone (no network
 * lookup); empty when the zone is not recognised.
 */
export function flagForTimeZone(zone: string | undefined): string {
  if (!zone) return "";
  if (ZONES[zone]) return ZONES[zone];
  if (zone.startsWith("Australia/")) return "🇦🇺";
  if (
    /^America\/(New_York|Chicago|Denver|Los_Angeles|Phoenix|Anchorage|Detroit)$/.test(
      zone,
    )
  )
    return "🇺🇸";
  return "";
}

/** "🇮🇷 Reza": the display name a matched player sees, within the server's rules. */
export function matchName(
  flag: string,
  name: string,
  fallback: string,
): string {
  const clean =
    name
      .replace(/[^\p{L}\p{N} _-]/gu, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 24) || fallback;
  return flag ? `${flag} ${clean}` : clean;
}
