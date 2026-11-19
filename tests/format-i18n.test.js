import { test } from "node:test";
import assert from "node:assert/strict";
import { fmtDur, fmtDurShort, writeQty } from "../src/format";
import { resolveLang, setLang, tr } from "../src/i18n";

test("duration and quantity formatting", () => {
  setLang("ko");
  assert.equal(fmtDur(3.3833333), "3시간 23분");
  assert.equal(fmtDur(0), "0분");
  assert.equal(fmtDurShort(3.3833333), "3h23m");
  assert.equal(fmtDurShort(0.5), "30m");
  assert.equal(writeQty(1.5, "시간"), "1h30m");
  assert.equal(writeQty(2.5, "km"), "2.5");
  setLang("en");
  assert.equal(fmtDur(3.3833333), "3h 23m");
});

test("tr translates, fills placeholders and falls back to the key", () => {
  setLang("en");
  assert.equal(tr("이전 날"), "Previous day");
  assert.equal(tr("{0}월 {1}일 ({2})", 11, 20, "Fri"), "11/20 (Fri)");
  assert.equal(tr("{0}월", 11), "Nov");
  assert.equal(tr("번역이 없는 문구 {0}", 1), "번역이 없는 문구 1");
  setLang("ko");
  assert.equal(tr("{0}일", 3), "3일");
});

test("resolveLang follows the app language when set to auto", () => {
  assert.equal(resolveLang("ko"), "ko");
  assert.equal(resolveLang("en"), "en");
  globalThis.__locale = "ko";
  assert.equal(resolveLang("auto"), "ko");
  globalThis.__locale = "en-gb";
  assert.equal(resolveLang("auto"), "en");
  delete globalThis.__locale;
});
