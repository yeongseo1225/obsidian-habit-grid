import { Modal } from "obsidian";
import { tr, unitLabel } from "../i18n";
import { splitHM } from "../format";
import { UNIT_HOURS } from "../constants";

// 날짜 하나 고르는 창
export class DateModal extends Modal {
  constructor(app, { title, desc, value, onSubmit }) {
    super(app);
    Object.assign(this, { title, desc, value, onSubmit });
  }
  onOpen() {
    const { contentEl } = this;
    this.titleEl.setText(this.title);
    if (this.desc) contentEl.createEl("p", { cls: "hg-modal-desc", text: this.desc });
    const input = contentEl.createEl("input", { type: "date", cls: "hg-modal-input hg-modal-date" });
    input.value = this.value || "";
    const submit = () => { if (!input.value) return; const v = input.value; this.close(); this.onSubmit(v); };
    const btns = contentEl.createDiv({ cls: "hg-modal-btns" });
    btns.createEl("button", { text: tr("취소") }).addEventListener("click", () => this.close());
    btns.createEl("button", { cls: "mod-cta", text: tr("저장") }).addEventListener("click", submit);
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") submit(); });
    window.setTimeout(() => input.focus(), 50);
  }
  onClose() { this.contentEl.empty(); }
}

// 되돌릴 수 없는 변경 앞에서 한 번 더 확인
export class ConfirmModal extends Modal {
  constructor(app, { title, desc, okText, onOk }) {
    super(app);
    Object.assign(this, { title, desc, okText, onOk });
  }
  onOpen() {
    const { contentEl } = this;
    this.titleEl.setText(this.title);
    for (const line of [].concat(this.desc)) contentEl.createEl("p", { cls: "hg-modal-desc", text: line });
    const btns = contentEl.createDiv({ cls: "hg-modal-btns" });
    btns.createEl("button", { text: tr("취소") }).addEventListener("click", () => this.close());
    const ok = btns.createEl("button", { cls: "mod-warning", text: this.okText || tr("확인") });
    ok.addEventListener("click", () => { this.close(); this.onOk(); });
  }
  onClose() { this.contentEl.empty(); }
}

// 숫자 하나 입력받는 창
export class NumberModal extends Modal {
  constructor(app, { title, desc, value, unit, onSubmit, allowClear }) {
    super(app);
    Object.assign(this, { title, desc, value, unit, onSubmit, allowClear });
  }
  onOpen() {
    const { contentEl } = this;
    this.titleEl.setText(this.title);
    if (this.desc) contentEl.createEl("p", { cls: "hg-modal-desc", text: this.desc });
    const row = contentEl.createDiv({ cls: "hg-modal-row" });
    let read, input;
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
      mIn.addEventListener("keydown", (e) => { if (e.key === "Enter") submit(); });
    } else {
      input = row.createEl("input", { type: "number", attr: { step: "0.5", min: "0", inputmode: "decimal" } });
      input.addClass("hg-modal-input");
      if (this.value) input.value = String(this.value);
      row.createSpan({ cls: "hg-modal-unit", text: unitLabel(this.unit) });
      read = () => parseFloat(input.value);
    }
    const btns = contentEl.createDiv({ cls: "hg-modal-btns" });
    const submit = () => { const v = read(); this.close(); this.onSubmit(isNaN(v) ? 0 : v); };
    if (this.allowClear) btns.createEl("button", { text: tr("지우기") }).addEventListener("click", () => { this.close(); this.onSubmit(0); });
    const ok = btns.createEl("button", { cls: "mod-cta", text: tr("저장") });
    ok.addEventListener("click", submit);
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") submit(); });
    window.setTimeout(() => input.focus(), 50);
  }
  onClose() { this.contentEl.empty(); }
}
