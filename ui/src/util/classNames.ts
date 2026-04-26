export function classNames(
  ...classes: (string | boolean | undefined | null)[]
): string {
  return classes
    .filter(Boolean)
    .filter((classNames) => typeof classNames === "string")
    .map((classNames) => classNames.trim())
    .join(" ");
}
