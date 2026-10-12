import { createContext, useContext } from "react";
import { Text as NativeText, StyleSheet, type TextProps } from "react-native";

/**
 * The layout direction of the chosen language. The app turns off the
 * system's right-to-left mirroring (expo-localization, supportsRTL false) so
 * English stays left-to-right on a Persian phone; Persian is laid out from
 * this instead.
 */
export const Direction = createContext<"ltr" | "rtl">("ltr");
export const useDirection = () => useContext(Direction);

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
          textAlign: dir === "rtl" ? "right" : "left",
          writingDirection: dir,
        },
        style,
        { fontFamily: bold ? "SamimBold" : "Samim", fontWeight: "normal" },
      ]}
    />
  );
}
