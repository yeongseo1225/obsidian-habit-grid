import { DONE_RE, SKIP_RE } from "./constants";
import { writeQty } from "./format";
import { convertAmount, itemsLine, parseEntries, parseItemLines, parseTitle } from "./parse";

// 로그에서 새로 들어온 줄(날짜 + 미리 알림 제목)을 습관별·날짜별 기록으로 정리한다.
// prefixes: 항목 기록이 켜진 습관 이름들 (그 이름으로 시작하는 제목은 그 습관의 항목)
export function planImport(entries, prefixes) {
  const plan = new Map();
  const habit = (name) => {
    if (!plan.has(name)) plan.set(name, { name, unit: undefined, days: new Map() });
    return plan.get(name);
  };
  const day = (h, ds) => {
    if (!h.days.has(ds)) h.days.set(ds, { amount: 0, items: [] });
    return h.days.get(ds);
  };
  const sorted = [...prefixes].sort((a, b) => b.length - a.length);
  for (const { ds, title } of entries) {
    const p = sorted.find((x) => title === x || (title.startsWith(x) && /[\s·]/.test(title[x.length])));
    if (p) {
      const rest = title.slice(p.length).replace(/^[\s·]+/, "");
      const d = day(habit(p), ds);
      // "운동 1h"처럼 이름 뒤에 양만 오면 항목이 아니라서, 그 날을 한 날로만 센다
      const amountOnly = rest && (parseTitle(`${p} ${rest}`) || {}).base === p;
      if (rest && !amountOnly && !d.items.includes(rest)) d.items.push(rest);
      continue;
    }
    const t = parseTitle(title);
    const h = habit(t ? t.base : title);
    const d = day(h, ds);
    if (t) {
      h.unit = h.unit || t.unit;
      d.amount = Math.max(d.amount, convertAmount(t.amount, t.unit, h.unit));
    }
  }
  return plan;
}

// 습관 파일 글에 날짜별 기록을 합친다. 이미 있는 날은 건드리지 않고, 사용자가 지운 날('- [ ] 날짜')은 다시 넣지 않는다.
// opts: { unit, isItems, amountUnit }  amountUnit은 plan의 단위(파일 단위로 바꿀 때 쓴다)
export function upsertDays(text, days, opts) {
  const lines = text.split("\n");
  while (lines.length && lines[lines.length - 1].trim() === "") lines.pop();
  for (const [ds, d] of days) {
    const idx = lines.findIndex((l) => { const m = l.match(DONE_RE) || l.match(SKIP_RE); return m && m[1] === ds; });
    if (idx >= 0 && !DONE_RE.test(lines[idx])) continue;
    if (opts.isItems) {
      if (idx < 0) lines.push(itemsLine(ds, d.items));
      else {
        const cur = parseItemLines(lines[idx]).get(ds) || [];
        lines[idx] = itemsLine(ds, [...cur, ...d.items.filter((x) => !cur.includes(x))]);
      }
    } else if (opts.unit) {
      const qty = convertAmount(d.amount, opts.amountUnit, opts.unit);
      if (!qty) { if (idx < 0) lines.push(`- [x] ${ds}`); continue; }
      const line = `- [x] ${ds} ${writeQty(qty, opts.unit)}`;
      if (idx < 0) lines.push(line);
      else if (qty > (parseEntries(lines[idx]).get(ds) || 0)) lines[idx] = line;
    } else if (idx < 0) lines.push(`- [x] ${ds}`);
  }
  return lines.join("\n") + "\n";
}

// 제목을 파일 이름으로 쓸 수 있게 다듬는다
export function safeFileName(name) {
  return name.replace(/[\\/:*?"<>|#^[\]]/g, " ").replace(/\s+/g, " ").trim().replace(/^\.+/, "").slice(0, 100);
}
