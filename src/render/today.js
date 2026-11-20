import { DAY_NAMES, tr, unitLabel } from "../i18n";
import { addDays, fmt, toDate, weekMonthKey, weekStartOf } from "../dates";
import { fmtDurShort, fmtNum } from "../format";
import { goalForMonth, scheduleAt } from "../stats";
import { stopEditorGrab } from "../ui";
import { UNIT_HOURS } from "../constants";

// 대시보드 맨 위 '오늘' 줄
// 그 날 해야 하는 습관인지: 요일을 정했다면 그 요일이거나 이미 기록이 있을 때만
export function dueOn(h, date, weekStart, done) {
  if (done) return true;
  if (!h.days || !Object.keys(h.days).length) return true;
  const sc = scheduleAt(h.freqsRaw, h.days, weekMonthKey(weekStartOf(date, weekStart)));
  return !(sc && sc.days) || sc.days.includes(date.getDay());
}

const DAYS = 14;
const WEEKS_BACK = 12;

export function doneOf(h, ds) {
  return h.kind === "check" ? h.set.has(ds) : (h.entries.get(ds) || 0) >= (goalForMonth(h.monthGoals, ds.slice(0, 7)) || 0.0001);
}
export function recOf(h, ds) {
  return h.kind === "check" ? h.set.has(ds) : (h.entries.get(ds) || 0) > 0;
}
// 그 날 이미 시작한 습관인지 (첫 기록이나 기간 시작 전이면 아직 아님)
export function startedBy(h, ds, todayStr) {
  if (ds >= todayStr) return true;
  if (h.period && h.period.start && h.period.start > ds) return false;
  const all = h.kind === "check" ? [...h.set] : [...h.entries].filter(([, v]) => v > 0).map(([d]) => d);
  return all.some((d) => d <= ds);
}

// 주간 보기: 그 주에 보여 줄 습관인지
export function weekHasHabit(h, ws, todayStr) {
  const end = fmt(addDays(ws, 6));
  if (!startedBy(h, end > todayStr ? todayStr : end, todayStr)) return false;
  if (h.period && h.period.start) {
    const periodEnd = fmt(addDays(toDate(h.period.start), h.period.days - 1));
    if (periodEnd < fmt(ws)) return false;
  }
  return true;
}

// 주간 보기: 한 습관의 7칸. state는 future(아직 안 온 날), off(시작 전), on, partial, none
export function weekCellsOf(h, days, todayStr, weekStart) {
  return days.map((date) => {
    const ds = fmt(date);
    if (ds > todayStr) return { ds, state: "future" };
    if (!startedBy(h, ds, todayStr)) return { ds, state: "off" };
    const due = dueOn(h, date, weekStart, recOf(h, ds));
    let state = "none", text = "";
    if (h.kind === "check") {
      if (h.set.has(ds)) state = "on";
    } else {
      const v = h.entries.get(ds) || 0;
      if (v > 0) {
        state = doneOf(h, ds) ? "on" : "partial";
        text = h.unit === UNIT_HOURS ? fmtDurShort(v) : fmtNum(Math.round(v * 10) / 10);
      }
    }
    return { ds, state, text, due };
  });
}

// 일간 | 주간 전환
function todayTabs(parent, mode, onMode) {
  const tabs = parent.createDiv({ cls: "hg-tabs" });
  for (const [m, label] of [["day", tr("일간")], ["week", tr("주간")]]) {
    const t = tabs.createSpan({ cls: "hg-tab" + (m === mode ? " is-on" : ""), text: label });
    if (m !== mode) t.addEventListener("click", () => onMode(m));
    stopEditorGrab(t);
  }
}

// 주간 보기: 한 줄이 한 습관, 열이 요일. 칸을 누르면 그 날을 기록해요
function renderWeekBar(box, habits, today, opts) {
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
    const rows = habits.filter((h) => weekHasHabit(h, ws, todayStr)).map((h) => ({ h, cells: weekCellsOf(h, days, todayStr, weekStart) }));

    const head = body.createDiv({ cls: "hg-todayhead" });
    const nav = head.createSpan({ cls: "hg-todaynav" });
    const prev = nav.createEl("button", { cls: "hg-yearbtn" + (offset >= WEEKS_BACK ? " is-ghost" : ""), text: "‹" });
    prev.setAttr("aria-label", tr("지난주"));
    const range = tr("{0}월 {1}일 – {2}{3}일", ws.getMonth() + 1, ws.getDate(), we.getMonth() !== ws.getMonth() ? tr("{0}월 ", we.getMonth() + 1) : "", we.getDate());
    nav.createSpan({ cls: "hg-todaytitle", text: offset === 0 ? `${tr("이번 주")} · ${range}` : range });
    const next = nav.createEl("button", { cls: "hg-yearbtn" + (offset === 0 ? " is-ghost" : ""), text: "›" });
    next.setAttr("aria-label", tr("다음 주"));
    if (offset < WEEKS_BACK) prev.addEventListener("click", () => { offset++; draw(); });
    if (offset > 0) next.addEventListener("click", () => { offset--; draw(); });
    stopEditorGrab(prev); stopEditorGrab(next);
    const side = head.createSpan({ cls: "hg-todayright" });
    if (opts.onMode) todayTabs(side, "week", opts.onMode);
    let due = 0, done = 0;
    for (const { cells } of rows) for (const c of cells) if (c.due && c.state !== "future" && c.state !== "off") { due++; if (c.state === "on") done++; }
    side.createSpan({ cls: "hg-todaycount", text: `${done}/${due}` });

    if (!rows.length) { body.createSpan({ cls: "hg-todayempty", text: tr("이 주에 할 습관이 없어요") }); return; }
    const grid = body.createDiv({ cls: "hg-wkgrid" });
    grid.createDiv({ cls: "hg-wkcorner" });
    for (const d of days) {
      const c = grid.createDiv({ cls: "hg-wkday" + (fmt(d) === todayStr ? " is-today" : "") });
      c.createDiv({ cls: "hg-wkdow", text: DAY_NAMES[d.getDay()] });
      c.createDiv({ cls: "hg-wkdate", text: String(d.getDate()) });
    }
    for (const { h, cells } of rows) {
      const row = grid.createDiv({ cls: "hg-wkrow" });
      const color = opts.colorOf(h);
      if (color) row.style.setProperty("--hg-on", color);
      row.createDiv({ cls: "hg-wkname", text: h.name });
      for (const c of cells) {
        const cell = row.createDiv({ cls: `hg-wkcell is-${c.state}` + (c.state !== "future" && c.state !== "off" && !c.due ? " is-rest" : "") });
        if (c.text) cell.setText(c.text); else if (c.state === "on") cell.setText("✓");
        cell.setAttr("aria-label", `${h.name} · ${c.ds}`);
        if (c.state !== "future" && c.state !== "off") {
          cell.addEventListener("click", () => (h.kind === "check" ? opts.onCheck(h, c.ds) : opts.onValue(h, c.ds)));
          stopEditorGrab(cell);
        }
      }
    }
  };
  draw();
}

// 오늘 줄: 옆으로 넘기면 지난 날들도 보여요. opts.mode가 "week"이면 주간 보기
export function renderTodayBar(parent, habits, today, opts) {
  const weekStart = opts.weekStart == null ? 1 : opts.weekStart;
  const todayStr = fmt(today);
  const box = parent.createDiv({ cls: "hg-todaybar" });
  if (opts.mode === "week") { renderWeekBar(box, habits, today, opts); return; }
  const pager = box.createDiv({ cls: "hg-todaypager" });
  const pages = [];
  for (let n = DAYS - 1; n >= 0; n--) {
    const date = addDays(today, -n);
    const ds = fmt(date);
    const isToday = n === 0;
    const list = habits.filter((h) => startedBy(h, ds, todayStr) && dueOn(h, date, weekStart, recOf(h, ds)));
    const page = pager.createDiv({ cls: "hg-todaypage" });
    pages.push(page);
    const head = page.createDiv({ cls: "hg-todayhead" });
    const nav = head.createSpan({ cls: "hg-todaynav" });
    const prev = nav.createEl("button", { cls: "hg-yearbtn", text: "‹" });
    prev.setAttr("aria-label", tr("이전 날"));
    const title = isToday
      ? tr("오늘 · {0}월 {1}일 ({2})", date.getMonth() + 1, date.getDate(), DAY_NAMES[date.getDay()])
      : tr("{0}월 {1}일 ({2})", date.getMonth() + 1, date.getDate(), DAY_NAMES[date.getDay()]);
    nav.createSpan({ cls: "hg-todaytitle", text: title });
    const next = nav.createEl("button", { cls: "hg-yearbtn" + (isToday ? " is-ghost" : ""), text: "›" });
    next.setAttr("aria-label", tr("다음 날"));
    const goPage = (d) => { const t = pages[pages.indexOf(page) + d]; if (t) pager.scrollTo({ left: t.offsetLeft - pager.offsetLeft, behavior: "smooth" }); };
    if (n === DAYS - 1) prev.addClass("is-ghost"); else prev.addEventListener("click", () => goPage(-1));
    if (!isToday) next.addEventListener("click", () => goPage(1));
    stopEditorGrab(prev); stopEditorGrab(next);
    const side = opts.onMode ? head.createSpan({ cls: "hg-todayright" }) : head;
    if (opts.onMode) todayTabs(side, "day", opts.onMode);
    side.createSpan({ cls: "hg-todaycount", text: `${list.filter((h) => doneOf(h, ds)).length}/${list.length}` });

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
        b.addEventListener("click", () => opts.onCheck(h, ds));
        stopEditorGrab(b);
      } else {
        const v = h.entries.get(ds) || 0;
        const g = goalForMonth(h.monthGoals, ds.slice(0, 7));
        const on = v > 0 && (!g || v >= g);
        const b = item.createDiv({ cls: "hg-tbtn is-measure" + (on ? " is-on" : v > 0 ? " is-partial" : "") });
        b.createSpan({ text: h.name });
        b.createSpan({ cls: "hg-tval", text: h.unit === UNIT_HOURS ? `${fmtDurShort(v)}${g ? " / " + fmtDurShort(g) : ""}` : `${fmtNum(v)}${g ? "/" + fmtNum(g) : ""}${unitLabel(h.unit)}` });
        b.addEventListener("click", () => opts.onValue(h, ds));
        stopEditorGrab(b);
      }
    }
  }
  window.setTimeout(() => { pager.scrollLeft = pager.scrollWidth; }, 0);
}
