import { DAY_NAMES, tr, unitLabel } from "../i18n";
import { addDays, fmt, weekMonthKey, weekStartOf } from "../dates";
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

// 오늘 줄: 옆으로 넘기면 지난 날들도 보여요
export function renderTodayBar(parent, habits, today, opts) {
  const weekStart = opts.weekStart == null ? 1 : opts.weekStart;
  const todayStr = fmt(today);
  const DAYS = 14;
  const box = parent.createDiv({ cls: "hg-todaybar" });
  const pager = box.createDiv({ cls: "hg-todaypager" });
  const pages = [];
  const doneOf = (h, ds) => h.kind === "check" ? h.set.has(ds) : (h.entries.get(ds) || 0) >= (goalForMonth(h.monthGoals, ds.slice(0, 7)) || 0.0001);
  const recOf = (h, ds) => h.kind === "check" ? h.set.has(ds) : (h.entries.get(ds) || 0) > 0;
  const startedBy = (h, ds) => {
    if (ds >= todayStr) return true;
    if (h.period && h.period.start && h.period.start > ds) return false;
    const all = h.kind === "check" ? [...h.set] : [...h.entries].filter(([, v]) => v > 0).map(([d]) => d);
    return all.some((d) => d <= ds);
  };
  for (let n = DAYS - 1; n >= 0; n--) {
    const date = addDays(today, -n);
    const ds = fmt(date);
    const isToday = n === 0;
    const list = habits.filter((h) => startedBy(h, ds) && dueOn(h, date, weekStart, recOf(h, ds)));
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
    head.createSpan({ cls: "hg-todaycount", text: `${list.filter((h) => doneOf(h, ds)).length}/${list.length}` });

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
  setTimeout(() => { pager.scrollLeft = pager.scrollWidth; }, 0);
}
