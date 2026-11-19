import { UNIT_HOURS, UNIT_MINUTES, UNIT_PAGES } from "./constants";
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
};

const UNIT_EN = { [UNIT_HOURS]: "hours", [UNIT_MINUTES]: "minutes", [UNIT_PAGES]: "pages" };
const UNIT_ALIASES = {
  hours: UNIT_HOURS, hour: UNIT_HOURS, hrs: UNIT_HOURS, hr: UNIT_HOURS, h: UNIT_HOURS,
  minutes: UNIT_MINUTES, minute: UNIT_MINUTES, mins: UNIT_MINUTES, min: UNIT_MINUTES,
  pages: UNIT_PAGES, page: UNIT_PAGES, pg: UNIT_PAGES,
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
