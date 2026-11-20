import type { PeriodOpts } from "../types";
import { DAY_NAMES, tr } from "../i18n";
import { addDays, fmt, weekStartOf } from "../dates";
import { fmtQty, fmtQtyShort } from "../format";
import { stopEditorGrab } from "../ui";
import { renderItemLog } from "./measured";

export function renderWeekTop(card: HTMLElement, c: PeriodOpts) {
  const { today, weekStart, kind } = c;
  const unit = c.unit ?? "";
  const measure = kind === "measure";
  const todayStr = fmt(today);
  const curWs = weekStartOf(today, weekStart);
  const ws = c.weekAnchor || curWs;
  const we = addDays(ws, 6);
  const isCur = fmt(ws) === fmt(curWs);
  const goalOf = c.goalOf || (() => 0);

  const bar = card.createDiv({ cls: "hg-weektop" });
  const nav = bar.createDiv({ cls: "hg-yearnav" });
  const navBtn = (label: string, aria: string, delta: number, enabled = true) => {
    const b = nav.createEl("button", { cls: "hg-yearbtn", text: label });
    b.setAttr("aria-label", aria);
    if (!enabled) b.addClass("is-disabled");
    else if (c.onWeekNav) b.addEventListener("click", () => { void c.onWeekNav?.(delta); });
    stopEditorGrab(b);
  };
  navBtn("‹", tr("지난주"), -1);
  const range = tr("{0}월 {1}일 – {2}{3}일", ws.getMonth() + 1, ws.getDate(), we.getMonth() !== ws.getMonth() ? tr("{0}월 ", we.getMonth() + 1) : "", we.getDate());
  nav.createSpan({ cls: "hg-year hg-year-wide", text: range });
  navBtn("›", tr("다음 주"), 1, !isCur);
  {
    const back = nav.createSpan({ cls: "hg-yearbtn hg-thisyear" + (isCur ? " is-ghost" : ""), text: tr("이번 주") });
    if (!isCur && c.onWeekNav) back.addEventListener("click", () => { void c.onWeekNav?.(0); });
    stopEditorGrab(back);
  }
  let sum = 0, hits = 0;
  const days = Array.from({ length: 7 }, (_, i) => addDays(ws, i));
  for (const d of days) { const ds = fmt(d); const v = c.value(ds); sum += v; if (v && c.hit(ds)) hits++; }
  bar.createSpan({ cls: "hg-yearsum", text: measure ? tr("합계 {0}", fmtQty(sum, unit)) : tr("{0}/7일", hits) });

  const row = card.createDiv({ cls: "hg-recent" });
  for (const d of days) {
    const ds = fmt(d);
    const v = c.value(ds);
    const fut = ds > todayStr;
    const locked = !!c.minDate && ds < c.minDate;
    let state = "off";
    if (!fut && v) state = c.hit(ds) ? "on" : "partial";
    const b = row.createDiv({ cls: `hg-day is-${state}` + (ds === todayStr ? " is-today" : "") + (fut ? " is-future" : "") + (locked ? " is-locked" : "") });
    if (state === "partial") {
      const g = goalOf(ds);
      b.style.setProperty("--hg-ratio", `${g ? Math.round(12 + 88 * Math.min(1, v / g)) : 100}%`);
    }
    b.createDiv({ cls: "hg-day-dow", text: ds === todayStr ? tr("오늘") : DAY_NAMES[d.getDay()] });
    b.createDiv({ cls: "hg-day-mark", text: fut ? String(d.getDate()) : v ? (measure ? fmtQtyShort(v, unit) : "✓") : String(d.getDate()) });
    b.setAttr("aria-label", tr("{0}월 {1}일", d.getMonth() + 1, d.getDate()));
    if (c.onTap && !fut && !locked) b.addEventListener("click", () => { void c.onTap?.(ds); });
    stopEditorGrab(b);
  }

  if (c.itemsAll) renderItemLog(card, c.itemsAll, days, todayStr);

  const f = c.freqOf ? c.freqOf(ws) : 0;
  if (f) {
    const wk = card.createDiv({ cls: "hg-weekbar" + (hits >= f ? " is-done" : "") });
    wk.createSpan({ cls: "hg-weekbar-label", text: tr("주 {0}회", f) });
    const track = wk.createDiv({ cls: "hg-weekbar-track" });
    for (let n = 0; n < f; n++) track.createDiv({ cls: "hg-weekbar-seg" + (n < hits ? " is-on" : "") });
    wk.createSpan({ cls: "hg-weekbar-count", text: tr("{0}/{1}회", hits, f) + (hits >= f ? " ✓" : "") });
  }
}
