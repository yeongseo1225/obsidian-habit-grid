import { DAY_NAMES, tr, unitLabel } from "../i18n";
import { addDays, fmt, monthKey, pad, toDate, weekMonthKey, weekStartOf } from "../dates";
import { daysLabel, fmtDur, fmtNum, fmtQty } from "../format";
import { freqOfWeek, goalForMonth, isSchedDay, scheduleAt } from "../stats";
import { addMoreButton, enableHorizontalScroll, makeColorDot, stopEditorGrab } from "../ui";
import { renderWeekTop } from "./weekTop";
import { modeTabs, renderPeriodView } from "./periodView";
import { UNIT_HOURS } from "../constants";

// ── 시간 기록 습관 (달마다 목표 시간이 다른 습관) ──
export function renderMeasured(parent, name, entries, opts) {
  const today = opts.today || new Date();
  const weekStart = opts.weekStart ?? 1;
  const unit = opts.unit || UNIT_HOURS;
  const goals = opts.monthGoals || {};
  const year = opts.year || today.getFullYear();
  const todayStr = fmt(today);
  const curKey = monthKey(today);
  const curGoal = goalForMonth(goals, curKey);
  const hit = (ds, v) => v > 0 && v >= goalForMonth(goals, ds.slice(0, 7));
  const freqOf = (ws) => freqOfWeek(opts.freqs, ws);
  const freq = freqOf(weekStartOf(today, weekStart));
  // 주 N회 목표: 주마다 목표량을 채운 날 수
  const weekHits = new Map();
  for (const [ds, v] of entries) {
    if (!hit(ds, v)) continue;
    const k = fmt(weekStartOf(toDate(ds), weekStart));
    weekHits.set(k, (weekHits.get(k) || 0) + 1);
  }
  const thisWeekKey = fmt(weekStartOf(today, weekStart));
  const thisWeekCount = weekHits.get(thisWeekKey) || 0;

  // 이번 달 통계
  let mDone = 0, mSum = 0;
  for (const [ds, v] of entries) {
    if (!ds.startsWith(curKey) || ds > todayStr) continue;
    if (v > 0) { mSum += v; }
    if (hit(ds, v)) mDone++;
  }

  const card = parent.createDiv({ cls: "hg-card is-measure" });
  if (opts.color) card.style.setProperty("--hg-on", opts.color);

  const head = card.createDiv({ cls: "hg-head" });
  const title = head.createDiv({ cls: "hg-title" });
  const tv = entries.get(todayStr) || 0;
  const dot = title.createSpan({ cls: "hg-dot" + (hit(todayStr, tv) ? " is-done" : "") });
  makeColorDot(dot, opts);
  title.createSpan({ cls: "hg-name", text: name });
  const chipText = curGoal
    ? tr("{0}월 · 하루 {1}", today.getMonth() + 1, fmtQty(curGoal, unit)) + (freq ? tr(" · 주 {0}회", freq) : "") + (freq && thisWeekCount >= freq ? " ✓" : "")
    : tr("목표 정하기");
  const chip = head.createSpan({ cls: "hg-goal is-clickable" + (freq && thisWeekCount >= freq ? " is-done" : ""), text: chipText });
  chip.setAttr("aria-label", tr("달별 목표 정하기"));
  if (opts.onGoals) chip.addEventListener("click", () => opts.onGoals(today.getFullYear()));
  stopEditorGrab(chip);
  addMoreButton(head, opts);

  const stats = card.createDiv({ cls: "hg-stats" });
  const stat = (value, u, label, accent) => {
    const box = stats.createDiv({ cls: "hg-stat" + (accent ? " is-accent" : "") });
    const v = box.createDiv({ cls: "hg-stat-value" });
    v.createSpan({ text: String(value) });
    v.createSpan({ cls: "hg-stat-unit", text: u });
    box.createDiv({ cls: "hg-stat-label", text: label });
  };
  const sv = (v) => unit === UNIT_HOURS ? [fmtDur(v), ""] : [fmtNum(Math.round(v * 10) / 10), unitLabel(unit)];
  stat(...sv(tv), tr("오늘"), hit(todayStr, tv));
  const monthLen = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  if (freq) stat(thisWeekCount, tr("/{0}회", freq), tr("이번 주 달성"), thisWeekCount >= freq);
  else stat(mDone, tr("/{0}일", monthLen), tr("이번 달 달성"), mDone > 0);
  stat(...sv(mSum), tr("이번 달 합계"));
  stats.addClass("hg-stats-3");

  renderWeekTop(card, {
    ...opts, kind: "measure", today, weekStart, freqOf, unit,
    value: (ds) => entries.get(ds) || 0,
    goalOf: (ds) => goalForMonth(goals, ds.slice(0, 7)),
    hit: (ds) => hit(ds, entries.get(ds) || 0),
    onTap: opts.onValue ? (ds) => opts.onValue(ds, entries.get(ds) || 0) : null,
  });

  if (opts.mode === "month") {
    renderPeriodView(card, {
      ...opts, kind: "measure", today, weekStart, freqOf, unit,
      value: (ds) => entries.get(ds) || 0,
      goalOf: (ds) => goalForMonth(goals, ds.slice(0, 7)),
      hit: (ds) => hit(ds, entries.get(ds) || 0),
      onCell: opts.onValue ? (ds) => opts.onValue(ds, entries.get(ds) || 0) : null,
    });
    return card;
  }

  // 연도 넘기기
  const bar = card.createDiv({ cls: "hg-yearbar" });
  const nav = bar.createDiv({ cls: "hg-yearnav" });
  const btn = (label, aria, target, enabled = true) => {
    const b = nav.createEl ? nav.createEl("button", { cls: "hg-yearbtn", text: label }) : nav.createDiv({ cls: "hg-yearbtn", text: label });
    b.setAttr("aria-label", aria);
    stopEditorGrab(b);
    if (!enabled) b.addClass("is-disabled");
    else if (opts.onYear) b.addEventListener("click", () => opts.onYear(target));
  };
  btn("‹", tr("이전 해"), year - 1);
  nav.createSpan({ cls: "hg-year", text: `${year}` });
  {
    const isNow = year >= today.getFullYear();
    btn("›", tr("다음 해"), year + 1, !isNow);
    const back = nav.createSpan({ cls: "hg-yearbtn hg-thisyear" + (isNow ? " is-ghost" : ""), text: tr("올해") });
    if (!isNow) back.addEventListener("click", () => opts.onYear && opts.onYear(today.getFullYear()));
    stopEditorGrab(back);
  }
  let ySum = 0;
  for (const [ds, v] of entries) if (ds.startsWith(`${year}-`)) ySum += v;
  const right = bar.createDiv({ cls: "hg-barright" });
  right.createSpan({ cls: "hg-yearsum", text: tr("{0}년 {1}", year, fmtQty(ySum, unit)) });
  if (opts.onMode) modeTabs(right, "year", opts.onMode);

  // 격자
  const scroll = card.createDiv({ cls: "hg-scroll is-year" });
  const grid = scroll.createDiv({ cls: "hg-grid" });
  const labels = grid.createDiv({ cls: "hg-col hg-labels" });
  labels.createDiv({ cls: "hg-month" });
  for (let i = 0; i < 7; i++) labels.createDiv({ cls: "hg-daylabel", text: i % 2 === 0 ? DAY_NAMES[(weekStart + i) % 7] : "" });

  const start = weekStartOf(new Date(year, 0, 1), weekStart);
  const weeks = Math.round((weekStartOf(new Date(year, 11, 31), weekStart) - start) / (7 * 86400000)) + 1;
  let prevMonth = -1;
  for (let w = 0; w < weeks; w++) {
    const top = addDays(start, w * 7);
    const col = grid.createDiv({ cls: "hg-col" });
    const month = col.createDiv({ cls: "hg-month" });
    const end = addDays(top, 6);
    if (end.getMonth() !== prevMonth) {
      if (end.getFullYear() === year) month.setText(tr("{0}월", end.getMonth() + 1));
      prevMonth = end.getMonth();
    }
    for (let i = 0; i < 7; i++) {
      const date = addDays(top, i);
      const ds = fmt(date);
      const cell = col.createDiv({ cls: "hg-cell" });
      if (isSchedDay(opts.freqsRaw, opts.days, date, today, weekStart)) cell.addClass("is-sched");
      if (date.getFullYear() !== year) { cell.addClass("is-outside"); continue; }
      const v = entries.get(ds) || 0;
      const g = goalForMonth(goals, ds.slice(0, 7));
      if (ds > todayStr) { cell.addClass("is-planned"); continue; }
      if (v > 0) {
        cell.addClass("is-level");
        cell.style.setProperty("--hg-level", `${g ? Math.round(34 + 66 * Math.min(1, v / g)) : 100}%`);
      }
      if (ds === todayStr) cell.addClass("is-today");
      cell.setAttr("aria-label", tr("{0}월 {1}일 · {2}{3}", date.getMonth() + 1, date.getDate(), v ? fmtQty(v, unit) : tr("기록 없음"), g ? tr(" / 목표 {0}", fmtQty(g, unit)) : ""));
      if (opts.onValue) {
        cell.addClass("is-clickable");
        cell.addEventListener("click", () => opts.onValue(ds, v));
      }
    }
  }
  enableHorizontalScroll(scroll);
  stopEditorGrab(scroll);

  // 월별 목표·결과 표
  const table = card.createDiv({ cls: "hg-months" });
  const tbar = table.createDiv({ cls: "hg-mtitle" });
  if (opts.goalsFolded) table.addClass("is-folded");
  const fold = tbar.createSpan({ cls: "hg-fold-toggle", text: opts.goalsFolded ? "▸" : "▾" });
  fold.setAttr("aria-label", opts.goalsFolded ? tr("펼치기") : tr("접기"));
  stopEditorGrab(fold);
  tbar.createSpan({ text: tr("{0}년 달별 목표", year), cls: "hg-mtitle-text" });
  if (opts.onFoldGoals) tbar.addEventListener("click", (e) => { if (e.target.closest(".hg-mmanage")) return; opts.onFoldGoals(!opts.goalsFolded); });
  if (opts.onGoals && !opts.goalsFolded) {
    const manage = tbar.createSpan({ cls: "hg-mmanage", text: tr("목표 정하기") });
    manage.addEventListener("click", () => opts.onGoals(year));
    stopEditorGrab(manage);
  }
  const freqs = opts.freqs || {};
  const monthFreq = (key) => { const f = goalForMonth(freqs, key); return f > 0 && f < 7 ? Math.round(f) : 0; };
  let hasFreq = false;
  for (let m = 0; m < 12; m++) if (monthFreq(`${year}-${pad(m + 1)}`)) hasFreq = true;
  if (hasFreq) table.addClass("has-weeks");
  const hdr = table.createDiv({ cls: "hg-mrow is-head" });
  (hasFreq ? [tr("월"), tr("하루 목표"), tr("주 목표"), tr("달성"), tr("달성 주"), tr("합계"), ""] : [tr("월"), tr("하루 목표"), tr("달성"), tr("합계"), ""]).forEach((t) => hdr.createDiv({ text: t }));
  let rows = 0;
  for (let m = 11; m >= 0; m--) {
    const key = `${year}-${pad(m + 1)}`;
    const future = key > curKey;
    if (future && goals[key] == null && freqs[key] == null) continue;
    const g = goalForMonth(goals, key);
    const daysInMonth = new Date(year, m + 1, 0).getDate();
    const days = daysInMonth;
    let done = 0, sum = 0;
    for (const [ds, v] of entries) {
      if (!ds.startsWith(key)) continue;
      sum += v;
      if (v > 0 && (!g || v >= g)) done++;
    }
    if (!sum && goals[key] == null && freqs[key] == null && key !== curKey) continue;
    rows++;
    const row = table.createDiv({ cls: "hg-mrow" + (key === curKey ? " is-current" : "") + (future ? " is-future" : "") });
    row.createDiv({ cls: "hg-mname", text: tr("{0}월", m + 1) });
    const gcell = row.createDiv({ cls: "hg-mgoal is-clickable" + (goals[key] == null ? " is-inherited" : ""), text: g ? fmtQty(g, unit) : "—" });
    gcell.setAttr("aria-label", goals[key] == null ? tr("앞 달 목표를 이어서 쓰는 중 · 눌러서 바꾸기") : tr("눌러서 목표 바꾸기"));
    if (opts.onMonthGoal) gcell.addEventListener("click", () => opts.onMonthGoal(key, g));
    stopEditorGrab(gcell);
    const mf = monthFreq(key);
    if (hasFreq) {
      const fcell = row.createDiv({ cls: "hg-mgoal is-clickable" + (freqs[key] == null ? " is-inherited" : ""), text: mf ? ((() => { const sc = scheduleAt(opts.freqsRaw, opts.days, key); return sc && sc.days ? daysLabel(sc.days) : tr("주 {0}회", mf); })()) : tr("매일") });
      if (opts.onGoals) fcell.addEventListener("click", () => opts.onGoals(year));
      stopEditorGrab(fcell);
    }
    if (future) {
      row.createDiv({ cls: "hg-mdone", text: tr("예정") });
      if (hasFreq) row.createDiv();
      row.createDiv({ cls: "hg-msum" });
      row.createDiv();
      continue;
    }
    row.createDiv({ cls: "hg-mdone", text: tr("{0}/{1}일", done, days) });
    if (hasFreq) {
      // A 규칙으로 이 달에 속한 주들 중 그 달의 횟수를 채운 주 (진행 중인 이번 주 포함)
      let weeksTotal = 0, weeksHit = 0;
      const first = weekStartOf(new Date(year, m, 1), weekStart);
      for (let i = -1; i < 6; i++) {
        const d = addDays(first, i * 7);
        if (weekMonthKey(d) !== key) continue;
        if (fmt(d) > todayStr) break;
        weeksTotal++;
        const wf = freqOf(d);
        if (wf > 0 && (weekHits.get(fmt(d)) || 0) >= wf) weeksHit++;
      }
      row.createDiv({ cls: "hg-mweeks", text: mf && weeksTotal ? tr("{0}/{1}주", weeksHit, weeksTotal) : "—" });
    }
    row.createDiv({ cls: "hg-msum", text: fmtQty(sum, unit) });
    const track = row.createDiv({ cls: "hg-mbar" });
    track.createDiv({ cls: "hg-mbar-fill" }).style.width = `${Math.round((done / days) * 100)}%`;
  }
  if (!rows) table.createDiv({ cls: "hg-empty", text: tr("{0}년 기록이 없어요.", year) });

  window.requestAnimationFrame(() => {
    scroll.classList.toggle("is-overflow", scroll.scrollWidth > scroll.clientWidth + 1);
    if (year === today.getFullYear()) {
      const t = scroll.querySelector(".is-today");
      if (t) scroll.scrollLeft = t.parentElement.offsetLeft - scroll.clientWidth + 40;
    }
  });
  return card;
}

// 카드 위쪽: 이번 주(월~일) 타일 + 주 N회 진행 막대. ‹ › 로 다른 주
// 운동처럼 "무엇을 했는지"가 있는 습관: 보고 있는 주(7일)의 기록을 쭉 보여 줌
export function renderItemLog(card, itemsAll, days, todayStr) {
  const box = card.createDiv({ cls: "hg-itemlog" });
  box.createDiv({ cls: "hg-itemlog-title", text: tr("이 주의 운동 기록") });
  for (const d of days) {
    const ds = fmt(d);
    if (ds > todayStr) continue;
    const its = itemsAll.get(ds) || [];
    const r = box.createDiv({ cls: "hg-itemlog-row" + (ds === todayStr ? " is-today" : "") });
    r.createDiv({ cls: "hg-itemlog-day", text: `${d.getMonth() + 1}/${d.getDate()} ${DAY_NAMES[d.getDay()]}` });
    const chips = r.createDiv({ cls: "hg-itemlog-chips" });
    if (!its.length) chips.createSpan({ cls: "hg-itemlog-none", text: "—" });
    for (const it of its) chips.createSpan({ cls: "hg-itemlog-chip", text: it });
  }
}
