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
