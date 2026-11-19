import { LANG } from "./i18n";

// Habit file properties. The first name is the Korean name, the second the English one.
// Older files use the Korean names; English names are read everywhere and written when chosen.
export const FM = {
  unit: ["단위", "unit"],
  monthGoals: ["월별목표", "monthGoals"],
  weeklyTimes: ["월별횟수", "weeklyTimes"],
  weekdays: ["월별요일", "weekdays"],
  duration: ["기간", "duration"],
  start: ["시작", "start"],
  archived: ["보관", "archived"],
  color: ["색", "color"],
  goal: ["목표", "goal", "주간목표"],
};

const UNIT_EN = { 시간: "hours", 분: "minutes", 쪽: "pages" };
const UNIT_ALIASES = {
  hours: "시간", hour: "시간", hrs: "시간", hr: "시간", h: "시간",
  minutes: "분", minute: "분", mins: "분", min: "분",
  pages: "쪽", page: "쪽", pg: "쪽",
};

// Which property names to write: "ko" or "en". "auto" follows the display language.
export function resolveKeyStyle(pref) {
  return pref === "ko" || pref === "en" ? pref : LANG === "ko" ? "ko" : "en";
}

function has(v) { return v !== undefined && v !== null && v !== "" && v !== false; }

// Value of a property under any of its names (Korean name first)
export function fmGet(fm, name) {
  if (!fm) return undefined;
  for (const key of FM[name]) if (has(fm[key])) return fm[key];
  return undefined;
}

export function fmKey(name, style) { return FM[name][style === "en" ? 1 : 0]; }

export function fmDel(fm, name) { for (const key of FM[name]) delete fm[key]; }

// Write under the name the file already uses; otherwise use the chosen style.
// Other names for the same property are removed so the file never holds two copies.
export function fmSet(fm, name, value, style) {
  const keys = FM[name];
  const key = keys.slice(0, 2).find((k) => fm[k] !== undefined) || fmKey(name, style);
  for (const k of keys) if (k !== key) delete fm[k];
  fm[key] = value;
  return key;
}

// Unit text as stored internally: hours, minutes and pages use the Korean words
export function normalizeUnit(u) {
  if (typeof u !== "string") return u;
  return UNIT_ALIASES[u.trim().toLowerCase()] || u;
}

// Unit text for a file whose property name is Korean or English
export function unitForKey(unit, key) {
  return key === FM.unit[1] ? UNIT_EN[unit] || unit : unit;
}

export function fmSetUnit(fm, unit, style) {
  const key = FM.unit.find((k) => fm[k] !== undefined) || fmKey("unit", style);
  for (const k of FM.unit) if (k !== key) delete fm[k];
  fm[key] = unitForKey(unit, key);
}
