import { avatarSvg } from "@mench/board-geometry";
const avatars = [0, 1, 2, 3].map(
  (seat) => `data:image/svg+xml,${encodeURIComponent(avatarSvg(seat))}`,
);
export function Avatar({ seat }: { seat: number }) {
  return (
    <span className="player-avatar" aria-hidden="true">
      <img src={avatars[seat]} alt="" />
    </span>
  );
}
