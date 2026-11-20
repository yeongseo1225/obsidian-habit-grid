import { addDays, fmt, toDate, weekMonthKey, weekStartOf } from "./dates";

export function weekCounts(set, weekStart) {
  const counts = new Map();
  for (const s of set) {
    const k = fmt(weekStartOf(toDate(s), weekStart));
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  return counts;
}

export function freqOfWeek(freqs, ws) {
  const f = goalForMonth(freqs || {}, weekMonthKey(ws));
  return f > 0 && f < 7 ? Math.round(f) : 0;
}

export function computeWeeklyStats(set, today, freqOf, weekStart) {
  const counts = weekCounts(set, weekStart);
  const hit = (k) => { const f = freqOf(toDate(k)); return f > 0 && (counts.get(k) || 0) >= f; };
  const thisWeek = weekStartOf(today, weekStart);
  const thisCount = counts.get(fmt(thisWeek)) || 0;
  const goal = freqOf(thisWeek);

  let current = 0;
  let w = hit(fmt(thisWeek)) ? thisWeek : addDays(thisWeek, -7);
  while (hit(fmt(w))) { current++; w = addDays(w, -7); }

  let longest = 0, run = 0, prev = null;
  for (const k of [...counts.keys()].filter(hit).sort()) {
    run = prev && fmt(addDays(prev, 7)) === k ? run + 1 : 1;
    if (run > longest) longest = run;
    prev = toDate(k);
  }
  return { total: set.size, current, longest, thisCount, doneToday: set.has(fmt(today)), weekDone: thisCount >= goal };
}

// 이번 주에 해야 하는 요일 칸인지
export function isSchedDay(fr, dd, date, today, weekStart) {
  if (!dd || !Object.keys(dd).length) return false;
  const ws = weekStartOf(today, weekStart);
  if (fmt(weekStartOf(date, weekStart)) !== fmt(ws)) return false;
  const sc = scheduleAt(fr, dd, weekMonthKey(ws));
  return !!(sc && sc.days && sc.days.includes(date.getDay()));
}

// 그 달에 적용되는 방식: 요일 지정이면 {days}, 횟수면 {n}. 가장 가까운 앞 달 설정을 이어서 쓴다
export function scheduleAt(fr, dd, key) {
  const ks = [...new Set([...Object.keys(fr || {}), ...Object.keys(dd || {})])].filter((k) => k <= key).sort();
  if (!ks.length) return null;
  const k = ks[ks.length - 1];
  if (dd && dd[k] && dd[k].length) return { days: dd[k] };
  return { n: Number(fr && fr[k]) || 0 };
}

// 그 달의 목표. 정해진 게 없으면 가장 최근에 정한 목표를 이어서 쓴다
export function goalForMonth(goals, key) {
  if (!goals) return 0;
  if (goals[key] != null) return Number(goals[key]) || 0;
  const earlier = Object.keys(goals).filter((k) => k < key).sort();
  return earlier.length ? Number(goals[earlier[earlier.length - 1]]) || 0 : 0;
}

export function computeStats(set, today) {
  let current = 0;
  let d = set.has(fmt(today)) ? today : addDays(today, -1);
  while (set.has(fmt(d))) { current++; d = addDays(d, -1); }

  let longest = 0, run = 0, prev = null;
  for (const s of [...set].sort()) {
    run = prev && fmt(addDays(prev, 1)) === s ? run + 1 : 1;
    if (run > longest) longest = run;
    prev = toDate(s);
  }

  const monthPrefix = fmt(today).slice(0, 8);
  let monthDone = 0;
  for (const s of set) if (s.startsWith(monthPrefix) && s <= fmt(today)) monthDone++;

  return { total: set.size, current, longest, monthDone, monthDays: new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate(), doneToday: set.has(fmt(today)) };
}

// 습관이 시작된 날: 챌린지 시작일, 정해 둔 시작일, 없으면 첫 기록일 (아무것도 없으면 빈 문자열)
export function habitStart(h) {
  if (h.period && h.period.start) return h.period.start;
  if (h.startDate) return h.startDate;
  const all = h.kind === "check" ? [...h.set] : [...h.entries].filter(([, v]) => v > 0).map(([d]) => d);
  if (h.items) for (const [d, list] of h.items) if (list.length) all.push(d);
  return all.reduce((a, d) => (!a || d < a ? d : a), "");
}
