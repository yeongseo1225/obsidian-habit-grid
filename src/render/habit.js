import { DAY_NAMES, tr } from "../i18n";
import { addDays, fmt, toDate, weekStartOf } from "../dates";
import { computeStats, computeWeeklyStats, freqOfWeek, weekCounts } from "../stats";
import { addMoreButton, enableHorizontalScroll, makeColorDot, stopEditorGrab } from "../ui";
import { renderChallenge } from "./challenge";
import { renderMeasured } from "./measured";
import { renderWeekTop } from "./weekTop";
import { modeTabs, renderPeriodView } from "./periodView";

export function renderHabit(parent, name, set, opts) {
  if (opts.period && !opts.measure) return renderChallenge(parent, name, set, opts);
  if (opts.measure) return renderMeasured(parent, name, opts.entries || new Map(), opts);
  const today = opts.today || new Date();
  const weekStart = opts.weekStart ?? 1;
  const WEEK_MS = 7 * 86400000;
  const firstRecord = set.size ? [...set].sort()[0] : null;
  const year = opts.range === "year" ? (opts.year || today.getFullYear()) : null;
  let weeks, start;
  if (year) {
    start = weekStartOf(new Date(year, 0, 1), weekStart);
    weeks = Math.round((weekStartOf(new Date(year, 11, 31), weekStart) - start) / WEEK_MS) + 1;
  } else {
    weeks = Math.max(4, opts.weeks || 20);
    if (opts.range === "all" && firstRecord) {
      const span = Math.round((weekStartOf(today, weekStart) - weekStartOf(toDate(firstRecord), weekStart)) / WEEK_MS) + 1;
      weeks = Math.max(weeks, span);
    }
    start = addDays(weekStartOf(today, weekStart), -(weeks - 1) * 7);
  }
  const freqOf = (ws) => freqOfWeek(opts.freqs, ws);
  const goal = freqOf(weekStartOf(today, weekStart));
  const st = goal ? computeWeeklyStats(set, today, freqOf, weekStart) : computeStats(set, today);
  const counts = weekCounts(set, weekStart);

  const card = parent.createDiv({ cls: "hg-card" });
  if (opts.color) card.style.setProperty("--hg-on", opts.color);

  // 헤더
  const head = card.createDiv({ cls: "hg-head" });
  const title = head.createDiv({ cls: "hg-title" });
  const dot = title.createSpan({ cls: "hg-dot" + (st.doneToday ? " is-done" : "") });
  makeColorDot(dot, opts);
  title.createSpan({ cls: "hg-name", text: name });
  const chip = head.createSpan({
    cls: "hg-goal" + (goal && st.weekDone ? " is-done" : "") + (opts.onGoals ? " is-clickable" : ""),
    text: goal ? tr("{0}월 · 주 {1}회", today.getMonth() + 1, goal) + (st.weekDone ? " ✓" : "") : tr("매일"),
  });
  if (opts.onGoals) {
    chip.setAttr("aria-label", tr("달별 목표 정하기"));
    chip.addEventListener("click", () => opts.onGoals(today.getFullYear()));
    stopEditorGrab(chip);
  }
  addMoreButton(head, opts);

  const stats = card.createDiv({ cls: "hg-stats" });
  const stat = (value, unit, label, accent) => {
    const box = stats.createDiv({ cls: "hg-stat" + (accent ? " is-accent" : "") });
    const v = box.createDiv({ cls: "hg-stat-value" });
    v.createSpan({ text: String(value) });
    v.createSpan({ cls: "hg-stat-unit", text: unit });
    box.createDiv({ cls: "hg-stat-label", text: label });
  };
  if (goal) {
    stat(st.current, tr("주"), tr("연속 달성"), st.current > 0);
    stat(st.longest, tr("주"), tr("최장 달성"));
    stat(st.thisCount, `/${goal}`, tr("이번 주"), st.weekDone);
    stat(st.total, tr("회"), tr("전체"));
  } else {
    stat(st.current, tr("일"), tr("연속"), st.current > 0);
    stat(st.longest, tr("일"), tr("최장 연속"));
    stat(st.monthDone, `/${st.monthDays}`, tr("이번 달"));
    stat(st.total, tr("회"), tr("전체"));
  }

  renderWeekTop(card, {
    ...opts, kind: "check", today, weekStart, freqOf,
    value: (ds) => (set.has(ds) ? 1 : 0),
    hit: (ds) => set.has(ds),
    onTap: opts.onToggle ? (ds) => opts.onToggle(ds, !set.has(ds)) : null,
  });

  if (year && opts.mode === "month") {
    renderPeriodView(card, {
      ...opts, kind: "check", today, weekStart, freqOf,
      value: (ds) => (set.has(ds) ? 1 : 0),
      hit: (ds) => set.has(ds),
      onCell: opts.onSelect ? (ds) => opts.onSelect(ds) : opts.onToggle ? (ds) => opts.onToggle(ds, !set.has(ds)) : null,
    });
    return card;
  }

  // 연도 넘기기
  if (year) {
    const bar = card.createDiv({ cls: "hg-yearbar" });
    const nav = bar.createDiv({ cls: "hg-yearnav" });
    const btn = (label, aria, target, enabled) => {
      const b = nav.createEl ? nav.createEl("button", { cls: "hg-yearbtn", text: label }) : nav.createDiv({ cls: "hg-yearbtn", text: label });
      b.setAttr("aria-label", aria);
      stopEditorGrab(b);
      if (!enabled) b.addClass("is-disabled");
      else if (opts.onYear) b.addEventListener("click", () => opts.onYear(target));
    };
    if (!opts.yearFixed) btn("‹", tr("이전 해"), year - 1, true);
    nav.createSpan({ cls: "hg-year", text: `${year}` });
    if (!opts.yearFixed) {
      const isNow = year >= today.getFullYear();
      btn("›", tr("다음 해"), year + 1, !isNow);
      const back = nav.createSpan({ cls: "hg-yearbtn hg-thisyear" + (isNow ? " is-ghost" : ""), text: tr("올해") });
      if (!isNow) back.addEventListener("click", () => opts.onYear && opts.onYear(today.getFullYear()));
      stopEditorGrab(back);
    }
    const prefix = `${year}-`;
    let yearCount = 0;
    for (const d of set) if (d.startsWith(prefix)) yearCount++;
    const right = bar.createDiv({ cls: "hg-barright" });
    right.createSpan({ cls: "hg-yearsum", text: tr("{0}년 {1}회", year, yearCount) });
    if (opts.onMode) modeTabs(right, "year", opts.onMode);
  }

  // 격자
  const scroll = card.createDiv({ cls: "hg-scroll" + (year ? " is-year" : "") });
  const grid = scroll.createDiv({ cls: "hg-grid" });

  const labels = grid.createDiv({ cls: "hg-col hg-labels" });
  labels.createDiv({ cls: "hg-month" });
  for (let i = 0; i < 7; i++) {
    const dow = (weekStart + i) % 7;
    labels.createDiv({ cls: "hg-daylabel", text: i % 2 === 0 ? DAY_NAMES[dow] : "" });
  }

  const todayStr = fmt(today);
  let prevMonth = -1;
  for (let w = 0; w < weeks; w++) {
    const top = addDays(start, w * 7);
    const wf = freqOf(top);
    const weekHit = wf > 0 && (counts.get(fmt(top)) || 0) >= wf;
    const col = grid.createDiv({ cls: "hg-col" + (weekHit ? " is-week-done" : "") });
    const month = col.createDiv({ cls: "hg-month" });
    const end = addDays(top, 6);
    if (end.getMonth() !== prevMonth) {
      if (!(year && end.getFullYear() !== year)) {
        month.setText(!year && end.getMonth() === 0 ? `${end.getFullYear()}` : tr("{0}월", end.getMonth() + 1));
      }
      prevMonth = end.getMonth();
    }
    for (let i = 0; i < 7; i++) {
      const date = addDays(top, i);
      const ds = fmt(date);
      const cell = col.createDiv({ cls: "hg-cell" });
      const on = set.has(ds);
      if (year && date.getFullYear() !== year) { cell.addClass("is-outside"); continue; }
      if (ds > todayStr) { cell.addClass(weekHit ? "is-rest" : year ? "is-planned" : "is-future"); continue; }
      if (on) cell.addClass("is-on");
      else if (weekHit) cell.addClass("is-rest");
      if (ds === todayStr) cell.addClass("is-today");
      cell.setAttr("aria-label", tr("{0}월 {1}일 ({2}) · {3}{4}", date.getMonth() + 1, date.getDate(), DAY_NAMES[date.getDay()], on ? tr("완료") : weekHit ? tr("이번 주 목표 달성") : tr("기록 없음"), opts.itemsOf && opts.itemsOf(ds).length ? " · " + opts.itemsOf(ds).join(", ") : ""));
      if (opts.onToggle) {
        cell.addClass("is-clickable");
        cell.addEventListener("click", () => opts.onToggle(ds, !on));
      }
    }
  }

  enableHorizontalScroll(scroll);
  stopEditorGrab(scroll);

  window.requestAnimationFrame(() => {
    scroll.toggleClass ? scroll.toggleClass("is-overflow", scroll.scrollWidth > scroll.clientWidth + 1)
      : scroll.classList.toggle("is-overflow", scroll.scrollWidth > scroll.clientWidth + 1);
    if (!year || year === today.getFullYear()) {
      const t = scroll.querySelector(".is-today");
      scroll.scrollLeft = t ? t.parentElement.offsetLeft - scroll.clientWidth + 40 : scroll.scrollWidth;
    } else scroll.scrollLeft = 0;
  });
  return card;
}
