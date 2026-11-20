import { WEEK_MS } from "../constants";
import { DAY_NAMES, tr } from "../i18n";
import { addDays, fmt, monthKey, toDate, weekStartOf } from "../dates";
import { daysLabel, fmtQty } from "../format";
import { freqOfWeek, goalForMonth, isSchedDay, scheduleAt, weekCounts } from "../stats";
import { enableHorizontalScroll, makeColorDot, stopEditorGrab } from "../ui";

// 요약 카드 격자: 한 칸 = 하루. 기간(rangeStart~rangeEnd)만 그린다
export function compactGrid(card, h, o) {
  const { today, weekStart } = o;
  const todayStr = fmt(today);
  const rs = o.rangeStart, re = o.rangeEnd;
  const rsStr = fmt(rs), reStr = fmt(re);
  const isM = h.kind === "measure";
  const goals = h.monthGoals || {};
  const counts = isM ? null : weekCounts(h.set, weekStart);
  const first = weekStartOf(rs, weekStart);
  const nWeeks = Math.round((weekStartOf(re, weekStart) - first) / WEEK_MS) + 1;

  const scroll = card.createDiv({ cls: `hg-scroll is-year hg-cg hg-cg-${o.mode}` });
  const grid = scroll.createDiv({ cls: "hg-grid" });
  const labels = grid.createDiv({ cls: "hg-col hg-labels" });
  labels.createDiv({ cls: "hg-month" });
  for (let i = 0; i < 7; i++) labels.createDiv({ cls: "hg-daylabel", text: i % 2 === 0 ? DAY_NAMES[(weekStart + i) % 7] : "" });

  let prevMonth = -1;
  for (let w = 0; w < nWeeks; w++) {
    const top = addDays(first, w * 7);
    const wf = isM ? 0 : freqOfWeek(h.freqs, top);
    const weekHit = wf > 0 && (counts.get(fmt(top)) || 0) >= wf;
    const col = grid.createDiv({ cls: "hg-col" + (weekHit ? " is-week-done" : "") });
    const month = col.createDiv({ cls: "hg-month" });
    const mEnd = addDays(top, 6);
    if (mEnd.getMonth() !== prevMonth) {
      if (mEnd >= rs && mEnd <= addDays(re, 6)) month.setText(tr("{0}월", mEnd.getMonth() + 1));
      prevMonth = mEnd.getMonth();
    }
    for (let i = 0; i < 7; i++) {
      const date = addDays(top, i);
      const ds = fmt(date);
      const cell = col.createDiv({ cls: "hg-cell" });
      if (!isM && isSchedDay(h.freqsRaw, h.days, date, today, weekStart)) cell.addClass("is-sched");
      if (ds < rsStr || ds > reStr) { cell.addClass("is-outside"); continue; }
      if (ds > todayStr) { cell.addClass("is-planned"); continue; }
      if (isM) {
        const v = h.entries.get(ds) || 0;
        const g = goalForMonth(goals, ds.slice(0, 7));
        if (v > 0) {
          cell.addClass("is-level");
          cell.style.setProperty("--hg-level", `${g ? Math.round(34 + 66 * Math.min(1, v / g)) : 100}%`);
        }
        cell.setAttr("aria-label", tr("{0}월 {1}일 · {2}", date.getMonth() + 1, date.getDate(), v ? fmtQty(v, h.unit) : tr("기록 없음")));
        if (o.onValue) { cell.addClass("is-clickable"); cell.addEventListener("click", () => o.onValue(ds, v)); }
      } else {
        const on = h.set.has(ds);
        if (on) cell.addClass("is-on");
        else if (weekHit) cell.addClass("is-rest");
        if (o.onToggle) { cell.addClass("is-clickable"); cell.addEventListener("click", () => o.onToggle(ds, !on)); }
        cell.setAttr("aria-label", tr("{0}월 {1}일 · {2}", date.getMonth() + 1, date.getDate(), on ? tr("완료") : weekHit ? tr("이번 주 목표 달성") : tr("기록 없음")));
      }
      if (ds === todayStr) cell.addClass("is-today");
    }
  }
  enableHorizontalScroll(scroll);
  stopEditorGrab(scroll);
  window.requestAnimationFrame(() => {
    scroll.classList.toggle("is-overflow", scroll.scrollWidth > scroll.clientWidth + 1);
    if (o.mode === "half") scroll.scrollLeft = scroll.scrollWidth;
    else {
      const t = scroll.querySelector(".is-today");
      scroll.scrollLeft = t ? t.parentElement.offsetLeft - scroll.clientWidth + 40 : 0;
    }
  });
  return scroll;
}

// 기간이 정해진 습관(예: 66일)의 요약: 기간 격자 + 옆에 진행 상황
export function compactChallengeBody(card, h, o) {
  const { today, weekStart } = o;
  const todayStr = fmt(today);
  const set = h.set;
  const { days, start: startStr } = h.period;
  const startD = toDate(startStr);
  const endD = addDays(startD, days - 1);
  const endStr = fmt(endD);
  const dayNo = Math.max(0, Math.min(days, Math.round((toDate(todayStr) - startD) / 86400000) + 1));
  const finished = todayStr > endStr;
  const notStarted = todayStr < startStr;
  let done = 0;
  for (let i = 0; i < days; i++) { const ds = fmt(addDays(startD, i)); if (ds <= todayStr && set.has(ds)) done++; }
  const pct = Math.round((done / Math.max(1, dayNo)) * 100);
  const md = (d) => `${d.getMonth() + 1}/${d.getDate()} ${DAY_NAMES[d.getDay()]}`;

  const body = card.createDiv({ cls: "hg-cbody" });
  const scroll = body.createDiv({ cls: "hg-scroll is-year hg-cg hg-cg-half" });
  // 기간이 길수록 칸을 줄여서 한 줄에 들어오게 (30일 단위)
  const step = Math.min(7, Math.max(1, Math.ceil(days / 30)));
  const CELL = [0, 30, 26, 22, 18, 15, 13, 11][step];
  const GAP = CELL >= 22 ? 5 : CELL >= 15 ? 4 : 3;
  scroll.style.setProperty("--cc", `${CELL}px`);
  scroll.style.setProperty("--cgap", `${GAP}px`);
  const grid = scroll.createDiv({ cls: "hg-grid" });
  const labels = grid.createDiv({ cls: "hg-col hg-labels" });
  labels.createDiv({ cls: "hg-month" });
  for (let i = 0; i < 7; i++) labels.createDiv({ cls: "hg-daylabel", text: i % 2 === 0 ? DAY_NAMES[(weekStart + i) % 7] : "" });
  const first = weekStartOf(startD, weekStart);
  const nWeeks = Math.round((weekStartOf(endD, weekStart) - first) / WEEK_MS) + 1;
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
      if (ds > todayStr) cell.addClass("is-planned");
      else if (set.has(ds)) cell.addClass("is-on");
      if (ds === todayStr) cell.addClass("is-today");
      const n = Math.round((date - startD) / 86400000) + 1;
      cell.setAttr("aria-label", tr("{0}일째 · {1}월 {2}일 · {3}", n, date.getMonth() + 1, date.getDate(), ds > todayStr ? tr("예정") : set.has(ds) ? tr("완료") : tr("기록 없음")));
      if (o.onToggle && ds <= todayStr) { const on = set.has(ds); cell.addClass("is-clickable"); cell.addEventListener("click", () => o.onToggle(ds, !on)); }
    }
  }
  enableHorizontalScroll(scroll);
  stopEditorGrab(scroll);

  // 기간이 길면(120일 초과) 격자가 폭을 거의 다 써서 옆 통계는 생략 (칩에 D-day가 있어요)
  if (days <= 120) {
    const side = body.createDiv({ cls: "hg-cside hg-cside-ring" });
    const shown = finished ? days : dayNo;
    const NS = "http://www.w3.org/2000/svg";
    const ringBox = side.createDiv({ cls: "hg-ring" });
    const svg = activeDocument.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 84 84"); svg.setAttribute("width", "84"); svg.setAttribute("height", "84");
    const mkc = (cls) => { const c = activeDocument.createElementNS(NS, "circle"); c.setAttribute("cx", "42"); c.setAttribute("cy", "42"); c.setAttribute("r", "35"); c.setAttribute("class", cls); svg.appendChild(c); return c; };
    mkc("hg-ring-bg");
    const arc = mkc("hg-ring-fg");
    const circ = 2 * Math.PI * 35;
    arc.setAttribute("stroke-dasharray", `${(circ * shown / days).toFixed(1)} ${circ.toFixed(1)}`);
    arc.setAttribute("transform", "rotate(-90 42 42)");
    ringBox.appendChild(svg);
    const mid = ringBox.createDiv({ cls: "hg-ring-mid" });
    mid.createEl("b", { text: String(shown) });
    mid.createSpan({ text: tr("/ {0}일", days) });
    const info = side.createDiv({ cls: "hg-cinfo" });
    const rate = finished ? Math.round((done / days) * 100) : pct;
    const l1 = info.createDiv({ cls: "hg-cinfo-a" }); l1.createEl("b", { text: tr("{0}일", done) }); l1.appendText(tr(" 했어요"));
    const l2 = info.createDiv({ cls: "hg-cinfo-a" }); if (finished) { l2.appendText(tr("{0}일 중 ", days)); l2.createEl("b", { text: `${rate}%` }); }
    else if (dayNo > 0) { l2.appendText(tr("지난 {0}일 중 ", dayNo)); l2.createEl("b", { text: `${rate}%` }); }
    else l2.remove();
    info.createDiv({ cls: "hg-cinfo-b", text: finished ? tr("{0} 끝", md(endD)) : tr("{0} 끝 · D-{1}", md(endD), Math.round((endD - toDate(todayStr)) / 86400000)) });

  }
  window.requestAnimationFrame(() => {
    scroll.classList.toggle("is-overflow", scroll.scrollWidth > scroll.clientWidth + 1);
    const t = scroll.querySelector(".is-today");
    scroll.scrollLeft = t ? Math.max(0, t.parentElement.offsetLeft - scroll.clientWidth + 40) : 0;
  });
  return { done, pct, finished, notStarted, left: Math.round((endD - toDate(todayStr)) / 86400000), days };
}

export function renderCompact(parent, h, o) {
  const { today, weekStart } = o;
  const todayStr = fmt(today);
  const isM = h.kind === "measure";
  const card = parent.createDiv({ cls: "hg-card hg-compact" + (isM ? " is-measure" : "") });
  if (o.color) card.style.setProperty("--hg-on", o.color);

  // 윗줄 칩 + 오늘 했는지 (보는 기간 기준: 지난 기간이면 그 기간의 목표만, 없으면 칩 숨김)
  const isCur = o.isCurrent !== false;
  const rs = o.rangeStart ? fmt(o.rangeStart) : "0000-00-00", re = o.rangeEnd ? fmt(o.rangeEnd) : "9999-99-99";
  const inRange = (ds) => ds >= rs && ds <= re;
  // 지난 기간이면 그 기간에서 가장 최근에 기록한 달을 기준으로 삼는다
  let ref = o.refDate || today;
  if (!isCur) {
    let last = "";
    for (const ds of (isM ? [...h.entries].filter(([, v]) => v > 0).map(([d]) => d) : h.set)) if (inRange(ds) && ds > last) last = ds;
    if (last) ref = toDate(last);
  }
  const refKey = monthKey(ref), refMonth = ref.getMonth() + 1;
  const fOf = (g) => { const f = goalForMonth(g, refKey); return f > 0 && f < 7 ? Math.round(f) : 0; };
  let chip = "", chipDone = false, doneToday;
  if (isM) {
    const goals = h.monthGoals || {};
    const hit = (ds, v) => v > 0 && v >= goalForMonth(goals, ds.slice(0, 7));
    doneToday = hit(todayStr, h.entries.get(todayStr) || 0);
    const curGoal = goalForMonth(goals, refKey);
    const freq = isCur ? freqOfWeek(h.freqs, weekStartOf(today, weekStart)) : fOf(h.freqs);
    if (isCur) {
      let weekCount = 0;
      const wk = fmt(weekStartOf(today, weekStart));
      for (const [ds, v] of h.entries) if (hit(ds, v) && fmt(weekStartOf(toDate(ds), weekStart)) === wk) weekCount++;
      chipDone = !!freq && weekCount >= freq;
    }
    const hasRec = [...h.entries].some(([ds, v]) => v > 0 && inRange(ds));
    if (curGoal && (isCur || hasRec)) chip = tr("{0}월 · 하루 {1}", refMonth, fmtQty(curGoal, h.unit)) + (freq ? tr(" · 주 {0}회", freq) : "") + (chipDone ? " ✓" : "");
    else if (isCur) chip = tr("목표 없음");
  } else {
    doneToday = h.set.has(todayStr);
    if (!h.period) {
      const goal = isCur ? freqOfWeek(h.freqs, weekStartOf(today, weekStart)) : fOf(h.freqs);
      if (isCur) {
        const wc = weekCounts(h.set, weekStart).get(fmt(weekStartOf(today, weekStart))) || 0;
        chipDone = !!goal && wc >= goal;
      }
      const hasRec = [...h.set].some(inRange);
      const sch = scheduleAt(h.freqsRaw, h.days, refKey);
      if (goal && (isCur || hasRec)) chip = (sch && sch.days ? tr("{0}월 · {1}", refMonth, daysLabel(sch.days)) : tr("{0}월 · 주 {1}회", refMonth, goal)) + (chipDone ? " ✓" : "");
      else if (isCur) chip = tr("매일");
      else if (hasRec) chip = tr("매일");
    }
  }

  const head = card.createDiv({ cls: "hg-head hg-head-open" });
  const title = head.createDiv({ cls: "hg-title" });
  const dot = title.createSpan({ cls: "hg-dot" + (doneToday ? " is-done" : "") });
  makeColorDot(dot, o);
  title.createSpan({ cls: "hg-name", text: h.name });
  const right = head.createDiv({ cls: "hg-headright" });
  const chipEl = (chip || (!isM && h.period)) ? right.createSpan({ cls: "hg-goal" + (chipDone ? " is-done" : ""), text: chip }) : null;
  const chipAct = (!isM && h.period) ? (o.onPeriod ? (evt) => o.onPeriod(evt) : null) : (o.onGoals ? () => o.onGoals(ref.getFullYear()) : null);
  if (chipAct && chipEl) {
    chipEl.addClass("is-clickable");
    chipEl.setAttr("aria-label", (!isM && h.period) ? tr("기간 바꾸기") : tr("목표 정하기 (주 몇 회, 하루 목표)"));
    chipEl.addEventListener("click", (evt) => { evt.stopPropagation(); chipAct(evt); });
    stopEditorGrab(chipEl);
  }
  if (o.onMore) {
    const more = right.createSpan({ cls: "hg-more hg-more-lg", text: "⋯" });
    more.setAttr("aria-label", tr("더 보기 (순서 바꾸기, 보관함으로 옮기기)"));
    more.addEventListener("click", (evt) => { evt.stopPropagation(); o.onMore(evt); });
    stopEditorGrab(more);
  }
  right.createSpan({ cls: "hg-chev", text: "›" });
  head.setAttr("aria-label", tr("{0} 자세히 보기", h.name));
  head.addEventListener("click", () => o.onOpen());
  stopEditorGrab(head);

  let footer;
  if (!isM && h.period) {
    const r = compactChallengeBody(card, h, o);
    chipEl.setText(r.finished ? tr("{0}일 완료", r.days) : r.notStarted ? tr("{0}일 · 시작 전", r.days) : tr("{0}일 챌린지 · D-{1}", r.days, r.left));
    if (r.finished) chipEl.addClass("is-done");
    if (r.finished) {
      const ban = card.createDiv({ cls: "hg-chal-banner" });
      ban.createDiv({ cls: "hg-chal-banner-t", text: tr("{0}일 끝! {1}일 했어요 ({2}%)", r.days, r.done, Math.round((r.done / r.days) * 100)) });
      const row = ban.createDiv({ cls: "hg-chal-banner-btns" });
      const b = (label, fn) => { const x = row.createEl("button", { text: label }); x.addEventListener("click", fn); stopEditorGrab(x); };
      if (o.onExtend) { b(tr("+30일 더 하기"), () => o.onExtend(30)); b(tr("기간 없이 계속"), () => o.onExtend(0)); }
      if (o.onArchive) b(tr("보관함으로"), () => o.onArchive());
    }
  } else {
    compactGrid(card, h, o);
    const rsStr = fmt(o.rangeStart), reStr = fmt(o.rangeEnd);
    if (isM) {
      let sum = 0;
      for (const [ds, v] of h.entries) if (ds >= rsStr && ds <= reStr) sum += v;
      footer = `${o.rangeText} ${fmtQty(sum, h.unit)}`;
    } else {
      let n = 0;
      for (const ds of h.set) if (ds >= rsStr && ds <= reStr) n++;
      footer = tr("{0} {1}회", o.rangeText, n);
    }
  }
  if (footer) card.createDiv({ cls: "hg-ctotal", text: footer });
  return card;
}

// 보관함 목록의 한 줄(카드)
export function renderArchiveRow(parent, h, o) {
  const today = o.today;
  const isM = h.kind === "measure";
  const card = parent.createDiv({ cls: "hg-card hg-arch-row" });
  if (o.color) card.style.setProperty("--hg-on", o.color);
  const dates = [...h.set].sort();
  const firstDs = dates[0], lastDs = dates[dates.length - 1];
  let badge = tr("보관됨"), badgeDone = false;
  if (!isM && h.period) {
    const endStr = fmt(addDays(toDate(h.period.start), h.period.days - 1));
    if (fmt(today) > endStr) { badge = tr("{0}일 완료", h.period.days); badgeDone = true; }
  }
  const head = card.createDiv({ cls: "hg-head hg-head-open" });
  const title = head.createDiv({ cls: "hg-title" });
  title.createSpan({ cls: "hg-dot is-done" });
  title.createSpan({ cls: "hg-name", text: h.name });
  title.createSpan({ cls: "hg-goal" + (badgeDone ? " is-done" : ""), text: badge });
  head.createSpan({ cls: "hg-chev", text: "›" });
  head.addEventListener("click", () => o.onOpen());
  stopEditorGrab(head);

  const ym = (ds) => `${ds.slice(0, 4)}.${Number(ds.slice(5, 7))}`;
  const total = isM ? fmtQty([...h.entries.values()].reduce((a, b) => a + b, 0), h.unit) : tr("{0}회", h.set.size);
  let line = tr("기록이 없어요");
  if (firstDs) {
    const span = Math.round((toDate(lastDs) - toDate(firstDs)) / 86400000) + 1;
    const rate = Math.round((h.set.size / span) * 100);
    line = tr("{0} – {1} · 총 {2} · 기록한 날 {3}%", ym(firstDs), ym(lastDs), total, rate);
  }
  card.createDiv({ cls: "hg-ainfo2", text: line });

  if (lastDs) {
    const yr = lastDs.slice(0, 4);
    const per = new Array(12).fill(0);
    if (isM) { for (const [ds, v] of h.entries) if (ds.startsWith(yr)) per[Number(ds.slice(5, 7)) - 1] += v; }
    else { for (const ds of h.set) if (ds.startsWith(yr)) per[Number(ds.slice(5, 7)) - 1]++; }
    const max = Math.max(...per, 1);
    const strip = card.createDiv({ cls: "hg-astrip" });
    per.forEach((v, i) => {
      const c = strip.createEl("i");
      c.style.setProperty("--p", v ? `${Math.round(25 + 75 * (v / max))}%` : "0%");
      c.setAttr("aria-label", tr("{0}년 {1}월", yr, i + 1));
    });
    const ax = card.createDiv({ cls: "hg-aaxis" });
    ax.createSpan({ text: tr("{0}년 1월", yr) });
    ax.createSpan({ text: tr("12월") });
  }
  const act = card.createDiv({ cls: "hg-aact" });
  const back = act.createEl("button", { cls: "hg-abtn2", text: tr("다시 시작") });
  back.addEventListener("click", (e) => { e.stopPropagation(); o.onRestore(); });
  stopEditorGrab(back);
  return card;
}
