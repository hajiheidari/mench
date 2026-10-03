export function isLocale(value: unknown): value is "fa" | "en" {
  return value === "fa" || value === "en";
}
