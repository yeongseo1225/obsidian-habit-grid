export function pad(n) { return String(n).padStart(2, "0"); }

export function fmt(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }

export function addDays(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }

export function toDate(s) { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); }

export function weekStartOf(d, weekStart) {
  return addDays(d, -((d.getDay() - weekStart + 7) % 7));
}

// A 규칙: 두 달에 걸친 주는 날짜가 더 많은 달(주의 가운데 날)이 기준
export function weekMonthKey(ws) { return monthKey(addDays(ws, 3)); }

export function monthKey(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; }
