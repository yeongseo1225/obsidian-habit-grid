import { Modal } from "obsidian";
import { splitItem } from "../parse";
import { tr } from "../i18n";

// 그 날 한 항목을 고르는 창. 항목마다 횟수나 양을 적을 수 있고, 하나도 안 골라도 그 날은 기록돼요
export class ItemsModal extends Modal {
  constructor(app, { title, known, lastAmount, locked, selected, hasRecord, onSubmit, onClear, onHide }) {
    super(app);
    Object.assign(this, { title, known, lastAmount, locked, selected, hasRecord, onSubmit, onClear, onHide });
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.addClass("hg-nh");
    this.titleEl.setText(this.title);
    contentEl.createEl("p", { cls: "hg-modal-desc", text: tr("이 날 한 것을 골라요. 고르지 않아도 기록돼요.") });
    // 미리 알림에서 온 항목은 지울 수 없어서 따로 보여 주고, 같은 이름은 고르는 목록에서 뺀다
    const lockedNames = new Set(this.locked.map((t) => splitItem(t).name));
    const on = new Map(this.selected.map((s) => [s.name, s.amount]));
    const names = [...new Set([...this.known, ...on.keys()])].filter((n) => !lockedNames.has(n));
    const box = contentEl.createDiv({ cls: "hg-items-pick" });
    const draw = () => {
      box.empty();
      for (const t of this.locked) {
        const row = box.createDiv({ cls: "hg-items-row" });
        const chip = row.createEl("button", { cls: "hg-nh-chip is-on is-disabled", text: t });
        chip.setAttr("aria-label", tr("미리 알림에서 온 항목은 여기서 지울 수 없어요."));
      }
      for (const name of names) {
        const row = box.createDiv({ cls: "hg-items-row" });
        const chip = row.createEl("button", { cls: "hg-nh-chip" + (on.has(name) ? " is-on" : ""), text: name });
        chip.addEventListener("click", () => {
          if (on.has(name)) on.delete(name); else on.set(name, "");
          draw();
        });
        if (!on.has(name) && this.onHide) {
          const x = row.createEl("button", { cls: "hg-items-x", text: "×" });
          x.setAttr("aria-label", tr("추천 목록에서 빼기"));
          x.addEventListener("click", () => this.onHide(name, () => { names.splice(names.indexOf(name), 1); draw(); }));
        }
        if (on.has(name)) {
          const amt = row.createEl("input", { type: "text", cls: "hg-modal-input hg-items-amt", attr: { placeholder: this.lastAmount.get(name) || tr("예: 30회") } });
          amt.value = on.get(name);
          amt.addEventListener("input", () => on.set(name, amt.value));
        }
      }
    };
    draw();
    const row = contentEl.createDiv({ cls: "hg-modal-row" });
    const input = row.createEl("input", { type: "text", cls: "hg-modal-input", attr: { placeholder: tr("예: 스쿼트") } });
    const add = () => {
      const v = input.value.trim().replace(/[,，、]/g, " ");
      if (!v) return;
      if (!names.includes(v) && !lockedNames.has(v)) names.push(v);
      if (!lockedNames.has(v) && !on.has(v)) on.set(v, "");
      input.value = "";
      draw();
    };
    row.createEl("button", { text: tr("추가") }).addEventListener("click", add);
    const submit = () => {
      add();
      const items = [...on].map(([n, a]) => {
        const amount = a.trim().replace(/[,，、]/g, " ");
        return amount ? `${n} ${amount}` : n;
      });
      this.close();
      this.onSubmit(items);
    };
    // 한글을 입력하는 중(조합 중)에 누른 Enter는 글자를 확정하는 키라서 무시한다
    input.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" || e.isComposing || e.keyCode === 229) return;
      e.preventDefault();
      if (input.value.trim()) add(); else submit();
    });
    const btns = contentEl.createDiv({ cls: "hg-modal-btns" });
    if (this.hasRecord) btns.createEl("button", { cls: "mod-warning", text: tr("이날 기록 지우기") }).addEventListener("click", () => { this.close(); this.onClear(); });
    btns.createEl("button", { text: tr("취소") }).addEventListener("click", () => this.close());
    btns.createEl("button", { cls: "mod-cta", text: tr("저장") }).addEventListener("click", submit);
    window.setTimeout(() => input.focus(), 50);
  }
  onClose() { this.contentEl.empty(); }
}
