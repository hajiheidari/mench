import { bases, colors, track } from "./index";
import type { BoardThemeId, PawnSetId } from "./themes";

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

interface BoardStyle {
  frame: string;
  defs: string;
  overlay: string;
  tileTop: string;
  tileBottom: string;
  tileStroke: string;
  tileShadow: string;
  homeStroke: string | null;
  homeStrokeWidth: number;
  homeOverlay: string;
  circleFill: string;
  circleStroke: string;
  centerFill: string;
  centerStroke: string;
}

const CLASSIC: BoardStyle = {
  frame: "#eee7f5",
  defs: "",
  overlay: "",
  tileTop: "#fffef9",
  tileBottom: "#eae5f2",
  tileStroke: "#d7cee1",
  tileShadow: "#b8b1cd",
  homeStroke: null,
  homeStrokeWidth: 0.1,
  homeOverlay: "",
  circleFill: "#fff7ec",
  circleStroke: "#ffffff",
  centerFill: "#54387d",
  centerStroke: "#fff1ae",
};

// Turquoise chips set in copper (firoozeh-koobi).
const CHIPS = `<pattern id="chips" width=".5" height=".5" patternUnits="userSpaceOnUse"><path d="M.04 .09L.19 .03L.29 .14L.17 .26Z" fill="#3fc1c0"/><path d="M.3 .29L.45 .27L.43 .45L.28 .42Z" fill="#20a0a6"/><circle cx=".11" cy=".39" r=".06" fill="#86e3da"/><circle cx=".41" cy=".09" r=".04" fill="#5fd3cb"/></pattern>`;
// Ivory and brass triangles of khatam marquetry.
const KHATAM = `<pattern id="khatam" width=".5" height=".44" patternUnits="userSpaceOnUse"><path d="M0 0L.25 .43L.5 0Z" fill="#efe2c4"/><path d="M0 .44L.25 .01L.5 .44Z" fill="#b8892f"/><circle cx=".25" cy=".2" r=".035" fill="#3a2214"/></pattern>`;
// Isfahan tile rosettes.
const ROSETTE = `<pattern id="rosette" width=".75" height=".75" patternUnits="userSpaceOnUse"><circle cx=".375" cy=".375" r=".26" fill="#1d58b0" stroke="#e8f3ff" stroke-width=".035"/><path d="M.375 .17L.43 .32L.58 .375L.43 .43L.375 .58L.32 .43L.17 .375L.32 .32Z" fill="#f4f1e6"/><circle cx=".375" cy=".375" r=".06" fill="#f2c14e"/><circle cx="0" cy="0" r=".07" fill="#45c4d6"/><circle cx=".75" cy="0" r=".07" fill="#45c4d6"/><circle cx="0" cy=".75" r=".07" fill="#45c4d6"/><circle cx=".75" cy=".75" r=".07" fill="#45c4d6"/></pattern>`;
const GRAIN = `<pattern id="grain" width="15" height=".42" patternUnits="userSpaceOnUse"><path d="M0 .2Q3.7 .05 7.5 .22T15 .18" fill="none" stroke="#5e3519" stroke-opacity=".35" stroke-width=".03"/><path d="M0 .36Q4 .3 8 .38T15 .33" fill="none" stroke="#f0c48f" stroke-opacity=".18" stroke-width=".02"/></pattern>`;
const STARS = `<pattern id="stars" width="1.6" height="1.6" patternUnits="userSpaceOnUse"><circle cx=".2" cy=".3" r=".035" fill="#fff"/><circle cx=".9" cy=".15" r=".02" fill="#fff" opacity=".7"/><circle cx="1.3" cy=".8" r=".04" fill="#fff6c8"/><circle cx=".55" cy="1.1" r=".02" fill="#fff" opacity=".6"/><circle cx="1.1" cy="1.4" r=".025" fill="#fff" opacity=".8"/></pattern>`;
const overlayRect = (id: string, opacity = 1) =>
  `<rect width="15" height="15" rx=".7" fill="url(#${id})" opacity="${opacity}"/>`;

const STYLES: Record<BoardThemeId, BoardStyle> = {
  classic: CLASSIC,
  firoozeh: {
    frame: "url(#fr)",
    defs: `<linearGradient id="fr" x2="1" y2="1"><stop stop-color="#9c4f1f"/><stop offset=".5" stop-color="#d98a4e"/><stop offset="1" stop-color="#7c3a14"/></linearGradient>${CHIPS}`,
    overlay: overlayRect("chips"),
    tileTop: "#effcfa",
    tileBottom: "#c4ece6",
    tileStroke: "#b87333",
    tileShadow: "#6a3010",
    homeStroke: "#e0a066",
    homeStrokeWidth: 0.16,
    homeOverlay: "chips",
    circleFill: "#f3fffd",
    circleStroke: "#d99a5e",
    centerFill: "#1e8f92",
    centerStroke: "#f0b27a",
  },
  khatam: {
    frame: "#3a2214",
    defs: KHATAM,
    overlay: overlayRect("khatam", 0.55),
    tileTop: "#fbf3e2",
    tileBottom: "#e7d7b4",
    tileStroke: "#a8792c",
    tileShadow: "#2a170c",
    homeStroke: "#d4a64a",
    homeStrokeWidth: 0.16,
    homeOverlay: "khatam",
    circleFill: "#fffaf0",
    circleStroke: "#c99a45",
    centerFill: "#3a2214",
    centerStroke: "#e0b85a",
  },
  kashi: {
    frame: "#11357a",
    defs: ROSETTE,
    overlay: overlayRect("rosette"),
    tileTop: "#ffffff",
    tileBottom: "#dfe9f8",
    tileStroke: "#5b86c9",
    tileShadow: "#0b2552",
    homeStroke: "#f2c14e",
    homeStrokeWidth: 0.14,
    homeOverlay: "rosette",
    circleFill: "#f7fbff",
    circleStroke: "#9ab9e8",
    centerFill: "#11357a",
    centerStroke: "#f2c14e",
  },
  wood: {
    frame: "url(#fr)",
    defs: `<linearGradient id="fr" x2="1" y2=".2"><stop stop-color="#8a5530"/><stop offset=".3" stop-color="#a8693b"/><stop offset=".6" stop-color="#7c4a28"/><stop offset="1" stop-color="#9a6236"/></linearGradient>${GRAIN}`,
    overlay: overlayRect("grain"),
    tileTop: "#f6e3c4",
    tileBottom: "#e3c597",
    tileStroke: "#a9784a",
    tileShadow: "#5e3519",
    homeStroke: "#5e3519",
    homeStrokeWidth: 0.12,
    homeOverlay: "grain",
    circleFill: "#fff4e2",
    circleStroke: "#c79a63",
    centerFill: "#6b3f1f",
    centerStroke: "#f0c98a",
  },
  night: {
    frame: "url(#fr)",
    defs: `<linearGradient id="fr" x2=".3" y2="1"><stop stop-color="#121836"/><stop offset="1" stop-color="#2a1d55"/></linearGradient>${STARS}`,
    overlay: overlayRect("stars"),
    tileTop: "#eeebff",
    tileBottom: "#cbc4f2",
    tileStroke: "#8c84d6",
    tileShadow: "#0a0d22",
    homeStroke: "#fff3b0",
    homeStrokeWidth: 0.08,
    homeOverlay: "stars",
    circleFill: "#f5f3ff",
    circleStroke: "#c9c3ff",
    centerFill: "#1b2050",
    centerStroke: "#fff1ae",
  },
};

export function boardSvg(theme: BoardThemeId = "classic"): string {
  const st = STYLES[theme] ?? CLASSIC;
  const gradients = colors
    .map(
      (color, i) =>
        `<linearGradient id="c${i}" x2=".3" y2="1"><stop stop-color="${color}"/><stop offset="1" stop-color="${depths[i]}"/></linearGradient>`,
    )
    .join("");
  const homes = bases
    .map(
      ([x, y], seat) =>
        `<rect x="${x + 0.14}" y="${y + 0.14}" width="5.72" height="5.72" rx=".65" fill="url(#c${seat})" stroke="${st.homeStroke ?? depths[seat]}" stroke-width="${st.homeStrokeWidth}"/>${st.homeOverlay ? `<rect x="${x + 0.62}" y="${y + 0.62}" width="4.76" height="4.76" rx=".4" fill="${st.frame}" stroke="${depths[seat]}" stroke-width=".08"/><rect x="${x + 0.62}" y="${y + 0.62}" width="4.76" height="4.76" rx=".4" fill="url(#${st.homeOverlay})"/>` : ""}<rect x="${x + 0.4}" y="${y + 0.4}" width="5.2" height="5.2" rx=".48" fill="none" stroke="white" stroke-opacity=".35" stroke-width=".05"/><path d="M${x + 0.7} ${y + 0.9} Q${x + 3} ${y + 0.2} ${x + 5.2} ${y + 0.9}" fill="none" stroke="white" stroke-opacity=".22" stroke-width=".08"/>${[
          0, 1, 2, 3,
        ]
          .map((p) => {
            const px = x + 1.65 + (p % 2) * 2.3,
              py = y + 1.65 + Math.floor(p / 2) * 2.3;
            return `<circle cx="${px}" cy="${py + 0.05}" r=".78" fill="${depths[seat]}" opacity=".6"/><circle cx="${px}" cy="${py}" r=".7" fill="${st.circleFill}" stroke="${st.homeOverlay ? colors[seat] : st.circleStroke}" stroke-opacity="${st.homeOverlay ? 1 : 0.5}" stroke-width="${st.homeOverlay ? 0.14 : 0.07}"/><circle cx="${px}" cy="${py}" r=".56" fill="${colors[seat]}" opacity=".15"/>`;
          })
          .join("")}`,
    )
    .join("");
  const cells = track
    .map(
      ([x, y], i) =>
        `<rect x="${x + 0.07}" y="${y + 0.11}" width=".86" height=".86" rx=".16" fill="${st.tileShadow}"/><rect x="${x + 0.07}" y="${y + 0.04}" width=".86" height=".86" rx=".16" fill="${i % 13 === 0 ? `url(#c${i / 13})` : "url(#tile)"}" stroke="${i % 13 === 0 ? depths[i / 13] : st.tileStroke}" stroke-width=".03"/>`,
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
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 15 15"><defs>${gradients}${st.defs}<linearGradient id="tile" x2="0" y2="1"><stop stop-color="${st.tileTop}"/><stop offset="1" stop-color="${st.tileBottom}"/></linearGradient><radialGradient id="gold"><stop stop-color="#fff5bd"/><stop offset=".55" stop-color="#ffdc6b"/><stop offset="1" stop-color="#d09228"/></radialGradient></defs><rect width="15" height="15" rx=".7" fill="${st.frame}"/>${st.overlay}${homes}${cells}${lanes}<path d="M6 6H9L7.5 7.5Z" fill="${colors[0]}"/><path d="M6 6V9L7.5 7.5Z" fill="${colors[1]}"/><path d="M6 9H9L7.5 7.5Z" fill="${colors[2]}"/><path d="M9 6V9L7.5 7.5Z" fill="${colors[3]}"/><circle cx="7.5" cy="7.5" r=".8" fill="${st.centerFill}" stroke="${st.centerStroke}" stroke-width=".08"/><path d="M6.94 7.16L7.18 7.39L7.5 6.91L7.82 7.39L8.06 7.16L7.96 7.83H7.04Z" fill="url(#gold)"/><path d="M7.09 8.02H7.91" stroke="#ffe8a3" stroke-width=".09" stroke-linecap="round"/></svg>`;
}

const SHAPE = "M14 77Q29 61 29 40H51Q51 61 66 77Q40 94 14 77Z";
const metal = (id: string, stops: string[]) =>
  `<linearGradient id="${id}" x2="1" y2=".4">${stops
    .map(
      (c, i) => `<stop offset="${i / (stops.length - 1)}" stop-color="${c}"/>`,
    )
    .join("")}</linearGradient>`;
const gloss = (seat: number) =>
  `<radialGradient id="head" cx=".3" cy=".2"><stop stop-color="#ffffff" stop-opacity=".85"/><stop offset=".35" stop-color="${colors[seat]}"/><stop offset="1" stop-color="${depths[seat]}"/></radialGradient>`;

export function pawnSvg(seat: number, set: PawnSetId = "classic"): string {
  const c = colors[seat]!;
  const d = depths[seat]!;
  const open = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="200" viewBox="0 0 80 100">`;
  const shadow = `<ellipse cx="40" cy="90" rx="32" ry="8" fill="#211339" opacity=".28"/>`;
  const shine = `<ellipse cx="32" cy="18" rx="7" ry="4" fill="white" opacity=".55"/>`;
  if (set === "copper" || set === "firoozeh") {
    const chips =
      set === "firoozeh"
        ? `<path d="M30 58L35 54L38 60L33 63Z" fill="#3fc1c0"/><path d="M44 50L49 48L49 54L45 55Z" fill="#20a0a6"/><path d="M40 66L46 63L48 69L42 71Z" fill="#5fd3cb"/><circle cx="36" cy="46" r="2" fill="#86e3da"/><path d="M24 74L29 71L31 76Z" fill="#3fc1c0"/><path d="M52 72L57 70L56 76Z" fill="#20a0a6"/>`
        : `<path d="M30 48Q40 52 50 48M27 62Q40 67 53 62" fill="none" stroke="#ffd2a1" stroke-opacity=".6" stroke-width="1.5"/>`;
    return `${open}<defs>${metal("body", ["#5a2a0e", "#e8a066", "#b8692e", "#5a2a0e"])}${gloss(seat)}</defs>${shadow}<ellipse cx="40" cy="81" rx="30" ry="12" fill="#6e3412" stroke="#f3b27a" stroke-width="2"/><path d="${SHAPE}" fill="url(#body)" stroke="#f6c089" stroke-width="1.5"/>${chips}<ellipse cx="40" cy="77" rx="25" ry="8" fill="${c}" stroke="#7c3a14" stroke-width="1.5"/><circle cx="40" cy="28" r="22" fill="url(#head)" stroke="#e8a066" stroke-width="3"/>${shine}</svg>`;
  }
  if (set === "gold") {
    return `${open}<defs>${metal("body", ["#7a5410", "#ffe08a", "#c8961e", "#7a5410"])}${gloss(seat)}</defs>${shadow}<ellipse cx="40" cy="81" rx="30" ry="12" fill="#8a6212" stroke="#fff1b8" stroke-width="2"/><path d="${SHAPE}" fill="url(#body)" stroke="#fff3c4" stroke-width="1.5"/><ellipse cx="40" cy="77" rx="25" ry="8" fill="${c}" stroke="#ffe08a" stroke-width="2"/><circle cx="40" cy="28" r="22" fill="url(#head)" stroke="#ffd34d" stroke-width="3.5"/><path d="M40 8L52 22L40 48L28 22Z" fill="white" opacity=".18"/><path d="M28 22H52" stroke="white" stroke-opacity=".35" stroke-width="1.2"/>${shine}</svg>`;
  }
  if (set === "crystal") {
    return `${open}<defs><linearGradient id="body" x2="1" y2=".5"><stop stop-color="${d}" stop-opacity=".85"/><stop offset=".4" stop-color="${c}" stop-opacity=".45"/><stop offset=".7" stop-color="#ffffff" stop-opacity=".55"/><stop offset="1" stop-color="${d}" stop-opacity=".8"/></linearGradient>${gloss(seat)}</defs>${shadow}<ellipse cx="40" cy="81" rx="30" ry="12" fill="${c}" fill-opacity=".55" stroke="#ffffff" stroke-width="2.5"/><path d="${SHAPE}" fill="url(#body)" stroke="#ffffff" stroke-width="2.2"/><path d="M33 44Q32 62 22 74" fill="none" stroke="white" stroke-opacity=".8" stroke-width="2.5" stroke-linecap="round"/><ellipse cx="40" cy="77" rx="25" ry="8" fill="${c}" fill-opacity=".65" stroke="white" stroke-opacity=".7"/><circle cx="40" cy="28" r="22" fill="url(#head)" fill-opacity=".85" stroke="#ffffff" stroke-width="2.5"/><path d="M27 22Q30 12 40 10" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" opacity=".85"/></svg>`;
  }
  if (set === "wood") {
    return `${open}<defs>${metal("body", ["#6e3f1c", "#c58b52", "#9a6334", "#6e3f1c"])}</defs>${shadow}<ellipse cx="40" cy="81" rx="30" ry="12" fill="#7b4a22" stroke="#e3b47c" stroke-width="2"/><path d="${SHAPE}" fill="url(#body)" stroke="#e3b47c" stroke-width="1.5"/><path d="M33 44Q36 60 30 74M45 44Q43 58 49 74" fill="none" stroke="#5a3214" stroke-opacity=".45" stroke-width="1.2"/><ellipse cx="40" cy="77" rx="25" ry="8" fill="${c}" stroke="${d}" stroke-width="1.5"/><circle cx="40" cy="28" r="22" fill="${c}" stroke="${d}" stroke-width="3"/><circle cx="40" cy="28" r="15" fill="none" stroke="white" stroke-opacity=".3" stroke-width="1.5"/>${shine}</svg>`;
  }
  return `${open}<defs><linearGradient id="pawn" x2="1" y2=".5"><stop stop-color="${d}"/><stop offset=".35" stop-color="${c}"/><stop offset=".6" stop-color="${c}"/><stop offset="1" stop-color="${d}"/></linearGradient>${gloss(seat)}</defs>${shadow}<ellipse cx="40" cy="81" rx="30" ry="12" fill="${d}" stroke="#fff" stroke-width="2"/><path d="${SHAPE}" fill="url(#pawn)" stroke="white" stroke-opacity=".75" stroke-width="1.5"/><ellipse cx="40" cy="77" rx="25" ry="8" fill="${c}"/><circle cx="40" cy="28" r="22" fill="url(#head)" stroke="#fff" stroke-opacity=".85" stroke-width="2"/>${shine}</svg>`;
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

/** App icon: four classic pawns on the purple arcade backdrop (full bleed, safe-zone centered). */
export function iconSvg(transparent = false): string {
  const spots = [
    [33, 34],
    [67, 34],
    [67, 70],
    [33, 70],
  ];
  const pawns = spots
    .map(
      ([x, y], seat) =>
        `<g transform="translate(${x! - 12.8} ${y! - 18}) scale(.32)"><ellipse cx="40" cy="90" rx="32" ry="8" fill="#211339" opacity=".3"/><ellipse cx="40" cy="81" rx="30" ry="12" fill="${depths[seat]}" stroke="#fff" stroke-width="3"/><path d="M14 77Q29 61 29 40H51Q51 61 66 77Q40 94 14 77Z" fill="${colors[seat]}" stroke="white" stroke-opacity=".8" stroke-width="2.5"/><circle cx="40" cy="28" r="22" fill="${colors[seat]}" stroke="#fff" stroke-width="3"/><ellipse cx="32" cy="18" rx="7" ry="4" fill="white" opacity=".6"/></g>`,
    )
    .join("");
  const background = transparent
    ? ""
    : `<rect width="100" height="100" fill="url(#ibg)"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 100 100"><defs><radialGradient id="ibg" cx=".5" cy=".3" r=".85"><stop stop-color="#8c55c5"/><stop offset=".6" stop-color="#4a2677"/><stop offset="1" stop-color="#26164a"/></radialGradient></defs>${background}<rect x="19" y="19" width="62" height="62" rx="12" fill="#3b2463" stroke="#f3c35f" stroke-width="3"/><path d="M50 26V74M26 50H74" stroke="#f3c35f" stroke-opacity=".35" stroke-width="1.5"/>${pawns}</svg>`;
}
