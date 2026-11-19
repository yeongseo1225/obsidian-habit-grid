import { DONE_RE, LOG_RE, SKIP_RE, TITLE_RE, UNIT_HOURS } from "./constants";

// 날짜 -> 값(시간). 값이 없는 기록은 0
export function parseEntries(text) {
  const map = new Map();
  for (const line of text.split("\n")) {
    const m = line.match(DONE_RE);
    if (!m) continue;
    map.set(m[1], (map.get(m[1]) || 0) + parseAmount(m[2] || ""));
  }
  return map;
}

export function parseTitle(name) {
  const hm = name.match(/^(.+?)\s+(\d+)\s*시간\s*(\d+)\s*분\s*(?:이상)?$/);
  if (hm) return { base: hm[1].trim(), amount: parseInt(hm[2], 10) + parseInt(hm[3], 10) / 60, unit: UNIT_HOURS };
  const m = name.match(TITLE_RE);
  if (!m) return null;
  return { base: m[1].trim(), amount: parseFloat(m[2]), unit: m[3] === "h" ? UNIT_HOURS : m[3] };
}

// "3h23m", "3시간 23분", "45m", "1.5h", "2" -> 시간(소수)
export function parseAmount(str) {
  const t = str.trim();
  let m = t.match(/^(\d+):(\d{1,2})\b/);
  if (m) return parseInt(m[1], 10) + parseInt(m[2], 10) / 60;
  m = t.match(/^(\d+(?:\.\d+)?)\s*(?:h|시간)\s*(?:(\d+)\s*(?:m|분))?/);
  if (m) return parseFloat(m[1]) + (m[2] ? parseInt(m[2], 10) / 60 : 0);
  m = t.match(/^(\d+)\s*(?:m|분)/);
  if (m) return parseInt(m[1], 10) / 60;
  m = t.match(/^(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : 0;
}

// 단축어가 쓰는 '미리 알림 기록' 파일: 날짜 + 미리 알림 이름
export function parseLog(text) {
  const out = [];
  for (const line of text.split("\n")) {
    const m = line.match(LOG_RE);
    if (!m || !m[2]) continue;
    out.push({ ds: m[1], title: m[2].normalize("NFC") });
  }
  return out;
}

export function parseSkips(text) {
  const set = new Set();
  for (const line of text.split("\n")) { const m = line.match(SKIP_RE); if (m) set.add(m[1]); }
  return set;
}

export function parseDates(text) {
  const set = new Set();
  for (const line of text.split("\n")) {
    const m = line.match(DONE_RE);
    if (m) set.add(m[1]);
  }
  return set;
}

export function parseBlock(source) {
  const opts = {};
  for (const raw of source.split("\n")) {
    const m = raw.match(/^\s*([a-zA-Z가-힣]+)\s*:\s*(.+?)\s*$/);
    if (!m) continue;
    const key = m[1].toLowerCase(), val = m[2];
    if (key === "habit" || key === "습관") opts.habits = val.split(",").map((s) => s.trim()).filter(Boolean);
    else if (key === "weeks" || key === "주") opts.weeks = parseInt(val, 10);
    else if (key === "color" || key === "색") opts.color = val;
    else if (key === "folder" || key === "폴더") opts.folder = val;
    else if (key === "goal" || key === "목표") opts.goal = parseInt(val, 10);
  }
  return opts;
}
