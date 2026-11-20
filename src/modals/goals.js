import { Modal } from "obsidian";
import { UNIT_HOURS, WD_ORDER } from "../constants";
import { DAY_NAMES, tr, unitLabel } from "../i18n";
import { monthKey, pad } from "../dates";
import { daysLabel, fmtNum, fmtQty, splitHM } from "../format";
import { goalForMonth, scheduleAt } from "../stats";
import { iconifyNav } from "../ui";

// 달별 목표를 정하는 창: 12개 달을 타일로 보여 주고, 누른 달의 목표를 아래에서 고친다
export class GoalsModal extends Modal {
  constructor(app, { name, unit, year, explicit, inferred, freqs, days, measure, color, onSave }) {
    super(app);
    Object.assign(this, { name, unit, year, color, onSave });
    this.measure = measure !== false;
    this.inferred = inferred || {};
    this.work = {};
    for (const [k, v] of Object.entries(explicit || {})) this.work[String(k)] = Number(v);
    this.fwork = {};
    for (const [k, v] of Object.entries(freqs || {})) this.fwork[String(k)] = Number(v);
    this.dwork = {};
    for (const [k, v] of Object.entries(days || {})) this.dwork[String(k)] = [...v];
    this.sel = null;
  }
  onOpen() {
    this.titleEl.setText(tr("{0} · 달별 목표", this.name));
    this.modalEl.addClass("hg-goals-modal");
    if (this.color) this.modalEl.style.setProperty("--hg-on", this.color);
    const cur = monthKey(new Date());
    if (cur.startsWith(`${this.year}-`)) this.sel = cur;
    this.draw();
  }
  // 그 달에 적용되는 방식을 글로: 매일 / 주 N회 / 요일
  scheduleText(key) {
    const sc = scheduleAt(this.fwork, this.dwork, key);
    if (!sc || (!sc.days && !sc.n)) return tr("매일");
    return sc.days ? daysLabel(sc.days) : tr("주 {0}회", sc.n);
  }
  hasEarlier(key) {
    const keys = [...Object.keys(this.fwork), ...Object.keys(this.dwork), ...Object.keys(this.work), ...Object.keys(this.inferred)];
    return keys.some((k) => k < key);
  }
  draw() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("p", { cls: "hg-modal-desc", text: tr("눌러서 그 달의 목표를 정해요. 정하지 않은 달은 앞 달 값을 이어서 써요.") });

    const nav = contentEl.createDiv({ cls: "hg-yearnav hg-goals-nav" });
    const prev = nav.createEl("button", { cls: "hg-yearbtn", text: "‹" });
    nav.createSpan({ cls: "hg-year", text: `${this.year}` });
    const next = nav.createEl("button", { cls: "hg-yearbtn", text: "›" });
    prev.addEventListener("click", () => { this.year--; this.sel = null; this.draw(); });
    next.addEventListener("click", () => { this.year++; this.sel = null; this.draw(); });

    const cur = monthKey(new Date());
    const merged = Object.assign({}, this.inferred, this.work);
    const grid = contentEl.createDiv({ cls: "hg-gt-grid" });
    for (let m = 1; m <= 12; m++) {
      const key = `${this.year}-${pad(m)}`;
      const own = this.fwork[key] != null || this.dwork[key] != null || this.work[key] != null;
      const tile = grid.createEl("button", { cls: "hg-gt" + (own ? " is-set" : "") + (key === this.sel ? " is-sel" : "") + (key === cur ? " is-now" : "") });
      tile.createDiv({ cls: "hg-gt-m", text: tr("{0}월", m) + (key === cur ? tr(" · 이번 달") : "") });
      tile.createDiv({ cls: "hg-gt-v", text: this.scheduleText(key) });
      const goal = this.measure ? goalForMonth(merged, key) : 0;
      if (goal) tile.createDiv({ cls: "hg-gt-g", text: fmtQty(goal, this.unit) });
      tile.createDiv({ cls: "hg-gt-s", text: own ? tr("직접 정함") : this.hasEarlier(key) ? tr("앞 달과 같음") : tr("기본값") });
      tile.addEventListener("click", () => { this.sel = key === this.sel ? null : key; this.draw(); });
    }
    if (this.sel) this.drawPanel(contentEl, this.sel, merged);
    iconifyNav(contentEl);

    const btns = contentEl.createDiv({ cls: "hg-modal-btns" });
    btns.createEl("button", { text: tr("취소") }).addEventListener("click", () => this.close());
    const ok = btns.createEl("button", { cls: "mod-cta", text: tr("저장") });
    ok.addEventListener("click", () => {
      const active = contentEl.querySelector("input:focus");
      if (active) active.blur();
      this.close();
      this.onSave(this.work, this.fwork, this.dwork);
    });
  }
  // 누른 달을 고치는 곳: 주 몇 회 또는 요일, 하루 목표
  drawPanel(parent, key, merged) {
    const panel = parent.createDiv({ cls: "hg-gt-panel" });
    const [sy, sm] = key.split("-").map(Number);
    panel.createDiv({ cls: "hg-gt-ptitle", text: tr("{0}년 {1}월", sy, sm) });

    panel.createDiv({ cls: "hg-gt-lab", text: tr("주 횟수") });
    const ownD = this.dwork[key] != null;
    const ownF = this.fwork[key] != null || ownD;
    const prevKeys = [...new Set([...Object.keys(this.fwork), ...Object.keys(this.dwork)])].filter((k) => k < key).sort();
    const prevSch = prevKeys.length ? scheduleAt(this.fwork, this.dwork, prevKeys[prevKeys.length - 1]) : null;
    const prevText = (!prevSch || (!prevSch.days && !prevSch.n)) ? tr("매일") : (prevSch.days ? daysLabel(prevSch.days) : tr("주 {0}회", prevSch.n));
    const chips = panel.createDiv({ cls: "hg-nh-chips" });
    const chip = (label, on, fn) => {
      const c = chips.createEl("button", { cls: "hg-nh-chip" + (on ? " is-on" : ""), text: label });
      c.addEventListener("click", fn);
    };
    chip(tr("이어서 ({0})", prevText), !ownF, () => { delete this.fwork[key]; delete this.dwork[key]; this.draw(); });
    chip(tr("매일"), this.fwork[key] === 0 && !ownD, () => { this.fwork[key] = 0; delete this.dwork[key]; this.draw(); });
    for (let n = 1; n <= 6; n++) chip(tr("주 {0}회", n), this.fwork[key] === n && !ownD, () => { this.fwork[key] = n; delete this.dwork[key]; this.draw(); });
    chip(tr("요일 지정"), ownD, () => { delete this.fwork[key]; this.dwork[key] = this.dwork[key] || (prevSch && prevSch.days ? [...prevSch.days] : []); this.draw(); });
    if (ownD) {
      const drow = panel.createDiv({ cls: "hg-goals-days" });
      for (const d of WD_ORDER) {
        const on = this.dwork[key].includes(d);
        const b = drow.createEl("button", { cls: "hg-nh-chip hg-daychip" + (on ? " is-on" : ""), text: DAY_NAMES[d] });
        b.addEventListener("click", () => {
          const list = this.dwork[key];
          this.dwork[key] = on ? list.filter((x) => x !== d) : [...list, d];
          this.draw();
        });
      }
    }

    if (this.measure) {
      panel.createDiv({ cls: "hg-gt-lab", text: tr("하루 목표") });
      const row = panel.createDiv({ cls: "hg-gt-inputs" });
      const effective = goalForMonth(merged, key);
      const own = this.work[key] != null;
      const save = (v) => {
        if (isNaN(v) || v <= 0) delete this.work[key]; else this.work[key] = Math.round(v * 10000) / 10000;
        this.draw();
      };
      if (this.unit === UNIT_HOURS) {
        const [eh, em] = splitHM(own ? this.work[key] : effective);
        const hIn = row.createEl("input", { type: "number", attr: { min: "0", step: "1", inputmode: "numeric" } });
        row.createSpan({ cls: "hg-modal-unit", text: tr("시간") });
        const mIn = row.createEl("input", { type: "number", attr: { min: "0", max: "59", step: "5", inputmode: "numeric" } });
        row.createSpan({ cls: "hg-modal-unit", text: tr("분") });
        if (own) { hIn.value = String(eh); mIn.value = String(em); }
        else if (effective) { hIn.placeholder = String(eh); mIn.placeholder = String(em); }
        else { hIn.placeholder = "—"; mIn.placeholder = ""; }
        const onChange = () => {
          if (hIn.value === "" && mIn.value === "") return save(NaN);
          save((parseInt(hIn.value, 10) || 0) + (parseInt(mIn.value, 10) || 0) / 60);
        };
        hIn.addEventListener("change", onChange);
        mIn.addEventListener("change", onChange);
      } else {
        const input = row.createEl("input", { type: "number", attr: { step: "0.5", min: "0", inputmode: "decimal" } });
        if (own) input.value = String(this.work[key]);
        else input.placeholder = effective ? fmtNum(effective) : "—";
        row.createSpan({ cls: "hg-modal-unit", text: unitLabel(this.unit) });
        input.addEventListener("change", () => save(parseFloat(input.value)));
      }
    }

    const reset = panel.createEl("button", { cls: "hg-gt-reset", text: tr("앞 달 값 쓰기") });
    reset.addEventListener("click", () => { delete this.fwork[key]; delete this.dwork[key]; delete this.work[key]; this.draw(); });
  }
  onClose() { this.contentEl.empty(); }
}
