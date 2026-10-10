import { bases, colors, track } from "./index";

export const depths = ["#ad2020", "#147a29", "#c5a315", "#1754a8"];
export const dicePips = [
  [],
  [4],
  [0, 8],
  [0, 4, 8],
  [0, 2, 6, 8],
  [0, 2, 4, 6, 8],
  [0, 2, 3, 5, 6, 8],
] as const;

export function boardSvg(): string {
  const gradients = colors
    .map(
      (color, i) =>
        `<linearGradient id="c${i}" x2=".3" y2="1"><stop stop-color="${color}"/><stop offset="1" stop-color="${depths[i]}"/></linearGradient>`,
    )
    .join("");
  const homes = bases
    .map(
      ([x, y], seat) =>
        `<rect x="${x + 0.14}" y="${y + 0.14}" width="5.72" height="5.72" rx=".65" fill="url(#c${seat})" stroke="${depths[seat]}" stroke-width=".1"/><rect x="${x + 0.4}" y="${y + 0.4}" width="5.2" height="5.2" rx=".48" fill="none" stroke="white" stroke-opacity=".35" stroke-width=".05"/><path d="M${x + 0.7} ${y + 0.9} Q${x + 3} ${y + 0.2} ${x + 5.2} ${y + 0.9}" fill="none" stroke="white" stroke-opacity=".22" stroke-width=".08"/>${[
          0, 1, 2, 3,
        ]
          .map((p) => {
            const px = x + 1.65 + (p % 2) * 2.3,
              py = y + 1.65 + Math.floor(p / 2) * 2.3;
            return `<circle cx="${px}" cy="${py + 0.05}" r=".78" fill="${depths[seat]}" opacity=".6"/><circle cx="${px}" cy="${py}" r=".7" fill="#fff7ec" stroke="#ffffff" stroke-opacity=".5" stroke-width=".07"/><circle cx="${px}" cy="${py}" r=".56" fill="${colors[seat]}" opacity=".15"/>`;
          })
          .join("")}`,
    )
    .join("");
  const cells = track
    .map(
      ([x, y], i) =>
        `<rect x="${x + 0.07}" y="${y + 0.11}" width=".86" height=".86" rx=".16" fill="#b8b1cd"/><rect x="${x + 0.07}" y="${y + 0.04}" width=".86" height=".86" rx=".16" fill="${i % 13 === 0 ? `url(#c${i / 13})` : "url(#tile)"}" stroke="${i % 13 === 0 ? depths[i / 13] : "#d7cee1"}" stroke-width=".03"/>`,
    )
    .join("");
  const lanes = [0, 1, 2, 3]
    .flatMap((seat) =>
      [1, 2, 3, 4, 5, 6].map((n) => {
        const [x, y] =
          seat === 0
            ? [7, n]
            : seat === 1
              ? [n, 7]
              : seat === 2
                ? [7, 14 - n]
                : [14 - n, 7];
        return `<rect x="${x! + 0.07}" y="${y! + 0.04}" width=".86" height=".9" rx=".15" fill="url(#c${seat})" stroke="white" stroke-opacity=".35" stroke-width=".04"/>`;
      }),
    )
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 15 15"><defs>${gradients}<linearGradient id="tile" x2="0" y2="1"><stop stop-color="#fffef9"/><stop offset="1" stop-color="#eae5f2"/></linearGradient><radialGradient id="gold"><stop stop-color="#fff5bd"/><stop offset=".55" stop-color="#ffdc6b"/><stop offset="1" stop-color="#d09228"/></radialGradient></defs><rect width="15" height="15" rx=".7" fill="#eee7f5"/>${homes}${cells}${lanes}<path d="M6 6H9L7.5 7.5Z" fill="${colors[0]}"/><path d="M6 6V9L7.5 7.5Z" fill="${colors[1]}"/><path d="M6 9H9L7.5 7.5Z" fill="${colors[2]}"/><path d="M9 6V9L7.5 7.5Z" fill="${colors[3]}"/><circle cx="7.5" cy="7.5" r=".8" fill="#54387d" stroke="#fff1ae" stroke-width=".08"/><path d="M6.94 7.16L7.18 7.39L7.5 6.91L7.82 7.39L8.06 7.16L7.96 7.83H7.04Z" fill="url(#gold)"/><path d="M7.09 8.02H7.91" stroke="#ffe8a3" stroke-width=".09" stroke-linecap="round"/></svg>`;
}

export function pawnSvg(seat: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="200" viewBox="0 0 80 100"><defs><linearGradient id="pawn" x2="1" y2=".5"><stop stop-color="${depths[seat]}"/><stop offset=".35" stop-color="${colors[seat]}"/><stop offset=".6" stop-color="${colors[seat]}"/><stop offset="1" stop-color="${depths[seat]}"/></linearGradient><radialGradient id="head" cx=".3" cy=".2"><stop stop-color="#ffffff" stop-opacity=".85"/><stop offset=".35" stop-color="${colors[seat]}"/><stop offset="1" stop-color="${depths[seat]}"/></radialGradient></defs><ellipse cx="40" cy="90" rx="32" ry="8" fill="#211339" opacity=".28"/><ellipse cx="40" cy="81" rx="30" ry="12" fill="${depths[seat]}" stroke="#fff" stroke-width="2"/><path d="M14 77Q29 61 29 40H51Q51 61 66 77Q40 94 14 77Z" fill="url(#pawn)" stroke="white" stroke-opacity=".75" stroke-width="1.5"/><ellipse cx="40" cy="77" rx="25" ry="8" fill="${colors[seat]}"/><circle cx="40" cy="28" r="22" fill="url(#head)" stroke="#fff" stroke-opacity=".85" stroke-width="2"/><ellipse cx="32" cy="18" rx="7" ry="4" fill="white" opacity=".55"/></svg>`;
}

export function backdropSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1600"><defs><radialGradient id="bg" cx=".5" cy=".25" r=".9"><stop stop-color="#8c55c5"/><stop offset=".55" stop-color="#44236f"/><stop offset="1" stop-color="#21143e"/></radialGradient></defs><rect width="900" height="1600" fill="url(#bg)"/>${Array.from({ length: 35 }, (_, i) => `<circle cx="${(i * 197 + 67) % 900}" cy="${(i * 347 + 83) % 1600}" r="${(i % 4) + 1}" fill="#fce5b9" opacity=".25"/>`).join("")}<path d="M-200 200Q450 -180 1100 400M-250 1350Q450 900 1100 1520" fill="none" stroke="#c395f0" stroke-opacity=".08" stroke-width="130"/></svg>`;
}

export function avatarSvg(seat: number): string {
  const ears =
    seat === 1
      ? `<circle cx="29" cy="30" r="13" fill="${colors[seat]}"/><circle cx="71" cy="30" r="13" fill="${colors[seat]}"/>`
      : seat === 2
        ? `<circle cx="50" cy="51" r="36" fill="${depths[seat]}"/>`
        : '<path d="M20 46L19 16L41 31M59 31L81 16L80 46" fill="' +
          colors[seat] +
          '" stroke="' +
          depths[seat] +
          '" stroke-width="3"/>';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 100 100"><defs><linearGradient id="bg" y2="1" x2=".4"><stop stop-color="${colors[seat]}"/><stop offset="1" stop-color="${depths[seat]}"/></linearGradient></defs><circle cx="50" cy="50" r="47" fill="url(#bg)" stroke="#fff0ba" stroke-width="4"/><circle cx="50" cy="73" r="26" fill="#301c4b" opacity=".2"/>${ears}<ellipse cx="50" cy="52" rx="31" ry="29" fill="${colors[seat]}"/><path d="M22 56Q34 58 50 48Q66 58 78 56Q75 80 50 80Q25 80 22 56" fill="white" fill-opacity=".35"/><ellipse cx="37" cy="46" rx="5" ry="7" fill="#302039"/><ellipse cx="63" cy="46" rx="5" ry="7" fill="#302039"/><circle cx="38" cy="44" r="1.7" fill="white"/><circle cx="64" cy="44" r="1.7" fill="white"/><path d="M45 59Q50 55 55 59L50 64Z" fill="#573344"/><path d="M40 67Q50 78 60 67" fill="none" stroke="#6b3e4b" stroke-width="2.5" stroke-linecap="round"/><ellipse cx="29" cy="59" rx="5" ry="3" fill="#fb8a92" opacity=".5"/><ellipse cx="71" cy="59" rx="5" ry="3" fill="#fb8a92" opacity=".5"/></svg>`;
}
