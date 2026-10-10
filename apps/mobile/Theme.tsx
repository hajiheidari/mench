import { Text as NativeText, StyleSheet, type TextProps } from "react-native";
export function Text({ style, ...props }: TextProps) {
  const weight = StyleSheet.flatten(style)?.fontWeight;
  const bold = weight === "bold" || Number(weight) >= 600;
  return (
    <NativeText
      {...props}
      style={[
        { color: "#fff4df" },
        style,
        { fontFamily: bold ? "SamimBold" : "Samim", fontWeight: "normal" },
      ]}
    />
  );
}
