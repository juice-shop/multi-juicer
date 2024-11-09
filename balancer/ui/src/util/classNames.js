export function classNames(...classes) {
  return classes
    .filter(Boolean)
    .map((classNames) => classNames.trim())
    .join(" ");
}
