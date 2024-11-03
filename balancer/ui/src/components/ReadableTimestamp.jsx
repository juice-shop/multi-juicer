import React from "react";

function formatRelativeTime(date) {
  const now = new Date();
  const seconds = Math.floor((now - date) / 1000);

  const units = [
    { max: 60, value: 1, name: "second" },
    { max: 3600, value: 60, name: "minute" },
    { max: 86400, value: 3600, name: "hour" },
    { max: 2592000, value: 86400, name: "day" },
    { max: 31536000, value: 2592000, name: "month" },
    { max: Infinity, value: 31536000, name: "year" },
  ];

  const { value, name } = units.find((unit) => Math.abs(seconds) < unit.max);
  const relativeTime = Math.floor(seconds / value);

  return new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(
    -relativeTime,
    name
  );
}

function formatAbsoluteTime(date) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(date);
}

export function ReadableTimestamp({ date }) {
  return (
    <span title={formatAbsoluteTime(date)}>{formatRelativeTime(date)}</span>
  );
}
