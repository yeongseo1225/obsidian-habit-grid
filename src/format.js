import { WD_ORDER } from "./constants";
import { DAY_NAMES, LANG, tr, unitLabel } from "./i18n";

export function daysLabel(days) { return WD_ORDER.filter((d) => (days || []).includes(d)).map((d) => DAY_NAMES[d]).join("·"); }

export function splitHM(h) {
  const mins = Math.round(h * 60);
  return [Math.floor(mins / 60), mins % 60];
}

// 3.3833 -> "3시간 23분"
export function fmtDur(h) {
  const [H, M] = splitHM(h);
  if (!H && !M) return tr("0분");
  return [H ? tr("{0}시간", H) : "", M ? tr("{0}분", M) : ""].filter(Boolean).join(" ");
}

// 3.3833 -> "3h23m" (짧게)
export function fmtDurShort(h) {
  const [H, M] = splitHM(h);
  if (!H) return `${M}m`;
  return M ? `${H}h${M}m` : `${H}h`;
}

export function fmtQty(v, unit) { return unit === "시간" ? fmtDur(v) : `${fmtNum(Math.round(v * 10) / 10)}${LANG === "en" && unitLabel(unit) ? " " : ""}${unitLabel(unit)}`; }

export function fmtQtyShort(v, unit) { return unit === "시간" ? fmtDurShort(v) : fmtNum(Math.round(v * 10) / 10); }

// 파일에 적는 값: 시간이면 "3h23m"
export function writeQty(v, unit) { return unit === "시간" ? fmtDurShort(v) : fmtNum(Math.round(v * 100) / 100); }

export function fmtNum(n) { return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, ""); }
