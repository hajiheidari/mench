import { Image } from "react-native";
import avatar0 from "./assets/game/avatar-0.png";
import avatar1 from "./assets/game/avatar-1.png";
import avatar2 from "./assets/game/avatar-2.png";
import avatar3 from "./assets/game/avatar-3.png";
const avatars = [avatar0, avatar1, avatar2, avatar3];
export function Avatar({ seat }: { seat: number }) {
  return (
    <Image
      source={avatars[seat]!}
      accessible={false}
      style={{ width: 38, height: 38 }}
    />
  );
}
