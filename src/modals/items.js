import { Modal } from "obsidian";
import { tr } from "../i18n";

// 그 날 한 항목을 고르는 창. 하나도 안 골라도 그 날은 기록돼요
export class ItemsModal extends Modal {
  constructor(app, { title, known, locked, selected, hasRecord, onSubmit, onClear }) {
    super(app);
    Object.assign(this, { title, known, locked, selected, hasRecord, onSubmit, onClear });
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.addClass("hg-nh");
    this.titleEl.setText(this.title);
    contentEl.createEl("p", { cls: "hg-modal-desc", text: tr("이 날 한 것을 골라요. 고르지 않아도 기록돼요.") });
    const on = new Set(this.selected);
    const names = [...new Set([...this.locked, ...this.known, ...this.selected])];
    const box = contentEl.createDiv({ cls: "hg-nh-chips hg-items-pick" });
    const draw = () => {
      box.empty();
      for (const name of names) {
        const locked = this.locked.includes(name);
        const chip = box.createEl("button", {
          cls: "hg-nh-chip" + (locked || on.has(name) ? " is-on" : "") + (locked ? " is-disabled" : ""),
          text: name,
        });
        if (locked) chip.setAttr("aria-label", tr("미리 알림에서 온 항목은 여기서 지울 수 없어요."));
        else chip.addEventListener("click", () => { if (on.has(name)) on.delete(name); else on.add(name); draw(); });
      }
    };
    draw();
    const row = contentEl.createDiv({ cls: "hg-modal-row" });
    const input = row.createEl("input", { type: "text", cls: "hg-modal-input", attr: { placeholder: tr("예: 스쿼트") } });
    const add = () => {
      const v = input.value.trim().replace(/[,，、]/g, " ");
      if (!v) return;
      if (!names.includes(v)) names.push(v);
      on.add(v);
      input.value = "";
      draw();
    };
    row.createEl("button", { text: tr("추가") }).addEventListener("click", add);
    const submit = () => {
      add();
      const items = names.filter((n) => on.has(n) && !this.locked.includes(n));
      this.close();
      this.onSubmit(items);
    };
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); if (input.value.trim()) add(); else submit(); } });
    const btns = contentEl.createDiv({ cls: "hg-modal-btns" });
    if (this.hasRecord) btns.createEl("button", { text: tr("지우기") }).addEventListener("click", () => { this.close(); this.onClear(); });
    btns.createEl("button", { text: tr("취소") }).addEventListener("click", () => this.close());
    btns.createEl("button", { cls: "mod-cta", text: tr("저장") }).addEventListener("click", submit);
    window.setTimeout(() => input.focus(), 50);
  }
  onClose() { this.contentEl.empty(); }
}
