import { Notice, Modal } from "obsidian";
import { WD_ORDER } from "../constants";
import { DAY_NAMES, tr, unitLabel } from "../i18n";
import { addDays } from "../dates";
import { daysLabel, fmtNum } from "../format";

// 새 습관 만들기 창
export class NewHabitModal extends Modal {
  constructor(app, onSubmit) { super(app); this.onSubmit = onSubmit; }
  onOpen() {
    const { contentEl } = this;
    contentEl.addClass("hg-nh");
    this.titleEl.setText(tr("새 습관"));
    const S = { name: "", kind: "check", unit: "\uc2dc\uac04", customUnit: "", goalH: "", goalM: "", goalN: "", freq: 0, mode: "count", days: [], period: 0, customPeriod: false };
    const today = new Date();
    const md = (d) => `${d.getMonth() + 1}/${d.getDate()}`;
    const unitName = () => (S.unit === "직접" ? S.customUnit.trim() : S.unit);
    const goalValue = () => {
      const u = unitName();
      if (u === "시간") return (parseInt(S.goalH, 10) || 0) + (parseInt(S.goalM, 10) || 0) / 60;
      if (u === "분") return (parseInt(S.goalH, 10) || 0) * 60 + (parseInt(S.goalM, 10) || 0);
      return parseFloat(S.goalN) || 0;
    };
    const goalText = () => {
      const u = unitName(), v = goalValue();
      if (!v) return "";
      if (u === "시간" || u === "분") { const mins = u === "시간" ? Math.round(v * 60) : Math.round(v); const H = Math.floor(mins / 60), M = mins % 60; return [H ? tr("{0}시간", H) : "", M ? tr("{0}분", M) : ""].filter(Boolean).join(" "); }
      return `${fmtNum(v)}${u}`;
    };

    const lab = (parent, text, hint) => {
      const r = parent.createDiv({ cls: "hg-nh-label" });
      r.createSpan({ text });
      if (hint) r.createSpan({ cls: "hg-nh-hint", text: hint });
    };

    // 이름
    const nameBox = contentEl.createDiv({ cls: "hg-nh-sec" });
    lab(nameBox, tr("이름"));
    const nameIn = nameBox.createEl("input", { type: "text", cls: "hg-nh-input", attr: { placeholder: tr("예: 공부") } });
    nameIn.addEventListener("input", () => { S.name = nameIn.value.trim(); sum(); });
    setTimeout(() => nameIn.focus(), 50);

    const body = contentEl.createDiv({ cls: "hg-nh-body" });
    const sumBox = contentEl.createDiv({ cls: "hg-nh-sum" });
    const btns = contentEl.createDiv({ cls: "hg-modal-btns" });
    btns.createEl("button", { text: tr("취소") }).addEventListener("click", () => this.close());
    const ok = btns.createEl("button", { cls: "mod-cta", text: tr("만들기") });

    const sum = () => {
      sumBox.empty();
      sumBox.createDiv({ cls: "hg-nh-sumt", text: tr("이렇게 만들어져요") });
      const parts = [];
      if (S.kind === "measure") { const g = goalText(); parts.push(g ? tr("하루 {0}", g) : tr("{0} 기록", unitLabel(unitName()) || tr("단위"))); }
      else if (S.kind === "items") parts.push(tr("항목 기록"));
      else parts.push(tr("기본"));
      parts.push(S.mode === "days" && S.days.length && S.days.length < 7 ? daysLabel(S.days) : (S.mode === "count" && S.freq ? tr("주 {0}회", S.freq) : tr("매일")));
      if (S.period > 0 && S.kind !== "measure") parts.push(tr("{0}일 챌린지", S.period));
      const line = sumBox.createDiv({ cls: "hg-nh-sumline" });
      line.createEl("b", { text: S.name || tr("이름") });
      line.createSpan({ text: parts.join(" · ") });
    };

    const chip = (parent, text, on, fn, disabled) => {
      const c = parent.createEl("button", { cls: "hg-nh-chip" + (on ? " is-on" : "") + (disabled ? " is-disabled" : ""), text });
      if (!disabled) c.addEventListener("click", fn);
      return c;
    };
    const numIn = (parent, key, ph, w) => {
      const i = parent.createEl("input", { type: "number", cls: "hg-nh-num", attr: { min: "0", inputmode: "numeric", placeholder: ph || "" } });
      i.value = S[key] || "";
      if (w) i.style.width = w;
      i.addEventListener("input", () => { S[key] = i.value; sum(); });
      return i;
    };

    const draw = () => {
      body.empty();
      // 종류
      const ks = body.createDiv({ cls: "hg-nh-sec" });
      lab(ks, tr("종류"));
      const kinds = [
        ["check", tr("기본"), tr("했는지만 체크해요 · 예: 영양제 먹기")],
        ["measure", tr("양 기록"), tr("시간·쪽·km처럼 양을 적어요 · 예: 공부 2시간")],
        ["items", tr("항목 기록"), tr("이 습관 안에서 한 것을 하나씩 적어요 · 예: 운동 → 스쿼트, 플랭크")],
      ];
      for (const [k, t, sub] of kinds) {
        const card = ks.createDiv({ cls: "hg-nh-kind" + (S.kind === k ? " is-on" : "") });
        const head = card.createDiv({ cls: "hg-nh-khead" });
        head.createSpan({ cls: "hg-nh-radio" });
        head.createSpan({ cls: "hg-nh-ktitle", text: t });
        card.createDiv({ cls: "hg-nh-ksub", text: sub });
        head.addEventListener("click", () => { S.kind = k; draw(); });
        card.querySelector(".hg-nh-ksub").addEventListener("click", () => { S.kind = k; draw(); });
        if (k === "measure" && S.kind === "measure") {
          const ex = card.createDiv({ cls: "hg-nh-extra" });
          lab(ex, tr("단위"));
          const row = ex.createDiv({ cls: "hg-nh-chips" });
          for (const u of ["시간", "쪽", "km"]) chip(row, unitLabel(u), S.unit === u, () => { S.unit = u; draw(); });
          chip(row, tr("직접 입력 +"), S.unit === "직접", () => { S.unit = "직접"; draw(); });
          if (S.unit === "직접") {
            const ci = ex.createEl("input", { type: "text", cls: "hg-nh-input", attr: { placeholder: tr("예: 잔, 문제, 장") } });
            ci.value = S.customUnit;
            ci.addEventListener("input", () => { S.customUnit = ci.value; sum(); });
            setTimeout(() => ci.focus(), 30);
          }
          lab(ex, tr("하루 목표"), tr("비워도 돼요"));
          const g = ex.createDiv({ cls: "hg-nh-goal" });
          const u = unitName();
          if (u === "시간" || u === "분") {
            numIn(g, "goalH", "0", "64px"); g.createSpan({ text: tr("시간") });
            numIn(g, "goalM", "0", "64px"); g.createSpan({ text: tr("분") });
          } else {
            numIn(g, "goalN", "0", "84px"); g.createSpan({ text: u || "" });
          }
        }
      }
      // 얼마나 자주
      const fs = body.createDiv({ cls: "hg-nh-sec" });
      lab(fs, tr("얼마나 자주"), tr("달마다 바꿀 수 있어요"));
      const mr = fs.createDiv({ cls: "hg-nh-chips" });
      chip(mr, tr("주 횟수"), S.mode === "count", () => { S.mode = "count"; draw(); });
      chip(mr, tr("요일 지정"), S.mode === "days", () => { S.mode = "days"; draw(); });
      const fr = fs.createDiv({ cls: "hg-nh-chips" });
      if (S.mode === "count") {
        chip(fr, tr("매일"), S.freq === 0, () => { S.freq = 0; draw(); });
        for (let n = 1; n <= 6; n++) chip(fr, tr("주 {0}회", n), S.freq === n, () => { S.freq = n; draw(); });
      } else {
        for (const d of WD_ORDER) chip(fr, DAY_NAMES[d], S.days.includes(d), () => { S.days = S.days.includes(d) ? S.days.filter((x) => x !== d) : [...S.days, d]; draw(); });
        fs.createDiv({ cls: "hg-nh-note", text: tr("고른 요일 수만큼 하면 그 주는 달성이에요. 쉬는 날에 해도 기록은 남아요.") });
      }
      // 기간
      const ps = body.createDiv({ cls: "hg-nh-sec" });
      const noPeriod = S.kind === "measure";
      lab(ps, tr("기간"), noPeriod ? tr("양 기록은 아직 기간을 정할 수 없어요") : tr("정하면 챌린지가 돼요"));
      const pr = ps.createDiv({ cls: "hg-nh-chips" });
      chip(pr, tr("없음"), !noPeriod && S.period === 0 && !S.customPeriod, () => { S.period = 0; S.customPeriod = false; draw(); }, noPeriod);
      for (const n of [30, 66, 100]) chip(pr, tr("{0}일", n), !noPeriod && S.period === n && !S.customPeriod, () => { S.period = n; S.customPeriod = false; draw(); }, noPeriod);
      chip(pr, tr("직접 입력 +"), !noPeriod && S.customPeriod, () => { S.customPeriod = true; draw(); }, noPeriod);
      if (!noPeriod && S.customPeriod) {
        const r = ps.createDiv({ cls: "hg-nh-goal" });
        const i = r.createEl("input", { type: "number", cls: "hg-nh-num", attr: { min: "1", inputmode: "numeric", placeholder: tr("예: 21") } });
        i.addClass("hg-nh-num-wide");
        if (S.period) i.value = String(S.period);
        i.addEventListener("input", () => { S.period = parseInt(i.value, 10) || 0; sum(); });
        r.createSpan({ text: tr("일") });
        setTimeout(() => i.focus(), 30);
      }
      if (!noPeriod && S.period > 0) ps.createDiv({ cls: "hg-nh-note", text: tr("시작 오늘({0}) · 끝 {1} · 챌린지 카드로 보여요", md(today), md(addDays(today, S.period - 1))) });
      sum();
    };

    ok.addEventListener("click", () => {
      if (!S.name) { new Notice(tr("이름을 적어 주세요")); nameIn.focus(); return; }
      if (S.kind === "measure" && !unitName()) { new Notice(tr("단위를 적어 주세요")); return; }
      this.close();
      this.onSubmit({
        name: S.name, kind: S.kind,
        unit: S.kind === "measure" ? unitName() : "",
        goal: S.kind === "measure" ? goalValue() : 0,
        freq: S.mode === "count" ? S.freq : 0, days: S.mode === "days" && S.days.length > 0 && S.days.length < 7 ? S.days : [], period: S.kind === "measure" ? 0 : (S.period > 0 ? S.period : 0),
      });
    });
    draw();
  }
  onClose() { this.contentEl.empty(); }
}
