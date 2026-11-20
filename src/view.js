import { MarkdownRenderChild, normalizePath } from "obsidian";
import { tr } from "./i18n";
import { addDays, fmt, toDate, weekStartOf } from "./dates";
import { goalForMonth } from "./stats";
import { parseBlock } from "./parse";
import { iconifyNav, stopEditorGrab } from "./ui";
import { renderHabit } from "./render/habit";
import { renderArchiveRow, renderCompact } from "./render/compact";
import { renderTodayBar } from "./render/today";

export class HabitView extends MarkdownRenderChild {
  constructor(plugin, el, source) {
    super(el);
    this.plugin = plugin;
    this.opts = parseBlock(source);
    this.timer = null;
    this.years = {};
    this.months = {};
    this.weekAnchors = {};
    this.selDays = {};
    this.view = "main"; // main | detail | archive | archdetail
    this.openKey = null;
    this.mainYear = null;
    this.halfOffset = 0;
  }

  get folderPath() { return normalizePath(this.opts.folder || this.plugin.settings.folder); }

  onload() {
    void this.render();
    const v = this.plugin.app.vault;
    const maybe = (f) => { if (f && f.path && f.path.startsWith(this.folderPath + "/")) this.schedule(); };
    this.registerEvent(v.on("modify", maybe));
    this.registerEvent(v.on("create", maybe));
    this.registerEvent(v.on("delete", maybe));
    this.registerEvent(v.on("rename", (f, old) => { maybe(f); if (old && old.startsWith(this.folderPath + "/")) this.schedule(); }));
    this.registerEvent(this.plugin.app.metadataCache.on("changed", maybe));
    this.registerEvent(this.plugin.app.workspace.on("habit-grid:refresh", () => this.schedule()));
    this.register(() => window.clearTimeout(this.timer));
  }

  schedule() {
    window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => this.render(), 250);
  }

  // 상세·읽기 전용 상세에서 쓰는 전체 카드 (예전 카드 그대로)
  fullCard(wrap, h, colorOf, readonly, noMore) {
    const { settings } = this.plugin;
    const key = h.key;
    const common = {
      color: colorOf(h),
      onColor: (evt) => this.plugin.openColorMenu(evt, h.target, h.unit, h.color),
      weeks: this.opts.weeks || 20,
      range: this.opts.weeks ? "recent" : "year",
      year: this.years[key],
      onYear: (y) => { this.years[key] = y; void this.render(); },
      mode: ((settings.modes || {})[h.name] === "month") ? "month" : "year",
      onMode: (m) => { settings.modes = Object.assign({}, settings.modes, { [h.name]: m }); this.plugin.saveSettings(); void this.render(); },
      monthAnchor: this.months[key],
      weekAnchor: this.weekAnchors[key],
      onNav: (delta) => {
        const now = new Date();
        const cur = this.months[key] || new Date(now.getFullYear(), now.getMonth(), 1);
        this.months[key] = delta === 0 ? undefined : new Date(cur.getFullYear(), cur.getMonth() + delta, 1);
        void this.render();
      },
      weekStart: settings.weekStart,
      onMore: (evt) => this.plugin.openHabitMenu(evt, h),
      freqs: h.freqs, freqsRaw: h.freqsRaw, days: h.days,
      period: h.kind === "check" ? h.period : null,
      onExtend: (n) => this.plugin.extendPeriod(h, n),
      onPeriod: (evt) => this.plugin.openPeriodMenu(evt, h),
      onArchive: () => this.plugin.setArchived(h, true),
      itemsOf: h.items ? (ds) => h.items.get(ds) || [] : null,
      itemsAll: h.items || null,
      selDay: this.selDays[key],
      onGoals: (yr) => this.plugin.openGoals(h, yr),
      goalsFolded: !!(settings.goalsFolded || {})[h.name],
      onFoldGoals: (v) => { settings.goalsFolded = Object.assign({}, settings.goalsFolded, { [h.name]: v }); this.plugin.saveSettings(); void this.render(); },
      onWeekNav: (delta) => {
        const now = weekStartOf(new Date(), settings.weekStart);
        const cur = this.weekAnchors[key] || now;
        const next = delta === 0 ? undefined : addDays(cur, delta * 7);
        this.weekAnchors[key] = next && fmt(next) === fmt(now) ? undefined : next;
        void this.render();
      },
    };
    let o;
    if (h.kind === "check") {
      o = {
        ...common,
        onToggle: settings.clickToToggle ? (ds, on) => this.plugin.recordCheck(h, ds, on) : null,
        onSelect: h.items ? (ds) => { this.selDays[key] = ds; void this.render(); } : null,
      };
    } else {
      o = {
        ...common, measure: true, unit: h.unit, entries: h.entries, monthGoals: h.monthGoals,
        onValue: (ds, cur) => this.plugin.askValue(h.target, ds, cur, h.unit, goalForMonth(h.monthGoals, ds.slice(0, 7))),
        onMonthGoal: (mk, cur) => this.plugin.askMonthGoal(h.target, mk, cur, h.unit),
      };
    }
    if (readonly) for (const k of ["onColor", "onMore", "onToggle", "onSelect", "onValue", "onMonthGoal", "onGoals", "onPeriod", "onExtend", "onArchive"]) o[k] = null;
    if (noMore) o.onMore = null;
    return renderHabit(wrap, h.name, h.set, o);
  }

  // 오늘 줄(일간·주간)을 그릴 때 쓰는 값과 동작
  todayOpts(colorOf, today, mode, toggle) {
    const { settings } = this.plugin;
    const todayStr = fmt(today);
    return {
      colorOf,
      weekStart: settings.weekStart,
      mode,
      collapsed: !!settings.todayCollapsed,
      onCollapse: () => { settings.todayCollapsed = !settings.todayCollapsed; void this.plugin.saveSettings().then(() => this.plugin.app.workspace.trigger("habit-grid:refresh")); },
      onMode: toggle ? (m) => { settings.todayMode = m; void this.plugin.saveSettings().then(() => this.plugin.app.workspace.trigger("habit-grid:refresh")); } : null,
      onCheck: (h, ds) => this.plugin.recordCheck(h, ds, !h.set.has(ds)),
      onItems: (h, ds) => this.plugin.openItems(h, ds),
      onAdd: (h, delta) => this.plugin.recordValue(h, todayStr, Math.round(((h.entries.get(todayStr) || 0) + delta) * 100) / 100),
      onValue: (h, ds) => this.plugin.askValue(h.target, ds, h.entries.get(ds) || 0, h.unit, goalForMonth(h.monthGoals, ds.slice(0, 7))),
      onRecord: () => this.plugin.openRecorder(),
    };
  }

  settingsMode() { return this.plugin.settings.todayMode === "week" ? "week" : "day"; }

  async render() {
    const { settings } = this.plugin;
    const el = this.containerEl;
    const wrap = createDiv({ cls: "hg-wrap" + (this.opts.habits ? "" : " hg-v24") });
    const loaded = await this.plugin.loadHabits(this.folderPath, this.opts.habits);
    const habits = loaded ? loaded.filter((h) => !h.archived) : null;
    const archived = loaded ? loaded.filter((h) => h.archived) : [];

    if (habits === null) {
      wrap.createDiv({ cls: "hg-empty", text: tr("'{0}' 폴더를 찾을 수 없어요.", this.folderPath) });
      el.empty(); el.appendChild(wrap);
      return;
    }

    const today = new Date();
    const colorOf = (h) => h.color || this.opts.color || settings.color;

    if (this.opts.view) {
      // 노트에 ```habit view: day|week|today``` 처럼 적으면 오늘 줄(일간·주간)만 보여요. today는 전환 버튼이 있어요
      const v = this.opts.view;
      if (habits.length) renderTodayBar(wrap, habits, today, this.todayOpts(colorOf, today, v === "today" ? this.settingsMode() : v, v === "today"));
      else wrap.createDiv({ cls: "hg-empty", text: tr("진행 중인 습관이 없어요.") });
    } else if (this.opts.habits) {
      // 노트에 ```habit 습관: 이름``` 처럼 직접 고른 경우: 예전처럼 전체 카드를 그대로 보여 줘요
      if (!habits.length) wrap.createDiv({ cls: "hg-empty", text: tr("아직 기록된 습관이 없어요.") });
      for (const h of habits) this.fullCard(wrap, h, colorOf, false);
    } else {
      if (this.view === "detail" && !habits.find((x) => x.key === this.openKey)) this.view = "main";
      if (this.view === "archdetail" && !archived.find((x) => x.key === this.openKey)) this.view = "archive";
      if (this.view === "detail" || this.view === "archdetail") this.renderDetail(wrap, habits, archived, colorOf);
      else if (this.view === "archive") this.renderArchive(wrap, archived, colorOf, today);
      else this.renderMain(wrap, habits, archived, colorOf, today);
    }

    el.empty();
    el.appendChild(wrap);
    iconifyNav(wrap);
  }

  go(view, key) {
    this.view = view;
    this.openKey = key || null;
    void this.render();
  }

  // 상세·보관함 맨 위 줄: [‹ 목록] 가운데 이름 [⋯]
  backBar(wrap, label, onBack, mid, color, onMore) {
    const bar = wrap.createDiv({ cls: "hg-backbar" });
    if (color) bar.style.setProperty("--hg-on", color);
    const left = bar.createDiv({ cls: "hg-bb-left" });
    const back = left.createEl("button", { cls: "hg-backbtn", text: `‹ ${label}` });
    back.setAttr("aria-label", tr("{0}으로 돌아가기", label));
    back.addEventListener("click", onBack);
    stopEditorGrab(back);
    const t = bar.createDiv({ cls: "hg-bartitle" });
    if (color) t.createSpan({ cls: "hg-dot is-done" });
    t.createSpan({ text: mid || "" });
    const right = bar.createDiv({ cls: "hg-bb-right" });
    if (onMore) {
      const m = right.createEl("button", { cls: "hg-circbtn", text: "⋯" });
      m.setAttr("aria-label", tr("더 보기"));
      m.addEventListener("click", (evt) => onMore(evt));
      stopEditorGrab(m);
    }
  }

  renderMain(wrap, habits, archived, colorOf, today) {
    const { settings } = this.plugin;
    const mode = settings.gridMode === "half" ? "half" : "year";

    // 가장 오래된 기록 (그 앞으로는 못 넘기게)
    let earliest = "";
    for (const h of habits) for (const ds of h.set) if (!earliest || ds < earliest) earliest = ds;

    let rangeStart, rangeEnd, label, rangeText, canPrev, atNow, onPrev, onNext, onNow;
    if (mode === "year") {
      const cur = today.getFullYear();
      const year = this.mainYear || cur;
      rangeStart = new Date(year, 0, 1); rangeEnd = new Date(year, 11, 31);
      label = `${year}`; rangeText = tr("{0}년", year);
      atNow = year >= cur;
      canPrev = true;
      onPrev = () => { this.mainYear = year - 1; };
      onNext = () => { this.mainYear = year + 1 >= cur ? null : year + 1; };
      onNow = () => { this.mainYear = null; };
    } else {
      const off = this.halfOffset || 0;
      const endIdx = today.getFullYear() * 12 + today.getMonth() - 6 * off;
      const startIdx = endIdx - 5;
      const sy = Math.floor(startIdx / 12), sm = startIdx % 12, ey = Math.floor(endIdx / 12), em = endIdx % 12;
      rangeStart = new Date(sy, sm, 1);
      rangeEnd = off === 0 ? today : new Date(ey, em + 1, 0);
      label = sy === ey ? `${sy}.${sm + 1} – ${em + 1}` : `${sy}.${sm + 1} – ${ey}.${em + 1}`;
      rangeText = label;
      atNow = off === 0;
      canPrev = true;
      onPrev = () => { this.halfOffset = off + 1; };
      onNext = () => { this.halfOffset = Math.max(0, off - 1); };
      onNow = () => { this.halfOffset = 0; };
    }

    // 맨 위: ‹ 2026 › 와 보관함 버튼
    const bar = wrap.createDiv({ cls: "hg-topbar hg-maintop" });
    const nav = bar.createDiv({ cls: "hg-yearnav" });
    const btn = (text, aria, enabled, fn) => {
      const b = nav.createEl("button", { cls: "hg-yearbtn", text });
      b.setAttr("aria-label", aria);
      stopEditorGrab(b);
      if (!enabled) b.addClass("is-disabled");
      else b.addEventListener("click", () => { fn(); void this.render(); });
    };
    btn("‹", mode === "year" ? tr("이전 해") : tr("이전 6개월"), canPrev, onPrev);
    nav.createSpan({ cls: "hg-year hg-year-wide", text: label });
    btn("›", mode === "year" ? tr("다음 해") : tr("다음 6개월"), !atNow, onNext);
    const now = nav.createSpan({ cls: "hg-yearbtn hg-thisyear" + (atNow ? " is-ghost" : ""), text: tr("올해") });
    if (!atNow) now.addEventListener("click", () => { onNow(); void this.render(); });
    stopEditorGrab(now);
    const rbar = bar.createDiv({ cls: "hg-rbar" });
    const ab = rbar.createEl("button", { cls: "hg-archbtn" });
    ab.createSpan({ text: tr("보관함") });
    ab.createSpan({ cls: "hg-archn", text: String(archived.length) });
    ab.setAttr("aria-label", tr("보관함 열기"));
    ab.addEventListener("click", () => this.go("archive"));
    stopEditorGrab(ab);

    // 오늘 줄
    if (habits.length) renderTodayBar(wrap, habits, today, this.todayOpts(colorOf, today, this.settingsMode(), true));
    else wrap.createDiv({ cls: "hg-empty", text: tr("진행 중인 습관이 없어요.") });

    // 기간이 정해진 습관(66일 등)은 보고 있는 기간과 겹칠 때만 보여요
    const rsStr = fmt(rangeStart), reStr = fmt(rangeEnd);
    const todayInRange = today >= rangeStart && today <= rangeEnd;
    const visible = habits.filter((h) => {
      // 시작 전(첫 기록보다 앞선 기간)에는 보여주지 않는다
      let first = "";
      for (const ds of (h.kind === "measure" ? [...h.entries].filter(([, v]) => v > 0).map(([d]) => d) : h.set)) if (!first || ds < first) first = ds;
      if (h.period && h.period.start && (!first || h.period.start < first)) first = h.period.start;
      if (first ? first > reStr : !todayInRange) return false;
      if (h.kind !== "check" || !h.period) return true;
      const endStr = fmt(addDays(toDate(h.period.start), h.period.days - 1));
      return h.period.start <= reStr && endStr >= rsStr;
    });
    for (const h of visible) {
      renderCompact(wrap, h, {
        color: colorOf(h), today, weekStart: settings.weekStart, mode, rangeStart, rangeEnd, rangeText,
        isCurrent: today >= rangeStart && today <= rangeEnd, refDate: (today >= rangeStart && today <= rangeEnd) ? today : rangeEnd,
        onColor: (evt) => this.plugin.openColorMenu(evt, h.target, h.unit, h.color),
        onOpen: () => this.go("detail", h.key),
        onMore: (evt) => this.plugin.openHabitMenu(evt, h),
        onGoals: (yr) => this.plugin.openGoals(h, yr),
        onToggle: (h.kind === "check" && settings.clickToToggle) ? (ds, on) => this.plugin.recordCheck(h, ds, on) : null,
        onValue: h.kind === "measure" ? (ds, cur) => this.plugin.askValue(h.target, ds, cur, h.unit, goalForMonth(h.monthGoals, ds.slice(0, 7))) : null,
        onPeriod: (evt) => this.plugin.openPeriodMenu(evt, h),
        onExtend: (n) => this.plugin.extendPeriod(h, n),
        onArchive: () => this.plugin.setArchived(h, true),
      });
    }

    const foot = wrap.createDiv({ cls: "hg-foot" });
    const add = foot.createDiv({ cls: "hg-add", text: tr("＋ 새 습관") });
    add.addEventListener("click", () => this.plugin.newHabit());
    stopEditorGrab(add);
    const rec = foot.createDiv({ cls: "hg-add", text: tr("지난 기록 채우기") });
    rec.addEventListener("click", () => this.plugin.openRecorder());
    stopEditorGrab(rec);
  }

  renderDetail(wrap, habits, archived, colorOf) {
    const arch = this.view === "archdetail";
    const h = (arch ? archived : habits).find((x) => x.key === this.openKey);
    this.backBar(wrap, arch ? tr("보관함") : tr("목록"), () => this.go(arch ? "archive" : "main"), h.name, colorOf(h), arch ? null : (evt) => this.plugin.openHabitMenu(evt, h));
    if (arch) {
      const ban = wrap.createDiv({ cls: "hg-archbanner" });
      const lastDs = [...h.set].sort().pop();
      ban.createDiv({ cls: "hg-archbanner-t", text: tr("보관함에 있어요{0}\n기록은 그대로 보여요 (읽기 전용)", lastDs ? tr(" · 마지막 기록 {0}.{1}.{2}", lastDs.slice(0, 4), Number(lastDs.slice(5, 7)), Number(lastDs.slice(8, 10))) : "") });
      const b = ban.createEl("button", { cls: "hg-abtn2 is-primary", text: tr("다시 시작") });
      b.addEventListener("click", async () => { await this.plugin.setArchived(h, false); this.go("main"); });
      stopEditorGrab(b);
    }
    this.fullCard(wrap, h, colorOf, arch, true);
  }

  renderArchive(wrap, archived, colorOf, today) {
    this.backBar(wrap, tr("목록"), () => this.go("main"), tr("보관함"));
    wrap.createDiv({ cls: "hg-ainfo2 hg-aintro" + (archived.length ? "" : " is-empty"), text: archived.length ? tr("끝낸 습관 {0}개 · 눌러서 지난 기록을 볼 수 있어요", archived.length) : tr("보관함이 비었어요. 습관 카드의 ⋯ 메뉴에서 '보관함으로 옮기기'를 고르면 여기로 와요.") });
    for (const h of archived) {
      renderArchiveRow(wrap, h, {
        color: colorOf(h), today,
        onOpen: () => this.go("archdetail", h.key),
        onRestore: () => this.plugin.setArchived(h, false),
      });
    }
    if (archived.length) wrap.createDiv({ cls: "hg-ainfo2 hg-afoot", text: tr("보관해도 기록은 지워지지 않아요 · 다시 시작하면 같은 기록을 이어서 써요") });
  }
}
