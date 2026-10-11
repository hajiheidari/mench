import { createContext, useContext, type ReactNode } from "react";
import { Avatar } from "./Avatar";
import { Dice } from "./Dice";
import type { Messages } from "./messages";

/** Lets every top bar offer the language switch, including invite deep links. */
export const LanguageToggle = createContext<{
  label: string;
  toggle: () => void;
} | null>(null);

export interface HudPlayer {
  key: string;
  seat: number;
  name: string;
  finished: number;
  current: boolean;
}

/**
 * One-screen game frame: top bar, a board area that takes all remaining
 * height (the board is square and sized to fit), and the control strip.
 * Nothing scrolls; extra settings live in dialogs.
 */
export function GameScreen({
  t,
  title,
  onBack,
  actions,
  board,
  players,
  dice,
  status,
  rollDisabled,
  onRoll,
  info,
  children,
}: {
  t: Messages;
  title: string;
  onBack: () => void;
  actions?: ReactNode;
  board: ReactNode;
  players: HudPlayer[];
  dice: number | null;
  status: ReactNode;
  rollDisabled: boolean;
  onRoll: () => void;
  info?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="game-screen">
      <TopBar t={t} title={title} onBack={onBack} actions={actions} />
      <div className="game-body">
        <div className="board-wrap">{board}</div>
        <div className="hud">
          <div className="hud-players">
            {players.map((p) => (
              <div
                key={p.key}
                className={p.current ? "chip current" : "chip"}
                data-seat={p.seat}
              >
                <Avatar seat={p.seat} />
                <span className="chip-name">{p.name}</span>
                <small>{p.finished}/4</small>
              </div>
            ))}
          </div>
          {info && <div className="hud-info">{info}</div>}
          <div className="roll-bar">
            <Dice value={dice} />
            <span className="roll-turn" role="status">
              {status}
            </span>
            <button
              className="primary"
              disabled={rollDisabled}
              onClick={onRoll}
            >
              {t.roll}
            </button>
          </div>
        </div>
      </div>
      {children}
    </div>
  );
}

export function TopBar({
  t,
  title,
  onBack,
  actions,
}: {
  t: Messages;
  title: string;
  onBack: () => void;
  actions?: ReactNode;
}) {
  const language = useContext(LanguageToggle);
  return (
    <div className="topbar">
      <button className="icon-btn back" aria-label={t.back} onClick={onBack}>
        <span aria-hidden="true">‹</span>
      </button>
      <span className="topbar-title">{title}</span>
      <div className="topbar-actions">
        {language && (
          <button className="icon-btn lang" onClick={language.toggle}>
            {language.label}
          </button>
        )}
        {actions}
      </div>
    </div>
  );
}

/** Uniform float in [0, 1) from the platform CSPRNG. */
export function randomFloat(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0]! / 2 ** 32;
}

export function randomDie(): number {
  const bytes = new Uint8Array(1);
  do {
    crypto.getRandomValues(bytes);
  } while (bytes[0]! >= 252);
  return (bytes[0]! % 6) + 1;
}
