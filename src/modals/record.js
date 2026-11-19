import { normalizePath, Notice, Modal } from "obsidian";
import { DAY_NAMES, tr, unitLabel } from "../i18n";
import { addDays, fmt, toDate } from "../dates";
import { fmtDur, fmtNum, splitHM } from "../format";
import { goalForMonth } from "../stats";

// 날짜를 골라 여러 습관을 한 번에 기록하는 창
export class RecordModal extends Modal {
  constructor(app, plugin, date) {
    super(app);
    this.plugin = plugin;
    this.date = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }
  onOpen() {
    this.titleEl.setText(tr("습관 기록하기"));
    this.modalEl.addClass("hg-record-modal");
    this.draw();
  }
  async draw() {
    const { contentEl } = this;
    const habits = ((await this.plugin.loadHabits(normalizePath(this.plugin.settings.folder))) || []).filter((h) => !h.archived);
    const ds = fmt(this.date);
    const today = new Date();
    contentEl.empty();

    // 날짜 고르기
    const dates = contentEl.createDiv({ cls: "hg-rdates" });
    const quick = [[tr("오늘"), 0], [tr("어제"), -1], [tr("그제"), -2]];
    for (const [label, off] of quick) {
      const d = addDays(today, off);
      const b = dates.createEl("button", { text: label, cls: fmt(d) === ds ? "mod-cta" : "" });
      b.addEventListener("click", () => { this.date = d; this.draw(); });
    }
    const picker = dates.createEl("input", { type: "date" });
    picker.value = ds;
    picker.max = fmt(today);
    picker.addEventListener("change", () => { if (picker.value) { this.date = toDate(picker.value); this.draw(); } });
    contentEl.createDiv({ cls: "hg-rdate", text: tr("{0}년 {1}월 {2}일 ({3})", this.date.getFullYear(), this.date.getMonth() + 1, this.date.getDate(), DAY_NAMES[this.date.getDay()]) });

    if (!habits.length) { contentEl.createDiv({ cls: "hg-empty", text: tr("아직 습관이 없어요.") }); return; }

    // 습관 목록
    const changes = new Map();
    const list = contentEl.createDiv({ cls: "hg-rlist" });
    for (const h of habits) {
      const row = list.createDiv({ cls: "hg-rrow" });
      if (h.color) row.style.setProperty("--hg-on", h.color);
      row.createSpan({ cls: "hg-dot is-done" });
      row.createSpan({ cls: "hg-rname", text: h.name });
      if (h.kind === "check") {
        const cb = row.createEl("input", { type: "checkbox" });
        cb.checked = h.set.has(ds);
        cb.addEventListener("change", () => changes.set(h, cb.checked));
      } else {
        const g = goalForMonth(h.monthGoals, ds.slice(0, 7));
        const v = h.entries.get(ds) || 0;
        if (h.unit === "시간") {
          const [H, M] = splitHM(v);
          const hIn = row.createEl("input", { type: "number", attr: { min: "0", step: "1", inputmode: "numeric" } });
          hIn.addClass("hg-rnum");
          row.createSpan({ cls: "hg-modal-unit", text: tr("시간") });
          const mIn = row.createEl("input", { type: "number", attr: { min: "0", max: "59", step: "5", inputmode: "numeric" } });
          mIn.addClass("hg-rnum");
          row.createSpan({ cls: "hg-modal-unit", text: tr("분{0}", g ? tr(" (목표 {0})", fmtDur(g)) : "") });
          if (v) { hIn.value = String(H); mIn.value = String(M); }
          hIn.placeholder = "0"; mIn.placeholder = "0";
          const upd = () => changes.set(h, (parseInt(hIn.value, 10) || 0) + (parseInt(mIn.value, 10) || 0) / 60);
          hIn.addEventListener("input", upd); mIn.addEventListener("input", upd);
        } else {
          const input = row.createEl("input", { type: "number", attr: { step: "0.5", min: "0", inputmode: "decimal" } });
          input.addClass("hg-rnum");
          if (v) input.value = String(v);
          input.placeholder = "0";
          input.addEventListener("input", () => changes.set(h, parseFloat(input.value) || 0));
          row.createSpan({ cls: "hg-modal-unit", text: `${unitLabel(h.unit)}${g ? tr(" (목표 {0})", fmtNum(g)) : ""}` });
        }
      }
    }

    const btns = contentEl.createDiv({ cls: "hg-modal-btns" });
    btns.createEl("button", { text: tr("닫기") }).addEventListener("click", () => this.close());
    const ok = btns.createEl("button", { cls: "mod-cta", text: tr("저장") });
    ok.addEventListener("click", async () => {
      for (const [h, val] of changes) {
        if (h.kind === "check") { if (val !== h.set.has(ds)) await this.plugin.recordCheck(h, ds, val); }
        else if (Math.abs(val - (h.entries.get(ds) || 0)) > 0.001) await this.plugin.recordValue(h, ds, val);
      }
      new Notice(tr("{0}월 {1}일 기록을 저장했어요", this.date.getMonth() + 1, this.date.getDate()));
      this.close();
    });
  }
  onClose() { this.contentEl.empty(); }
}
