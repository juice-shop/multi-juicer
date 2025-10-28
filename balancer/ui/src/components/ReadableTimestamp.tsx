import { useIntl } from "react-intl";

interface Unit {
  max: number;
  value: number;
  name: Intl.RelativeTimeFormatUnit;
}

const units: Unit[] = [
  { max: 60, value: 1, name: "second" },
  { max: 3600, value: 60, name: "minute" },
  { max: 86400, value: 3600, name: "hour" },
  { max: 2592000, value: 86400, name: "day" },
  { max: 31536000, value: 2592000, name: "month" },
] as const;
const maxUnit: Unit = { max: Infinity, value: 31536000, name: "year" };

function formatRelativeTime(date: Date, locale: string): string {
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  const { value, name } =
    units.find((unit) => Math.abs(seconds) < unit.max) ?? maxUnit;
  const relativeTime = Math.floor(seconds / value);

  return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(
    -relativeTime,
    name
  );
}

function formatAbsoluteTime(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "long",
    timeStyle: "short",
  }).format(date);
}

export function ReadableTimestamp({ date }: { date: Date }) {
  const intl = useIntl();
  const locale = intl.locale;

  return (
    <span title={formatAbsoluteTime(date, locale)}>
      {formatRelativeTime(date, locale)}
    </span>
  );
}
