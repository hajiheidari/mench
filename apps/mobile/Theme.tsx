import { createContext, useContext } from "react";
import {
  Text as NativeText,
  Platform,
  StyleSheet,
  type TextProps,
} from "react-native";

/**
 * The layout direction of the chosen language. The app turns off the
 * system's right-to-left mirroring (expo-localization, supportsRTL false) so
 * English stays left-to-right on a Persian phone; Persian is laid out from
 * this instead.
 */
export const Direction = createContext<"ltr" | "rtl">("ltr");
export const useDirection = () => useContext(Direction);

/**
 * textAlign for the start of a line. On iOS and Android "left" already means
 * the start of the layout direction (React Native swaps it under rtl);
 * react-native-web takes it literally.
 */
export function startAlign(dir: "ltr" | "rtl"): "left" | "right" {
  return Platform.OS === "web" && dir === "rtl" ? "right" : "left";
}

export function Text({ style, ...props }: TextProps) {
  const dir = useDirection();
  const weight = StyleSheet.flatten(style)?.fontWeight;
  const bold = weight === "bold" || Number(weight) >= 600;
  return (
    <NativeText
      {...props}
      style={[
        {
          color: "#fff4df",
          textAlign: startAlign(dir),
        },
        style,
        { fontFamily: bold ? "SamimBold" : "Samim", fontWeight: "normal" },
      ]}
    />
  );
}
