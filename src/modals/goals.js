import { Modal } from "obsidian";
import { WD_ORDER } from "../constants";
import { DAY_NAMES, tr, unitLabel } from "../i18n";
import { monthKey, pad } from "../dates";
import { daysLabel, fmtNum, splitHM } from "../format";
import { goalForMonth, scheduleAt } from "../stats";

// 달별 목표를 한 번에 정하는 창 (지난달·다음 달 모두)
export class GoalsModal extends Modal {
  constructor(app, { name, unit, year, explicit, inferred, freqs, days, measure, onSave }) {
    super(app);
    Object.assign(this, { name, unit, year, onSave });
    this.measure = measure !== false;
    this.inferred = inferred || {};
    this.work = {};
    for (const [k, v] of Object.entries(explicit || {})) this.work[String(k)] = Number(v);
    this.fwork = {};
    for (const [k, v] of Object.entries(freqs || {})) this.fwork[String(k)] = Number(v);
    this.dwork = {};
    for (const [k, v] of Object.entries(days || {})) this.dwork[String(k)] = [...v];
  }
  onOpen() {
    this.titleEl.setText(tr("{0} · 달별 목표", this.name));
    this.modalEl.addClass("hg-goals-modal");
    this.draw();
  }
  draw() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("p", { cls: "hg-modal-desc", text: this.measure
      ? tr("하루 목표를 채운 날이 그 주에 몇 번 있으면 '달성한 주'인지도 정해요. 비워 둔 달은 앞 달 값을 이어서 써요.")
      : tr("그 달에는 일주일에 몇 번 하면 '달성한 주'인지 정해요. 비워 둔 달은 앞 달 값을 이어서 써요.") });

    const nav = contentEl.createDiv({ cls: "hg-yearnav hg-goals-nav" });
    const prev = nav.createEl("button", { cls: "hg-yearbtn", text: "‹" });
    nav.createSpan({ cls: "hg-year", text: `${this.year}` });
    const next = nav.createEl("button", { cls: "hg-yearbtn", text: "›" });
    prev.addEventListener("click", () => { this.year--; this.draw(); });
    next.addEventListener("click", () => { this.year++; this.draw(); });

    const today = new Date();
    const cur = monthKey(today);
    const grid = contentEl.createDiv({ cls: "hg-goals-grid" });
    for (let m = 1; m <= 12; m++) {
      const key = `${this.year}-${pad(m)}`;
      const cell = grid.createDiv({ cls: "hg-goals-cell" + (key === cur ? " is-current" : "") });
      cell.createDiv({ cls: "hg-goals-month", text: tr("{0}월", m) + (key === cur ? tr(" · 이번 달") : "") });
      const row = cell.createDiv({ cls: "hg-goals-inputrow" + (this.measure ? "" : " is-hidden") });
      if (this.measure) row.createSpan({ cls: "hg-goals-lab", text: tr("하루") });
      const merged = Object.assign({}, this.inferred, this.work);
      const effective = goalForMonth(merged, key);
      const own = this.work[key] != null;
      if (!own) cell.addClass("is-inherited");
      const save = (v) => {
        if (isNaN(v) || v <= 0) delete this.work[key]; else this.work[key] = Math.round(v * 10000) / 10000;
        this.draw();
      };
      if (this.unit === "시간") {
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
      // 주 몇 회
      const frow = cell.createDiv({ cls: "hg-goals-inputrow" });
      frow.createSpan({ cls: "hg-goals-lab", text: tr("주") });
      const sel = frow.createEl("select", { cls: "dropdown hg-goals-select" });
      const ownD = this.dwork[key] != null;
      const ownF = this.fwork[key] != null || ownD;
      const prevKeys = [...new Set([...Object.keys(this.fwork), ...Object.keys(this.dwork)])].filter((k) => k < key).sort();
      const prevSch = prevKeys.length ? scheduleAt(this.fwork, this.dwork, prevKeys[prevKeys.length - 1]) : null;
      const schLabel = (sc) => (!sc || (!sc.days && !sc.n)) ? tr("매일") : (sc.days ? daysLabel(sc.days) : tr("주 {0}회", sc.n));
      const inheritedF = !!prevSch && (prevSch.days || prevSch.n);
      const addOpt = (val, label) => { const o = sel.createEl("option", { text: label }); o.value = val; return o; };
      addOpt("", tr("이어서 ({0})", schLabel(prevSch)));
      addOpt("0", tr("매일"));
      for (let n = 1; n <= 6; n++) addOpt(String(n), tr("주 {0}회", n));
      addOpt("d", tr("요일 지정"));
      sel.value = ownD ? "d" : (this.fwork[key] != null ? String(this.fwork[key]) : "");
      if (!ownF) sel.addClass("is-inherited");
      sel.addEventListener("change", () => {
        if (sel.value === "") { delete this.fwork[key]; delete this.dwork[key]; }
        else if (sel.value === "d") { delete this.fwork[key]; this.dwork[key] = this.dwork[key] || (prevSch && prevSch.days ? [...prevSch.days] : []); }
        else { this.fwork[key] = Number(sel.value); delete this.dwork[key]; }
        this.draw();
      });
      if (ownD) {
        const drow = cell.createDiv({ cls: "hg-goals-days" });
        for (const d of WD_ORDER) {
          const on = this.dwork[key].includes(d);
          const b = drow.createEl("button", { cls: "hg-nh-chip hg-daychip" + (on ? " is-on" : ""), text: DAY_NAMES[d] });
          b.addEventListener("click", () => {
            const cur = this.dwork[key];
            this.dwork[key] = on ? cur.filter((x) => x !== d) : [...cur, d];
            this.draw();
          });
        }
      }
      const hint = cell.createDiv({ cls: "hg-goals-hint" });
      const parts = [];
      if (this.measure) {
        if (this.work[key] != null) parts.push(tr("하루: 직접"));
        else if (this.inferred[key] != null) parts.push(tr("하루: 미리 알림 이름에서"));
        else if (effective) parts.push(tr("하루: 앞 달 이어서"));
      }
      if (ownF) parts.push(tr("주: 직접"));
      else if (inheritedF) parts.push(tr("주: 앞 달 이어서"));
      hint.setText(parts.join(" · "));
    }

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
  onClose() { this.contentEl.empty(); }
}
