import { Modal } from "obsidian";
import type { App } from "obsidian";
import { DAY_NAMES, tr, unitLabel } from "../i18n";
import { addDays, toDate } from "../dates";
import { splitHM } from "../format";
import { UNIT_HOURS } from "../constants";

// 날짜 하나 고르는 창
export class DateModal extends Modal {
  private title: string; private desc?: string; private value?: string; private onSubmit: (ds: string) => void | Promise<void>;
  constructor(app: App, o: { title: string; desc?: string; value?: string; onSubmit: (ds: string) => void | Promise<void> }) {
    super(app);
    this.title = o.title; this.desc = o.desc; this.value = o.value; this.onSubmit = o.onSubmit;
  }
  onOpen() {
    const { contentEl } = this;
    this.titleEl.setText(this.title);
    if (this.desc) contentEl.createEl("p", { cls: "hg-modal-desc", text: this.desc });
    const input = contentEl.createEl("input", { type: "date", cls: "hg-modal-input hg-modal-date" });
    input.value = this.value || "";
    const submit = () => { if (!input.value) return; const v = input.value; this.close(); void this.onSubmit(v); };
    const btns = contentEl.createDiv({ cls: "hg-modal-btns" });
    btns.createEl("button", { text: tr("취소") }).addEventListener("click", () => this.close());
    btns.createEl("button", { cls: "mod-cta", text: tr("저장") }).addEventListener("click", submit);
    input.addEventListener("keydown", (e: KeyboardEvent) => { if (e.key === "Enter") submit(); });
    window.setTimeout(() => input.focus(), 50);
  }
  onClose() { this.contentEl.empty(); }
}

// 되돌릴 수 없는 변경 앞에서 한 번 더 확인
export class ConfirmModal extends Modal {
  private title: string; private desc: string | string[]; private okText?: string; private onOk: () => void | Promise<void>;
  constructor(app: App, o: { title: string; desc: string | string[]; okText?: string; onOk: () => void | Promise<void> }) {
    super(app);
    this.title = o.title; this.desc = o.desc; this.okText = o.okText; this.onOk = o.onOk;
  }
  onOpen() {
    const { contentEl } = this;
    this.titleEl.setText(this.title);
    for (const line of ([] as string[]).concat(this.desc)) contentEl.createEl("p", { cls: "hg-modal-desc", text: line });
    const btns = contentEl.createDiv({ cls: "hg-modal-btns" });
    btns.createEl("button", { text: tr("취소") }).addEventListener("click", () => this.close());
    const ok = btns.createEl("button", { cls: "mod-warning", text: this.okText || tr("확인") });
    ok.addEventListener("click", () => { this.close(); void this.onOk(); });
  }
  onClose() { this.contentEl.empty(); }
}

// 숫자 하나 입력받는 창
export class NumberModal extends Modal {
  private title: string; private desc?: string; private value?: number; private unit: string;
  private onSubmit: (v: number) => void | Promise<unknown>; private allowClear?: boolean;
  constructor(app: App, o: { title: string; desc?: string; value?: number; unit: string; onSubmit: (v: number) => void | Promise<unknown>; allowClear?: boolean }) {
    super(app);
    this.title = o.title; this.desc = o.desc; this.value = o.value; this.unit = o.unit; this.onSubmit = o.onSubmit; this.allowClear = o.allowClear;
  }
  onOpen() {
    const { contentEl } = this;
    this.titleEl.setText(this.title);
    if (this.desc) contentEl.createEl("p", { cls: "hg-modal-desc", text: this.desc });
    const row = contentEl.createDiv({ cls: "hg-modal-row" });
    let read: () => number, input: HTMLInputElement;
    if (this.unit === UNIT_HOURS) {
      const [H, M] = splitHM(this.value || 0);
      const hIn = row.createEl("input", { type: "number", attr: { min: "0", step: "1", inputmode: "numeric" } });
      hIn.addClass("hg-modal-input");
      row.createSpan({ cls: "hg-modal-unit", text: tr("시간") });
      const mIn = row.createEl("input", { type: "number", attr: { min: "0", max: "59", step: "5", inputmode: "numeric" } });
      mIn.addClass("hg-modal-input");
      row.createSpan({ cls: "hg-modal-unit", text: tr("분") });
      if (this.value) { hIn.value = String(H); mIn.value = String(M); }
      read = () => (parseInt(hIn.value, 10) || 0) + (parseInt(mIn.value, 10) || 0) / 60;
      input = hIn;
      mIn.addEventListener("keydown", (e: KeyboardEvent) => { if (e.key === "Enter") submit(); });
    } else {
      input = row.createEl("input", { type: "number", attr: { step: "0.5", min: "0", inputmode: "decimal" } });
      input.addClass("hg-modal-input");
      if (this.value) input.value = String(this.value);
      row.createSpan({ cls: "hg-modal-unit", text: unitLabel(this.unit) });
      read = () => parseFloat(input.value);
    }
    const btns = contentEl.createDiv({ cls: "hg-modal-btns" });
    const submit = () => { const v = read(); this.close(); void this.onSubmit(isNaN(v) ? 0 : v); };
    if (this.allowClear) btns.createEl("button", { text: tr("지우기") }).addEventListener("click", () => { this.close(); void this.onSubmit(0); });
    const ok = btns.createEl("button", { cls: "mod-cta", text: tr("저장") });
    ok.addEventListener("click", submit);
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") submit(); });
    window.setTimeout(() => input.focus(), 50);
  }
  onClose() { this.contentEl.empty(); }
}

// 챌린지 기간(총 며칠)과 시작일을 한 창에서 받는다
export class PeriodModal extends Modal {
  private title: string; private days: number; private start: string; private onSubmit: (days: number, ds: string) => void | Promise<void>;
  constructor(app: App, o: { title: string; days: number; start: string; onSubmit: (days: number, ds: string) => void | Promise<void> }) {
    super(app);
    this.title = o.title; this.days = o.days; this.start = o.start; this.onSubmit = o.onSubmit;
  }
  onOpen() {
    const { contentEl } = this;
    this.titleEl.setText(this.title);
    contentEl.createEl("p", { cls: "hg-modal-label", text: tr("총 며칠") });
    const row = contentEl.createDiv({ cls: "hg-modal-row" });
    const daysIn = row.createEl("input", { type: "number", attr: { min: "1", step: "1", inputmode: "numeric" } });
    daysIn.addClass("hg-modal-input");
    daysIn.value = String(this.days || 66);
    row.createSpan({ cls: "hg-modal-unit", text: tr("일") });
    contentEl.createEl("p", { cls: "hg-modal-label", text: tr("시작일") });
    const dateIn = contentEl.createEl("input", { type: "date", cls: "hg-modal-input hg-modal-date" });
    dateIn.value = this.start || "";
    // 며칠과 시작일을 바꿀 때마다 끝나는 날을 보여준다 (시작일을 첫날로 세서 시작일 + 며칠 - 1)
    const note = contentEl.createDiv({ cls: "hg-modal-note" });
    const update = () => {
      const d = Math.round(parseFloat(daysIn.value));
      if (!(d > 0) || !dateIn.value) { note.setText(""); return; }
      const end = addDays(toDate(dateIn.value), d - 1);
      note.setText(tr("{0}에 끝나요", `${end.getFullYear()}/${end.getMonth() + 1}/${end.getDate()} (${DAY_NAMES[end.getDay()]})`));
    };
    for (const el of [daysIn, dateIn]) { el.addEventListener("input", update); el.addEventListener("change", update); }
    update();
    const submit = () => {
      const d = Math.round(parseFloat(daysIn.value));
      if (!(d > 0) || !dateIn.value) return;
      const ds = dateIn.value;
      this.close();
      void this.onSubmit(d, ds);
    };
    const btns = contentEl.createDiv({ cls: "hg-modal-btns" });
    btns.createEl("button", { text: tr("취소") }).addEventListener("click", () => this.close());
    btns.createEl("button", { cls: "mod-cta", text: tr("저장") }).addEventListener("click", submit);
    for (const el of [daysIn, dateIn]) el.addEventListener("keydown", (e: KeyboardEvent) => { if (e.key === "Enter") submit(); });
    window.setTimeout(() => daysIn.focus(), 50);
  }
  onClose() { this.contentEl.empty(); }
}
