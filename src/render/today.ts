import type { Habit, TodayOpts } from "../types";
import { DAY_NAMES, tr, unitLabel } from "../i18n";
import { addDays, fmt, toDate, weekMonthKey, weekStartOf } from "../dates";
import { fmtDurShort, fmtNum } from "../format";
import { goalForMonth, habitStart, scheduleAt } from "../stats";
import { iconifyNav, stopEditorGrab } from "../ui";
import { setIcon } from "obsidian";
import { UNIT_HOURS } from "../constants";

// 대시보드 맨 위 '오늘' 줄
// 그 날 해야 하는 습관인지: 요일을 정했다면 그 요일이거나 이미 기록이 있을 때만
export function dueOn(h: Habit, date: Date, weekStart: number, done: boolean) {
  if (done) return true;
  if (!h.days || !Object.keys(h.days).length) return true;
  const sc = scheduleAt(h.freqsRaw, h.days, weekMonthKey(weekStartOf(date, weekStart)));
  return !(sc && sc.days) || sc.days.includes(date.getDay());
}

export interface WeekCell { ds: string; state: "future" | "off" | "on" | "partial" | "none"; text?: string; due?: boolean; n?: number }

const DAYS = 14;
const WEEKS_BACK = 12;

export function doneOf(h: Habit, ds: string) {
  return h.kind === "check" ? h.set.has(ds) : (h.entries.get(ds) || 0) >= (goalForMonth(h.monthGoals, ds.slice(0, 7)) || 0.0001);
}
export function recOf(h: Habit, ds: string) {
  return h.kind === "check" ? h.set.has(ds) : (h.entries.get(ds) || 0) > 0;
}
// 그 날 이미 시작한 습관인지 (시작일 전이면 아직 아님)
export function startedBy(h: Habit, ds: string, todayStr: string) {
  if (ds >= todayStr) return true;
  const start = habitStart(h);
  return !!start && start <= ds;
}

// 주간 보기: 그 주에 보여 줄 습관인지. 시작한 주부터 보여요
export function weekHasHabit(h: Habit, ws: Date, todayStr: string) {
  const end = fmt(addDays(ws, 6));
  const start = habitStart(h);
  if (start ? start > end : end < todayStr) return false;
  if (h.period && h.period.start) {
    const periodEnd = fmt(addDays(toDate(h.period.start), h.period.days - 1));
    if (periodEnd < fmt(ws)) return false;
  }
  return true;
}

// 칸 안에 들어갈 짧은 양: 시간은 2h40m처럼 시와 분으로 (소수 시간으로 줄이지 않는다)
function cellAmount(h: Habit, v: number) {
  return h.kind === "measure" && h.unit === UNIT_HOURS ? fmtDurShort(v) : fmtNum(Math.round(v * 10) / 10);
}

// 주간 보기: 그 주의 목표 횟수. 요일을 정했으면 그 요일 수, 주 N회면 N, 정하지 않았으면 매일(7)
export function weekTargetOf(h: Habit, ws: Date) {
  const sc = scheduleAt(h.freqsRaw, h.days, weekMonthKey(ws));
  if (sc && sc.days) return sc.days.length;
  if (sc && sc.n && sc.n > 0 && sc.n < 7) return sc.n;
  return 7;
}

// 주간 보기: 한 습관의 7칸. state는 future(아직 안 온 날), off(시작 전), on, partial, none
export function weekCellsOf(h: Habit, days: Date[], todayStr: string, weekStart: number): WeekCell[] {
  return days.map((date: Date): WeekCell => {
    const ds = fmt(date);
    if (ds > todayStr) return { ds, state: "future" };
    if (!startedBy(h, ds, todayStr)) return { ds, state: "off" };
    const due = dueOn(h, date, weekStart, recOf(h, ds));
    let state: WeekCell["state"] = "none", text = "", n = 0;
    if (h.kind === "check") {
      if (h.set.has(ds)) state = "on";
      if (h.isItems && h.items) n = (h.items.get(ds) || []).length;
    } else {
      const v = h.entries.get(ds) || 0;
      if (v > 0) {
        state = doneOf(h, ds) ? "on" : "partial";
        text = cellAmount(h, v);
      }
    }
    return { ds, state, text, due, n };
  });
}

// 오늘 줄 접기·펼치기 버튼
function addFold(parent: HTMLElement, opts: TodayOpts) {
  const b = parent.createEl("button", { cls: "hg-yearbtn hg-todayfold" });
  setIcon(b, opts.collapsed ? "chevron-right" : "chevron-down");
  b.setAttr("aria-label", opts.collapsed ? tr("펼치기") : tr("접기"));
  b.addEventListener("click", () => { void opts.onCollapse?.(); });
  stopEditorGrab(b);
}

// 일간 | 주간 전환
function todayTabs(parent: HTMLElement, mode: "day" | "week", onMode: (m: "day" | "week") => unknown) {
  const tabs = parent.createDiv({ cls: "hg-tabs" });
  for (const [m, label] of [["day", tr("일간")], ["week", tr("주간")]] as ["day" | "week", string][]) {
    const t = tabs.createSpan({ cls: "hg-tab" + (m === mode ? " is-on" : ""), text: label });
    if (m !== mode) t.addEventListener("click", () => { void onMode(m); });
    stopEditorGrab(t);
  }
}

// 주간 보기: 한 줄이 한 습관, 열이 요일. 칸을 누르면 그 날을 기록해요
function renderWeekBar(box: HTMLElement, habits: Habit[], today: Date, opts: TodayOpts) {
  const weekStart = opts.weekStart == null ? 1 : opts.weekStart;
  const todayStr = fmt(today);
  const thisWeek = weekStartOf(today, weekStart);
  let offset = 0;
  const body = box.createDiv({ cls: "hg-weekbody" });
  const draw = () => {
    body.empty();
    const ws = addDays(thisWeek, -7 * offset);
    const we = addDays(ws, 6);
    const days = [0, 1, 2, 3, 4, 5, 6].map((i) => addDays(ws, i));
    const rows = habits.filter((h: Habit) => weekHasHabit(h, ws, todayStr)).map((h: Habit) => {
      const cells = weekCellsOf(h, days, todayStr, weekStart);
      const target = weekTargetOf(h, ws);
      const achieved = cells.filter((c) => c.state === "on").length;
      return { h, cells, target, achieved };
    });

    const head = body.createDiv({ cls: "hg-todayhead" });
    const nav = head.createSpan({ cls: "hg-todaynav" });
    const prev = nav.createEl("button", { cls: "hg-yearbtn" + (offset >= WEEKS_BACK ? " is-ghost" : ""), text: "‹" });
    prev.setAttr("aria-label", tr("지난주"));
    const range = tr("{0}월 {1}일 – {2}{3}일", ws.getMonth() + 1, ws.getDate(), we.getMonth() !== ws.getMonth() ? tr("{0}월 ", we.getMonth() + 1) : "", we.getDate());
    nav.createSpan({ cls: "hg-todaytitle", text: range });
    const next = nav.createEl("button", { cls: "hg-yearbtn" + (offset === 0 ? " is-ghost" : ""), text: "›" });
    next.setAttr("aria-label", tr("다음 주"));
    if (offset < WEEKS_BACK) prev.addEventListener("click", () => { offset++; draw(); iconifyNav(body); });
    if (offset > 0) next.addEventListener("click", () => { offset--; draw(); iconifyNav(body); });
    const back = nav.createSpan({ cls: "hg-yearbtn hg-thisyear" + (offset === 0 ? " is-disabled" : ""), text: tr("이번 주") });
    if (offset > 0) back.addEventListener("click", () => { offset = 0; draw(); iconifyNav(body); });
    stopEditorGrab(prev); stopEditorGrab(next); stopEditorGrab(back);
    const side = head.createSpan({ cls: "hg-todayright" });
    if (opts.onCollapse) addFold(side, opts);
    if (opts.onMode) todayTabs(side, "week", opts.onMode);
    let due = 0, done = 0;
    for (const r of rows) { due += r.target; done += Math.min(r.achieved, r.target); }
    side.createSpan({ cls: "hg-todaycount", text: `${done}/${due}` });

    if (!rows.length) { body.createSpan({ cls: "hg-todayempty", text: tr("이 주에 할 습관이 없어요") }); return; }
    const grid = body.createDiv({ cls: "hg-wkgrid" });
    grid.createDiv({ cls: "hg-wkcorner" });
    for (const d of days) {
      const c = grid.createDiv({ cls: "hg-wkday" + (fmt(d) === todayStr ? " is-today" : "") });
      c.createDiv({ cls: "hg-wkdow", text: DAY_NAMES[d.getDay()] });
      c.createDiv({ cls: "hg-wkdate", text: String(d.getDate()) });
    }
    grid.createDiv({ cls: "hg-wkcorner" });
    for (const { h, cells, target, achieved } of rows) {
      const complete = achieved >= target;
      const color = opts.colorOf(h);
      // 줄마다 색을 따로 쓰려고 칸마다 변수를 넣는다 (줄 래퍼 없이 격자에 바로 붙는다)
      const paint = <T extends HTMLElement>(el: T): T => { if (color) el.style.setProperty("--hg-on", color); return el; };
      // 긴 이름은 두 줄까지 보이고, 마우스를 올리면 전체 이름이 나온다
      const nameEl = paint(grid.createDiv({ cls: "hg-wkname", text: h.name }));
      nameEl.setAttr("aria-label", h.name);
      for (const c of cells) {
        const open = c.state !== "future" && c.state !== "off";
        const cell = paint(grid.createDiv({
          cls: `hg-wkcell is-${c.state}` + (open && !c.due ? " is-rest" : "") + (c.ds === todayStr ? " is-todaycell" : "") + (complete && c.state === "none" ? " is-dim" : ""),
        }));
        if (c.text) cell.setText(c.text); else if (c.state === "on") cell.setText(c.n ? `✓ ${c.n}` : "✓");
        cell.setAttr("aria-label", `${h.name} · ${c.ds}`);
        if (open) {
          cell.addEventListener("click", () => {
            if (h.kind !== "check") void opts.onValue(h, c.ds);
            else if (h.isItems && c.state === "on" && opts.onItems) void opts.onItems(h, c.ds);
            else void opts.onCheck(h, c.ds);
          });
          stopEditorGrab(cell);
        }
      }
      const goal = paint(grid.createDiv({ cls: "hg-wkgoal" + (complete ? " is-done" : ""), text: `${achieved}/${target}` }));
      if (complete) goal.setAttr("aria-label", tr("이번 주 목표 달성"));
    }
  };
  draw();
}

// 오늘 줄: 옆으로 넘기면 지난 날들도 보여요. opts.mode가 "week"이면 주간 보기
export function renderTodayBar(parent: HTMLElement, habits: Habit[], today: Date, opts: TodayOpts) {
  const weekStart = opts.weekStart == null ? 1 : opts.weekStart;
  const todayStr = fmt(today);
  const box = parent.createDiv({ cls: "hg-todaybar" + (opts.collapsed ? " is-collapsed" : "") });
  if (opts.mode === "week") { renderWeekBar(box, habits, today, opts); return; }
  const pager = box.createDiv({ cls: "hg-todaypager" });
  const pages: HTMLElement[] = [];
  for (let n = DAYS - 1; n >= 0; n--) {
    const date = addDays(today, -n);
    const ds = fmt(date);
    const isToday = n === 0;
    const list = habits.filter((h: Habit) => startedBy(h, ds, todayStr) && dueOn(h, date, weekStart, recOf(h, ds)));
    const page = pager.createDiv({ cls: "hg-todaypage" });
    pages.push(page);
    const head = page.createDiv({ cls: "hg-todayhead" });
    const nav = head.createSpan({ cls: "hg-todaynav" });
    const prev = nav.createEl("button", { cls: "hg-yearbtn", text: "‹" });
    prev.setAttr("aria-label", tr("이전 날"));
    const title = tr("{0}월 {1}일 ({2})", date.getMonth() + 1, date.getDate(), DAY_NAMES[date.getDay()]);
    nav.createSpan({ cls: "hg-todaytitle", text: title });
    const next = nav.createEl("button", { cls: "hg-yearbtn" + (isToday ? " is-ghost" : ""), text: "›" });
    next.setAttr("aria-label", tr("다음 날"));
    const goPage = (d: number) => { const t = pages[pages.indexOf(page) + d]; if (t) pager.scrollTo({ left: t.offsetLeft - pager.offsetLeft, behavior: "smooth" }); };
    if (n === DAYS - 1) prev.addClass("is-ghost"); else prev.addEventListener("click", () => goPage(-1));
    if (!isToday) next.addEventListener("click", () => goPage(1));
    const back = nav.createSpan({ cls: "hg-yearbtn hg-thisyear" + (isToday ? " is-disabled" : ""), text: tr("오늘") });
    if (!isToday) back.addEventListener("click", () => { const t = pages[pages.length - 1]; pager.scrollTo({ left: t.offsetLeft - pager.offsetLeft, behavior: "smooth" }); });
    stopEditorGrab(prev); stopEditorGrab(next); stopEditorGrab(back);
    const side = opts.onMode || opts.onCollapse ? head.createSpan({ cls: "hg-todayright" }) : head;
    if (opts.onCollapse) addFold(side, opts);
    if (opts.onMode) todayTabs(side, "day", opts.onMode);
    side.createSpan({ cls: "hg-todaycount", text: `${list.filter((h: Habit) => doneOf(h, ds)).length}/${list.length}` });

    const lst = page.createDiv({ cls: "hg-todaylist" });
    if (!list.length) lst.createSpan({ cls: "hg-todayempty", text: tr("이 날 할 습관이 없어요") });
    for (const h of list) {
      const item = lst.createDiv({ cls: "hg-titem" });
      const color = opts.colorOf(h);
      if (color) item.style.setProperty("--hg-on", color);
      if (h.kind === "check") {
        const on = h.set.has(ds);
        const b = item.createDiv({ cls: "hg-tbtn" + (on ? " is-on" : "") });
        b.createSpan({ cls: "hg-tcheck", text: on ? "✓" : "" });
        b.createSpan({ text: h.name });
        const n = h.isItems && h.items ? (h.items.get(ds) || []).length : 0;
        if (n) b.createSpan({ cls: "hg-tval", text: String(n) });
        b.addEventListener("click", () => { void (h.isItems && on && opts.onItems ? opts.onItems(h, ds) : opts.onCheck(h, ds)); });
        stopEditorGrab(b);
      } else {
        const v = h.entries.get(ds) || 0;
        const g = goalForMonth(h.monthGoals, ds.slice(0, 7));
        const on = v > 0 && (!g || v >= g);
        const b = item.createDiv({ cls: "hg-tbtn is-measure" + (on ? " is-on" : v > 0 ? " is-partial" : "") });
        b.createSpan({ text: h.name });
        b.createSpan({ cls: "hg-tval", text: h.unit === UNIT_HOURS ? `${fmtDurShort(v)}${g ? " / " + fmtDurShort(g) : ""}` : `${fmtNum(v)}${g ? "/" + fmtNum(g) : ""}${unitLabel(h.unit)}` });
        b.addEventListener("click", () => { void opts.onValue(h, ds); });
        stopEditorGrab(b);
      }
    }
  }
  window.setTimeout(() => { pager.scrollLeft = pager.scrollWidth; }, 0);
}
