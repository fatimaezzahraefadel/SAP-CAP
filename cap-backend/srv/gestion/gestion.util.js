'use strict';

const dayMs = 24 * 60 * 60 * 1000;

const isoDate = (value) => new Date(`${value}T00:00:00`);

const countWorkingDays = (start, end) => {
  const from = isoDate(start);
  const to = isoDate(end);
  let days = 0;

  for (let cursor = from; cursor <= to; cursor = new Date(cursor.getTime() + dayMs)) {
    const weekday = cursor.getDay();
    if (weekday !== 0 && weekday !== 6) days += 1;
  }

  return days;
};

const todayIso = () => new Date().toISOString().slice(0, 10);

module.exports = {
  countWorkingDays,
  isoDate,
  todayIso,
};
