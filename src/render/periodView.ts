import type { PeriodOpts } from "../types";
import { DAY_NAMES, tr } from "../i18n";
import { addDays, fmt, toDate, weekStartOf } from "../dates";
import { fmtQty, fmtQtyShort } from "../format";
import { stopEditorGrab } from "../ui";

// 연도 | 월 전환
export function modeTabs(parent: HTMLElement, mode: string, onMode: (m: "year" | "month") => unknown) {
  const tabs = parent.createDiv({ cls: "hg-tabs" });
  for (const [m, label] of [["year", tr("연도")], ["month", tr("월")]] as ["year" | "month", string][]) {
    const t = tabs.createSpan({ cls: "hg-tab" + (m === mode ? " is-on" : ""), text: label });
    if (m !== mode) t.addEventListener("click", () => { void onMode(m); });
    stopEditorGrab(t);
  }
}

// 월 보기(달력) / 주 보기(가로 줄)
export function renderPeriodView(card: HTMLElement, c: PeriodOpts) {
  const { today, weekStart, kind } = c;
  const unit = c.unit ?? "";
  const freqOf = c.freqOf || (() => 0);
  const todayStr = fmt(today);
  const measure = kind === "measure";
  const goalOf = c.goalOf || (() => 0);
  const bar = card.createDiv({ cls: "hg-yearbar" });
  const nav = bar.createDiv({ cls: "hg-yearnav" });
  const right = bar.createDiv({ cls: "hg-barright" });
  const navBtn = (label: string, aria: string, fn: () => void, enabled = true) => {
    const b = nav.createEl("button", { cls: "hg-yearbtn", text: label });
    b.setAttr("aria-label", aria);
    if (!enabled) b.addClass("is-disabled");
    else b.addEventListener("click", fn);
    stopEditorGrab(b);
  };
  const weekdayNames = Array.from({ length: 7 }, (_, i) => DAY_NAMES[(weekStart + i) % 7]);
  const cellText = (ds: string) => {
    const v = c.value(ds);
    if (!v) return "";
    return measure ? fmtQtyShort(v, unit) : "✓";
  };

  if (c.mode === "month") {
    const anchor = c.monthAnchor || new Date(today.getFullYear(), today.getMonth(), 1);
    const y = anchor.getFullYear(), m = anchor.getMonth();
    const isCur = y === today.getFullYear() && m === today.getMonth();
    navBtn("‹", tr("이전 달"), () => { void c.onNav?.(-1); });
    nav.createSpan({ cls: "hg-year hg-year-wide", text: tr("{0}년 {1}월", y, m + 1) });
    navBtn("›", tr("다음 달"), () => { void c.onNav?.(1); }, !isCur);
    {
      const back = nav.createSpan({ cls: "hg-yearbtn hg-thisyear" + (isCur ? " is-ghost" : ""), text: tr("이번 달") });
      if (!isCur) back.addEventListener("click", () => { void c.onNav?.(0); });
      stopEditorGrab(back);
    }
    const days = new Date(y, m + 1, 0).getDate();
    let sum = 0, hits = 0;
    for (let d = 1; d <= days; d++) { const ds = fmt(new Date(y, m, d)); sum += c.value(ds); if (c.value(ds) && c.hit(ds)) hits++; }
    right.createSpan({ cls: "hg-yearsum", text: measure ? tr("합계 {0} · 달성 {1}/{2}일", fmtQty(sum, unit), hits, days) : tr("{0}/{1}일", hits, days) });
    if (c.onMode) modeTabs(right, "month", c.onMode);

    // 주간 목표 달성 주 (체크 습관의 쉬는 날 표시용)
    const weekHit = (ws: Date) => {
      const f = freqOf(ws);
      if (!f || measure) return false;
      let n = 0;
      for (let i = 0; i < 7; i++) if (c.hit(fmt(addDays(ws, i)))) n++;
      return n >= f;
    };

    const cal = card.createDiv({ cls: "hg-cal" });
    for (const n of weekdayNames) cal.createDiv({ cls: "hg-cal-head", text: n });
    const first = weekStartOf(new Date(y, m, 1), weekStart);
    for (let w = 0; w < 6; w++) {
      const ws = addDays(first, w * 7);
      if (w > 0 && ws.getMonth() !== m) break;
      const rest = weekHit(ws);
      for (let i = 0; i < 7; i++) {
        const d = addDays(ws, i);
        const ds = fmt(d);
        const cell = cal.createDiv({ cls: "hg-cal-cell" });
        cell.createDiv({ cls: "hg-cal-num", text: String(d.getDate()) });
        if (d.getMonth() !== m) { cell.addClass("is-outside"); continue; }
        if (ds > todayStr) { cell.addClass(rest ? "is-rest" : "is-future"); continue; }
        const v = c.value(ds);
        if (v && c.hit(ds)) cell.addClass("is-on");
        else if (v) {
          cell.addClass("is-partial");
          const g = goalOf(ds);
          cell.style.setProperty("--hg-ratio", `${g ? Math.round(12 + 88 * Math.min(1, v / g)) : 100}%`);
        } else if (rest) cell.addClass("is-rest");
        if (ds === todayStr) cell.addClass("is-today");
        const its = c.itemsOf ? c.itemsOf(ds) : [];
        if (c.itemsOf) {
          if (its.length) {
            cell.addClass("has-items");
            const box = cell.createDiv({ cls: "hg-cal-items" });
            its.slice(0, 2).forEach((t: string) => box.createDiv({ cls: "hg-cal-item", text: t }));
            if (its.length > 2) box.createDiv({ cls: "hg-cal-more", text: `+${its.length - 2}` });
          }
          if (ds === c.selDay) cell.addClass("is-selected");
        } else cell.createDiv({ cls: "hg-cal-val", text: cellText(ds) });
        if (c.onCell) { cell.addClass("is-clickable"); cell.addEventListener("click", () => { void c.onCell?.(ds); }); }
        stopEditorGrab(cell);
      }
    }
    if (c.itemsOf) {
      const sel = c.selDay || todayStr;
      const sd = toDate(sel);
      const its = c.itemsOf(sel);
      const det = card.createDiv({ cls: "hg-daydetail" });
      det.createDiv({ cls: "hg-daydetail-title", text: `${sd.getMonth() + 1}/${sd.getDate()} (${DAY_NAMES[sd.getDay()]})${its.length ? tr(" · {0}가지", its.length) : ""}` });
      if (its.length) { const l = det.createDiv({ cls: "hg-itemlog-chips" }); its.forEach((t: string) => l.createSpan({ cls: "hg-itemlog-chip", text: t })); }
      else det.createDiv({ cls: "hg-itemlog-none", text: tr("이 날 적힌 내용이 없어요") });
      det.createDiv({ cls: "hg-daydetail-hint", text: tr("날짜를 누르면 그날 한 것이 여기에 나와요") });
    }
    return;
  }

  // 주 보기
  const ws = c.weekAnchor || weekStartOf(today, weekStart);
  const we = addDays(ws, 6);
  const isCur = fmt(ws) === fmt(weekStartOf(today, weekStart));
  navBtn("‹", tr("지난주"), () => { void c.onNav?.(-1); });
  nav.createSpan({ cls: "hg-year hg-year-wide", text: tr("{0}월 {1}일 – {2}{3}일", ws.getMonth() + 1, ws.getDate(), we.getMonth() !== ws.getMonth() ? tr("{0}월 ", we.getMonth() + 1) : "", we.getDate()) });
  navBtn("›", tr("다음 주"), () => { void c.onNav?.(1); }, !isCur);
  {
    const back = nav.createSpan({ cls: "hg-yearbtn hg-thisyear" + (isCur ? " is-ghost" : ""), text: tr("이번 주") });
    if (!isCur) back.addEventListener("click", () => { void c.onNav?.(0); });
    stopEditorGrab(back);
  }
  let sum = 0, hits = 0, maxV = 0;
  const dayList = Array.from({ length: 7 }, (_, i) => addDays(ws, i));
  for (const d of dayList) { const ds = fmt(d); const v = c.value(ds); sum += v; maxV = Math.max(maxV, v); if (v && c.hit(ds)) hits++; }
  right.createSpan({ cls: "hg-yearsum", text: measure ? tr("합계 {0}", fmtQty(sum, unit)) : tr("{0}/7일", hits) });
  if (c.onMode) modeTabs(right, "week", c.onMode);

  const freq = freqOf(ws);
  if (freq) {
    const wk = card.createDiv({ cls: "hg-weekbar" + (hits >= freq ? " is-done" : "") });
    wk.createSpan({ cls: "hg-weekbar-label", text: tr("주 {0}회 목표", freq) });
    const track = wk.createDiv({ cls: "hg-weekbar-track" });
    for (let n = 0; n < freq; n++) track.createDiv({ cls: "hg-weekbar-seg" + (n < hits ? " is-on" : "") });
    wk.createSpan({ cls: "hg-weekbar-count", text: tr("{0}/{1}회", hits, freq) + (hits >= freq ? " ✓" : "") });
  }

  const rows = card.createDiv({ cls: "hg-wrows" });
  const goalMax = Math.max(...dayList.map((d) => goalOf(fmt(d))), 0);
  const scale = measure ? Math.max(goalMax * 2, maxV, 1) : 1;
  for (const d of dayList) {
    const ds = fmt(d);
    const v = c.value(ds);
    const g = goalOf(ds);
    const row = rows.createDiv({ cls: "hg-wrow" + (ds > todayStr ? " is-future" : "") + (ds === todayStr ? " is-today" : "") });
    const lab = row.createDiv({ cls: "hg-wrow-day" });
    lab.createSpan({ cls: "hg-wrow-dow", text: DAY_NAMES[d.getDay()] });
    lab.createSpan({ text: tr(" {0}일", d.getDate()) });
    const track = row.createDiv({ cls: "hg-wrow-track" });
    if (ds <= todayStr && v) {
      const fill = track.createDiv({ cls: "hg-wrow-fill" + (c.hit(ds) ? " is-on" : "") });
      fill.style.width = `${Math.min(100, (measure ? v / scale : 1) * 100)}%`;
    }
    if (measure && g) {
      const gl = track.createDiv({ cls: "hg-wrow-goal" });
      gl.style.left = `${Math.min(100, (g / scale) * 100)}%`;
    }
    row.createDiv({ cls: "hg-wrow-val", text: ds > todayStr ? "" : v ? (measure ? fmtQty(v, unit) : "✓") : "—" });
    if (c.onCell && ds <= todayStr) { row.addClass("is-clickable"); row.addEventListener("click", () => { void c.onCell?.(ds); }); }
    stopEditorGrab(row);
  }
}
