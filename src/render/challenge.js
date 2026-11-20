import { DAY_NAMES, tr } from "../i18n";
import { addDays, fmt, toDate, weekStartOf } from "../dates";
import { computeStats } from "../stats";
import { addMoreButton, enableHorizontalScroll, makeColorDot, stopEditorGrab } from "../ui";
import { renderWeekTop } from "./weekTop";

// 기간이 정해진 습관(예: 66일): 실제 날짜가 보이는 카드
export function renderChallenge(parent, name, set, opts) {
  const today = opts.today || new Date();
  const weekStart = opts.weekStart ?? 1;
  const todayStr = fmt(today);
  const { days, start: startStr } = opts.period;
  const startD = toDate(startStr);
  const endD = addDays(startD, days - 1);
  const endStr = fmt(endD);
  const dayNo = Math.max(0, Math.min(days, Math.round((toDate(todayStr) - startD) / 86400000) + 1));
  const finished = todayStr > endStr;
  const notStarted = todayStr < startStr;
  const left = Math.round((endD - toDate(todayStr)) / 86400000);
  let done = 0;
  for (let i = 0; i < days; i++) { const ds = fmt(addDays(startD, i)); if (ds <= todayStr && set.has(ds)) done++; }
  const elapsed = Math.max(1, dayNo);
  const st = computeStats(set, today);
  const md = (d) => `${d.getMonth() + 1}/${d.getDate()} ${DAY_NAMES[d.getDay()]}`;

  const card = parent.createDiv({ cls: "hg-card hg-challenge" });
  if (opts.color) card.style.setProperty("--hg-on", opts.color);

  const head = card.createDiv({ cls: "hg-head" });
  const title = head.createDiv({ cls: "hg-title" });
  const dot = title.createSpan({ cls: "hg-dot" + (st.doneToday ? " is-done" : "") });
  makeColorDot(dot, opts);
  title.createSpan({ cls: "hg-name", text: name });
  const chalChip = head.createSpan({
    cls: "hg-goal" + (finished ? " is-done" : "") + (opts.onPeriod ? " is-clickable" : ""),
    text: finished ? tr("{0}일 완료", days) : notStarted ? tr("{0}일 · 시작 전", days) : tr("{0}일 챌린지 · D-{1}", days, left),
  });
  if (opts.onPeriod) {
    chalChip.setAttr("aria-label", tr("기간 바꾸기"));
    chalChip.addEventListener("click", (evt) => opts.onPeriod(evt));
    stopEditorGrab(chalChip);
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
  stat(finished ? days : dayNo, `/${days}`, tr("진행"), !finished);
  stat(done, tr("일"), tr("한 날"), done > 0);
  stat(st.current, tr("일"), tr("연속"), st.current > 0);
  stat(Math.round((done / elapsed) * 100), "%", tr("달성률"));

  // 기간 막대 + 실제 날짜
  const prog = card.createDiv({ cls: "hg-chal-prog" });
  const track = prog.createDiv({ cls: "hg-chal-track" });
  track.createDiv({ cls: "hg-chal-fill" }).style.width = `${Math.round(((finished ? days : dayNo) / days) * 100)}%`;
  const dates = prog.createDiv({ cls: "hg-chal-dates" });
  dates.createSpan({ text: tr("시작 {0}", md(startD)) });
  dates.createSpan({ cls: "hg-chal-today", text: finished ? "" : notStarted ? "" : tr("오늘 {0} · {1}일째", md(today), dayNo) });
  dates.createSpan({ text: tr("끝 {0}", md(endD)) });

  if (finished) {
    const ban = card.createDiv({ cls: "hg-chal-banner" });
    ban.createDiv({ cls: "hg-chal-banner-t", text: tr("{0}일 끝! {1}일 했어요 ({2}%)", days, done, Math.round((done / days) * 100)) });
    const row = ban.createDiv({ cls: "hg-chal-banner-btns" });
    const b = (label, fn) => { const x = row.createEl("button", { text: label }); x.addEventListener("click", fn); stopEditorGrab(x); };
    if (opts.onExtend) {
      b(tr("+30일 더 하기"), () => opts.onExtend(30));
      b(tr("기간 없이 계속"), () => opts.onExtend(0));
    }
    if (opts.onArchive) b(tr("보관함으로"), () => opts.onArchive());
  }

  renderWeekTop(card, {
    ...opts, kind: "check", today, weekStart, freqOf: () => 0, minDate: startStr,
    value: (ds) => (set.has(ds) ? 1 : 0),
    hit: (ds) => set.has(ds),
    onTap: opts.onToggle ? (ds) => opts.onToggle(ds, !set.has(ds)) : null,
  });

  // 기간 전체 격자: 기존 카드와 같은 주 단위 열. 아직 안 온 날도 회색 칸으로 보임
  const scroll = card.createDiv({ cls: "hg-scroll is-year hg-chal-scroll" });
  const grid = scroll.createDiv({ cls: "hg-grid" });
  const labels = grid.createDiv({ cls: "hg-col hg-labels" });
  labels.createDiv({ cls: "hg-month" });
  for (let i = 0; i < 7; i++) labels.createDiv({ cls: "hg-daylabel", text: i % 2 === 0 ? DAY_NAMES[(weekStart + i) % 7] : "" });
  const first = weekStartOf(startD, weekStart);
  const nWeeks = Math.round((weekStartOf(endD, weekStart) - first) / (7 * 86400000)) + 1;
  let prevMonth = -1;
  for (let w = 0; w < nWeeks; w++) {
    const top = addDays(first, w * 7);
    const col = grid.createDiv({ cls: "hg-col" });
    const month = col.createDiv({ cls: "hg-month" });
    const mEnd = addDays(top, 6);
    if (mEnd.getMonth() !== prevMonth) { month.setText(tr("{0}월", mEnd.getMonth() + 1)); prevMonth = mEnd.getMonth(); }
    for (let i = 0; i < 7; i++) {
      const date = addDays(top, i);
      const ds = fmt(date);
      const cell = col.createDiv({ cls: "hg-cell" });
      if (ds < startStr || ds > endStr) { cell.addClass("is-outside"); continue; }
      if (ds === todayStr) cell.addClass("is-today");
      const on = set.has(ds);
      if (ds > todayStr) cell.addClass("is-planned");
      else if (on) cell.addClass("is-on");
      const n = Math.round((date - startD) / 86400000) + 1;
      cell.setAttr("aria-label", tr("{0}일째 · {1}월 {2}일 ({3}) · {4}", n, date.getMonth() + 1, date.getDate(), DAY_NAMES[date.getDay()], ds > todayStr ? tr("예정") : on ? tr("완료") : tr("기록 없음")));
      if (opts.onToggle && ds <= todayStr) {
        cell.addClass("is-clickable");
        cell.addEventListener("click", () => opts.onToggle(ds, !on));
      }
    }
  }
  enableHorizontalScroll(scroll);
  stopEditorGrab(scroll);
  window.requestAnimationFrame(() => {
    scroll.classList.toggle("is-overflow", scroll.scrollWidth > scroll.clientWidth + 1);
    const t = scroll.querySelector(".is-today");
    scroll.scrollLeft = t ? t.parentElement.offsetLeft - scroll.clientWidth + 40 : 0;
  });
  return card;
}
