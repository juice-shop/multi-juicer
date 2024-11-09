export function classNames(...classes: string[]): string {
  return classes
    .filter(Boolean)
    .map((classNames) => classNames.trim())
    .join(" ");
}
