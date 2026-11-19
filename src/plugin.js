import { Plugin, TFile, TFolder, normalizePath, Notice, Menu } from "obsidian";
import { ALT_LOG_NAME, DASHBOARD_TEMPLATE, DEFAULT_GROUP_PREFIX, DEFAULT_SETTINGS, DONE_RE, LEGACY_HABITS_DIR, LEGACY_SYNC_DIR, PRESET_COLORS, SKIP_RE, UNIT_HOURS, WD_ORDER } from "./constants";
import { resolveLang, setLang, tr, unitLabel } from "./i18n";
import { fmDel, fmGet, fmKey, fmSet, fmSetUnit, normalizeUnit, resolveKeyStyle, unitForKey } from "./frontmatter";
import { fmt, monthKey } from "./dates";
import { writeQty } from "./format";
import { dedupeText, parseDates, parseEntries, parseLog, parseSkips, parseTitle } from "./parse";
import { HabitView } from "./view";
import { ConfirmModal, DayItemsModal, NumberModal } from "./modals/simple";
import { GoalsModal } from "./modals/goals";
import { RecordModal } from "./modals/record";
import { NewHabitModal } from "./modals/newHabit";
import { HabitGridSettingTab } from "./settingTab";

export class HabitGridPlugin extends Plugin {
  async onload() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    setLang(resolveLang(this.settings.lang));
    this.registerMarkdownCodeBlockProcessor("habit", (source, el, ctx) => {
      ctx.addChild(new HabitView(this, el, source));
    });
    this.addSettingTab(new HabitGridSettingTab(this.app, this));

    this.addRibbonIcon("layout-grid", tr("습관 대시보드 열기"), () => this.openDashboard());
    this.addCommand({ id: "open-dashboard", name: tr("습관 대시보드 열기"), callback: () => this.openDashboard() });
    this.addCommand({ id: "setup", name: tr("습관 폴더와 대시보드 만들기"), callback: () => this.setup(true) });
    this.addCommand({ id: "new-habit", name: tr("새 습관 만들기"), callback: () => this.newHabit() });
    this.addCommand({ id: "record", name: tr("습관 기록하기 (날짜 골라서)"), callback: () => this.openRecorder() });
    this.addRibbonIcon("calendar-check", tr("습관 기록하기"), () => this.openRecorder());

    this.app.workspace.onLayoutReady(() => {
      if (!this.settings.initialized) this.setup(false);
      setTimeout(() => this.tidyArchive(), 2000);
    });
  }

  onunload() {
    activeDocument.querySelectorAll(".hg-pop").forEach((n) => n.remove());
  }

  get dashboardPath() {
    return normalizePath(`${this.settings.folder}/${this.settings.dashboardName}.md`);
  }

  isDashboard(file) {
    if (file.path === this.dashboardPath) return true;
    const fm = this.app.metadataCache.getFileCache(file)?.frontmatter;
    return !!(fm && fm["habit-dashboard"]);
  }

  // 습관 폴더와 대시보드가 없으면 만든다
  async setup(notify) {
    const { vault } = this.app;
    const folder = normalizePath(this.settings.folder);
    try {
      if (!vault.getAbstractFileByPath(folder)) await vault.createFolder(folder);
      if (!vault.getAbstractFileByPath(this.dashboardPath)) await vault.create(this.dashboardPath, DASHBOARD_TEMPLATE);
      this.settings.initialized = true;
      await this.saveSettings();
      if (notify) new Notice(tr("'{0}' 폴더와 대시보드를 준비했어요", folder));
    } catch (e) {
      console.error("habit-grid setup", e);
      if (notify) new Notice(tr("습관 폴더를 만들지 못했어요"));
    }
  }

  async openDashboard() {
    let file = this.app.vault.getAbstractFileByPath(this.dashboardPath);
    if (!(file instanceof TFile)) { await this.setup(false); file = this.app.vault.getAbstractFileByPath(this.dashboardPath); }
    if (file instanceof TFile) await this.app.workspace.getLeaf(false).openFile(file);
  }

  async toggle(file, ds, on) {
    await this.app.vault.process(file, (text) => {
      const lines = text.split("\n").filter((l) => { const m = l.match(DONE_RE); return !(m && m[1] === ds); });
      while (lines.length && lines[lines.length - 1].trim() === "") lines.pop();
      if (on) lines.push(`- [x] ${ds}`);
      return lines.join("\n") + "\n";
    });
    const [, m, d] = ds.split("-").map(Number);
    new Notice(tr("{0} · {1}월 {2}일 {3}", file.basename, m, d, on ? tr("기록했어요") : tr("기록을 지웠어요")));
  }

  isLog(file) {
    const name = file.basename.normalize("NFC");
    return name === this.settings.logName.normalize("NFC") || name === ALT_LOG_NAME;
  }

  // Property names to write in habit files: "ko" or "en"
  keyStyle() { return resolveKeyStyle(this.settings.keyStyle); }

  // Habit 폴더의 습관들을 읽어 온다.
  //  - 습관 파일(공부.md 등): 플러그인만 고친다 (색·목표·직접 기록·제외한 날)
  //  - 미리 알림 기록.md: 단축어만 쓴다. 플러그인은 읽기만 한다
  async loadHabits(folderPath, only) {
    const { app } = this;
    const folder = app.vault.getAbstractFileByPath(folderPath);
    if (!(folder instanceof TFolder)) return null;
    const nfc = (x) => x.normalize("NFC");
    // Habit/습관/ 의 습관 파일, Habit/동기화/ 의 미리 알림 기록을 읽는다. 예전처럼 Habit/ 바로 아래에 있는 파일도 계속 읽는다
    const sub = (name) => folder.children.find((c) => c instanceof TFolder && nfc(c.name) === nfc(name));
    const mdIn = (fd) => (Array.isArray(fd) ? fd : fd ? [fd] : []).flatMap((d) => d.children.filter((f) => f instanceof TFile && f.extension === "md"));
    // 예전 한글 하위 폴더(습관/, 동기화/)도 같이 읽는다
    const subs = (...names) => names.map(sub).filter(Boolean);
    const hDirs = subs(this.settings.habitsDir || "list", LEGACY_HABITS_DIR, this.settings.archiveDir || "archive"), sDirs = subs(this.settings.syncDir || "sync", LEGACY_SYNC_DIR);
    const rootMd = mdIn(folder).filter((f) => !this.isDashboard(f));
    // 단축어가 아직 예전 경로(Habit/)에 쓰는 동안에도 기록이 이어지도록 두 곳의 로그를 합쳐 읽는다
    const logFiles = [...mdIn(sDirs), ...rootMd].filter((f) => this.isLog(f));
    const logFile = logFiles[0];
    const files = [...rootMd, ...mdIn(hDirs).filter((f) => !this.isDashboard(f))].filter((f) => !this.isLog(f));

    const groups = new Map();
    const group = (name) => {
      if (!groups.has(name)) groups.set(name, { name, main: null, sources: [], log: new Map() });
      return groups.get(name);
    };
    for (const f of files) {
      const n = nfc(f.basename);
      const t = parseTitle(n);
      if (t) group(t.base).sources.push({ file: f, ...t }); // 예전 방식 파일도 계속 읽는다
      else group(n).main = f;
    }
    if (logFile) {
      const prefixes = (this.settings.groupPrefixes || [DEFAULT_GROUP_PREFIX]).map(nfc);
      const splitPrefix = (title) => {
        for (const p of prefixes) {
          if (title === p) return { prefix: p, rest: "" };
          if (title.startsWith(p) && /[\s·]/.test(title[p.length])) return { prefix: p, rest: title.slice(p.length).replace(/^[\s·]+/, "") };
        }
        return null;
      };
      const seenLog = new Set();
      for (const { ds, title } of parseLog((await Promise.all(logFiles.map((f) => app.vault.cachedRead(f)))).join("\n"))) {
        const lk = ds + "\u0001" + title;
        if (seenLog.has(lk)) continue;
        seenLog.add(lk);
        const gp = splitPrefix(title);
        if (gp) {
          const g = group(gp.prefix);
          if (!g.log.has(ds)) g.log.set(ds, { amount: 0, unit: undefined });
          if (gp.rest) {
            g.items = g.items || new Map();
            g.items.set(ds, [...(g.items.get(ds) || []), gp.rest]);
          }
          continue;
        }
        const t = parseTitle(title);
        const g = group(t ? t.base : title);
        const prev = g.log.get(ds);
        const amount = t ? t.amount : 0;
        g.log.set(ds, { amount: Math.max(prev ? prev.amount : 0, amount), unit: t ? t.unit : (prev && prev.unit) });
      }
    }

    let list = [...groups.values()];
    if (only) list = only.map((h) => groups.get(nfc(h))).filter(Boolean);
    const order = (this.settings.habitOrder || []).map(nfc);
    const rank = (n) => { const i = order.indexOf(nfc(n)); return i < 0 ? 1e6 : i; };
    list.sort((a, b) => rank(a.name) - rank(b.name) || a.name.localeCompare(b.name, "ko"));

    const out = [];
    for (const g of list) {
      const mainText = g.main ? await app.vault.cachedRead(g.main) : "";
      const fm = (g.main && app.metadataCache.getFileCache(g.main)?.frontmatter) || {};
      const unitRaw = normalizeUnit(fmGet(fm, "unit"));
      const skips = parseSkips(mainText);
      const logDates = new Set(g.log.keys());
      const logUnit = [...g.log.values()].map((v) => v.unit).find(Boolean);
      const legacy = parseInt(fmGet(fm, "goal") ?? 0, 10) || 0;
      const freqsRaw = Object.assign({}, fmGet(fm, "weeklyTimes") || (legacy ? { [monthKey(new Date())]: legacy } : {}));
      const daysRaw = {};
      for (const [k, v] of Object.entries(fmGet(fm, "weekdays") || {})) { const a = (Array.isArray(v) ? v : []).map(Number).filter((n) => n >= 0 && n <= 6); if (a.length) daysRaw[String(k)] = [...new Set(a)]; }
      const freqs = Object.assign({}, freqsRaw);
      for (const [k, v] of Object.entries(daysRaw)) freqs[k] = v.length;
      const base = {
        name: g.name, key: `${folderPath}/${g.name}`, fm, color: fmGet(fm, "color") || "", freqs, freqsRaw, days: daysRaw,
        target: g, file: g.main, logDates, items: g.items || null,
        archived: !!fmGet(fm, "archived"),
      };

      if (!unitRaw && !logUnit && !g.sources.length) {
        const set = new Set([...parseDates(mainText), ...logDates]);
        for (const ds of skips) set.delete(ds);
        const pd = parseInt(fmGet(fm, "duration") ?? 0, 10) || 0;
        const ps = fmGet(fm, "start") ? String(fmGet(fm, "start")).slice(0, 10) : "";
        out.push({ ...base, kind: "check", set,
          period: pd > 0 && /^\d{4}-\d{2}-\d{2}$/.test(ps) ? { days: pd, start: ps } : null,
          goal: parseInt(fmGet(fm, "goal") ?? 0, 10) || 0 });
        continue;
      }

      const unit = (unitRaw === true ? null : unitRaw) || logUnit || (g.sources[0] && g.sources[0].unit) || UNIT_HOURS;
      const entries = new Map();
      const inferred = {};
      const addAuto = (ds, amount) => {
        entries.set(ds, Math.max(entries.get(ds) || 0, amount));
        if (amount) { const mk = ds.slice(0, 7); inferred[mk] = Math.max(inferred[mk] || 0, amount); }
      };
      for (const [ds, v] of g.log) addAuto(ds, v.amount);
      for (const src of g.sources) {
        for (const ds of parseDates(await app.vault.cachedRead(src.file))) { addAuto(ds, src.amount); logDates.add(ds); }
      }
      for (const [ds, v] of parseEntries(mainText)) if (v > 0) entries.set(ds, v); // 직접 적은 값이 우선
      for (const ds of skips) entries.delete(ds);
      for (const [ds, v] of [...entries]) if (!v) entries.delete(ds);
      const explicit = fmGet(fm, "monthGoals") || {};
      out.push({ ...base, kind: "measure", unit, entries, set: new Set(entries.keys()),
        goal: parseInt(fmGet(fm, "goal") ?? 0, 10) || 0,
        explicit, inferred, monthGoals: Object.assign({}, inferred, explicit) });
    }
    return out;
  }

  // 습관 파일에서 그 날짜 줄을 바꾼다. 미리 알림으로 들어온 날을 지우면 '- [ ] 날짜'로 제외 표시
  async writeDay(h, ds, line) {
    const file = await this.mainFileOf(h.target, h.kind === "measure" ? h.unit : null);
    await this.app.vault.process(file, (text) => {
      const lines = text.split("\n").filter((l) => {
        const m = l.match(DONE_RE) || l.match(SKIP_RE);
        return !(m && m[1] === ds);
      });
      while (lines.length && lines[lines.length - 1].trim() === "") lines.pop();
      if (line) lines.push(line);
      else if (h.logDates && h.logDates.has(ds)) lines.push(`- [ ] ${ds}`);
      return lines.join("\n") + "\n";
    });
  }

  async recordCheck(h, ds, on) {
    if (h.period && ds < h.period.start) { new Notice(tr("기간 시작 전 날짜는 기록할 수 없어요")); return; }
    await this.writeDay(h, ds, on ? `- [x] ${ds}` : null);
    const [, m, d] = ds.split("-").map(Number);
    new Notice(tr("{0} · {1}월 {2}일 {3}", h.name, m, d, on ? tr("기록했어요") : tr("기록을 지웠어요")));
  }

  async recordValue(h, ds, v) {
    await this.writeDay(h, ds, v > 0 ? `- [x] ${ds} ${writeQty(v, h.unit)}` : null);
  }

  // group(target)으로 기록에 필요한 정보를 만든다
  habitOf(target, unit) {
    if (target && target.name !== undefined && !(target instanceof TFile)) {
      return { name: target.name, target, kind: "measure", unit, logDates: new Set([...(target.log ? target.log.keys() : [])]) };
    }
    return { name: target.basename, target, kind: "measure", unit, logDates: new Set() };
  }

  openHabitMenu(evt, h) {
    const menu = new Menu();
    menu.addItem((i) => i.setTitle(tr("색 바꾸기")).setIcon("palette").onClick(() => this.openColorMenu(evt, h.target, h.unit, h.color)));
    if (h.kind === "check") {
      menu.addSeparator();
      if (h.period) {
        menu.addItem((i) => i.setTitle(tr("기간 +30일")).setIcon("calendar-plus").onClick(() => this.extendPeriod(h, 30)));
        menu.addItem((i) => i.setTitle(tr("기간 +66일")).setIcon("calendar-plus").onClick(() => this.extendPeriod(h, 66)));
        menu.addItem((i) => i.setTitle(tr("기간 직접 입력")).setIcon("pencil").onClick(() => this.askPeriod(h)));
        menu.addItem((i) => i.setTitle(tr("기간 없음으로 바꾸기")).setIcon("infinity").onClick(() => this.extendPeriod(h, 0)));
      } else {
        menu.addItem((i) => i.setTitle(tr("기간 정하기 (오늘부터)")).setIcon("calendar-range").onClick(() => this.askPeriod(h)));
      }
      menu.addSeparator();
    }
    menu.addItem((i) => i.setTitle(tr("위로 옮기기")).setIcon("arrow-up").onClick(() => this.moveHabit(h, -1)));
    menu.addItem((i) => i.setTitle(tr("아래로 옮기기")).setIcon("arrow-down").onClick(() => this.moveHabit(h, 1)));
    menu.addSeparator();
    menu.addItem((i) => i.setTitle(tr("지난 기록 채우기")).setIcon("calendar-check").onClick(() => this.openRecorder()));
    menu.addSeparator();
    menu.addItem((i) => i.setTitle(tr("보관함으로 옮기기")).setIcon("archive").onClick(() => this.setArchived(h, true)));
    menu.showAtMouseEvent(evt);
  }

  // 기간 칩을 눌렀을 때 뜨는 메뉴
  openPeriodMenu(evt, h) {
    const menu = new Menu();
    if (h.period) {
      menu.addItem((i) => i.setTitle(tr("기간 +30일")).setIcon("calendar-plus").onClick(() => this.extendPeriod(h, 30)));
      menu.addItem((i) => i.setTitle(tr("기간 +66일")).setIcon("calendar-plus").onClick(() => this.extendPeriod(h, 66)));
      menu.addItem((i) => i.setTitle(tr("기간 직접 입력")).setIcon("pencil").onClick(() => this.askPeriod(h)));
      menu.addItem((i) => i.setTitle(tr("기간 없음으로 바꾸기")).setIcon("infinity").onClick(() => this.extendPeriod(h, 0)));
    } else {
      menu.addItem((i) => i.setTitle(tr("기간 정하기 (오늘부터)")).setIcon("calendar-range").onClick(() => this.askPeriod(h)));
    }
    menu.showAtMouseEvent(evt);
  }

  // n>0: 기간을 n일 늘림(없으면 오늘부터 n일), n===0: 기간 없음, n<0: 총 기간을 -n일로 지정
  async extendPeriod(h, n, confirmed) {
    if (n === 0 && h.period && !confirmed) {
      new ConfirmModal(this.app, {
        title: tr("기간 없음으로 바꿀까요?"),
        desc: [tr("'{0}'의 {1}일 챌린지 설정(기간·시작일)이 지워져요.", h.name, h.period.days), tr("기록은 그대로 남지만, 나중에 기간을 다시 정하면 원래 시작일이 아니라 그날부터 새로 세요. 지금 챌린지로는 돌아올 수 없어요.")],
        okText: tr("기간 없음으로 바꾸기"),
        onOk: () => this.extendPeriod(h, 0, true),
      }).open();
      return;
    }
    const file = await this.mainFileOf(h.target, null);
    await this.app.fileManager.processFrontMatter(file, (fm) => {
      const style = this.keyStyle();
      if (n === 0) { fmDel(fm, "duration"); fmDel(fm, "start"); return; }
      if (n < 0) { fmSet(fm, "duration", -n, style); if (!fmGet(fm, "start")) fmSet(fm, "start", fmt(new Date()), style); return; }
      const cur = parseInt(fmGet(fm, "duration") ?? 0, 10) || 0;
      if (cur > 0 && fmGet(fm, "start")) fmSet(fm, "duration", cur + n, style);
      else { fmSet(fm, "duration", n, style); fmSet(fm, "start", fmt(new Date()), style); }
    });
    new Notice(n === 0 ? tr("'{0}'은 기간 없이 계속해요", h.name) : tr("'{0}' 기간을 늘렸어요", h.name));
  }
  openDayItems(h, ds) {
    new DayItemsModal(this.app, h.name, ds, (h.items && h.items.get(ds)) || []).open();
  }
  async moveHabit(h, delta) {
    const nfc = (x) => x.normalize("NFC");
    const all = (await this.loadHabits(normalizePath(this.settings.folder))) || [];
    const names = all.filter((x) => !x.archived).map((x) => nfc(x.name));
    const i = names.indexOf(nfc(h.name));
    const j = i + delta;
    if (i < 0 || j < 0 || j >= names.length) { new Notice(delta < 0 ? tr("이미 맨 위예요") : tr("이미 맨 아래예요")); return; }
    [names[i], names[j]] = [names[j], names[i]];
    const rest = (this.settings.habitOrder || []).filter((n) => !names.includes(nfc(n)));
    this.settings.habitOrder = [...names, ...rest];
    await this.saveSettings();
    this.app.workspace.trigger("habit-grid:refresh");
  }
  askPeriod(h) {
    new NumberModal(this.app, {
      title: tr("기간 (일)"), desc: h.period ? tr("총 며칠로 할까요? (시작일부터 센 총 일수)") : tr("오늘부터 며칠 할까요?"),
      value: h.period ? h.period.days : 66, unit: tr("일"),
      onSubmit: async (v) => { const d = Math.round(v); if (d > 0) await this.extendPeriod(h, -d); },
    }).open();
  }
  async setArchived(h, on) {
    const file = await this.mainFileOf(h.target, h.kind === "measure" ? h.unit : null);
    await this.app.fileManager.processFrontMatter(file, (fm) => {
      if (on) fmSet(fm, "archived", true, this.keyStyle()); else fmDel(fm, "archived");
    });
    await this.moveHabitFile(file, on);
    new Notice(on ? tr("'{0}'을 보관함으로 옮겼어요. 기록은 그대로 남아 있어요", h.name) : tr("'{0}'을 다시 꺼냈어요", h.name));
  }

  // 보관하면 archive 폴더로, 다시 꺼내면 list 폴더로 파일을 옮긴다
  async moveHabitFile(file, toArchive) {
    try {
      const { vault, fileManager } = this.app;
      const dirName = toArchive ? (this.settings.archiveDir || "archive") : (this.settings.habitsDir || "list");
      const dir = normalizePath(`${this.settings.folder}/${dirName}`);
      if (file.parent && file.parent.path === dir) return;
      if (!vault.getAbstractFileByPath(dir)) await vault.createFolder(dir);
      const dest = normalizePath(`${dir}/${file.name}`);
      if (vault.getAbstractFileByPath(dest)) return;
      await fileManager.renameFile(file, dest);
    } catch (e) { console.error("habit-grid archive move", e); }
  }
  // 예전에 보관만 해 두고 폴더로 옮기지 않은 습관 파일을 archive 폴더로 정리한다
  async tidyArchive() {
    const folder = this.app.vault.getAbstractFileByPath(normalizePath(this.settings.folder));
    if (!(folder instanceof TFolder)) return;
    const archName = this.settings.archiveDir || "archive";
    const list = folder.children.find((c) => c instanceof TFolder && c.name.normalize("NFC") === (this.settings.habitsDir || "list").normalize("NFC"));
    if (!list) return;
    for (const f of [...list.children]) {
      if (!(f instanceof TFile) || f.extension !== "md" || this.isLog(f) || this.isDashboard(f)) continue;
      const fm = this.app.metadataCache.getFileCache(f)?.frontmatter;
      if (fm && fmGet(fm, "archived") && list.name !== archName) await this.moveHabitFile(f, true);
    }
  }

  openRecorder(date) {
    new RecordModal(this.app, this, date || new Date()).open();
  }

  habitFilePath(name) {
    return normalizePath(`${this.settings.folder}/${this.settings.habitsDir || "list"}/${name}.md`);
  }
  async ensureHabitDir() {
    const { vault } = this.app;
    for (const p of [normalizePath(this.settings.folder), normalizePath(`${this.settings.folder}/${this.settings.habitsDir || "list"}`)]) {
      if (!vault.getAbstractFileByPath(p)) await vault.createFolder(p);
    }
  }

  // 묶음(group)이면 본 파일을 찾고, 없으면 만든다
  async mainFileOf(target, unit) {
    if (target instanceof TFile) return target;
    if (target.main) return target.main;
    const legacy = this.app.vault.getAbstractFileByPath(normalizePath(`${this.settings.folder}/${target.name}.md`));
    if (legacy instanceof TFile) return legacy;
    const path = this.habitFilePath(target.name);
    const existing = this.app.vault.getAbstractFileByPath(path);
    if (existing instanceof TFile) return existing;
    await this.ensureHabitDir();
    const unitKey = fmKey("unit", this.keyStyle());
    target.main = await this.app.vault.create(path, unit ? `---\n${unitKey}: ${unitForKey(unit, unitKey)}\n---\n` : "");
    return target.main;
  }

  askValue(target, ds, cur, unit, fallback) {
    const u = unit === true ? UNIT_HOURS : unit;
    const name = target instanceof TFile ? target.basename : target.name;
    const [, m, d] = ds.split("-").map(Number);
    new NumberModal(this.app, {
      title: tr("{0} · {1}월 {2}일", name, m, d), desc: u === UNIT_HOURS ? tr("이날 한 시간을 적어 주세요.") : tr("이날 한 양을 적어 주세요."),
      value: cur || fallback || 0, unit: u, allowClear: cur > 0,
      onSubmit: async (v) => this.recordValue(this.habitOf(target, u), ds, v),
    }).open();
  }

  async setValue(file, ds, v, unit) {
    await this.app.vault.process(file, (text) => {
      const lines = text.split("\n").filter((l) => { const m = l.match(DONE_RE); return !(m && m[1] === ds); });
      while (lines.length && lines[lines.length - 1].trim() === "") lines.pop();
      if (v > 0) lines.push(`- [x] ${ds} ${writeQty(v, unit)}`);
      return lines.join("\n") + "\n";
    });
  }

  // 색 고르기: 맥의 기본(네이티브) 메뉴에는 동그라미를 못 넣어서 직접 그린 작은 창을 쓴다
  openColorMenu(evt, target, unit, current) {
    const apply = async (color) => {
      const file = await this.mainFileOf(target, unit || null);
      await this.app.fileManager.processFrontMatter(file, (fm) => {
        if (color) fmSet(fm, "color", color, this.keyStyle()); else fmDel(fm, "color");
      });
    };
    const cur = (current || "").toLowerCase();
    activeDocument.querySelectorAll(".hg-pop").forEach((n) => n.remove());
    const pop = activeDocument.body.createDiv({ cls: "hg-pop" });
    const close = () => {
      pop.remove();
      activeDocument.removeEventListener("mousedown", onDoc, true);
      activeDocument.removeEventListener("keydown", onKey, true);
    };
    const onDoc = (e) => { if (!pop.contains(e.target)) close(); };
    const onKey = (e) => { if (e.key === "Escape") close(); };
    const row = (label, bg, active, fn) => {
      const r = pop.createDiv({ cls: "hg-pop-row" + (active ? " is-on" : "") });
      const sw = r.createSpan({ cls: "hg-pop-sw" });
      sw.style.background = bg;
      r.createSpan({ cls: "hg-pop-name", text: label });
      if (active) r.createSpan({ cls: "hg-pop-check", text: "✓" });
      r.addEventListener("click", () => { close(); fn(); });
      return r;
    };
    row(tr("기본 색"), "var(--interactive-accent)", !cur, () => apply(""));
    pop.createDiv({ cls: "hg-pop-sep" });
    for (const [name, hex] of PRESET_COLORS) row(tr(name), hex, cur === hex.toLowerCase(), () => apply(hex));
    pop.createDiv({ cls: "hg-pop-sep" });
    row(tr("직접 고르기…"), "conic-gradient(#ef4444, #eab308, #2fb67c, #3b82f6, #7c5cff, #ef4444)", false, () => {
      const input = activeDocument.body.createEl("input", { type: "color", cls: "hg-hidden-color" });
      input.addEventListener("change", () => { apply(input.value); input.remove(); });
      input.addEventListener("blur", () => setTimeout(() => input.remove(), 500));
      input.click();
    });
    // 누른 자리 근처에, 화면 밖으로 안 나가게
    const x = (evt && evt.clientX) || 80, y = (evt && evt.clientY) || 80;
    const w = pop.offsetWidth || 190, h = pop.offsetHeight || 340;
    pop.style.left = `${Math.max(8, Math.min(x, activeWindow.innerWidth - w - 8))}px`;
    pop.style.top = `${Math.max(8, Math.min(y + 8, activeWindow.innerHeight - h - 8))}px`;
    setTimeout(() => {
      activeDocument.addEventListener("mousedown", onDoc, true);
      activeDocument.addEventListener("keydown", onKey, true);
    }, 0);
  }

  openGoals(h, year) {
    new GoalsModal(this.app, {
      name: h.name, unit: h.unit, year, measure: h.kind === "measure",
      explicit: h.kind === "measure" ? h.explicit : {}, inferred: h.kind === "measure" ? h.inferred : {}, freqs: h.freqsRaw, days: h.days,
      onSave: async (work, fwork, dwork) => {
        const file = await this.mainFileOf(h.target, h.kind === "measure" ? h.unit : null);
        await this.app.fileManager.processFrontMatter(file, (fm) => {
          const style = this.keyStyle();
          const sortObj = (o) => { const r = {}; for (const k of Object.keys(o).sort()) r[k] = o[k]; return r; };
          if (h.kind === "measure") {
            if (Object.keys(work).length) fmSet(fm, "monthGoals", sortObj(work), style); else fmDel(fm, "monthGoals");
            if (!fmGet(fm, "unit")) fmSetUnit(fm, h.unit, style);
          }
          for (const k of Object.keys(dwork)) if (!dwork[k].length) delete dwork[k];
          if (Object.keys(dwork).length) fmSet(fm, "weekdays", sortObj(dwork), style); else fmDel(fm, "weekdays");
          if (Object.keys(fwork).length) fmSet(fm, "weeklyTimes", sortObj(fwork), style); else fmDel(fm, "weeklyTimes");
          fmDel(fm, "goal");
        });
        new Notice(tr("{0} 목표를 저장했어요", h.name));
      },
    }).open();
  }

  askMonthGoal(target, key, cur, unit) {
    const u = unit === true ? UNIT_HOURS : unit;
    const name = target instanceof TFile ? target.basename : target.name;
    const [y, m] = key.split("-").map(Number);
    new NumberModal(this.app, {
      title: tr("{0} · {1}년 {2}월 목표", name, y, m), desc: tr("하루에 몇 {0} 하면 달성으로 볼까요? 비워 두면 앞 달 목표를 이어서 써요.", unitLabel(u)),
      value: cur, unit: u, allowClear: true,
      onSubmit: async (v) => this.app.fileManager.processFrontMatter(await this.mainFileOf(target, u), (fm) => {
        const goals = Object.assign({}, fmGet(fm, "monthGoals") || {});
        if (v > 0) goals[key] = Math.round(v * 10000) / 10000; else delete goals[key];
        const sorted = {};
        for (const k of Object.keys(goals).sort()) sorted[k] = goals[k];
        fmSet(fm, "monthGoals", sorted, this.keyStyle());
      }),
    }).open();
  }

  newHabit() {
    new NewHabitModal(this.app, async ({ name, kind, unit, goal, freq, days, period }) => {
      const path = this.habitFilePath(name);
      if (this.app.vault.getAbstractFileByPath(path) || this.app.vault.getAbstractFileByPath(normalizePath(`${this.settings.folder}/${name}.md`))) { new Notice(tr("같은 이름의 습관이 이미 있어요")); return; }
      await this.ensureHabitDir();
      const key = monthKey(new Date());
      const style = this.keyStyle();
      const fm = [];
      if (kind === "measure") {
        fm.push(`${fmKey("unit", style)}: ${unitForKey(unit, fmKey("unit", style))}`);
        if (goal > 0) fm.push(`${fmKey("monthGoals", style)}:`, `  "${key}": ${Math.round(goal * 10000) / 10000}`);
      }
      if (days && days.length) fm.push(`${fmKey("weekdays", style)}:`, `  "${key}": [${WD_ORDER.filter((d) => days.includes(d)).join(", ")}]`);
      else if (freq > 0) fm.push(`${fmKey("weeklyTimes", style)}:`, `  "${key}": ${freq}`);
      if (period > 0) fm.push(`${fmKey("duration", style)}: ${period}`, `${fmKey("start", style)}: ${fmt(new Date())}`);
      await this.app.vault.create(path, fm.length ? `---\n${fm.join("\n")}\n---\n` : "");
      if (kind === "items") {
        // 미리 알림 제목이 '이름 + 내용'이면 내용이 항목으로 모이도록, 이름을 묶음 이름으로 등록
        const nfc = (x) => x.normalize("NFC");
        const list = this.settings.groupPrefixes || [];
        if (!list.map(nfc).includes(nfc(name))) { this.settings.groupPrefixes = [...list, name]; await this.saveSettings(); }
      }
      new Notice(kind === "measure" ? tr("'{0}' 습관을 만들었어요. 대시보드에서 칸을 눌러 기록하세요", name) : tr("'{0}' 습관을 만들었어요", name));
      this.app.workspace.trigger("habit-grid:refresh");
    }).open();
  }

  async dedupe(file) {
    try {
      await this.app.vault.process(file, (text) => dedupeText(text) ?? text);
    } catch (e) { console.error("habit-grid dedupe", e); }
  }

  openGoalMenu(evt, h, current) {
    const menu = new Menu();
    const set = async (goal) => this.app.fileManager.processFrontMatter(await this.mainFileOf(h.target, h.kind === "measure" ? h.unit : null), (fm) => {
      fmDel(fm, "goal");
      if (goal) fmSet(fm, "goal", goal, this.keyStyle());
    });
    menu.addItem((i) => i.setTitle(tr("매일")).setChecked(!current).onClick(() => set(0)));
    menu.addSeparator();
    for (let n = 1; n <= 6; n++) {
      menu.addItem((i) => i.setTitle(tr("주 {0}회", n)).setChecked(current === n).onClick(() => set(n)));
    }
    menu.showAtMouseEvent(evt);
  }

  async saveSettings() { await this.saveData(this.settings); }
}
