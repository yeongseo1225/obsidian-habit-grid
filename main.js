/* Habit Grid — Habit 폴더의 "- [x] YYYY-MM-DD" 기록을 잔디 격자로 보여주는 플러그인 */
const obsidian = require("obsidian");
const { Plugin, PluginSettingTab, Setting, MarkdownRenderChild, TFile, TFolder, normalizePath, Notice, Menu, Modal } = obsidian;

const DEFAULT_SETTINGS = {
  folder: "Habits",
  lang: "ko",         // 화면 언어: "ko" | "en" | "auto"(옵시디언 언어 따라감)
  range: "year", // "year" = 연도별, "all" = 첫 기록부터 전부, "recent" = 최근 weeks주
  weeks: 20,
  color: "",
  weekStart: 1, // 0 = 일요일, 1 = 월요일
  gridMode: "year", // 메인 화면 격자: "year" = 1년씩, "half" = 6개월씩
  groupPrefixes: ["\uc6b4\ub3d9"],
  clickToToggle: true,
  dashboardName: "Habits Dashboard",
  logName: "\ubbf8\ub9ac \uc54c\ub9bc \uae30\ub85d",
  habitsDir: "list",   // 습관 파일(공부.md 등)이 들어가는 하위 폴더
  archiveDir: "archive", // 보관한 습관 파일이 옮겨지는 하위 폴더
  syncDir: "sync",   // 단축어가 쓰는 미리 알림 기록이 들어가는 하위 폴더
  initialized: false,
};

const DASHBOARD_TEMPLATE = `---
habit-dashboard: true
---

\`\`\`habit
\`\`\`
`;

const DONE_RE = /^\s*[-*]\s*\[[xX]\]\s*(\d{4}-\d{2}-\d{2})(.*)$/;
const DAY_NAMES = ["\uc77c", "\uc6d4", "\ud654", "\uc218", "\ubaa9", "\uae08", "\ud1a0"];
// ───────── 언어 (한국어 / English) ─────────
// 화면 문구는 한국어 문장을 그대로 키로 쓰고, 영어일 때만 아래 표에서 찾아 바꿔요. 표에 없으면 한국어 그대로 나와요.
let LANG = "ko";
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const KO_DAYS = ["일", "월", "화", "수", "목", "금", "토"];
const EN_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const EN = {
  "{0}월 {1}일 ({2})": "{0}/{1} ({2})",
  "이전 날": "Previous day",
  "다음 날": "Next day",
  "이 날 할 습관이 없어요": "Nothing scheduled for this day",
  "{0}월 · {1}": (m, d) => `${MON[m - 1]} · ${d}`,
  "주 횟수": "Times per week",
  "요일 지정": "Specific days",
  "고른 요일 수만큼 하면 그 주는 달성이에요. 쉬는 날에 해도 기록은 남아요.": "Hit as many days as you pick to complete the week. Logging on other days still counts as a record.",
  "동기화": "Sync",
  "단축어로 미리 알림 가져오기": "Import from Reminders with a shortcut",
  "단축어를 실행했어요. 끝나면 자동으로 반영돼요": "Shortcut started. The dashboard updates when it finishes",
  "동기화 단축어 이름": "Sync shortcut name",
  "적으면 대시보드에 동기화 버튼이 생겨요. 비워 두면 버튼이 없어요": "Enter a name to show a Sync button on the dashboard. Leave empty to hide it",
  "0분": "0m",
  "{0}시간": "{0}h",
  "{0}분": "{0}m",
  "{0}일 완료": "{0} days · complete",
  "{0}일 · 시작 전": "{0} days · not started",
  "{0}일 챌린지 · D-{1}": "{0}-day challenge · D-{1}",
  "기간 바꾸기": "Change duration",
  "진행": "Progress",
  "일": "d",
  "한 날": "Days done",
  "연속": "Streak",
  "달성률": "Completion",
  "시작 {0}": "Start {0}",
  "오늘 {0} · {1}일째": "Today {0} · day {1}",
  "끝 {0}": "End {0}",
  "{0}일 끝! {1}일 했어요 ({2}%)": "Challenge complete! {1} of {0} days ({2}%)",
  "+30일 더 하기": "Add 30 more days",
  "기간 없이 계속": "Keep going, no end date",
  "보관함으로": "Archive",
  "{0}월": (m) => MON[m - 1],
  "예정": "Upcoming",
  "완료": "Done",
  "기록 없음": "Not logged",
  "{0}일째 · {1}월 {2}일 ({3}) · {4}": "Day {0} · {1}/{2} ({3}) · {4}",
  "{0}월 · 주 {1}회": (m, n) => `${MON[m - 1]} · ${n}x/wk`,
  "매일": "Daily",
  "달별 목표 정하기": "Set monthly goals",
  "주": "wk",
  "연속 달성": "Weekly streak",
  "최장 달성": "Best weekly streak",
  "이번 주": "This week",
  "회": "times",
  "전체": "Total",
  "최장 연속": "Best streak",
  "이번 달": "This month",
  "이전 해": "Previous year",
  "다음 해": "Next year",
  "올해": "This year",
  "{0}년 {1}회": "{0} · {1} times",
  "이번 주 목표 달성": "Weekly goal reached",
  "{0}월 {1}일 ({2}) · {3}{4}": "{0}/{1} ({2}) · {3}{4}",
  "{0}월 · 하루 {1}": (m, g) => `${MON[m - 1]} · ${g}/day`,
  " · 주 {0}회": " · {0}x/wk",
  "목표 정하기": "Set goal",
  "오늘": "Today",
  "/{0}회": "/{0}",
  "이번 주 달성": "This week",
  "/{0}일": "/{0}d",
  "이번 달 달성": "This month",
  "이번 달 합계": "Month total",
  "{0}년 {1}": "{0}: {1}",
  " / 목표 {0}": " / goal {0}",
  "{0}월 {1}일 · {2}{3}": "{0}/{1} · {2}{3}",
  "펼치기": "Expand",
  "접기": "Collapse",
  "{0}년 달별 목표": "{0} monthly goals",
  "월": "Month",
  "하루 목표": "Daily goal",
  "주 목표": "Weekly goal",
  "달성": "Met",
  "달성 주": "Goal weeks",
  "합계": "Total",
  "앞 달 목표를 이어서 쓰는 중 · 눌러서 바꾸기": "Same as before · tap to change",
  "눌러서 목표 바꾸기": "Tap to set goal",
  "주 {0}회": "{0}x a week",
  "{0}/{1}일": "{0}/{1}d",
  "{0}/{1}주": "{0}/{1} wk",
  "{0}년 기록이 없어요.": "No records in {0}.",
  "이 주의 운동 기록": "This week's workouts",
  "지난주": "Last week",
  "{0}월 ": "{0}/",
  "{0}월 {1}일 – {2}{3}일": "{0}/{1} – {2}{3}",
  "다음 주": "Next week",
  "합계 {0}": "Total {0}",
  "{0}/7일": "{0}/7 days",
  "{0}월 {1}일": "{0}/{1}",
  "{0}/{1}회": "{0}/{1}",
  "연도": "Year",
  "이전 달": "Previous month",
  "{0}년 {1}월": (y, m) => `${MON[m - 1]} ${y}`,
  "다음 달": "Next month",
  "합계 {0} · 달성 {1}/{2}일": "Total {0} · {1} of {2} days met",
  " · {0}가지": " · {0} items",
  "이 날 적힌 내용이 없어요": "Nothing logged for this day",
  "날짜를 누르면 그날 한 것이 여기에 나와요": "Select a date to see what you did that day",
  "주 {0}회 목표": "Goal: {0}x a week",
  " {0}일": " {0}",
  "보라": "Purple",
  "파랑": "Blue",
  "청록": "Teal",
  "초록": "Green",
  "노랑": "Yellow",
  "주황": "Orange",
  "빨강": "Red",
  "분홍": "Pink",
  "더 보기": "More",
  "색 바꾸기": "Change color",
  "{0}월 {1}일 · {2}": "{0}/{1} · {2}",
  "{0}일째 · {1}월 {2}일 · {3}": "Day {0} · {1}/{2} · {3}",
  "/ {0}일": "/ {0}d",
  "{0}일": "{0}d",
  " 했어요": " logged",
  "{0}일 중 ": "Out of {0} days: ",
  "지난 {0}일 중 ": "Past {0} days: ",
  "{0} 끝": "Ends {0}",
  "{0} 끝 · D-{1}": "Ends {0} · D-{1}",
  "목표 없음": "No goal",
  "목표 정하기 (주 몇 회, 하루 목표)": "Set goals (times per week, daily goal)",
  "더 보기 (순서 바꾸기, 보관함으로 옮기기)": "More (reorder, archive)",
  "{0} 자세히 보기": "Open {0}",
  "{0} {1}회": "{0}: {1} times",
  "보관됨": "Archived",
  "{0}회": "{0} times",
  "기록이 없어요": "No records",
  "{0} – {1} · 총 {2} · 기록한 날 {3}%": "{0} – {1} · {2} total · logged on {3}% of days",
  "{0}년 1월": "Jan {0}",
  "12월": "Dec",
  "다시 시작": "Restore",
  "'{0}' 폴더를 찾을 수 없어요.": "Can't find the folder '{0}'.",
  "아직 기록된 습관이 없어요.": "No habits recorded yet.",
  "{0}으로 돌아가기": "Back to {0}",
  "{0}년": "{0}",
  "이전 6개월": "Previous 6 months",
  "다음 6개월": "Next 6 months",
  "보관함": "Archive",
  "보관함 열기": "Open archive",
  "진행 중인 습관이 없어요.": "No active habits.",
  "＋ 새 습관": "＋ New habit",
  "지난 기록 채우기": "Log past days",
  "목록": "List",
  " · 마지막 기록 {0}.{1}.{2}": " · last logged {0}.{1}.{2}",
  "보관함에 있어요{0}\n기록은 그대로 보여요 (읽기 전용)": "Archived{0}\nYour records are still here (read-only)",
  "끝낸 습관 {0}개 · 눌러서 지난 기록을 볼 수 있어요": "{0} finished habits · tap one to see its history",
  "보관함이 비었어요. 습관 카드의 ⋯ 메뉴에서 '보관함으로 옮기기'를 고르면 여기로 와요.": "Nothing in the archive yet. Use ⋯ → 'Move to archive' on a habit card to put one here.",
  "보관해도 기록은 지워지지 않아요 · 다시 시작하면 같은 기록을 이어서 써요": "Archiving doesn't delete records · restoring a habit picks up the same history",
  "+30분": "+30m",
  "+1시간": "+1h",
  "+10분": "+10m",
  "오늘 · {0}월 {1}일 ({2})": "Today · {0}/{1} ({2})",
  "{0}월 {1}일 ({2}) {3}": "{0}/{1} ({2}) {3}",
  "취소": "Cancel",
  "확인": "OK",
  "시간": "hr",
  "분": "min",
  "지우기": "Clear",
  "저장": "Save",
  "{0} · 달별 목표": "{0} · Monthly goals",
  "하루 목표를 채운 날이 그 주에 몇 번 있으면 '달성한 주'인지도 정해요. 비워 둔 달은 앞 달 값을 이어서 써요.": "Also choose how many days a week you need to hit the daily goal for that week to count as a goal week. Months you leave empty use the previous month's value.",
  "그 달에는 일주일에 몇 번 하면 '달성한 주'인지 정해요. 비워 둔 달은 앞 달 값을 이어서 써요.": "Choose how many times a week counts as a goal week. Months you leave empty use the previous month's value.",
  " · 이번 달": " · This month",
  "하루": "Daily",
  "이어서 ({0})": "Same as before ({0})",
  "하루: 직접": "Daily: set manually",
  "하루: 미리 알림 이름에서": "Daily: from Reminders title",
  "하루: 앞 달 이어서": "Daily: same as before",
  "주: 직접": "Weekly: set manually",
  "주: 앞 달 이어서": "Weekly: same as before",
  "습관 기록하기": "Log habits",
  "어제": "Yesterday",
  "그제": "2 days ago",
  "{0}년 {1}월 {2}일 ({3})": "{0}-{1}-{2} ({3})",
  "아직 습관이 없어요.": "No habits yet.",
  " (목표 {0})": " (goal {0})",
  "분{0}": "min{0}",
  "닫기": "Close",
  "{0}월 {1}일 기록을 저장했어요": "Saved {0}/{1}",
  "새 습관": "New habit",
  "이름": "Name",
  "예: 공부": "e.g. Study",
  "만들기": "Create",
  "이렇게 만들어져요": "What you'll get",
  "하루 {0}": "{0} a day",
  "단위": "Unit",
  "{0} 기록": "Tracks {0}",
  "항목 기록": "Log items",
  "기본": "Simple check",
  "{0}일 챌린지": "{0}-day challenge",
  "종류": "Type",
  "했는지만 체크해요 · 예: 영양제 먹기": "Just check it off · e.g. Take vitamins",
  "양 기록": "Log amounts",
  "시간·쪽·km처럼 양을 적어요 · 예: 공부 2시간": "Log amounts like hours, pages, km · e.g. Study 2h",
  "이 습관 안에서 한 것을 하나씩 적어요 · 예: 운동 → 스쿼트, 플랭크": "Write down what you did under this habit, one by one · e.g. Workout → squats, plank",
  "쪽": "pages",
  "직접 입력 +": "Custom +",
  "직접": "Custom",
  "예: 잔, 문제, 장": "e.g. cups, problems, pages",
  "비워도 돼요": "Optional",
  "얼마나 자주": "Frequency",
  "달마다 바꿀 수 있어요": "Can be changed each month",
  "기간": "Duration",
  "양 기록은 아직 기간을 정할 수 없어요": "Duration isn't available for amount logs yet",
  "정하면 챌린지가 돼요": "Set one to start a challenge",
  "없음": "None",
  "예: 21": "e.g. 21",
  "시작 오늘({0}) · 끝 {1} · 챌린지 카드로 보여요": "Starts today ({0}) · ends {1} · shown as a challenge card",
  "이름을 적어 주세요": "Enter a name",
  "단위를 적어 주세요": "Enter a unit",
  "습관 대시보드 열기": "Open habits dashboard",
  "습관 폴더와 대시보드 만들기": "Create habits folder and dashboard",
  "새 습관 만들기": "Create new habit",
  "습관 기록하기 (날짜 골라서)": "Log a habit (pick a date)",
  "'{0}' 폴더와 대시보드를 준비했어요": "Set up the '{0}' folder and dashboard",
  "습관 폴더를 만들지 못했어요": "Couldn't create the habits folder",
  "기록했어요": "logged",
  "기록을 지웠어요": "removed",
  "{0} · {1}월 {2}일 {3}": "{0} · {1}/{2} {3}",
  "기간 시작 전 날짜는 기록할 수 없어요": "Can't log days before the start date",
  "기간 +30일": "Extend by 30 days",
  "기간 +66일": "Extend by 66 days",
  "기간 직접 입력": "Set duration…",
  "기간 없음으로 바꾸기": "Remove duration",
  "기간 정하기 (오늘부터)": "Set duration (from today)",
  "위로 옮기기": "Move up",
  "아래로 옮기기": "Move down",
  "보관함으로 옮기기": "Move to archive",
  "기간 없음으로 바꿀까요?": "Remove the duration?",
  "'{0}'의 {1}일 챌린지 설정(기간·시작일)이 지워져요.": "This removes the {1}-day challenge settings (duration and start date) for '{0}'.",
  "기록은 그대로 남지만, 나중에 기간을 다시 정하면 원래 시작일이 아니라 그날부터 새로 세요. 지금 챌린지로는 돌아올 수 없어요.": "Your records stay, but if you set a duration again it starts counting from that day instead of the original start date. You can't go back to this challenge.",
  "'{0}'은 기간 없이 계속해요": "'{0}' now continues with no end date",
  "'{0}' 기간을 늘렸어요": "Extended '{0}'",
  "이미 맨 위예요": "Already at the top",
  "이미 맨 아래예요": "Already at the bottom",
  "기간 (일)": "Duration (days)",
  "총 며칠로 할까요? (시작일부터 센 총 일수)": "How many days in total? (counted from the start date)",
  "오늘부터 며칠 할까요?": "How many days, starting today?",
  "'{0}'을 보관함으로 옮겼어요. 기록은 그대로 남아 있어요": "Moved '{0}' to the archive. Its records are kept",
  "'{0}'을 다시 꺼냈어요": "Restored '{0}'",
  "{0} · {1}월 {2}일": "{0} · {1}/{2}",
  "양": "amount",
  "이날 한 {0}을 적어 주세요.": "Enter the {0} for this day.",
  "기본 색": "Default color",
  "직접 고르기…": "Custom color…",
  "{0} 목표를 저장했어요": "Saved goal for {0}",
  "{0} · {1}년 {2}월 목표": "{0} · goal for {1}-{2}",
  "하루에 몇 {0} 하면 달성으로 볼까요? 비워 두면 앞 달 목표를 이어서 써요.": "What daily goal ({0}) counts as done? Leave it empty to use the previous month's goal.",
  "같은 이름의 습관이 이미 있어요": "A habit with that name already exists",
  "'{0}' 습관을 만들었어요. 대시보드에서 칸을 눌러 기록하세요": "Created '{0}'. Click a cell on the dashboard to log it",
  "'{0}' 습관을 만들었어요": "Created '{0}'",
  "습관 폴더": "Habits folder",
  "습관 기록 파일이 들어 있는 폴더 경로": "Folder that holds your habit files",
  "대시보드 노트 이름": "Dashboard note name",
  "습관 폴더 안에 만들어지고, 습관 목록에서는 빠져요": "Created in the habits folder and left out of the habit list",
  "습관 대시보드": "Habits Dashboard",
  "지금 만들기": "Create now",
  "보여줄 기간": "Time range",
  "전체 기록: 첫 기록부터 오늘까지 모두 보여줘요 (옆으로 넘겨 보기)": "All records: everything from your first record to today (scroll sideways)",
  "연도별 (넘겨 보기)": "By year",
  "전체 기록": "All records",
  "최근 몇 주만": "Recent weeks only",
  "최소 표시 주 수": "Minimum weeks shown",
  "보여줄 주 수": "Weeks shown",
  "기록이 적을 때도 이만큼은 칸을 그려요": "Shows at least this many weeks even when you have few records",
  "격자에 표시할 최근 주 수": "How many recent weeks to show",
  "메인 화면 격자": "Main screen grid",
  "6개월: 큰 칸으로 반년씩 넘겨 봐요 · 1년: 한 해가 한 줄에 다 보이고 1년씩 넘겨 봐요": "6 months: larger cells, page by half year · 1 year: a full year in one row, page by year",
  "1년 (1년씩 넘기기)": "1 year (page by year)",
  "6개월 (반년씩 넘기기)": "6 months (page by half year)",
  "한 주의 시작": "Week starts on",
  "월요일": "Monday",
  "일요일": "Sunday",
  "칸 색깔": "Cell color",
  "비워 두면 테마 강조색을 써요": "Leave empty to use your theme's accent color",
  "테마 색으로 되돌리기": "Reset to theme color",
  "칸을 눌러 기록 고치기": "Click cells to add or remove records",
  "빠뜨린 날을 직접 채우거나 지울 수 있어요": "Fill in missed days or clear them directly",
  "설정을 바꾼 뒤에는 노트를 다시 열면 반영돼요.": "Reopen the note after changing settings for them to take effect.",
  "언어": "Language",
  "대시보드와 설정 화면의 표시 언어": "Display language for the dashboard and settings",
  "자동 (옵시디언 언어)": "Auto (follow Obsidian)",
  "명령 이름과 왼쪽 아이콘 이름은 옵시디언을 다시 시작하거나 플러그인을 껐다 켜면 바뀌어요.": "Command and ribbon names change after you restart Obsidian or reload the plugin.",
  "이날 한 시간을 적어 주세요.": "Enter the time for this day.",
  "이날 한 양을 적어 주세요.": "Enter the amount for this day.",
};
function tr(k, ...a) {
  let s = LANG === "en" && EN[k] != null ? EN[k] : k;
  if (typeof s === "function") return s(...a);
  return a.length ? s.replace(/\{(\d+)\}/g, (_, i) => (a[i] != null ? a[i] : "")) : s;
}
function setLang(l) {
  LANG = l === "en" ? "en" : "ko";
  DAY_NAMES.splice(0, 7, ...(LANG === "en" ? EN_DAYS : KO_DAYS));
}
function resolveLang(pref) {
  if (pref === "ko" || pref === "en") return pref;
  try { return String(obsidian.moment.locale() || navigator.language || "").toLowerCase().startsWith("ko") ? "ko" : "en"; } catch (_) { return "ko"; }
}
// 시간·분·쪽은 저장된 단위 값은 그대로 두고, 화면에 보일 때만 번역해요
function unitLabel(u) { return u === "시간" || u === "분" || u === "쪽" ? tr(u) : (u || ""); }

function pad(n) { return String(n).padStart(2, "0"); }
function fmt(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function addDays(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }
function toDate(s) { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); }

function weekStartOf(d, weekStart) {
  return addDays(d, -((d.getDay() - weekStart + 7) % 7));
}

function weekCounts(set, weekStart) {
  const counts = new Map();
  for (const s of set) {
    const k = fmt(weekStartOf(toDate(s), weekStart));
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  return counts;
}

// A 규칙: 두 달에 걸친 주는 날짜가 더 많은 달(주의 가운데 날)이 기준
function weekMonthKey(ws) { return monthKey(addDays(ws, 3)); }
function freqOfWeek(freqs, ws) {
  const f = goalForMonth(freqs || {}, weekMonthKey(ws));
  return f > 0 && f < 7 ? Math.round(f) : 0;
}

function computeWeeklyStats(set, today, freqOf, weekStart) {
  const counts = weekCounts(set, weekStart);
  const hit = (k) => { const f = freqOf(toDate(k)); return f > 0 && (counts.get(k) || 0) >= f; };
  const thisWeek = weekStartOf(today, weekStart);
  const thisCount = counts.get(fmt(thisWeek)) || 0;
  const goal = freqOf(thisWeek);

  let current = 0;
  let w = hit(fmt(thisWeek)) ? thisWeek : addDays(thisWeek, -7);
  while (hit(fmt(w))) { current++; w = addDays(w, -7); }

  let longest = 0, run = 0, prev = null;
  for (const k of [...counts.keys()].filter(hit).sort()) {
    run = prev && fmt(addDays(prev, 7)) === k ? run + 1 : 1;
    if (run > longest) longest = run;
    prev = toDate(k);
  }
  return { total: set.size, current, longest, thisCount, doneToday: set.has(fmt(today)), weekDone: thisCount >= goal };
}

// 날짜 -> 값(시간). 값이 없는 기록은 0
function parseEntries(text) {
  const map = new Map();
  for (const line of text.split("\n")) {
    const m = line.match(DONE_RE);
    if (!m) continue;
    map.set(m[1], (map.get(m[1]) || 0) + parseAmount(m[2] || ""));
  }
  return map;
}

// "공부 3시간 이상" 같은 미리 알림 이름에서 습관 이름·목표량·단위를 읽는다
const TITLE_RE = /^(.+?)\s+(\d+(?:\.\d+)?)\s*(시간|분|회|쪽|페이지|km|h)\s*(?:이상)?$/;
function parseTitle(name) {
  const hm = name.match(/^(.+?)\s+(\d+)\s*시간\s*(\d+)\s*분\s*(?:이상)?$/);
  if (hm) return { base: hm[1].trim(), amount: parseInt(hm[2], 10) + parseInt(hm[3], 10) / 60, unit: "\uc2dc\uac04" };
  const m = name.match(TITLE_RE);
  if (!m) return null;
  return { base: m[1].trim(), amount: parseFloat(m[2]), unit: m[3] === "h" ? "\uc2dc\uac04" : m[3] };
}

// 이번 주에 해야 하는 요일 칸인지
function isSchedDay(fr, dd, date, today, weekStart) {
  if (!dd || !Object.keys(dd).length) return false;
  const ws = weekStartOf(today, weekStart);
  if (fmt(weekStartOf(date, weekStart)) !== fmt(ws)) return false;
  const sc = scheduleAt(fr, dd, weekMonthKey(ws));
  return !!(sc && sc.days && sc.days.includes(date.getDay()));
}
const WD_ORDER = [1, 2, 3, 4, 5, 6, 0];
function daysLabel(days) { return WD_ORDER.filter((d) => (days || []).includes(d)).map((d) => DAY_NAMES[d]).join("·"); }
// 그 달에 적용되는 방식: 요일 지정이면 {days}, 횟수면 {n}. 가장 가까운 앞 달 설정을 이어서 쓴다
function scheduleAt(fr, dd, key) {
  const ks = [...new Set([...Object.keys(fr || {}), ...Object.keys(dd || {})])].filter((k) => k <= key).sort();
  if (!ks.length) return null;
  const k = ks[ks.length - 1];
  if (dd && dd[k] && dd[k].length) return { days: dd[k] };
  return { n: Number(fr && fr[k]) || 0 };
}
function monthKey(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; }

// 그 달의 목표. 정해진 게 없으면 가장 최근에 정한 목표를 이어서 쓴다
function goalForMonth(goals, key) {
  if (!goals) return 0;
  if (goals[key] != null) return Number(goals[key]) || 0;
  const earlier = Object.keys(goals).filter((k) => k < key).sort();
  return earlier.length ? Number(goals[earlier[earlier.length - 1]]) || 0 : 0;
}

// "3h23m", "3시간 23분", "45m", "1.5h", "2" -> 시간(소수)
function parseAmount(str) {
  const t = str.trim();
  let m = t.match(/^(\d+):(\d{1,2})\b/);
  if (m) return parseInt(m[1], 10) + parseInt(m[2], 10) / 60;
  m = t.match(/^(\d+(?:\.\d+)?)\s*(?:h|시간)\s*(?:(\d+)\s*(?:m|분))?/);
  if (m) return parseFloat(m[1]) + (m[2] ? parseInt(m[2], 10) / 60 : 0);
  m = t.match(/^(\d+)\s*(?:m|분)/);
  if (m) return parseInt(m[1], 10) / 60;
  m = t.match(/^(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : 0;
}

function splitHM(h) {
  const mins = Math.round(h * 60);
  return [Math.floor(mins / 60), mins % 60];
}

// 3.3833 -> "3시간 23분"
function fmtDur(h) {
  const [H, M] = splitHM(h);
  if (!H && !M) return tr("0분");
  return [H ? tr("{0}시간", H) : "", M ? tr("{0}분", M) : ""].filter(Boolean).join(" ");
}

// 3.3833 -> "3h23m" (짧게)
function fmtDurShort(h) {
  const [H, M] = splitHM(h);
  if (!H) return `${M}m`;
  return M ? `${H}h${M}m` : `${H}h`;
}

function fmtQty(v, unit) { return unit === "시간" ? fmtDur(v) : `${fmtNum(Math.round(v * 10) / 10)}${LANG === "en" && unitLabel(unit) ? " " : ""}${unitLabel(unit)}`; }
function fmtQtyShort(v, unit) { return unit === "시간" ? fmtDurShort(v) : fmtNum(Math.round(v * 10) / 10); }
// 파일에 적는 값: 시간이면 "3h23m"
function writeQty(v, unit) { return unit === "시간" ? fmtDurShort(v) : fmtNum(Math.round(v * 100) / 100); }

function fmtNum(n) { return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, ""); }

const SKIP_RE = /^\s*[-*]\s*\[ \]\s*(\d{4}-\d{2}-\d{2})/;
const LOG_RE = /^\s*[-*]\s*\[[xX]\]\s*(\d{4}-\d{2}-\d{2})\s*(.*?)\s*$/;

// 단축어가 쓰는 '미리 알림 기록' 파일: 날짜 + 미리 알림 이름
function parseLog(text) {
  const out = [];
  for (const line of text.split("\n")) {
    const m = line.match(LOG_RE);
    if (!m || !m[2]) continue;
    out.push({ ds: m[1], title: m[2].normalize("NFC") });
  }
  return out;
}

function parseSkips(text) {
  const set = new Set();
  for (const line of text.split("\n")) { const m = line.match(SKIP_RE); if (m) set.add(m[1]); }
  return set;
}

function parseDates(text) {
  const set = new Set();
  for (const line of text.split("\n")) {
    const m = line.match(DONE_RE);
    if (m) set.add(m[1]);
  }
  return set;
}

// 완전히 똑같은 기록 줄이 여러 개면 첫 줄만 남긴다. 바뀐 게 없으면 null
function dedupeText(text) {
  const seen = new Set();
  let changed = false;
  const out = text.split("\n").filter((line) => {
    const m = line.match(DONE_RE);
    if (!m) return true;
    const key = line.trim();
    if (seen.has(key)) { changed = true; return false; }
    seen.add(key);
    return true;
  });
  return changed ? out.join("\n") : null;
}

function computeStats(set, today) {
  let current = 0;
  let d = set.has(fmt(today)) ? today : addDays(today, -1);
  while (set.has(fmt(d))) { current++; d = addDays(d, -1); }

  let longest = 0, run = 0, prev = null;
  for (const s of [...set].sort()) {
    run = prev && fmt(addDays(prev, 1)) === s ? run + 1 : 1;
    if (run > longest) longest = run;
    prev = toDate(s);
  }

  const monthPrefix = fmt(today).slice(0, 8);
  let monthDone = 0;
  for (const s of set) if (s.startsWith(monthPrefix) && s <= fmt(today)) monthDone++;

  return { total: set.size, current, longest, monthDone, monthDays: new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate(), doneToday: set.has(fmt(today)) };
}

// 기간이 정해진 습관(예: 66일): 실제 날짜가 보이는 카드
function renderChallenge(parent, name, set, opts) {
  const today = opts.today || new Date();
  const weekStart = opts.weekStart ?? 1;
  const todayStr = fmt(today);
  const { days, start: startStr } = opts.period;
  const startD = toDate(startStr);
  const endD = addDays(startD, days - 1);
  const endStr = fmt(endD);
  const dayNo = Math.max(0, Math.min(days, Math.round((toDate(todayStr) - startD) / 86400000) + 1));
  const finished = todayStr > endStr;
  const notStarted = todayStr < startStr;
  const left = Math.round((endD - toDate(todayStr)) / 86400000);
  let done = 0;
  for (let i = 0; i < days; i++) { const ds = fmt(addDays(startD, i)); if (ds <= todayStr && set.has(ds)) done++; }
  const elapsed = Math.max(1, dayNo);
  const st = computeStats(set, today);
  const md = (d) => `${d.getMonth() + 1}/${d.getDate()} ${DAY_NAMES[d.getDay()]}`;

  const card = parent.createDiv({ cls: "hg-card hg-challenge" });
  if (opts.color) card.style.setProperty("--hg-on", opts.color);

  const head = card.createDiv({ cls: "hg-head" });
  const title = head.createDiv({ cls: "hg-title" });
  const dot = title.createSpan({ cls: "hg-dot" + (st.doneToday ? " is-done" : "") });
  makeColorDot(dot, opts);
  title.createSpan({ cls: "hg-name", text: name });
  const chalChip = head.createSpan({
    cls: "hg-goal" + (finished ? " is-done" : "") + (opts.onPeriod ? " is-clickable" : ""),
    text: finished ? tr("{0}일 완료", days) : notStarted ? tr("{0}일 · 시작 전", days) : tr("{0}일 챌린지 · D-{1}", days, left),
  });
  if (opts.onPeriod) {
    chalChip.setAttr("aria-label", tr("기간 바꾸기"));
    chalChip.addEventListener("click", (evt) => opts.onPeriod(evt));
    stopEditorGrab(chalChip);
  }
  addMoreButton(head, opts);

  const stats = card.createDiv({ cls: "hg-stats" });
  const stat = (value, unit, label, accent) => {
    const box = stats.createDiv({ cls: "hg-stat" + (accent ? " is-accent" : "") });
    const v = box.createDiv({ cls: "hg-stat-value" });
    v.createSpan({ text: String(value) });
    v.createSpan({ cls: "hg-stat-unit", text: unit });
    box.createDiv({ cls: "hg-stat-label", text: label });
  };
  stat(finished ? days : dayNo, `/${days}`, tr("진행"), !finished);
  stat(done, tr("일"), tr("한 날"), done > 0);
  stat(st.current, tr("일"), tr("연속"), st.current > 0);
  stat(Math.round((done / elapsed) * 100), "%", tr("달성률"));

  // 기간 막대 + 실제 날짜
  const prog = card.createDiv({ cls: "hg-chal-prog" });
  const track = prog.createDiv({ cls: "hg-chal-track" });
  track.createDiv({ cls: "hg-chal-fill" }).style.width = `${Math.round(((finished ? days : dayNo) / days) * 100)}%`;
  const dates = prog.createDiv({ cls: "hg-chal-dates" });
  dates.createSpan({ text: tr("시작 {0}", md(startD)) });
  dates.createSpan({ cls: "hg-chal-today", text: finished ? "" : notStarted ? "" : tr("오늘 {0} · {1}일째", md(today), dayNo) });
  dates.createSpan({ text: tr("끝 {0}", md(endD)) });

  if (finished) {
    const ban = card.createDiv({ cls: "hg-chal-banner" });
    ban.createDiv({ cls: "hg-chal-banner-t", text: tr("{0}일 끝! {1}일 했어요 ({2}%)", days, done, Math.round((done / days) * 100)) });
    const row = ban.createDiv({ cls: "hg-chal-banner-btns" });
    const b = (label, fn) => { const x = row.createEl("button", { text: label }); x.addEventListener("click", fn); stopEditorGrab(x); };
    if (opts.onExtend) {
      b(tr("+30일 더 하기"), () => opts.onExtend(30));
      b(tr("기간 없이 계속"), () => opts.onExtend(0));
    }
    if (opts.onArchive) b(tr("보관함으로"), () => opts.onArchive());
  }

  renderWeekTop(card, {
    ...opts, kind: "check", today, weekStart, freqOf: () => 0, minDate: startStr,
    value: (ds) => (set.has(ds) ? 1 : 0),
    hit: (ds) => set.has(ds),
    onTap: opts.onToggle ? (ds) => opts.onToggle(ds, !set.has(ds)) : null,
  });

  // 기간 전체 격자: 기존 카드와 같은 주 단위 열. 아직 안 온 날도 회색 칸으로 보임
  const scroll = card.createDiv({ cls: "hg-scroll is-year hg-chal-scroll" });
  const grid = scroll.createDiv({ cls: "hg-grid" });
  const labels = grid.createDiv({ cls: "hg-col hg-labels" });
  labels.createDiv({ cls: "hg-month" });
  for (let i = 0; i < 7; i++) labels.createDiv({ cls: "hg-daylabel", text: i % 2 === 0 ? DAY_NAMES[(weekStart + i) % 7] : "" });
  const first = weekStartOf(startD, weekStart);
  const nWeeks = Math.round((weekStartOf(endD, weekStart) - first) / (7 * 86400000)) + 1;
  let prevMonth = -1;
  for (let w = 0; w < nWeeks; w++) {
    const top = addDays(first, w * 7);
    const col = grid.createDiv({ cls: "hg-col" });
    const month = col.createDiv({ cls: "hg-month" });
    const mEnd = addDays(top, 6);
    if (mEnd.getMonth() !== prevMonth) { month.setText(tr("{0}월", mEnd.getMonth() + 1)); prevMonth = mEnd.getMonth(); }
    for (let i = 0; i < 7; i++) {
      const date = addDays(top, i);
      const ds = fmt(date);
      const cell = col.createDiv({ cls: "hg-cell" });
      if (ds < startStr || ds > endStr) { cell.addClass("is-outside"); continue; }
      if (ds === todayStr) cell.addClass("is-today");
      const on = set.has(ds);
      if (ds > todayStr) cell.addClass("is-planned");
      else if (on) cell.addClass("is-on");
      const n = Math.round((date - startD) / 86400000) + 1;
      cell.setAttr("aria-label", tr("{0}일째 · {1}월 {2}일 ({3}) · {4}", n, date.getMonth() + 1, date.getDate(), DAY_NAMES[date.getDay()], ds > todayStr ? tr("예정") : on ? tr("완료") : tr("기록 없음")));
      if (opts.onToggle && ds <= todayStr) {
        cell.addClass("is-clickable");
        cell.addEventListener("click", () => opts.onToggle(ds, !on));
      }
    }
  }
  enableHorizontalScroll(scroll);
  stopEditorGrab(scroll);
  requestAnimationFrame(() => {
    scroll.classList.toggle("is-overflow", scroll.scrollWidth > scroll.clientWidth + 1);
    const t = scroll.querySelector(".is-today");
    scroll.scrollLeft = t ? t.parentElement.offsetLeft - scroll.clientWidth + 40 : 0;
  });
  return card;
}

function renderHabit(parent, name, set, opts) {
  if (opts.period && !opts.measure) return renderChallenge(parent, name, set, opts);
  if (opts.measure) return renderMeasured(parent, name, opts.entries || new Map(), opts);
  const today = opts.today || new Date();
  const weekStart = opts.weekStart ?? 1;
  const WEEK_MS = 7 * 86400000;
  const firstRecord = set.size ? [...set].sort()[0] : null;
  const year = opts.range === "year" ? (opts.year || today.getFullYear()) : null;
  let weeks, start;
  if (year) {
    start = weekStartOf(new Date(year, 0, 1), weekStart);
    weeks = Math.round((weekStartOf(new Date(year, 11, 31), weekStart) - start) / WEEK_MS) + 1;
  } else {
    weeks = Math.max(4, opts.weeks || 20);
    if (opts.range === "all" && firstRecord) {
      const span = Math.round((weekStartOf(today, weekStart) - weekStartOf(toDate(firstRecord), weekStart)) / WEEK_MS) + 1;
      weeks = Math.max(weeks, span);
    }
    start = addDays(weekStartOf(today, weekStart), -(weeks - 1) * 7);
  }
  const freqOf = (ws) => freqOfWeek(opts.freqs, ws);
  const goal = freqOf(weekStartOf(today, weekStart));
  const st = goal ? computeWeeklyStats(set, today, freqOf, weekStart) : computeStats(set, today);
  const counts = weekCounts(set, weekStart);

  const card = parent.createDiv({ cls: "hg-card" });
  if (opts.color) card.style.setProperty("--hg-on", opts.color);

  // 헤더
  const head = card.createDiv({ cls: "hg-head" });
  const title = head.createDiv({ cls: "hg-title" });
  const dot = title.createSpan({ cls: "hg-dot" + (st.doneToday ? " is-done" : "") });
  makeColorDot(dot, opts);
  title.createSpan({ cls: "hg-name", text: name });
  const chip = head.createSpan({
    cls: "hg-goal" + (goal && st.weekDone ? " is-done" : "") + (opts.onGoals ? " is-clickable" : ""),
    text: goal ? tr("{0}월 · 주 {1}회", today.getMonth() + 1, goal) + (st.weekDone ? " ✓" : "") : tr("매일"),
  });
  if (opts.onGoals) {
    chip.setAttr("aria-label", tr("달별 목표 정하기"));
    chip.addEventListener("click", () => opts.onGoals(today.getFullYear()));
    stopEditorGrab(chip);
  }
  addMoreButton(head, opts);

  const stats = card.createDiv({ cls: "hg-stats" });
  const stat = (value, unit, label, accent) => {
    const box = stats.createDiv({ cls: "hg-stat" + (accent ? " is-accent" : "") });
    const v = box.createDiv({ cls: "hg-stat-value" });
    v.createSpan({ text: String(value) });
    v.createSpan({ cls: "hg-stat-unit", text: unit });
    box.createDiv({ cls: "hg-stat-label", text: label });
  };
  if (goal) {
    stat(st.current, tr("주"), tr("연속 달성"), st.current > 0);
    stat(st.longest, tr("주"), tr("최장 달성"));
    stat(st.thisCount, `/${goal}`, tr("이번 주"), st.weekDone);
    stat(st.total, tr("회"), tr("전체"));
  } else {
    stat(st.current, tr("일"), tr("연속"), st.current > 0);
    stat(st.longest, tr("일"), tr("최장 연속"));
    stat(st.monthDone, `/${st.monthDays}`, tr("이번 달"));
    stat(st.total, tr("회"), tr("전체"));
  }

  renderWeekTop(card, {
    ...opts, kind: "check", today, weekStart, freqOf,
    value: (ds) => (set.has(ds) ? 1 : 0),
    hit: (ds) => set.has(ds),
    onTap: opts.onToggle ? (ds) => opts.onToggle(ds, !set.has(ds)) : null,
  });

  if (year && opts.mode === "month") {
    renderPeriodView(card, {
      ...opts, kind: "check", today, weekStart, freqOf,
      value: (ds) => (set.has(ds) ? 1 : 0),
      hit: (ds) => set.has(ds),
      onCell: opts.onSelect ? (ds) => opts.onSelect(ds) : opts.onToggle ? (ds) => opts.onToggle(ds, !set.has(ds)) : null,
    });
    return card;
  }

  // 연도 넘기기
  if (year) {
    const bar = card.createDiv({ cls: "hg-yearbar" });
    const nav = bar.createDiv({ cls: "hg-yearnav" });
    const btn = (label, aria, target, enabled) => {
      const b = nav.createEl ? nav.createEl("button", { cls: "hg-yearbtn", text: label }) : nav.createDiv({ cls: "hg-yearbtn", text: label });
      b.setAttr("aria-label", aria);
      stopEditorGrab(b);
      if (!enabled) b.addClass("is-disabled");
      else if (opts.onYear) b.addEventListener("click", () => opts.onYear(target));
    };
    btn("‹", tr("이전 해"), year - 1, true);
    nav.createSpan({ cls: "hg-year", text: `${year}` });
    {
      const isNow = year >= today.getFullYear();
      btn("›", tr("다음 해"), year + 1, !isNow);
      const back = nav.createSpan({ cls: "hg-yearbtn hg-thisyear" + (isNow ? " is-ghost" : ""), text: tr("올해") });
      if (!isNow) back.addEventListener("click", () => opts.onYear && opts.onYear(today.getFullYear()));
      stopEditorGrab(back);
    }
    const prefix = `${year}-`;
    let yearCount = 0;
    for (const d of set) if (d.startsWith(prefix)) yearCount++;
    const right = bar.createDiv({ cls: "hg-barright" });
    right.createSpan({ cls: "hg-yearsum", text: tr("{0}년 {1}회", year, yearCount) });
    if (opts.onMode) modeTabs(right, "year", opts.onMode);
  }

  // 격자
  const scroll = card.createDiv({ cls: "hg-scroll" + (year ? " is-year" : "") });
  const grid = scroll.createDiv({ cls: "hg-grid" });

  const labels = grid.createDiv({ cls: "hg-col hg-labels" });
  labels.createDiv({ cls: "hg-month" });
  for (let i = 0; i < 7; i++) {
    const dow = (weekStart + i) % 7;
    labels.createDiv({ cls: "hg-daylabel", text: i % 2 === 0 ? DAY_NAMES[dow] : "" });
  }

  const todayStr = fmt(today);
  let prevMonth = -1;
  for (let w = 0; w < weeks; w++) {
    const top = addDays(start, w * 7);
    const wf = freqOf(top);
    const weekHit = wf > 0 && (counts.get(fmt(top)) || 0) >= wf;
    const col = grid.createDiv({ cls: "hg-col" + (weekHit ? " is-week-done" : "") });
    const month = col.createDiv({ cls: "hg-month" });
    const end = addDays(top, 6);
    if (end.getMonth() !== prevMonth) {
      if (!(year && end.getFullYear() !== year)) {
        month.setText(!year && end.getMonth() === 0 ? `${end.getFullYear()}` : tr("{0}월", end.getMonth() + 1));
      }
      prevMonth = end.getMonth();
    }
    for (let i = 0; i < 7; i++) {
      const date = addDays(top, i);
      const ds = fmt(date);
      const cell = col.createDiv({ cls: "hg-cell" });
      const on = set.has(ds);
      if (year && date.getFullYear() !== year) { cell.addClass("is-outside"); continue; }
      if (ds > todayStr) { cell.addClass(weekHit ? "is-rest" : year ? "is-planned" : "is-future"); continue; }
      if (on) cell.addClass("is-on");
      else if (weekHit) cell.addClass("is-rest");
      if (ds === todayStr) cell.addClass("is-today");
      cell.setAttr("aria-label", tr("{0}월 {1}일 ({2}) · {3}{4}", date.getMonth() + 1, date.getDate(), DAY_NAMES[date.getDay()], on ? tr("완료") : weekHit ? tr("이번 주 목표 달성") : tr("기록 없음"), opts.itemsOf && opts.itemsOf(ds).length ? " · " + opts.itemsOf(ds).join(", ") : ""));
      if (opts.onToggle) {
        cell.addClass("is-clickable");
        cell.addEventListener("click", () => opts.onToggle(ds, !on));
      }
    }
  }

  enableHorizontalScroll(scroll);
  stopEditorGrab(scroll);

  requestAnimationFrame(() => {
    scroll.toggleClass ? scroll.toggleClass("is-overflow", scroll.scrollWidth > scroll.clientWidth + 1)
      : scroll.classList.toggle("is-overflow", scroll.scrollWidth > scroll.clientWidth + 1);
    if (!year || year === today.getFullYear()) {
      const t = scroll.querySelector(".is-today");
      scroll.scrollLeft = t ? t.parentElement.offsetLeft - scroll.clientWidth + 40 : scroll.scrollWidth;
    } else scroll.scrollLeft = 0;
  });
  return card;
}

// ── 시간 기록 습관 (달마다 목표 시간이 다른 습관) ──
function renderMeasured(parent, name, entries, opts) {
  const today = opts.today || new Date();
  const weekStart = opts.weekStart ?? 1;
  const unit = opts.unit || "\uc2dc\uac04";
  const goals = opts.monthGoals || {};
  const year = opts.year || today.getFullYear();
  const todayStr = fmt(today);
  const curKey = monthKey(today);
  const curGoal = goalForMonth(goals, curKey);
  const hit = (ds, v) => v > 0 && v >= goalForMonth(goals, ds.slice(0, 7));
  const freqOf = (ws) => freqOfWeek(opts.freqs, ws);
  const freq = freqOf(weekStartOf(today, weekStart));
  // 주 N회 목표: 주마다 목표량을 채운 날 수
  const weekHits = new Map();
  for (const [ds, v] of entries) {
    if (!hit(ds, v)) continue;
    const k = fmt(weekStartOf(toDate(ds), weekStart));
    weekHits.set(k, (weekHits.get(k) || 0) + 1);
  }
  const thisWeekKey = fmt(weekStartOf(today, weekStart));
  const thisWeekCount = weekHits.get(thisWeekKey) || 0;

  // 이번 달 통계
  let mDone = 0, mSum = 0, mDays = 0;
  for (const [ds, v] of entries) {
    if (!ds.startsWith(curKey) || ds > todayStr) continue;
    if (v > 0) { mSum += v; mDays++; }
    if (hit(ds, v)) mDone++;
  }

  const card = parent.createDiv({ cls: "hg-card is-measure" });
  if (opts.color) card.style.setProperty("--hg-on", opts.color);

  const head = card.createDiv({ cls: "hg-head" });
  const title = head.createDiv({ cls: "hg-title" });
  const tv = entries.get(todayStr) || 0;
  const dot = title.createSpan({ cls: "hg-dot" + (hit(todayStr, tv) ? " is-done" : "") });
  makeColorDot(dot, opts);
  title.createSpan({ cls: "hg-name", text: name });
  const chipText = curGoal
    ? tr("{0}월 · 하루 {1}", today.getMonth() + 1, fmtQty(curGoal, unit)) + (freq ? tr(" · 주 {0}회", freq) : "") + (freq && thisWeekCount >= freq ? " ✓" : "")
    : tr("목표 정하기");
  const chip = head.createSpan({ cls: "hg-goal is-clickable" + (freq && thisWeekCount >= freq ? " is-done" : ""), text: chipText });
  chip.setAttr("aria-label", tr("달별 목표 정하기"));
  if (opts.onGoals) chip.addEventListener("click", () => opts.onGoals(today.getFullYear()));
  stopEditorGrab(chip);
  addMoreButton(head, opts);

  const stats = card.createDiv({ cls: "hg-stats" });
  const stat = (value, u, label, accent) => {
    const box = stats.createDiv({ cls: "hg-stat" + (accent ? " is-accent" : "") });
    const v = box.createDiv({ cls: "hg-stat-value" });
    v.createSpan({ text: String(value) });
    v.createSpan({ cls: "hg-stat-unit", text: u });
    box.createDiv({ cls: "hg-stat-label", text: label });
  };
  const sv = (v) => unit === "시간" ? [fmtDur(v), ""] : [fmtNum(Math.round(v * 10) / 10), unitLabel(unit)];
  stat(...sv(tv), tr("오늘"), hit(todayStr, tv));
  const monthLen = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  if (freq) stat(thisWeekCount, tr("/{0}회", freq), tr("이번 주 달성"), thisWeekCount >= freq);
  else stat(mDone, tr("/{0}일", monthLen), tr("이번 달 달성"), mDone > 0);
  stat(...sv(mSum), tr("이번 달 합계"));
  stats.addClass("hg-stats-3");

  renderWeekTop(card, {
    ...opts, kind: "measure", today, weekStart, freqOf, unit,
    value: (ds) => entries.get(ds) || 0,
    goalOf: (ds) => goalForMonth(goals, ds.slice(0, 7)),
    hit: (ds) => hit(ds, entries.get(ds) || 0),
    onTap: opts.onValue ? (ds) => opts.onValue(ds, entries.get(ds) || 0) : null,
  });

  if (opts.mode === "month") {
    renderPeriodView(card, {
      ...opts, kind: "measure", today, weekStart, freqOf, unit,
      value: (ds) => entries.get(ds) || 0,
      goalOf: (ds) => goalForMonth(goals, ds.slice(0, 7)),
      hit: (ds) => hit(ds, entries.get(ds) || 0),
      onCell: opts.onValue ? (ds) => opts.onValue(ds, entries.get(ds) || 0) : null,
    });
    return card;
  }

  // 연도 넘기기
  const bar = card.createDiv({ cls: "hg-yearbar" });
  const nav = bar.createDiv({ cls: "hg-yearnav" });
  const btn = (label, aria, target, enabled = true) => {
    const b = nav.createEl ? nav.createEl("button", { cls: "hg-yearbtn", text: label }) : nav.createDiv({ cls: "hg-yearbtn", text: label });
    b.setAttr("aria-label", aria);
    stopEditorGrab(b);
    if (!enabled) b.addClass("is-disabled");
    else if (opts.onYear) b.addEventListener("click", () => opts.onYear(target));
  };
  btn("‹", tr("이전 해"), year - 1);
  nav.createSpan({ cls: "hg-year", text: `${year}` });
  {
    const isNow = year >= today.getFullYear();
    btn("›", tr("다음 해"), year + 1, !isNow);
    const back = nav.createSpan({ cls: "hg-yearbtn hg-thisyear" + (isNow ? " is-ghost" : ""), text: tr("올해") });
    if (!isNow) back.addEventListener("click", () => opts.onYear && opts.onYear(today.getFullYear()));
    stopEditorGrab(back);
  }
  let ySum = 0;
  for (const [ds, v] of entries) if (ds.startsWith(`${year}-`)) ySum += v;
  const right = bar.createDiv({ cls: "hg-barright" });
  right.createSpan({ cls: "hg-yearsum", text: tr("{0}년 {1}", year, fmtQty(ySum, unit)) });
  if (opts.onMode) modeTabs(right, "year", opts.onMode);

  // 격자
  const scroll = card.createDiv({ cls: "hg-scroll is-year" });
  const grid = scroll.createDiv({ cls: "hg-grid" });
  const labels = grid.createDiv({ cls: "hg-col hg-labels" });
  labels.createDiv({ cls: "hg-month" });
  for (let i = 0; i < 7; i++) labels.createDiv({ cls: "hg-daylabel", text: i % 2 === 0 ? DAY_NAMES[(weekStart + i) % 7] : "" });

  const start = weekStartOf(new Date(year, 0, 1), weekStart);
  const weeks = Math.round((weekStartOf(new Date(year, 11, 31), weekStart) - start) / (7 * 86400000)) + 1;
  let prevMonth = -1;
  for (let w = 0; w < weeks; w++) {
    const top = addDays(start, w * 7);
    const wf = freqOf(top);
    const wkDone = wf > 0 && (weekHits.get(fmt(top)) || 0) >= wf;
    const col = grid.createDiv({ cls: "hg-col" });
    const month = col.createDiv({ cls: "hg-month" });
    const end = addDays(top, 6);
    if (end.getMonth() !== prevMonth) {
      if (end.getFullYear() === year) month.setText(tr("{0}월", end.getMonth() + 1));
      prevMonth = end.getMonth();
    }
    for (let i = 0; i < 7; i++) {
      const date = addDays(top, i);
      const ds = fmt(date);
      const cell = col.createDiv({ cls: "hg-cell" });
      if (isSchedDay(opts.freqsRaw, opts.days, date, today, weekStart)) cell.addClass("is-sched");
      if (date.getFullYear() !== year) { cell.addClass("is-outside"); continue; }
      const v = entries.get(ds) || 0;
      const g = goalForMonth(goals, ds.slice(0, 7));
      if (ds > todayStr) { cell.addClass("is-planned"); continue; }
      if (v > 0) {
        cell.addClass("is-level");
        cell.style.setProperty("--hg-level", `${g ? Math.round(34 + 66 * Math.min(1, v / g)) : 100}%`);
      }
      if (ds === todayStr) cell.addClass("is-today");
      cell.setAttr("aria-label", tr("{0}월 {1}일 · {2}{3}", date.getMonth() + 1, date.getDate(), v ? fmtQty(v, unit) : tr("기록 없음"), g ? tr(" / 목표 {0}", fmtQty(g, unit)) : ""));
      if (opts.onValue) {
        cell.addClass("is-clickable");
        cell.addEventListener("click", () => opts.onValue(ds, v));
      }
    }
  }
  enableHorizontalScroll(scroll);
  stopEditorGrab(scroll);

  // 월별 목표·결과 표
  const table = card.createDiv({ cls: "hg-months" });
  const tbar = table.createDiv({ cls: "hg-mtitle" });
  if (opts.goalsFolded) table.addClass("is-folded");
  const fold = tbar.createSpan({ cls: "hg-fold-toggle", text: opts.goalsFolded ? "▸" : "▾" });
  fold.setAttr("aria-label", opts.goalsFolded ? tr("펼치기") : tr("접기"));
  stopEditorGrab(fold);
  tbar.createSpan({ text: tr("{0}년 달별 목표", year), cls: "hg-mtitle-text" });
  if (opts.onFoldGoals) tbar.addEventListener("click", (e) => { if (e.target.closest(".hg-mmanage")) return; opts.onFoldGoals(!opts.goalsFolded); });
  if (opts.onGoals && !opts.goalsFolded) {
    const manage = tbar.createSpan({ cls: "hg-mmanage", text: tr("목표 정하기") });
    manage.addEventListener("click", () => opts.onGoals(year));
    stopEditorGrab(manage);
  }
  const freqs = opts.freqs || {};
  const monthFreq = (key) => { const f = goalForMonth(freqs, key); return f > 0 && f < 7 ? Math.round(f) : 0; };
  let hasFreq = false;
  for (let m = 0; m < 12; m++) if (monthFreq(`${year}-${pad(m + 1)}`)) hasFreq = true;
  if (hasFreq) table.addClass("has-weeks");
  const hdr = table.createDiv({ cls: "hg-mrow is-head" });
  (hasFreq ? [tr("월"), tr("하루 목표"), tr("주 목표"), tr("달성"), tr("달성 주"), tr("합계"), ""] : [tr("월"), tr("하루 목표"), tr("달성"), tr("합계"), ""]).forEach((t) => hdr.createDiv({ text: t }));
  let rows = 0;
  for (let m = 11; m >= 0; m--) {
    const key = `${year}-${pad(m + 1)}`;
    const future = key > curKey;
    if (future && goals[key] == null && freqs[key] == null) continue;
    const g = goalForMonth(goals, key);
    const daysInMonth = new Date(year, m + 1, 0).getDate();
    const days = daysInMonth;
    let done = 0, sum = 0;
    for (const [ds, v] of entries) {
      if (!ds.startsWith(key)) continue;
      sum += v;
      if (v > 0 && (!g || v >= g)) done++;
    }
    if (!sum && goals[key] == null && freqs[key] == null && key !== curKey) continue;
    rows++;
    const row = table.createDiv({ cls: "hg-mrow" + (key === curKey ? " is-current" : "") + (future ? " is-future" : "") });
    row.createDiv({ cls: "hg-mname", text: tr("{0}월", m + 1) });
    const gcell = row.createDiv({ cls: "hg-mgoal is-clickable" + (goals[key] == null ? " is-inherited" : ""), text: g ? fmtQty(g, unit) : "—" });
    gcell.setAttr("aria-label", goals[key] == null ? tr("앞 달 목표를 이어서 쓰는 중 · 눌러서 바꾸기") : tr("눌러서 목표 바꾸기"));
    if (opts.onMonthGoal) gcell.addEventListener("click", () => opts.onMonthGoal(key, g));
    stopEditorGrab(gcell);
    const mf = monthFreq(key);
    if (hasFreq) {
      const fcell = row.createDiv({ cls: "hg-mgoal is-clickable" + (freqs[key] == null ? " is-inherited" : ""), text: mf ? ((() => { const sc = scheduleAt(opts.freqsRaw, opts.days, key); return sc && sc.days ? daysLabel(sc.days) : tr("주 {0}회", mf); })()) : tr("매일") });
      if (opts.onGoals) fcell.addEventListener("click", () => opts.onGoals(year));
      stopEditorGrab(fcell);
    }
    if (future) {
      row.createDiv({ cls: "hg-mdone", text: tr("예정") });
      if (hasFreq) row.createDiv();
      row.createDiv({ cls: "hg-msum" });
      row.createDiv();
      continue;
    }
    row.createDiv({ cls: "hg-mdone", text: tr("{0}/{1}일", done, days) });
    if (hasFreq) {
      // A 규칙으로 이 달에 속한 주들 중 그 달의 횟수를 채운 주 (진행 중인 이번 주 포함)
      let weeksTotal = 0, weeksHit = 0;
      const first = weekStartOf(new Date(year, m, 1), weekStart);
      for (let i = -1; i < 6; i++) {
        const d = addDays(first, i * 7);
        if (weekMonthKey(d) !== key) continue;
        if (fmt(d) > todayStr) break;
        weeksTotal++;
        const wf = freqOf(d);
        if (wf > 0 && (weekHits.get(fmt(d)) || 0) >= wf) weeksHit++;
      }
      row.createDiv({ cls: "hg-mweeks", text: mf && weeksTotal ? tr("{0}/{1}주", weeksHit, weeksTotal) : "—" });
    }
    row.createDiv({ cls: "hg-msum", text: fmtQty(sum, unit) });
    const track = row.createDiv({ cls: "hg-mbar" });
    track.createDiv({ cls: "hg-mbar-fill" }).style.width = `${Math.round((done / days) * 100)}%`;
  }
  if (!rows) table.createDiv({ cls: "hg-empty", text: tr("{0}년 기록이 없어요.", year) });

  requestAnimationFrame(() => {
    scroll.classList.toggle("is-overflow", scroll.scrollWidth > scroll.clientWidth + 1);
    if (year === today.getFullYear()) {
      const t = scroll.querySelector(".is-today");
      if (t) scroll.scrollLeft = t.parentElement.offsetLeft - scroll.clientWidth + 40;
    }
  });
  return card;
}

// 카드 위쪽: 이번 주(월~일) 타일 + 주 N회 진행 막대. ‹ › 로 다른 주
// 운동처럼 "무엇을 했는지"가 있는 습관: 보고 있는 주(7일)의 기록을 쭉 보여 줌
function renderItemLog(card, itemsAll, days, todayStr) {
  const box = card.createDiv({ cls: "hg-itemlog" });
  box.createDiv({ cls: "hg-itemlog-title", text: tr("이 주의 운동 기록") });
  for (const d of days) {
    const ds = fmt(d);
    if (ds > todayStr) continue;
    const its = itemsAll.get(ds) || [];
    const r = box.createDiv({ cls: "hg-itemlog-row" + (ds === todayStr ? " is-today" : "") });
    r.createDiv({ cls: "hg-itemlog-day", text: `${d.getMonth() + 1}/${d.getDate()} ${DAY_NAMES[d.getDay()]}` });
    const chips = r.createDiv({ cls: "hg-itemlog-chips" });
    if (!its.length) chips.createSpan({ cls: "hg-itemlog-none", text: "—" });
    for (const it of its) chips.createSpan({ cls: "hg-itemlog-chip", text: it });
  }
}

function renderWeekTop(card, c) {
  const { today, weekStart, kind, unit } = c;
  const measure = kind === "measure";
  const todayStr = fmt(today);
  const curWs = weekStartOf(today, weekStart);
  const ws = c.weekAnchor || curWs;
  const we = addDays(ws, 6);
  const isCur = fmt(ws) === fmt(curWs);
  const goalOf = c.goalOf || (() => 0);

  const bar = card.createDiv({ cls: "hg-weektop" });
  const nav = bar.createDiv({ cls: "hg-yearnav" });
  const navBtn = (label, aria, delta, enabled = true) => {
    const b = nav.createEl ? nav.createEl("button", { cls: "hg-yearbtn", text: label }) : nav.createDiv({ cls: "hg-yearbtn", text: label });
    b.setAttr("aria-label", aria);
    if (!enabled) b.addClass("is-disabled");
    else if (c.onWeekNav) b.addEventListener("click", () => c.onWeekNav(delta));
    stopEditorGrab(b);
  };
  navBtn("‹", tr("지난주"), -1);
  const range = tr("{0}월 {1}일 – {2}{3}일", ws.getMonth() + 1, ws.getDate(), we.getMonth() !== ws.getMonth() ? tr("{0}월 ", we.getMonth() + 1) : "", we.getDate());
  nav.createSpan({ cls: "hg-year hg-year-wide", text: range });
  navBtn("›", tr("다음 주"), 1, !isCur);
  {
    const back = nav.createSpan({ cls: "hg-yearbtn hg-thisyear" + (isCur ? " is-ghost" : ""), text: tr("이번 주") });
    if (!isCur && c.onWeekNav) back.addEventListener("click", () => c.onWeekNav(0));
    stopEditorGrab(back);
  }
  let sum = 0, hits = 0;
  const days = [...Array(7)].map((_, i) => addDays(ws, i));
  for (const d of days) { const ds = fmt(d); const v = c.value(ds); sum += v; if (v && c.hit(ds)) hits++; }
  bar.createSpan({ cls: "hg-yearsum", text: measure ? tr("합계 {0}", fmtQty(sum, unit)) : tr("{0}/7일", hits) });

  const row = card.createDiv({ cls: "hg-recent" });
  for (const d of days) {
    const ds = fmt(d);
    const v = c.value(ds);
    const fut = ds > todayStr;
    const locked = !!c.minDate && ds < c.minDate;
    let state = "off";
    if (!fut && v) state = c.hit(ds) ? "on" : "partial";
    const b = row.createDiv({ cls: `hg-day is-${state}` + (ds === todayStr ? " is-today" : "") + (fut ? " is-future" : "") + (locked ? " is-locked" : "") });
    if (state === "partial") {
      const g = goalOf(ds);
      b.style.setProperty("--hg-ratio", `${g ? Math.round(12 + 88 * Math.min(1, v / g)) : 100}%`);
    }
    b.createDiv({ cls: "hg-day-dow", text: ds === todayStr ? tr("오늘") : DAY_NAMES[d.getDay()] });
    b.createDiv({ cls: "hg-day-mark", text: fut ? String(d.getDate()) : v ? (measure ? fmtQtyShort(v, unit) : "✓") : String(d.getDate()) });
    b.setAttr("aria-label", tr("{0}월 {1}일", d.getMonth() + 1, d.getDate()));
    if (c.onTap && !fut && !locked) b.addEventListener("click", () => c.onTap(ds));
    stopEditorGrab(b);
  }

  if (c.itemsAll) renderItemLog(card, c.itemsAll, days, todayStr);

  const f = c.freqOf ? c.freqOf(ws) : 0;
  if (f) {
    const wk = card.createDiv({ cls: "hg-weekbar" + (hits >= f ? " is-done" : "") });
    wk.createSpan({ cls: "hg-weekbar-label", text: tr("주 {0}회", f) });
    const track = wk.createDiv({ cls: "hg-weekbar-track" });
    for (let n = 0; n < f; n++) track.createDiv({ cls: "hg-weekbar-seg" + (n < hits ? " is-on" : "") });
    wk.createSpan({ cls: "hg-weekbar-count", text: tr("{0}/{1}회", hits, f) + (hits >= f ? " ✓" : "") });
  }
}

// 연도 | 월 전환
function modeTabs(parent, mode, onMode) {
  const tabs = parent.createDiv({ cls: "hg-tabs" });
  for (const [m, label] of [["year", tr("연도")], ["month", tr("월")]]) {
    const t = tabs.createSpan({ cls: "hg-tab" + (m === mode ? " is-on" : ""), text: label });
    if (m !== mode) t.addEventListener("click", () => onMode(m));
    stopEditorGrab(t);
  }
}

// 월 보기(달력) / 주 보기(가로 줄)
function renderPeriodView(card, c) {
  const { today, weekStart, kind, unit } = c;
  const freqOf = c.freqOf || (() => 0);
  const todayStr = fmt(today);
  const measure = kind === "measure";
  const goalOf = c.goalOf || (() => 0);
  const bar = card.createDiv({ cls: "hg-yearbar" });
  const nav = bar.createDiv({ cls: "hg-yearnav" });
  const right = bar.createDiv({ cls: "hg-barright" });
  const navBtn = (label, aria, fn, enabled = true) => {
    const b = nav.createEl ? nav.createEl("button", { cls: "hg-yearbtn", text: label }) : nav.createDiv({ cls: "hg-yearbtn", text: label });
    b.setAttr("aria-label", aria);
    if (!enabled) b.addClass("is-disabled");
    else b.addEventListener("click", fn);
    stopEditorGrab(b);
  };
  const weekdayNames = [...Array(7)].map((_, i) => DAY_NAMES[(weekStart + i) % 7]);
  const cellText = (ds) => {
    const v = c.value(ds);
    if (!v) return "";
    return measure ? fmtQtyShort(v, unit) : "✓";
  };

  if (c.mode === "month") {
    const anchor = c.monthAnchor || new Date(today.getFullYear(), today.getMonth(), 1);
    const y = anchor.getFullYear(), m = anchor.getMonth();
    const isCur = y === today.getFullYear() && m === today.getMonth();
    navBtn("‹", tr("이전 달"), () => c.onNav && c.onNav(-1));
    nav.createSpan({ cls: "hg-year hg-year-wide", text: tr("{0}년 {1}월", y, m + 1) });
    navBtn("›", tr("다음 달"), () => c.onNav && c.onNav(1), !isCur);
    {
      const back = nav.createSpan({ cls: "hg-yearbtn hg-thisyear" + (isCur ? " is-ghost" : ""), text: tr("이번 달") });
      if (!isCur) back.addEventListener("click", () => c.onNav && c.onNav(0));
      stopEditorGrab(back);
    }
    const days = new Date(y, m + 1, 0).getDate();
    let sum = 0, hits = 0;
    for (let d = 1; d <= days; d++) { const ds = fmt(new Date(y, m, d)); sum += c.value(ds); if (c.value(ds) && c.hit(ds)) hits++; }
    right.createSpan({ cls: "hg-yearsum", text: measure ? tr("합계 {0} · 달성 {1}/{2}일", fmtQty(sum, unit), hits, days) : tr("{0}/{1}일", hits, days) });
    if (c.onMode) modeTabs(right, "month", c.onMode);

    // 주간 목표 달성 주 (체크 습관의 쉬는 날 표시용)
    const weekHit = (ws) => {
      const f = freqOf(ws);
      if (!f || measure) return false;
      let n = 0;
      for (let i = 0; i < 7; i++) if (c.hit(fmt(addDays(ws, i)))) n++;
      return n >= f;
    };

    const cal = card.createDiv({ cls: "hg-cal" });
    for (const n of weekdayNames) cal.createDiv({ cls: "hg-cal-head", text: n });
    const first = weekStartOf(new Date(y, m, 1), weekStart);
    for (let w = 0; w < 6; w++) {
      const ws = addDays(first, w * 7);
      if (w > 0 && ws.getMonth() !== m) break;
      const rest = weekHit(ws);
      for (let i = 0; i < 7; i++) {
        const d = addDays(ws, i);
        const ds = fmt(d);
        const cell = cal.createDiv({ cls: "hg-cal-cell" });
        cell.createDiv({ cls: "hg-cal-num", text: String(d.getDate()) });
        if (d.getMonth() !== m) { cell.addClass("is-outside"); continue; }
        if (ds > todayStr) { cell.addClass(rest ? "is-rest" : "is-future"); continue; }
        const v = c.value(ds);
        if (v && c.hit(ds)) cell.addClass("is-on");
        else if (v) {
          cell.addClass("is-partial");
          const g = goalOf(ds);
          cell.style.setProperty("--hg-ratio", `${g ? Math.round(12 + 88 * Math.min(1, v / g)) : 100}%`);
        } else if (rest) cell.addClass("is-rest");
        if (ds === todayStr) cell.addClass("is-today");
        const its = c.itemsOf ? c.itemsOf(ds) : [];
        if (c.itemsOf) {
          if (its.length) {
            cell.addClass("has-items");
            const box = cell.createDiv({ cls: "hg-cal-items" });
            its.slice(0, 2).forEach((t) => box.createDiv({ cls: "hg-cal-item", text: t }));
            if (its.length > 2) box.createDiv({ cls: "hg-cal-more", text: `+${its.length - 2}` });
          }
          if (ds === c.selDay) cell.addClass("is-selected");
        } else cell.createDiv({ cls: "hg-cal-val", text: cellText(ds) });
        if (c.onCell) { cell.addClass("is-clickable"); cell.addEventListener("click", () => c.onCell(ds)); }
        stopEditorGrab(cell);
      }
    }
    if (c.itemsOf) {
      const sel = c.selDay || todayStr;
      const sd = toDate(sel);
      const its = c.itemsOf(sel);
      const det = card.createDiv({ cls: "hg-daydetail" });
      det.createDiv({ cls: "hg-daydetail-title", text: `${sd.getMonth() + 1}/${sd.getDate()} (${DAY_NAMES[sd.getDay()]})${its.length ? tr(" · {0}가지", its.length) : ""}` });
      if (its.length) { const l = det.createDiv({ cls: "hg-itemlog-chips" }); its.forEach((t) => l.createSpan({ cls: "hg-itemlog-chip", text: t })); }
      else det.createDiv({ cls: "hg-itemlog-none", text: tr("이 날 적힌 내용이 없어요") });
      det.createDiv({ cls: "hg-daydetail-hint", text: tr("날짜를 누르면 그날 한 것이 여기에 나와요") });
    }
    return;
  }

  // 주 보기
  const ws = c.weekAnchor || weekStartOf(today, weekStart);
  const we = addDays(ws, 6);
  const isCur = fmt(ws) === fmt(weekStartOf(today, weekStart));
  navBtn("‹", tr("지난주"), () => c.onNav && c.onNav(-1));
  nav.createSpan({ cls: "hg-year hg-year-wide", text: tr("{0}월 {1}일 – {2}{3}일", ws.getMonth() + 1, ws.getDate(), we.getMonth() !== ws.getMonth() ? tr("{0}월 ", we.getMonth() + 1) : "", we.getDate()) });
  navBtn("›", tr("다음 주"), () => c.onNav && c.onNav(1), !isCur);
  {
    const back = nav.createSpan({ cls: "hg-yearbtn hg-thisyear" + (isCur ? " is-ghost" : ""), text: tr("이번 주") });
    if (!isCur) back.addEventListener("click", () => c.onNav && c.onNav(0));
    stopEditorGrab(back);
  }
  let sum = 0, hits = 0, maxV = 0;
  const dayList = [...Array(7)].map((_, i) => addDays(ws, i));
  for (const d of dayList) { const ds = fmt(d); const v = c.value(ds); sum += v; maxV = Math.max(maxV, v); if (v && c.hit(ds)) hits++; }
  right.createSpan({ cls: "hg-yearsum", text: measure ? tr("합계 {0}", fmtQty(sum, unit)) : tr("{0}/7일", hits) });
  if (c.onMode) modeTabs(right, "week", c.onMode);

  const freq = freqOf(ws);
  if (freq) {
    const wk = card.createDiv({ cls: "hg-weekbar" + (hits >= freq ? " is-done" : "") });
    wk.createSpan({ cls: "hg-weekbar-label", text: tr("주 {0}회 목표", freq) });
    const track = wk.createDiv({ cls: "hg-weekbar-track" });
    for (let n = 0; n < freq; n++) track.createDiv({ cls: "hg-weekbar-seg" + (n < hits ? " is-on" : "") });
    wk.createSpan({ cls: "hg-weekbar-count", text: tr("{0}/{1}회", hits, freq) + (hits >= freq ? " ✓" : "") });
  }

  const rows = card.createDiv({ cls: "hg-wrows" });
  const goalMax = Math.max(...dayList.map((d) => goalOf(fmt(d))), 0);
  const scale = measure ? Math.max(goalMax * 2, maxV, 1) : 1;
  for (const d of dayList) {
    const ds = fmt(d);
    const v = c.value(ds);
    const g = goalOf(ds);
    const row = card.createDiv ? rows.createDiv({ cls: "hg-wrow" + (ds > todayStr ? " is-future" : "") + (ds === todayStr ? " is-today" : "") }) : null;
    const lab = row.createDiv({ cls: "hg-wrow-day" });
    lab.createSpan({ cls: "hg-wrow-dow", text: DAY_NAMES[d.getDay()] });
    lab.createSpan({ text: tr(" {0}일", d.getDate()) });
    const track = row.createDiv({ cls: "hg-wrow-track" });
    if (ds <= todayStr && v) {
      const fill = track.createDiv({ cls: "hg-wrow-fill" + (c.hit(ds) ? " is-on" : "") });
      fill.style.width = `${Math.min(100, (measure ? v / scale : 1) * 100)}%`;
    }
    if (measure && g) {
      const gl = track.createDiv({ cls: "hg-wrow-goal" });
      gl.style.left = `${Math.min(100, (g / scale) * 100)}%`;
    }
    row.createDiv({ cls: "hg-wrow-val", text: ds > todayStr ? "" : v ? (measure ? fmtQty(v, unit) : "✓") : "—" });
    if (c.onCell && ds <= todayStr) { row.addClass("is-clickable"); row.addEventListener("click", () => c.onCell(ds)); }
    stopEditorGrab(row);
  }
}

const PRESET_COLORS = [
  ["보라", "#7c5cff"], ["파랑", "#3b82f6"], ["청록", "#14b8a6"], ["초록", "#2fb67c"],
  ["노랑", "#eab308"], ["주황", "#e8833a"], ["빨강", "#ef4444"], ["분홍", "#ec4899"],
];

// 카드 오른쪽 위 '⋯' 메뉴 버튼
function addMoreButton(head, opts) {
  if (!opts.onMore) return;
  const right = head.createDiv({ cls: "hg-headright" });
  const kids = [...head.children].filter((c) => c !== right && !c.classList.contains("hg-title"));
  for (const k of kids) right.appendChild(k);
  const more = right.createSpan({ cls: "hg-more", text: "⋯" });
  more.setAttr("aria-label", tr("더 보기"));
  more.addEventListener("click", (evt) => opts.onMore(evt));
  stopEditorGrab(more);
}

function makeColorDot(dot, opts) {
  if (!opts.onColor) return;
  dot.addClass("is-clickable");
  dot.setAttr("aria-label", tr("색 바꾸기"));
  dot.addEventListener("click", (evt) => { evt.stopPropagation(); opts.onColor(evt); });
  stopEditorGrab(dot);
}

// 라이브 프리뷰에서 클릭이 편집기로 넘어가 코드 블록이 열리지 않게 막는다
function stopEditorGrab(el) {
  el.addEventListener("mousedown", (e) => e.stopPropagation());
}

// PC에서 마우스 휠(세로)과 드래그로 가로 스크롤
function enableHorizontalScroll(scroll) {
  scroll.addEventListener("wheel", (e) => {
    const max = scroll.scrollWidth - scroll.clientWidth;
    if (max <= 0 || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
    if ((e.deltaY < 0 && scroll.scrollLeft <= 0) || (e.deltaY > 0 && scroll.scrollLeft >= max - 1)) return;
    e.preventDefault();
    scroll.scrollLeft += e.deltaY;
  }, { passive: false });

  let drag = null;
  scroll.addEventListener("pointerdown", (e) => {
    if (e.pointerType !== "mouse" || e.button !== 0 || scroll.scrollWidth <= scroll.clientWidth) return;
    drag = { x: e.clientX, left: scroll.scrollLeft, moved: false, id: e.pointerId };
  });
  scroll.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    if (!drag.moved && Math.abs(dx) > 4) {
      drag.moved = true;
      scroll.addClass ? scroll.addClass("is-dragging") : scroll.classList.add("is-dragging");
      try { scroll.setPointerCapture(drag.id); } catch (_) {}
    }
    if (drag.moved) scroll.scrollLeft = drag.left - dx;
  });
  const end = () => {
    if (!drag) return;
    const moved = drag.moved;
    scroll.classList.remove("is-dragging");
    setTimeout(() => { if (drag && drag.moved === moved) drag = null; }, 0);
    if (!moved) drag = null;
  };
  scroll.addEventListener("pointerup", end);
  scroll.addEventListener("pointercancel", () => { drag = null; scroll.classList.remove("is-dragging"); });
  scroll.addEventListener("click", (e) => {
    if (drag && drag.moved) { e.stopPropagation(); e.preventDefault(); }
    drag = null;
  }, true);
}

function parseBlock(source) {
  const opts = {};
  for (const raw of source.split("\n")) {
    const m = raw.match(/^\s*([a-zA-Z가-힣]+)\s*:\s*(.+?)\s*$/);
    if (!m) continue;
    const key = m[1].toLowerCase(), val = m[2];
    if (key === "habit" || key === "습관") opts.habits = val.split(",").map((s) => s.trim()).filter(Boolean);
    else if (key === "weeks" || key === "주") opts.weeks = parseInt(val, 10);
    else if (key === "color" || key === "색") opts.color = val;
    else if (key === "folder" || key === "폴더") opts.folder = val;
    else if (key === "goal" || key === "목표") opts.goal = parseInt(val, 10);
  }
  return opts;
}

// ── v24: 메인 화면용 요약 카드 (윗줄을 누르면 상세로) ──
const WEEK_MS = 7 * 86400000;

// 요약 카드 격자: 한 칸 = 하루. 기간(rangeStart~rangeEnd)만 그린다
function compactGrid(card, h, o) {
  const { today, weekStart } = o;
  const todayStr = fmt(today);
  const rs = o.rangeStart, re = o.rangeEnd;
  const rsStr = fmt(rs), reStr = fmt(re);
  const isM = h.kind === "measure";
  const goals = h.monthGoals || {};
  const counts = isM ? null : weekCounts(h.set, weekStart);
  const first = weekStartOf(rs, weekStart);
  const nWeeks = Math.round((weekStartOf(re, weekStart) - first) / WEEK_MS) + 1;

  const scroll = card.createDiv({ cls: `hg-scroll is-year hg-cg hg-cg-${o.mode}` });
  const grid = scroll.createDiv({ cls: "hg-grid" });
  const labels = grid.createDiv({ cls: "hg-col hg-labels" });
  labels.createDiv({ cls: "hg-month" });
  for (let i = 0; i < 7; i++) labels.createDiv({ cls: "hg-daylabel", text: i % 2 === 0 ? DAY_NAMES[(weekStart + i) % 7] : "" });

  let prevMonth = -1;
  for (let w = 0; w < nWeeks; w++) {
    const top = addDays(first, w * 7);
    const wf = isM ? 0 : freqOfWeek(h.freqs, top);
    const weekHit = wf > 0 && (counts.get(fmt(top)) || 0) >= wf;
    const col = grid.createDiv({ cls: "hg-col" + (weekHit ? " is-week-done" : "") });
    const month = col.createDiv({ cls: "hg-month" });
    const mEnd = addDays(top, 6);
    if (mEnd.getMonth() !== prevMonth) {
      if (mEnd >= rs && mEnd <= addDays(re, 6)) month.setText(tr("{0}월", mEnd.getMonth() + 1));
      prevMonth = mEnd.getMonth();
    }
    for (let i = 0; i < 7; i++) {
      const date = addDays(top, i);
      const ds = fmt(date);
      const cell = col.createDiv({ cls: "hg-cell" });
      if (!isM && isSchedDay(h.freqsRaw, h.days, date, today, weekStart)) cell.addClass("is-sched");
      if (ds < rsStr || ds > reStr) { cell.addClass("is-outside"); continue; }
      if (ds > todayStr) { cell.addClass("is-planned"); continue; }
      if (isM) {
        const v = h.entries.get(ds) || 0;
        const g = goalForMonth(goals, ds.slice(0, 7));
        if (v > 0) {
          cell.addClass("is-level");
          cell.style.setProperty("--hg-level", `${g ? Math.round(34 + 66 * Math.min(1, v / g)) : 100}%`);
        }
        cell.setAttr("aria-label", tr("{0}월 {1}일 · {2}", date.getMonth() + 1, date.getDate(), v ? fmtQty(v, h.unit) : tr("기록 없음")));
        if (o.onValue) { cell.addClass("is-clickable"); cell.addEventListener("click", () => o.onValue(ds, v)); }
      } else {
        const on = h.set.has(ds);
        if (on) cell.addClass("is-on");
        else if (weekHit) cell.addClass("is-rest");
        if (o.onToggle) { cell.addClass("is-clickable"); cell.addEventListener("click", () => o.onToggle(ds, !on)); }
        cell.setAttr("aria-label", tr("{0}월 {1}일 · {2}", date.getMonth() + 1, date.getDate(), on ? tr("완료") : weekHit ? tr("이번 주 목표 달성") : tr("기록 없음")));
      }
      if (ds === todayStr) cell.addClass("is-today");
    }
  }
  enableHorizontalScroll(scroll);
  stopEditorGrab(scroll);
  requestAnimationFrame(() => {
    scroll.classList.toggle("is-overflow", scroll.scrollWidth > scroll.clientWidth + 1);
    if (o.mode === "half") scroll.scrollLeft = scroll.scrollWidth;
    else {
      const t = scroll.querySelector(".is-today");
      scroll.scrollLeft = t ? t.parentElement.offsetLeft - scroll.clientWidth + 40 : 0;
    }
  });
  return scroll;
}

// 기간이 정해진 습관(예: 66일)의 요약: 기간 격자 + 옆에 진행 상황
function compactChallengeBody(card, h, o) {
  const { today, weekStart } = o;
  const todayStr = fmt(today);
  const set = h.set;
  const { days, start: startStr } = h.period;
  const startD = toDate(startStr);
  const endD = addDays(startD, days - 1);
  const endStr = fmt(endD);
  const dayNo = Math.max(0, Math.min(days, Math.round((toDate(todayStr) - startD) / 86400000) + 1));
  const finished = todayStr > endStr;
  const notStarted = todayStr < startStr;
  let done = 0;
  for (let i = 0; i < days; i++) { const ds = fmt(addDays(startD, i)); if (ds <= todayStr && set.has(ds)) done++; }
  const pct = Math.round((done / Math.max(1, dayNo)) * 100);
  const md = (d) => `${d.getMonth() + 1}/${d.getDate()} ${DAY_NAMES[d.getDay()]}`;

  const body = card.createDiv({ cls: "hg-cbody" });
  const scroll = body.createDiv({ cls: "hg-scroll is-year hg-cg hg-cg-half" });
  // 기간이 길수록 칸을 줄여서 한 줄에 들어오게 (30일 단위)
  const step = Math.min(7, Math.max(1, Math.ceil(days / 30)));
  const CELL = [0, 30, 26, 22, 18, 15, 13, 11][step];
  const GAP = CELL >= 22 ? 5 : CELL >= 15 ? 4 : 3;
  scroll.style.setProperty("--cc", `${CELL}px`);
  scroll.style.setProperty("--cgap", `${GAP}px`);
  const grid = scroll.createDiv({ cls: "hg-grid" });
  const labels = grid.createDiv({ cls: "hg-col hg-labels" });
  labels.createDiv({ cls: "hg-month" });
  for (let i = 0; i < 7; i++) labels.createDiv({ cls: "hg-daylabel", text: i % 2 === 0 ? DAY_NAMES[(weekStart + i) % 7] : "" });
  const first = weekStartOf(startD, weekStart);
  const nWeeks = Math.round((weekStartOf(endD, weekStart) - first) / WEEK_MS) + 1;
  let prevMonth = -1;
  for (let w = 0; w < nWeeks; w++) {
    const top = addDays(first, w * 7);
    const col = grid.createDiv({ cls: "hg-col" });
    const month = col.createDiv({ cls: "hg-month" });
    const mEnd = addDays(top, 6);
    if (mEnd.getMonth() !== prevMonth) { month.setText(tr("{0}월", mEnd.getMonth() + 1)); prevMonth = mEnd.getMonth(); }
    for (let i = 0; i < 7; i++) {
      const date = addDays(top, i);
      const ds = fmt(date);
      const cell = col.createDiv({ cls: "hg-cell" });
      if (ds < startStr || ds > endStr) { cell.addClass("is-outside"); continue; }
      if (ds > todayStr) cell.addClass("is-planned");
      else if (set.has(ds)) cell.addClass("is-on");
      if (ds === todayStr) cell.addClass("is-today");
      const n = Math.round((date - startD) / 86400000) + 1;
      cell.setAttr("aria-label", tr("{0}일째 · {1}월 {2}일 · {3}", n, date.getMonth() + 1, date.getDate(), ds > todayStr ? tr("예정") : set.has(ds) ? tr("완료") : tr("기록 없음")));
      if (o.onToggle && ds <= todayStr) { const on = set.has(ds); cell.addClass("is-clickable"); cell.addEventListener("click", () => o.onToggle(ds, !on)); }
    }
  }
  enableHorizontalScroll(scroll);
  stopEditorGrab(scroll);

  // 기간이 길면(120일 초과) 격자가 폭을 거의 다 써서 옆 통계는 생략 (칩에 D-day가 있어요)
  if (days <= 120) {
    const side = body.createDiv({ cls: "hg-cside hg-cside-ring" });
    const shown = finished ? days : dayNo;
    const NS = "http://www.w3.org/2000/svg";
    const ringBox = side.createDiv({ cls: "hg-ring" });
    const svg = activeDocument.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 84 84"); svg.setAttribute("width", "84"); svg.setAttribute("height", "84");
    const mkc = (cls) => { const c = activeDocument.createElementNS(NS, "circle"); c.setAttribute("cx", "42"); c.setAttribute("cy", "42"); c.setAttribute("r", "35"); c.setAttribute("class", cls); svg.appendChild(c); return c; };
    mkc("hg-ring-bg");
    const arc = mkc("hg-ring-fg");
    const circ = 2 * Math.PI * 35;
    arc.setAttribute("stroke-dasharray", `${(circ * shown / days).toFixed(1)} ${circ.toFixed(1)}`);
    arc.setAttribute("transform", "rotate(-90 42 42)");
    ringBox.appendChild(svg);
    const mid = ringBox.createDiv({ cls: "hg-ring-mid" });
    mid.createEl("b", { text: String(shown) });
    mid.createSpan({ text: tr("/ {0}일", days) });
    const info = side.createDiv({ cls: "hg-cinfo" });
    const rate = finished ? Math.round((done / days) * 100) : pct;
    const l1 = info.createDiv({ cls: "hg-cinfo-a" }); l1.createEl("b", { text: tr("{0}일", done) }); l1.appendText(tr(" 했어요"));
    const l2 = info.createDiv({ cls: "hg-cinfo-a" }); if (finished) { l2.appendText(tr("{0}일 중 ", days)); l2.createEl("b", { text: `${rate}%` }); }
    else if (dayNo > 0) { l2.appendText(tr("지난 {0}일 중 ", dayNo)); l2.createEl("b", { text: `${rate}%` }); }
    else l2.remove();
    info.createDiv({ cls: "hg-cinfo-b", text: finished ? tr("{0} 끝", md(endD)) : tr("{0} 끝 · D-{1}", md(endD), Math.round((endD - toDate(todayStr)) / 86400000)) });

  }
  requestAnimationFrame(() => {
    scroll.classList.toggle("is-overflow", scroll.scrollWidth > scroll.clientWidth + 1);
    const t = scroll.querySelector(".is-today");
    scroll.scrollLeft = t ? Math.max(0, t.parentElement.offsetLeft - scroll.clientWidth + 40) : 0;
  });
  return { done, pct, finished, notStarted, left: Math.round((endD - toDate(todayStr)) / 86400000), days };
}

function renderCompact(parent, h, o) {
  const { today, weekStart } = o;
  const todayStr = fmt(today);
  const isM = h.kind === "measure";
  const card = parent.createDiv({ cls: "hg-card hg-compact" + (isM ? " is-measure" : "") });
  if (o.color) card.style.setProperty("--hg-on", o.color);

  // 윗줄 칩 + 오늘 했는지 (보는 기간 기준: 지난 기간이면 그 기간의 목표만, 없으면 칩 숨김)
  const isCur = o.isCurrent !== false;
  const rs = o.rangeStart ? fmt(o.rangeStart) : "0000-00-00", re = o.rangeEnd ? fmt(o.rangeEnd) : "9999-99-99";
  const inRange = (ds) => ds >= rs && ds <= re;
  // 지난 기간이면 그 기간에서 가장 최근에 기록한 달을 기준으로 삼는다
  let ref = o.refDate || today;
  if (!isCur) {
    let last = "";
    for (const ds of (isM ? [...h.entries].filter(([, v]) => v > 0).map(([d]) => d) : h.set)) if (inRange(ds) && ds > last) last = ds;
    if (last) ref = toDate(last);
  }
  const refKey = monthKey(ref), refMonth = ref.getMonth() + 1;
  const fOf = (g) => { const f = goalForMonth(g, refKey); return f > 0 && f < 7 ? Math.round(f) : 0; };
  let chip = "", chipDone = false, doneToday = false;
  if (isM) {
    const goals = h.monthGoals || {};
    const hit = (ds, v) => v > 0 && v >= goalForMonth(goals, ds.slice(0, 7));
    doneToday = hit(todayStr, h.entries.get(todayStr) || 0);
    const curGoal = goalForMonth(goals, refKey);
    const freq = isCur ? freqOfWeek(h.freqs, weekStartOf(today, weekStart)) : fOf(h.freqs);
    if (isCur) {
      let weekCount = 0;
      const wk = fmt(weekStartOf(today, weekStart));
      for (const [ds, v] of h.entries) if (hit(ds, v) && fmt(weekStartOf(toDate(ds), weekStart)) === wk) weekCount++;
      chipDone = !!freq && weekCount >= freq;
    }
    const hasRec = [...h.entries].some(([ds, v]) => v > 0 && inRange(ds));
    if (curGoal && (isCur || hasRec)) chip = tr("{0}월 · 하루 {1}", refMonth, fmtQty(curGoal, h.unit)) + (freq ? tr(" · 주 {0}회", freq) : "") + (chipDone ? " ✓" : "");
    else if (isCur) chip = tr("목표 없음");
  } else {
    doneToday = h.set.has(todayStr);
    if (!h.period) {
      const goal = isCur ? freqOfWeek(h.freqs, weekStartOf(today, weekStart)) : fOf(h.freqs);
      if (isCur) {
        const wc = weekCounts(h.set, weekStart).get(fmt(weekStartOf(today, weekStart))) || 0;
        chipDone = !!goal && wc >= goal;
      }
      const hasRec = [...h.set].some(inRange);
      const sch = scheduleAt(h.freqsRaw, h.days, refKey);
      if (goal && (isCur || hasRec)) chip = (sch && sch.days ? tr("{0}월 · {1}", refMonth, daysLabel(sch.days)) : tr("{0}월 · 주 {1}회", refMonth, goal)) + (chipDone ? " ✓" : "");
      else if (isCur) chip = tr("매일");
      else if (hasRec) chip = tr("매일");
    }
  }

  const head = card.createDiv({ cls: "hg-head hg-head-open" });
  const title = head.createDiv({ cls: "hg-title" });
  const dot = title.createSpan({ cls: "hg-dot" + (doneToday ? " is-done" : "") });
  makeColorDot(dot, o);
  title.createSpan({ cls: "hg-name", text: h.name });
  const right = head.createDiv({ cls: "hg-headright" });
  const chipEl = (chip || (!isM && h.period)) ? right.createSpan({ cls: "hg-goal" + (chipDone ? " is-done" : ""), text: chip }) : null;
  const chipAct = (!isM && h.period) ? (o.onPeriod ? (evt) => o.onPeriod(evt) : null) : (o.onGoals ? () => o.onGoals(ref.getFullYear()) : null);
  if (chipAct && chipEl) {
    chipEl.addClass("is-clickable");
    chipEl.setAttr("aria-label", (!isM && h.period) ? tr("기간 바꾸기") : tr("목표 정하기 (주 몇 회, 하루 목표)"));
    chipEl.addEventListener("click", (evt) => { evt.stopPropagation(); chipAct(evt); });
    stopEditorGrab(chipEl);
  }
  if (o.onMore) {
    const more = right.createSpan({ cls: "hg-more hg-more-lg", text: "⋯" });
    more.setAttr("aria-label", tr("더 보기 (순서 바꾸기, 보관함으로 옮기기)"));
    more.addEventListener("click", (evt) => { evt.stopPropagation(); o.onMore(evt); });
    stopEditorGrab(more);
  }
  right.createSpan({ cls: "hg-chev", text: "›" });
  head.setAttr("aria-label", tr("{0} 자세히 보기", h.name));
  head.addEventListener("click", () => o.onOpen());
  stopEditorGrab(head);

  let footer = "";
  if (!isM && h.period) {
    const r = compactChallengeBody(card, h, o);
    chipEl.setText(r.finished ? tr("{0}일 완료", r.days) : r.notStarted ? tr("{0}일 · 시작 전", r.days) : tr("{0}일 챌린지 · D-{1}", r.days, r.left));
    if (r.finished) chipEl.addClass("is-done");
    footer = "";
    if (r.finished) {
      const ban = card.createDiv({ cls: "hg-chal-banner" });
      ban.createDiv({ cls: "hg-chal-banner-t", text: tr("{0}일 끝! {1}일 했어요 ({2}%)", r.days, r.done, Math.round((r.done / r.days) * 100)) });
      const row = ban.createDiv({ cls: "hg-chal-banner-btns" });
      const b = (label, fn) => { const x = row.createEl("button", { text: label }); x.addEventListener("click", fn); stopEditorGrab(x); };
      if (o.onExtend) { b(tr("+30일 더 하기"), () => o.onExtend(30)); b(tr("기간 없이 계속"), () => o.onExtend(0)); }
      if (o.onArchive) b(tr("보관함으로"), () => o.onArchive());
    }
  } else {
    compactGrid(card, h, o);
    const rsStr = fmt(o.rangeStart), reStr = fmt(o.rangeEnd);
    if (isM) {
      let sum = 0;
      for (const [ds, v] of h.entries) if (ds >= rsStr && ds <= reStr) sum += v;
      footer = `${o.rangeText} ${fmtQty(sum, h.unit)}`;
    } else {
      let n = 0;
      for (const ds of h.set) if (ds >= rsStr && ds <= reStr) n++;
      footer = tr("{0} {1}회", o.rangeText, n);
    }
  }
  if (footer) card.createDiv({ cls: "hg-ctotal", text: footer });
  return card;
}

// 보관함 목록의 한 줄(카드)
function renderArchiveRow(parent, h, o) {
  const today = o.today;
  const isM = h.kind === "measure";
  const card = parent.createDiv({ cls: "hg-card hg-arch-row" });
  if (o.color) card.style.setProperty("--hg-on", o.color);
  const dates = [...h.set].sort();
  const firstDs = dates[0], lastDs = dates[dates.length - 1];
  let badge = tr("보관됨"), badgeDone = false;
  if (!isM && h.period) {
    const endStr = fmt(addDays(toDate(h.period.start), h.period.days - 1));
    if (fmt(today) > endStr) { badge = tr("{0}일 완료", h.period.days); badgeDone = true; }
  }
  const head = card.createDiv({ cls: "hg-head hg-head-open" });
  const title = head.createDiv({ cls: "hg-title" });
  title.createSpan({ cls: "hg-dot is-done" });
  title.createSpan({ cls: "hg-name", text: h.name });
  title.createSpan({ cls: "hg-goal" + (badgeDone ? " is-done" : ""), text: badge });
  head.createSpan({ cls: "hg-chev", text: "›" });
  head.addEventListener("click", () => o.onOpen());
  stopEditorGrab(head);

  const ym = (ds) => `${ds.slice(0, 4)}.${Number(ds.slice(5, 7))}`;
  const total = isM ? fmtQty([...h.entries.values()].reduce((a, b) => a + b, 0), h.unit) : tr("{0}회", h.set.size);
  let line = tr("기록이 없어요");
  if (firstDs) {
    const span = Math.round((toDate(lastDs) - toDate(firstDs)) / 86400000) + 1;
    const rate = Math.round((h.set.size / span) * 100);
    line = tr("{0} – {1} · 총 {2} · 기록한 날 {3}%", ym(firstDs), ym(lastDs), total, rate);
  }
  card.createDiv({ cls: "hg-ainfo2", text: line });

  if (lastDs) {
    const yr = lastDs.slice(0, 4);
    const per = new Array(12).fill(0);
    if (isM) { for (const [ds, v] of h.entries) if (ds.startsWith(yr)) per[Number(ds.slice(5, 7)) - 1] += v; }
    else { for (const ds of h.set) if (ds.startsWith(yr)) per[Number(ds.slice(5, 7)) - 1]++; }
    const max = Math.max(...per, 1);
    const strip = card.createDiv({ cls: "hg-astrip" });
    per.forEach((v, i) => {
      const c = strip.createEl("i");
      c.style.setProperty("--p", v ? `${Math.round(25 + 75 * (v / max))}%` : "0%");
      c.setAttr("aria-label", tr("{0}년 {1}월", yr, i + 1));
    });
    const ax = card.createDiv({ cls: "hg-aaxis" });
    ax.createSpan({ text: tr("{0}년 1월", yr) });
    ax.createSpan({ text: tr("12월") });
  }
  const act = card.createDiv({ cls: "hg-aact" });
  const back = act.createEl("button", { cls: "hg-abtn2", text: tr("다시 시작") });
  back.addEventListener("click", (e) => { e.stopPropagation(); o.onRestore(); });
  stopEditorGrab(back);
  return card;
}

class HabitView extends MarkdownRenderChild {
  constructor(plugin, el, source) {
    super(el);
    this.plugin = plugin;
    this.opts = parseBlock(source);
    this.timer = null;
    this.years = {};
    this.months = {};
    this.weekAnchors = {};
    this.selDays = {};
    this.view = "main"; // main | detail | archive | archdetail
    this.openKey = null;
    this.mainYear = null;
    this.halfOffset = 0;
  }

  get folderPath() { return normalizePath(this.opts.folder || this.plugin.settings.folder); }

  onload() {
    this.render();
    const v = this.plugin.app.vault;
    const maybe = (f) => { if (f && f.path && f.path.startsWith(this.folderPath + "/")) this.schedule(); };
    this.registerEvent(v.on("modify", maybe));
    this.registerEvent(v.on("create", maybe));
    this.registerEvent(v.on("delete", maybe));
    this.registerEvent(v.on("rename", (f, old) => { maybe(f); if (old && old.startsWith(this.folderPath + "/")) this.schedule(); }));
    this.registerEvent(this.plugin.app.metadataCache.on("changed", maybe));
    this.registerEvent(this.plugin.app.workspace.on("habit-grid:refresh", () => this.schedule()));
    this.register(() => clearTimeout(this.timer));
  }

  schedule() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.render(), 250);
  }

  // 상세·읽기 전용 상세에서 쓰는 전체 카드 (예전 카드 그대로)
  fullCard(wrap, h, colorOf, readonly, noMore) {
    const { settings } = this.plugin;
    const key = h.key;
    const common = {
      color: colorOf(h),
      onColor: (evt) => this.plugin.openColorMenu(evt, h.target, h.unit, h.color),
      weeks: this.opts.weeks || settings.weeks,
      range: this.opts.weeks ? "recent" : settings.range,
      year: this.years[key],
      onYear: (y) => { this.years[key] = y; this.render(); },
      mode: ((settings.modes || {})[h.name] === "month") ? "month" : "year",
      onMode: (m) => { settings.modes = Object.assign({}, settings.modes, { [h.name]: m }); this.plugin.saveSettings(); this.render(); },
      monthAnchor: this.months[key],
      weekAnchor: this.weekAnchors[key],
      onNav: (delta) => {
        const now = new Date();
        const cur = this.months[key] || new Date(now.getFullYear(), now.getMonth(), 1);
        this.months[key] = delta === 0 ? undefined : new Date(cur.getFullYear(), cur.getMonth() + delta, 1);
        this.render();
      },
      weekStart: settings.weekStart,
      onMore: (evt) => this.plugin.openHabitMenu(evt, h),
      freqs: h.freqs, freqsRaw: h.freqsRaw, days: h.days,
      period: h.kind === "check" ? h.period : null,
      onExtend: (n) => this.plugin.extendPeriod(h, n),
      onPeriod: (evt) => this.plugin.openPeriodMenu(evt, h),
      onArchive: () => this.plugin.setArchived(h, true),
      itemsOf: h.items ? (ds) => h.items.get(ds) || [] : null,
      itemsAll: h.items || null,
      selDay: this.selDays[key],
      onGoals: (yr) => this.plugin.openGoals(h, yr),
      goalsFolded: !!(settings.goalsFolded || {})[h.name],
      onFoldGoals: (v) => { settings.goalsFolded = Object.assign({}, settings.goalsFolded, { [h.name]: v }); this.plugin.saveSettings(); this.render(); },
      onWeekNav: (delta) => {
        const now = weekStartOf(new Date(), settings.weekStart);
        const cur = this.weekAnchors[key] || now;
        const next = delta === 0 ? undefined : addDays(cur, delta * 7);
        this.weekAnchors[key] = next && fmt(next) === fmt(now) ? undefined : next;
        this.render();
      },
    };
    let o;
    if (h.kind === "check") {
      o = {
        ...common,
        onToggle: settings.clickToToggle ? (ds, on) => this.plugin.recordCheck(h, ds, on) : null,
        onSelect: h.items ? (ds) => { this.selDays[key] = ds; this.render(); } : null,
      };
    } else {
      o = {
        ...common, measure: true, unit: h.unit, entries: h.entries, monthGoals: h.monthGoals,
        onValue: (ds, cur) => this.plugin.askValue(h.target, ds, cur, h.unit, goalForMonth(h.monthGoals, ds.slice(0, 7))),
        onMonthGoal: (mk, cur) => this.plugin.askMonthGoal(h.target, mk, cur, h.unit),
      };
    }
    if (readonly) for (const k of ["onColor", "onMore", "onToggle", "onSelect", "onValue", "onMonthGoal", "onGoals", "onPeriod", "onExtend", "onArchive"]) o[k] = null;
    if (noMore) o.onMore = null;
    return renderHabit(wrap, h.name, h.set, o);
  }

  async render() {
    const { settings } = this.plugin;
    const el = this.containerEl;
    const wrap = createDiv({ cls: "hg-wrap" + (this.opts.habits ? "" : " hg-v24") });
    const loaded = await this.plugin.loadHabits(this.folderPath, this.opts.habits);
    const habits = loaded ? loaded.filter((h) => !h.archived) : null;
    const archived = loaded ? loaded.filter((h) => h.archived) : [];

    if (habits === null) {
      wrap.createDiv({ cls: "hg-empty", text: tr("'{0}' 폴더를 찾을 수 없어요.", this.folderPath) });
      el.empty(); el.appendChild(wrap);
      return;
    }

    const today = new Date();
    const colorOf = (h) => h.color || this.opts.color || settings.color;

    if (this.opts.habits) {
      // 노트에 ```habit 습관: 이름``` 처럼 직접 고른 경우: 예전처럼 전체 카드를 그대로 보여 줘요
      if (!habits.length) wrap.createDiv({ cls: "hg-empty", text: tr("아직 기록된 습관이 없어요.") });
      for (const h of habits) this.fullCard(wrap, h, colorOf, false);
    } else {
      if (this.view === "detail" && !habits.find((x) => x.key === this.openKey)) this.view = "main";
      if (this.view === "archdetail" && !archived.find((x) => x.key === this.openKey)) this.view = "archive";
      if (this.view === "detail" || this.view === "archdetail") this.renderDetail(wrap, habits, archived, colorOf);
      else if (this.view === "archive") this.renderArchive(wrap, archived, colorOf, today);
      else this.renderMain(wrap, habits, archived, colorOf, today);
    }

    el.empty();
    el.appendChild(wrap);
  }

  go(view, key) {
    this.view = view;
    this.openKey = key || null;
    this.render();
  }

  // 상세·보관함 맨 위 줄: [‹ 목록] 가운데 이름 [⋯]
  backBar(wrap, label, onBack, mid, color, onMore) {
    const bar = wrap.createDiv({ cls: "hg-backbar" });
    if (color) bar.style.setProperty("--hg-on", color);
    const left = bar.createDiv({ cls: "hg-bb-left" });
    const back = left.createEl("button", { cls: "hg-backbtn", text: `‹ ${label}` });
    back.setAttr("aria-label", tr("{0}으로 돌아가기", label));
    back.addEventListener("click", onBack);
    stopEditorGrab(back);
    const t = bar.createDiv({ cls: "hg-bartitle" });
    if (color) t.createSpan({ cls: "hg-dot is-done" });
    t.createSpan({ text: mid || "" });
    const right = bar.createDiv({ cls: "hg-bb-right" });
    if (onMore) {
      const m = right.createEl("button", { cls: "hg-circbtn", text: "⋯" });
      m.setAttr("aria-label", tr("더 보기"));
      m.addEventListener("click", (evt) => onMore(evt));
      stopEditorGrab(m);
    }
  }

  renderMain(wrap, habits, archived, colorOf, today) {
    const { settings } = this.plugin;
    const todayStr = fmt(today);
    const mode = settings.gridMode === "half" ? "half" : "year";

    // 가장 오래된 기록 (그 앞으로는 못 넘기게)
    let earliest = "";
    for (const h of habits) for (const ds of h.set) if (!earliest || ds < earliest) earliest = ds;

    let rangeStart, rangeEnd, label, rangeText, canPrev, atNow, onPrev, onNext, onNow;
    if (mode === "year") {
      const cur = today.getFullYear();
      const year = this.mainYear || cur;
      rangeStart = new Date(year, 0, 1); rangeEnd = new Date(year, 11, 31);
      label = `${year}`; rangeText = tr("{0}년", year);
      atNow = year >= cur;
      canPrev = true;
      onPrev = () => { this.mainYear = year - 1; };
      onNext = () => { this.mainYear = year + 1 >= cur ? null : year + 1; };
      onNow = () => { this.mainYear = null; };
    } else {
      const off = this.halfOffset || 0;
      const endIdx = today.getFullYear() * 12 + today.getMonth() - 6 * off;
      const startIdx = endIdx - 5;
      const sy = Math.floor(startIdx / 12), sm = startIdx % 12, ey = Math.floor(endIdx / 12), em = endIdx % 12;
      rangeStart = new Date(sy, sm, 1);
      rangeEnd = off === 0 ? today : new Date(ey, em + 1, 0);
      label = sy === ey ? `${sy}.${sm + 1} – ${em + 1}` : `${sy}.${sm + 1} – ${ey}.${em + 1}`;
      rangeText = label;
      atNow = off === 0;
      canPrev = true;
      onPrev = () => { this.halfOffset = off + 1; };
      onNext = () => { this.halfOffset = Math.max(0, off - 1); };
      onNow = () => { this.halfOffset = 0; };
    }

    // 맨 위: ‹ 2026 › 와 보관함 버튼
    const bar = wrap.createDiv({ cls: "hg-topbar hg-maintop" });
    const nav = bar.createDiv({ cls: "hg-yearnav" });
    const btn = (text, aria, enabled, fn) => {
      const b = nav.createEl("button", { cls: "hg-yearbtn", text });
      b.setAttr("aria-label", aria);
      stopEditorGrab(b);
      if (!enabled) b.addClass("is-disabled");
      else b.addEventListener("click", () => { fn(); this.render(); });
    };
    btn("‹", mode === "year" ? tr("이전 해") : tr("이전 6개월"), canPrev, onPrev);
    nav.createSpan({ cls: "hg-year hg-year-wide", text: label });
    btn("›", mode === "year" ? tr("다음 해") : tr("다음 6개월"), !atNow, onNext);
    const now = nav.createSpan({ cls: "hg-yearbtn hg-thisyear" + (atNow ? " is-ghost" : ""), text: tr("올해") });
    if (!atNow) now.addEventListener("click", () => { onNow(); this.render(); });
    stopEditorGrab(now);
    const rbar = bar.createDiv({ cls: "hg-rbar" });
    const ab = rbar.createEl("button", { cls: "hg-archbtn" });
    ab.createSpan({ text: tr("보관함") });
    ab.createSpan({ cls: "hg-archn", text: String(archived.length) });
    ab.setAttr("aria-label", tr("보관함 열기"));
    ab.addEventListener("click", () => this.go("archive"));
    stopEditorGrab(ab);

    // 오늘 줄
    if (habits.length) renderTodayBar(wrap, habits, today, {
      colorOf,
      weekStart: settings.weekStart,
      onCheck: (h, ds) => this.plugin.recordCheck(h, ds, !h.set.has(ds)),
      onAdd: (h, delta) => this.plugin.recordValue(h, todayStr, Math.round(((h.entries.get(todayStr) || 0) + delta) * 100) / 100),
      onValue: (h, ds) => this.plugin.askValue(h.target, ds, h.entries.get(ds) || 0, h.unit, goalForMonth(h.monthGoals, ds.slice(0, 7))),
      onRecord: () => this.plugin.openRecorder(),
    });
    else wrap.createDiv({ cls: "hg-empty", text: tr("진행 중인 습관이 없어요.") });

    // 기간이 정해진 습관(66일 등)은 보고 있는 기간과 겹칠 때만 보여요
    const rsStr = fmt(rangeStart), reStr = fmt(rangeEnd);
    const todayInRange = today >= rangeStart && today <= rangeEnd;
    const visible = habits.filter((h) => {
      // 시작 전(첫 기록보다 앞선 기간)에는 보여주지 않는다
      let first = "";
      for (const ds of (h.kind === "measure" ? [...h.entries].filter(([, v]) => v > 0).map(([d]) => d) : h.set)) if (!first || ds < first) first = ds;
      if (h.period && h.period.start && (!first || h.period.start < first)) first = h.period.start;
      if (first ? first > reStr : !todayInRange) return false;
      if (h.kind !== "check" || !h.period) return true;
      const endStr = fmt(addDays(toDate(h.period.start), h.period.days - 1));
      return h.period.start <= reStr && endStr >= rsStr;
    });
    for (const h of visible) {
      renderCompact(wrap, h, {
        color: colorOf(h), today, weekStart: settings.weekStart, mode, rangeStart, rangeEnd, rangeText,
        isCurrent: today >= rangeStart && today <= rangeEnd, refDate: (today >= rangeStart && today <= rangeEnd) ? today : rangeEnd,
        onColor: (evt) => this.plugin.openColorMenu(evt, h.target, h.unit, h.color),
        onOpen: () => this.go("detail", h.key),
        onMore: (evt) => this.plugin.openHabitMenu(evt, h),
        onGoals: (yr) => this.plugin.openGoals(h, yr),
        onToggle: (h.kind === "check" && settings.clickToToggle) ? (ds, on) => this.plugin.recordCheck(h, ds, on) : null,
        onValue: h.kind === "measure" ? (ds, cur) => this.plugin.askValue(h.target, ds, cur, h.unit, goalForMonth(h.monthGoals, ds.slice(0, 7))) : null,
        onPeriod: (evt) => this.plugin.openPeriodMenu(evt, h),
        onExtend: (n) => this.plugin.extendPeriod(h, n),
        onArchive: () => this.plugin.setArchived(h, true),
      });
    }

    const foot = wrap.createDiv({ cls: "hg-foot" });
    const add = foot.createDiv({ cls: "hg-add", text: tr("＋ 새 습관") });
    add.addEventListener("click", () => this.plugin.newHabit());
    stopEditorGrab(add);
    const rec = foot.createDiv({ cls: "hg-add", text: tr("지난 기록 채우기") });
    rec.addEventListener("click", () => this.plugin.openRecorder());
    stopEditorGrab(rec);
  }

  renderDetail(wrap, habits, archived, colorOf) {
    const arch = this.view === "archdetail";
    const h = (arch ? archived : habits).find((x) => x.key === this.openKey);
    this.backBar(wrap, arch ? tr("보관함") : tr("목록"), () => this.go(arch ? "archive" : "main"), h.name, colorOf(h), arch ? null : (evt) => this.plugin.openHabitMenu(evt, h));
    if (arch) {
      const ban = wrap.createDiv({ cls: "hg-archbanner" });
      const lastDs = [...h.set].sort().pop();
      ban.createDiv({ cls: "hg-archbanner-t", text: tr("보관함에 있어요{0}\n기록은 그대로 보여요 (읽기 전용)", lastDs ? tr(" · 마지막 기록 {0}.{1}.{2}", lastDs.slice(0, 4), Number(lastDs.slice(5, 7)), Number(lastDs.slice(8, 10))) : "") });
      const b = ban.createEl("button", { cls: "hg-abtn2 is-primary", text: tr("다시 시작") });
      b.addEventListener("click", async () => { await this.plugin.setArchived(h, false); this.go("main"); });
      stopEditorGrab(b);
    }
    this.fullCard(wrap, h, colorOf, arch, true);
  }

  renderArchive(wrap, archived, colorOf, today) {
    this.backBar(wrap, tr("목록"), () => this.go("main"), tr("보관함"));
    wrap.createDiv({ cls: "hg-ainfo2 hg-aintro" + (archived.length ? "" : " is-empty"), text: archived.length ? tr("끝낸 습관 {0}개 · 눌러서 지난 기록을 볼 수 있어요", archived.length) : tr("보관함이 비었어요. 습관 카드의 ⋯ 메뉴에서 '보관함으로 옮기기'를 고르면 여기로 와요.") });
    for (const h of archived) {
      renderArchiveRow(wrap, h, {
        color: colorOf(h), today,
        onOpen: () => this.go("archdetail", h.key),
        onRestore: () => this.plugin.setArchived(h, false),
      });
    }
    if (archived.length) wrap.createDiv({ cls: "hg-ainfo2 hg-afoot", text: tr("보관해도 기록은 지워지지 않아요 · 다시 시작하면 같은 기록을 이어서 써요") });
  }
}

// 최근 7일 (오늘 포함) 상태
function recentDaysOf(h, today) {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = addDays(today, -i);
    const ds = fmt(d);
    let state = "off", text = "", ratio = 0;
    if (h.kind === "check") {
      if (h.set.has(ds)) { state = "on"; text = "✓"; }
    } else {
      const v = h.entries.get(ds) || 0;
      const g = goalForMonth(h.monthGoals, ds.slice(0, 7));
      if (v > 0) { state = !g || v >= g ? "on" : "partial"; text = fmtQtyShort(v, h.unit); ratio = g ? Math.round(12 + 88 * Math.min(1, v / g)) : 100; }
    }
    days.push({ ds, dow: DAY_NAMES[d.getDay()], date: d.getDate(), today: i === 0, state, text, ratio });
  }
  return days;
}

function renderRecent(card, days, onTap) {
  const row = card.createDiv({ cls: "hg-recent" });
  for (const d of days) {
    const b = row.createDiv({ cls: `hg-day is-${d.state}` + (d.today ? " is-today" : "") });
    if (d.ratio) b.style.setProperty("--hg-ratio", `${d.ratio}%`);
    b.createDiv({ cls: "hg-day-dow", text: d.today ? tr("오늘") : d.dow });
    b.createDiv({ cls: "hg-day-mark", text: d.text || String(d.date) });
    b.setAttr("aria-label", d.ds);
    if (onTap) b.addEventListener("click", () => onTap(d.ds));
    stopEditorGrab(b);
  }
}

function stepsFor(unit) {
  if (unit === "시간") return [[0.5, tr("+30분")], [1, tr("+1시간")]];
  if (unit === "분") return [[10, tr("+10분")], [30, tr("+30분")]];
  return [[1, `+1${unit}`]];
}

// 대시보드 맨 위 '오늘' 줄
// 그 날 해야 하는 습관인지: 요일을 정했다면 그 요일이거나 이미 기록이 있을 때만
function dueOn(h, date, weekStart, done) {
  if (done) return true;
  if (!h.days || !Object.keys(h.days).length) return true;
  const sc = scheduleAt(h.freqsRaw, h.days, weekMonthKey(weekStartOf(date, weekStart)));
  return !(sc && sc.days) || sc.days.includes(date.getDay());
}

// 오늘 줄: 옆으로 넘기면 지난 날들도 보여요
function renderTodayBar(parent, habits, today, opts) {
  const weekStart = opts.weekStart == null ? 1 : opts.weekStart;
  const todayStr = fmt(today);
  const DAYS = 14;
  const box = parent.createDiv({ cls: "hg-todaybar" });
  const pager = box.createDiv({ cls: "hg-todaypager" });
  const pages = [];
  const doneOf = (h, ds) => h.kind === "check" ? h.set.has(ds) : (h.entries.get(ds) || 0) >= (goalForMonth(h.monthGoals, ds.slice(0, 7)) || 0.0001);
  const recOf = (h, ds) => h.kind === "check" ? h.set.has(ds) : (h.entries.get(ds) || 0) > 0;
  const startedBy = (h, ds) => {
    if (ds >= todayStr) return true;
    if (h.period && h.period.start && h.period.start > ds) return false;
    const all = h.kind === "check" ? [...h.set] : [...h.entries].filter(([, v]) => v > 0).map(([d]) => d);
    return all.some((d) => d <= ds);
  };
  for (let n = DAYS - 1; n >= 0; n--) {
    const date = addDays(today, -n);
    const ds = fmt(date);
    const isToday = n === 0;
    const list = habits.filter((h) => startedBy(h, ds) && dueOn(h, date, weekStart, recOf(h, ds)));
    const page = pager.createDiv({ cls: "hg-todaypage" });
    pages.push(page);
    const head = page.createDiv({ cls: "hg-todayhead" });
    const nav = head.createSpan({ cls: "hg-todaynav" });
    const prev = nav.createEl("button", { cls: "hg-yearbtn", text: "‹" });
    prev.setAttr("aria-label", tr("이전 날"));
    const title = isToday
      ? tr("오늘 · {0}월 {1}일 ({2})", date.getMonth() + 1, date.getDate(), DAY_NAMES[date.getDay()])
      : tr("{0}월 {1}일 ({2})", date.getMonth() + 1, date.getDate(), DAY_NAMES[date.getDay()]);
    nav.createSpan({ cls: "hg-todaytitle", text: title });
    const next = nav.createEl("button", { cls: "hg-yearbtn" + (isToday ? " is-ghost" : ""), text: "›" });
    next.setAttr("aria-label", tr("다음 날"));
    const goPage = (d) => { const t = pages[pages.indexOf(page) + d]; if (t) pager.scrollTo({ left: t.offsetLeft - pager.offsetLeft, behavior: "smooth" }); };
    if (n === DAYS - 1) prev.addClass("is-ghost"); else prev.addEventListener("click", () => goPage(-1));
    if (!isToday) next.addEventListener("click", () => goPage(1));
    stopEditorGrab(prev); stopEditorGrab(next);
    head.createSpan({ cls: "hg-todaycount", text: `${list.filter((h) => doneOf(h, ds)).length}/${list.length}` });

    const lst = page.createDiv({ cls: "hg-todaylist" });
    if (!list.length) lst.createSpan({ cls: "hg-todayempty", text: tr("이 날 할 습관이 없어요") });
    for (const h of list) {
      const item = lst.createDiv({ cls: "hg-titem" });
      const color = opts.colorOf(h);
      if (color) item.style.setProperty("--hg-on", color);
      if (h.kind === "check") {
        const on = h.set.has(ds);
        const b = item.createDiv({ cls: "hg-tbtn" + (on ? " is-on" : "") });
        b.createSpan({ cls: "hg-tcheck", text: on ? "✓" : "" });
        b.createSpan({ text: h.name });
        b.addEventListener("click", () => opts.onCheck(h, ds));
        stopEditorGrab(b);
      } else {
        const v = h.entries.get(ds) || 0;
        const g = goalForMonth(h.monthGoals, ds.slice(0, 7));
        const on = v > 0 && (!g || v >= g);
        const b = item.createDiv({ cls: "hg-tbtn is-measure" + (on ? " is-on" : v > 0 ? " is-partial" : "") });
        b.createSpan({ text: h.name });
        b.createSpan({ cls: "hg-tval", text: h.unit === "시간" ? `${fmtDurShort(v)}${g ? " / " + fmtDurShort(g) : ""}` : `${fmtNum(v)}${g ? "/" + fmtNum(g) : ""}${unitLabel(h.unit)}` });
        b.addEventListener("click", () => opts.onValue(h, ds));
        stopEditorGrab(b);
      }
    }
  }
  setTimeout(() => { pager.scrollLeft = pager.scrollWidth; }, 0);
}

// 숫자 하나 입력받는 창
class DayItemsModal extends Modal {
  constructor(app, name, ds, items) { super(app); Object.assign(this, { name, ds, items }); }
  onOpen() {
    const d = toDate(this.ds);
    this.titleEl.setText(tr("{0}월 {1}일 ({2}) {3}", d.getMonth() + 1, d.getDate(), DAY_NAMES[d.getDay()], this.name));
    if (!this.items.length) { this.contentEl.createDiv({ cls: "hg-empty", text: tr("이 날 적힌 내용이 없어요") }); return; }
    const box = this.contentEl.createDiv({ cls: "hg-itemlog-chips" });
    for (const it of this.items) box.createSpan({ cls: "hg-itemlog-chip", text: it });
  }
  onClose() { this.contentEl.empty(); }
}

// 되돌릴 수 없는 변경 앞에서 한 번 더 확인
class ConfirmModal extends Modal {
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

class NumberModal extends Modal {
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
    if (this.unit === "시간") {
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
    setTimeout(() => input.focus(), 50);
  }
  onClose() { this.contentEl.empty(); }
}

// 달별 목표를 한 번에 정하는 창 (지난달·다음 달 모두)
class GoalsModal extends Modal {
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

// 날짜를 골라 여러 습관을 한 번에 기록하는 창
class RecordModal extends Modal {
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

// 새 습관 만들기 창
class NewHabitModal extends Modal {
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

class HabitGridPlugin extends Plugin {
  async onload() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    setLang(resolveLang(this.settings.lang));
    this.registerMarkdownCodeBlockProcessor("habit", (source, el, ctx) => {
      ctx.addChild(new HabitView(this, el, source));
    });
    this.addSettingTab(new HabitGridSettingTab(this.app, this));

    this.addRibbonIcon("layout-grid", tr("습관 대시보드 열기"), () => this.openDashboard());
    this.addCommand({ id: "open-dashboard", name: tr("습관 대시보드 열기"), callback: () => this.openDashboard() });
    this.addCommand({ id: "setup", name: tr("습관 폴더와 대시보드 만들기"), callback: () => this.setup(true) });
    this.addCommand({ id: "new-habit", name: tr("새 습관 만들기"), callback: () => this.newHabit() });
    this.addCommand({ id: "record", name: tr("습관 기록하기 (날짜 골라서)"), callback: () => this.openRecorder() });
    this.addRibbonIcon("calendar-check", tr("습관 기록하기"), () => this.openRecorder());

    this.app.workspace.onLayoutReady(() => {
      if (!this.settings.initialized) this.setup(false);
      setTimeout(() => this.tidyArchive(), 2000);
    });
  }

  onunload() {
    activeDocument.querySelectorAll(".hg-pop").forEach((n) => n.remove());
  }

  get dashboardPath() {
    return normalizePath(`${this.settings.folder}/${this.settings.dashboardName}.md`);
  }

  isDashboard(file) {
    if (file.path === this.dashboardPath) return true;
    const fm = this.app.metadataCache.getFileCache(file)?.frontmatter;
    return !!(fm && fm["habit-dashboard"]);
  }

  // 습관 폴더와 대시보드가 없으면 만든다
  async setup(notify) {
    const { vault } = this.app;
    const folder = normalizePath(this.settings.folder);
    try {
      if (!vault.getAbstractFileByPath(folder)) await vault.createFolder(folder);
      if (!vault.getAbstractFileByPath(this.dashboardPath)) await vault.create(this.dashboardPath, DASHBOARD_TEMPLATE);
      this.settings.initialized = true;
      await this.saveSettings();
      if (notify) new Notice(tr("'{0}' 폴더와 대시보드를 준비했어요", folder));
    } catch (e) {
      console.error("habit-grid setup", e);
      if (notify) new Notice(tr("습관 폴더를 만들지 못했어요"));
    }
  }

  async openDashboard() {
    let file = this.app.vault.getAbstractFileByPath(this.dashboardPath);
    if (!(file instanceof TFile)) { await this.setup(false); file = this.app.vault.getAbstractFileByPath(this.dashboardPath); }
    if (file instanceof TFile) await this.app.workspace.getLeaf(false).openFile(file);
  }

  async toggle(file, ds, on) {
    await this.app.vault.process(file, (text) => {
      const lines = text.split("\n").filter((l) => { const m = l.match(DONE_RE); return !(m && m[1] === ds); });
      while (lines.length && lines[lines.length - 1].trim() === "") lines.pop();
      if (on) lines.push(`- [x] ${ds}`);
      return lines.join("\n") + "\n";
    });
    const [, m, d] = ds.split("-").map(Number);
    new Notice(tr("{0} · {1}월 {2}일 {3}", file.basename, m, d, on ? tr("기록했어요") : tr("기록을 지웠어요")));
  }

  isLog(file) {
    return file.basename.normalize("NFC") === this.settings.logName.normalize("NFC");
  }

  // Habit 폴더의 습관들을 읽어 온다.
  //  - 습관 파일(공부.md 등): 플러그인만 고친다 (색·목표·직접 기록·제외한 날)
  //  - 미리 알림 기록.md: 단축어만 쓴다. 플러그인은 읽기만 한다
  async loadHabits(folderPath, only) {
    const { app } = this;
    const folder = app.vault.getAbstractFileByPath(folderPath);
    if (!(folder instanceof TFolder)) return null;
    const nfc = (x) => x.normalize("NFC");
    // Habit/습관/ 의 습관 파일, Habit/동기화/ 의 미리 알림 기록을 읽는다. 예전처럼 Habit/ 바로 아래에 있는 파일도 계속 읽는다
    const sub = (name) => folder.children.find((c) => c instanceof TFolder && nfc(c.name) === nfc(name));
    const mdIn = (fd) => (Array.isArray(fd) ? fd : fd ? [fd] : []).flatMap((d) => d.children.filter((f) => f instanceof TFile && f.extension === "md"));
    // 예전 한글 하위 폴더(습관/, 동기화/)도 같이 읽는다
    const subs = (...names) => names.map(sub).filter(Boolean);
    const hDirs = subs(this.settings.habitsDir || "list", "\uc2b5\uad00", this.settings.archiveDir || "archive"), sDirs = subs(this.settings.syncDir || "sync", "\ub3d9\uae30\ud654");
    const rootMd = mdIn(folder).filter((f) => !this.isDashboard(f));
    // 단축어가 아직 예전 경로(Habit/)에 쓰는 동안에도 기록이 이어지도록 두 곳의 로그를 합쳐 읽는다
    const logFiles = [...mdIn(sDirs), ...rootMd].filter((f) => this.isLog(f));
    const logFile = logFiles[0];
    const files = [...rootMd, ...mdIn(hDirs).filter((f) => !this.isDashboard(f))].filter((f) => !this.isLog(f));

    const groups = new Map();
    const group = (name) => {
      if (!groups.has(name)) groups.set(name, { name, main: null, sources: [], log: new Map() });
      return groups.get(name);
    };
    for (const f of files) {
      const n = nfc(f.basename);
      const t = parseTitle(n);
      if (t) group(t.base).sources.push({ file: f, ...t }); // 예전 방식 파일도 계속 읽는다
      else group(n).main = f;
    }
    if (logFile) {
      const prefixes = (this.settings.groupPrefixes || ["\uc6b4\ub3d9"]).map(nfc);
      const splitPrefix = (title) => {
        for (const p of prefixes) {
          if (title === p) return { prefix: p, rest: "" };
          if (title.startsWith(p) && /[\s·]/.test(title[p.length])) return { prefix: p, rest: title.slice(p.length).replace(/^[\s·]+/, "") };
        }
        return null;
      };
      const seenLog = new Set();
      for (const { ds, title } of parseLog((await Promise.all(logFiles.map((f) => app.vault.cachedRead(f)))).join("\n"))) {
        const lk = ds + "\u0001" + title;
        if (seenLog.has(lk)) continue;
        seenLog.add(lk);
        const gp = splitPrefix(title);
        if (gp) {
          const g = group(gp.prefix);
          if (!g.log.has(ds)) g.log.set(ds, { amount: 0, unit: undefined });
          if (gp.rest) {
            g.items = g.items || new Map();
            g.items.set(ds, [...(g.items.get(ds) || []), gp.rest]);
          }
          continue;
        }
        const t = parseTitle(title);
        const g = group(t ? t.base : title);
        const prev = g.log.get(ds);
        const amount = t ? t.amount : 0;
        g.log.set(ds, { amount: Math.max(prev ? prev.amount : 0, amount), unit: t ? t.unit : (prev && prev.unit) });
      }
    }

    let list = [...groups.values()];
    if (only) list = only.map((h) => groups.get(nfc(h))).filter(Boolean);
    const order = (this.settings.habitOrder || []).map(nfc);
    const rank = (n) => { const i = order.indexOf(nfc(n)); return i < 0 ? 1e6 : i; };
    list.sort((a, b) => rank(a.name) - rank(b.name) || a.name.localeCompare(b.name, "ko"));

    const out = [];
    for (const g of list) {
      const mainText = g.main ? await app.vault.cachedRead(g.main) : "";
      const fm = (g.main && app.metadataCache.getFileCache(g.main)?.frontmatter) || {};
      const unitRaw = fm["단위"] || fm["unit"];
      const skips = parseSkips(mainText);
      const logDates = new Set(g.log.keys());
      const logUnit = [...g.log.values()].map((v) => v.unit).find(Boolean);
      const legacy = parseInt(fm["목표"] ?? fm["goal"] ?? fm["주간목표"] ?? 0, 10) || 0;
      const freqsRaw = Object.assign({}, fm["월별횟수"] || (legacy ? { [monthKey(new Date())]: legacy } : {}));
      const daysRaw = {};
      for (const [k, v] of Object.entries(fm["월별요일"] || {})) { const a = (Array.isArray(v) ? v : []).map(Number).filter((n) => n >= 0 && n <= 6); if (a.length) daysRaw[String(k)] = [...new Set(a)]; }
      const freqs = Object.assign({}, freqsRaw);
      for (const [k, v] of Object.entries(daysRaw)) freqs[k] = v.length;
      const base = {
        name: g.name, key: `${folderPath}/${g.name}`, fm, color: fm["색"] || fm["color"] || "", freqs, freqsRaw, days: daysRaw,
        target: g, file: g.main, logDates, items: g.items || null,
        archived: !!(fm["보관"] || fm["archived"]),
      };

      if (!unitRaw && !logUnit && !g.sources.length) {
        const set = new Set([...parseDates(mainText), ...logDates]);
        for (const ds of skips) set.delete(ds);
        const pd = parseInt(fm["기간"] ?? 0, 10) || 0;
        const ps = fm["시작"] ? String(fm["시작"]).slice(0, 10) : "";
        out.push({ ...base, kind: "check", set,
          period: pd > 0 && /^\d{4}-\d{2}-\d{2}$/.test(ps) ? { days: pd, start: ps } : null,
          goal: parseInt(fm["goal"] ?? fm["목표"] ?? fm["주간목표"] ?? 0, 10) || 0 });
        continue;
      }

      const unit = (unitRaw === true ? null : unitRaw) || logUnit || (g.sources[0] && g.sources[0].unit) || "\uc2dc\uac04";
      const entries = new Map();
      const inferred = {};
      const addAuto = (ds, amount) => {
        entries.set(ds, Math.max(entries.get(ds) || 0, amount));
        if (amount) { const mk = ds.slice(0, 7); inferred[mk] = Math.max(inferred[mk] || 0, amount); }
      };
      for (const [ds, v] of g.log) addAuto(ds, v.amount);
      for (const src of g.sources) {
        for (const ds of parseDates(await app.vault.cachedRead(src.file))) { addAuto(ds, src.amount); logDates.add(ds); }
      }
      for (const [ds, v] of parseEntries(mainText)) if (v > 0) entries.set(ds, v); // 직접 적은 값이 우선
      for (const ds of skips) entries.delete(ds);
      for (const [ds, v] of [...entries]) if (!v) entries.delete(ds);
      const explicit = fm["월별목표"] || fm["monthGoals"] || {};
      out.push({ ...base, kind: "measure", unit, entries, set: new Set(entries.keys()),
        goal: parseInt(fm["목표"] ?? fm["goal"] ?? 0, 10) || 0,
        explicit, inferred, monthGoals: Object.assign({}, inferred, explicit) });
    }
    return out;
  }

  // 습관 파일에서 그 날짜 줄을 바꾼다. 미리 알림으로 들어온 날을 지우면 '- [ ] 날짜'로 제외 표시
  async writeDay(h, ds, line) {
    const file = await this.mainFileOf(h.target, h.kind === "measure" ? h.unit : null);
    await this.app.vault.process(file, (text) => {
      const lines = text.split("\n").filter((l) => {
        const m = l.match(DONE_RE) || l.match(SKIP_RE);
        return !(m && m[1] === ds);
      });
      while (lines.length && lines[lines.length - 1].trim() === "") lines.pop();
      if (line) lines.push(line);
      else if (h.logDates && h.logDates.has(ds)) lines.push(`- [ ] ${ds}`);
      return lines.join("\n") + "\n";
    });
  }

  async recordCheck(h, ds, on) {
    if (h.period && ds < h.period.start) { new Notice(tr("기간 시작 전 날짜는 기록할 수 없어요")); return; }
    await this.writeDay(h, ds, on ? `- [x] ${ds}` : null);
    const [, m, d] = ds.split("-").map(Number);
    new Notice(tr("{0} · {1}월 {2}일 {3}", h.name, m, d, on ? tr("기록했어요") : tr("기록을 지웠어요")));
  }

  async recordValue(h, ds, v) {
    await this.writeDay(h, ds, v > 0 ? `- [x] ${ds} ${writeQty(v, h.unit)}` : null);
  }

  // group(target)으로 기록에 필요한 정보를 만든다
  habitOf(target, unit) {
    if (target && target.name !== undefined && !(target instanceof TFile)) {
      return { name: target.name, target, kind: "measure", unit, logDates: new Set([...(target.log ? target.log.keys() : [])]) };
    }
    return { name: target.basename, target, kind: "measure", unit, logDates: new Set() };
  }

  openHabitMenu(evt, h) {
    const menu = new Menu();
    menu.addItem((i) => i.setTitle(tr("색 바꾸기")).setIcon("palette").onClick(() => this.openColorMenu(evt, h.target, h.unit, h.color)));
    if (h.kind === "check") {
      menu.addSeparator();
      if (h.period) {
        menu.addItem((i) => i.setTitle(tr("기간 +30일")).setIcon("calendar-plus").onClick(() => this.extendPeriod(h, 30)));
        menu.addItem((i) => i.setTitle(tr("기간 +66일")).setIcon("calendar-plus").onClick(() => this.extendPeriod(h, 66)));
        menu.addItem((i) => i.setTitle(tr("기간 직접 입력")).setIcon("pencil").onClick(() => this.askPeriod(h)));
        menu.addItem((i) => i.setTitle(tr("기간 없음으로 바꾸기")).setIcon("infinity").onClick(() => this.extendPeriod(h, 0)));
      } else {
        menu.addItem((i) => i.setTitle(tr("기간 정하기 (오늘부터)")).setIcon("calendar-range").onClick(() => this.askPeriod(h)));
      }
      menu.addSeparator();
    }
    menu.addItem((i) => i.setTitle(tr("위로 옮기기")).setIcon("arrow-up").onClick(() => this.moveHabit(h, -1)));
    menu.addItem((i) => i.setTitle(tr("아래로 옮기기")).setIcon("arrow-down").onClick(() => this.moveHabit(h, 1)));
    menu.addSeparator();
    menu.addItem((i) => i.setTitle(tr("지난 기록 채우기")).setIcon("calendar-check").onClick(() => this.openRecorder()));
    menu.addSeparator();
    menu.addItem((i) => i.setTitle(tr("보관함으로 옮기기")).setIcon("archive").onClick(() => this.setArchived(h, true)));
    menu.showAtMouseEvent(evt);
  }

  // 기간 칩을 눌렀을 때 뜨는 메뉴
  openPeriodMenu(evt, h) {
    const menu = new Menu();
    if (h.period) {
      menu.addItem((i) => i.setTitle(tr("기간 +30일")).setIcon("calendar-plus").onClick(() => this.extendPeriod(h, 30)));
      menu.addItem((i) => i.setTitle(tr("기간 +66일")).setIcon("calendar-plus").onClick(() => this.extendPeriod(h, 66)));
      menu.addItem((i) => i.setTitle(tr("기간 직접 입력")).setIcon("pencil").onClick(() => this.askPeriod(h)));
      menu.addItem((i) => i.setTitle(tr("기간 없음으로 바꾸기")).setIcon("infinity").onClick(() => this.extendPeriod(h, 0)));
    } else {
      menu.addItem((i) => i.setTitle(tr("기간 정하기 (오늘부터)")).setIcon("calendar-range").onClick(() => this.askPeriod(h)));
    }
    menu.showAtMouseEvent(evt);
  }

  // n>0: 기간을 n일 늘림(없으면 오늘부터 n일), n===0: 기간 없음, n<0: 총 기간을 -n일로 지정
  async extendPeriod(h, n, confirmed) {
    if (n === 0 && h.period && !confirmed) {
      new ConfirmModal(this.app, {
        title: tr("기간 없음으로 바꿀까요?"),
        desc: [tr("'{0}'의 {1}일 챌린지 설정(기간·시작일)이 지워져요.", h.name, h.period.days), tr("기록은 그대로 남지만, 나중에 기간을 다시 정하면 원래 시작일이 아니라 그날부터 새로 세요. 지금 챌린지로는 돌아올 수 없어요.")],
        okText: tr("기간 없음으로 바꾸기"),
        onOk: () => this.extendPeriod(h, 0, true),
      }).open();
      return;
    }
    const file = await this.mainFileOf(h.target, null);
    await this.app.fileManager.processFrontMatter(file, (fm) => {
      if (n === 0) { delete fm["기간"]; delete fm["시작"]; return; }
      if (n < 0) { fm["기간"] = -n; if (!fm["시작"]) fm["시작"] = fmt(new Date()); return; }
      const cur = parseInt(fm["기간"] ?? 0, 10) || 0;
      if (cur > 0 && fm["시작"]) fm["기간"] = cur + n;
      else { fm["기간"] = n; fm["시작"] = fmt(new Date()); }
    });
    new Notice(n === 0 ? tr("'{0}'은 기간 없이 계속해요", h.name) : tr("'{0}' 기간을 늘렸어요", h.name));
  }
  openDayItems(h, ds) {
    new DayItemsModal(this.app, h.name, ds, (h.items && h.items.get(ds)) || []).open();
  }
  async moveHabit(h, delta) {
    const nfc = (x) => x.normalize("NFC");
    const all = (await this.loadHabits(normalizePath(this.settings.folder))) || [];
    const names = all.filter((x) => !x.archived).map((x) => nfc(x.name));
    const i = names.indexOf(nfc(h.name));
    const j = i + delta;
    if (i < 0 || j < 0 || j >= names.length) { new Notice(delta < 0 ? tr("이미 맨 위예요") : tr("이미 맨 아래예요")); return; }
    [names[i], names[j]] = [names[j], names[i]];
    const rest = (this.settings.habitOrder || []).filter((n) => !names.includes(nfc(n)));
    this.settings.habitOrder = [...names, ...rest];
    await this.saveSettings();
    this.app.workspace.trigger("habit-grid:refresh");
  }
  askPeriod(h) {
    new NumberModal(this.app, {
      title: tr("기간 (일)"), desc: h.period ? tr("총 며칠로 할까요? (시작일부터 센 총 일수)") : tr("오늘부터 며칠 할까요?"),
      value: h.period ? h.period.days : 66, unit: tr("일"),
      onSubmit: async (v) => { const d = Math.round(v); if (d > 0) await this.extendPeriod(h, -d); },
    }).open();
  }
  async setArchived(h, on) {
    const file = await this.mainFileOf(h.target, h.kind === "measure" ? h.unit : null);
    await this.app.fileManager.processFrontMatter(file, (fm) => {
      delete fm.archived;
      if (on) fm["보관"] = true; else delete fm["보관"];
    });
    await this.moveHabitFile(file, on);
    new Notice(on ? tr("'{0}'을 보관함으로 옮겼어요. 기록은 그대로 남아 있어요", h.name) : tr("'{0}'을 다시 꺼냈어요", h.name));
  }

  // 보관하면 archive 폴더로, 다시 꺼내면 list 폴더로 파일을 옮긴다
  async moveHabitFile(file, toArchive) {
    try {
      const { vault, fileManager } = this.app;
      const dirName = toArchive ? (this.settings.archiveDir || "archive") : (this.settings.habitsDir || "list");
      const dir = normalizePath(`${this.settings.folder}/${dirName}`);
      if (file.parent && file.parent.path === dir) return;
      if (!vault.getAbstractFileByPath(dir)) await vault.createFolder(dir);
      const dest = normalizePath(`${dir}/${file.name}`);
      if (vault.getAbstractFileByPath(dest)) return;
      await fileManager.renameFile(file, dest);
    } catch (e) { console.error("habit-grid archive move", e); }
  }
  // 예전에 보관만 해 두고 폴더로 옮기지 않은 습관 파일을 archive 폴더로 정리한다
  async tidyArchive() {
    const folder = this.app.vault.getAbstractFileByPath(normalizePath(this.settings.folder));
    if (!(folder instanceof TFolder)) return;
    const archName = this.settings.archiveDir || "archive";
    const list = folder.children.find((c) => c instanceof TFolder && c.name.normalize("NFC") === (this.settings.habitsDir || "list").normalize("NFC"));
    if (!list) return;
    for (const f of [...list.children]) {
      if (!(f instanceof TFile) || f.extension !== "md" || this.isLog(f) || this.isDashboard(f)) continue;
      const fm = this.app.metadataCache.getFileCache(f)?.frontmatter;
      if (fm && (fm["보관"] || fm.archived) && list.name !== archName) await this.moveHabitFile(f, true);
    }
  }

  openRecorder(date) {
    new RecordModal(this.app, this, date || new Date()).open();
  }

  habitFilePath(name) {
    return normalizePath(`${this.settings.folder}/${this.settings.habitsDir || "list"}/${name}.md`);
  }
  async ensureHabitDir() {
    const { vault } = this.app;
    for (const p of [normalizePath(this.settings.folder), normalizePath(`${this.settings.folder}/${this.settings.habitsDir || "list"}`)]) {
      if (!vault.getAbstractFileByPath(p)) await vault.createFolder(p);
    }
  }

  // 묶음(group)이면 본 파일을 찾고, 없으면 만든다
  async mainFileOf(target, unit) {
    if (target instanceof TFile) return target;
    if (target.main) return target.main;
    const legacy = this.app.vault.getAbstractFileByPath(normalizePath(`${this.settings.folder}/${target.name}.md`));
    if (legacy instanceof TFile) return legacy;
    const path = this.habitFilePath(target.name);
    const existing = this.app.vault.getAbstractFileByPath(path);
    if (existing instanceof TFile) return existing;
    await this.ensureHabitDir();
    target.main = await this.app.vault.create(path, unit ? `---\n\ub2e8\uc704: ${unit}\n---\n` : "");
    return target.main;
  }

  askValue(target, ds, cur, unit, fallback) {
    const u = unit === true ? "\uc2dc\uac04" : unit;
    const name = target instanceof TFile ? target.basename : target.name;
    const [, m, d] = ds.split("-").map(Number);
    new NumberModal(this.app, {
      title: tr("{0} · {1}월 {2}일", name, m, d), desc: u === "시간" ? tr("이날 한 시간을 적어 주세요.") : tr("이날 한 양을 적어 주세요."),
      value: cur || fallback || 0, unit: u, allowClear: cur > 0,
      onSubmit: async (v) => this.recordValue(this.habitOf(target, u), ds, v),
    }).open();
  }

  async setValue(file, ds, v, unit) {
    await this.app.vault.process(file, (text) => {
      const lines = text.split("\n").filter((l) => { const m = l.match(DONE_RE); return !(m && m[1] === ds); });
      while (lines.length && lines[lines.length - 1].trim() === "") lines.pop();
      if (v > 0) lines.push(`- [x] ${ds} ${writeQty(v, unit)}`);
      return lines.join("\n") + "\n";
    });
  }

  // 색 고르기: 맥의 기본(네이티브) 메뉴에는 동그라미를 못 넣어서 직접 그린 작은 창을 쓴다
  openColorMenu(evt, target, unit, current) {
    const apply = async (color) => {
      const file = await this.mainFileOf(target, unit || null);
      await this.app.fileManager.processFrontMatter(file, (fm) => {
        delete fm.color;
        if (color) fm["색"] = color; else delete fm["색"];
      });
    };
    const cur = (current || "").toLowerCase();
    activeDocument.querySelectorAll(".hg-pop").forEach((n) => n.remove());
    const pop = activeDocument.body.createDiv({ cls: "hg-pop" });
    const close = () => {
      pop.remove();
      activeDocument.removeEventListener("mousedown", onDoc, true);
      activeDocument.removeEventListener("keydown", onKey, true);
    };
    const onDoc = (e) => { if (!pop.contains(e.target)) close(); };
    const onKey = (e) => { if (e.key === "Escape") close(); };
    const row = (label, bg, active, fn) => {
      const r = pop.createDiv({ cls: "hg-pop-row" + (active ? " is-on" : "") });
      const sw = r.createSpan({ cls: "hg-pop-sw" });
      sw.style.background = bg;
      r.createSpan({ cls: "hg-pop-name", text: label });
      if (active) r.createSpan({ cls: "hg-pop-check", text: "✓" });
      r.addEventListener("click", () => { close(); fn(); });
      return r;
    };
    row(tr("기본 색"), "var(--interactive-accent)", !cur, () => apply(""));
    pop.createDiv({ cls: "hg-pop-sep" });
    for (const [name, hex] of PRESET_COLORS) row(tr(name), hex, cur === hex.toLowerCase(), () => apply(hex));
    pop.createDiv({ cls: "hg-pop-sep" });
    row(tr("직접 고르기…"), "conic-gradient(#ef4444, #eab308, #2fb67c, #3b82f6, #7c5cff, #ef4444)", false, () => {
      const input = activeDocument.body.createEl("input", { type: "color", cls: "hg-hidden-color" });
      input.addEventListener("change", () => { apply(input.value); input.remove(); });
      input.addEventListener("blur", () => setTimeout(() => input.remove(), 500));
      input.click();
    });
    // 누른 자리 근처에, 화면 밖으로 안 나가게
    const x = (evt && evt.clientX) || 80, y = (evt && evt.clientY) || 80;
    const w = pop.offsetWidth || 190, h = pop.offsetHeight || 340;
    pop.style.left = `${Math.max(8, Math.min(x, activeWindow.innerWidth - w - 8))}px`;
    pop.style.top = `${Math.max(8, Math.min(y + 8, activeWindow.innerHeight - h - 8))}px`;
    setTimeout(() => {
      activeDocument.addEventListener("mousedown", onDoc, true);
      activeDocument.addEventListener("keydown", onKey, true);
    }, 0);
  }

  openGoals(h, year) {
    new GoalsModal(this.app, {
      name: h.name, unit: h.unit, year, measure: h.kind === "measure",
      explicit: h.kind === "measure" ? h.explicit : {}, inferred: h.kind === "measure" ? h.inferred : {}, freqs: h.freqsRaw, days: h.days,
      onSave: async (work, fwork, dwork) => {
        const file = await this.mainFileOf(h.target, h.kind === "measure" ? h.unit : null);
        await this.app.fileManager.processFrontMatter(file, (fm) => {
          const sortObj = (o) => { const r = {}; for (const k of Object.keys(o).sort()) r[k] = o[k]; return r; };
          if (h.kind === "measure") {
            if (Object.keys(work).length) fm["월별목표"] = sortObj(work); else delete fm["월별목표"];
            if (!fm["단위"]) fm["단위"] = h.unit;
          }
          for (const k of Object.keys(dwork)) if (!dwork[k].length) delete dwork[k];
          if (Object.keys(dwork).length) fm["월별요일"] = sortObj(dwork); else delete fm["월별요일"];
          if (Object.keys(fwork).length) fm["월별횟수"] = sortObj(fwork); else delete fm["월별횟수"];
          delete fm["목표"]; delete fm.goal; delete fm["주간목표"];
        });
        new Notice(tr("{0} 목표를 저장했어요", h.name));
      },
    }).open();
  }

  askMonthGoal(target, key, cur, unit) {
    const u = unit === true ? "\uc2dc\uac04" : unit;
    const name = target instanceof TFile ? target.basename : target.name;
    const [y, m] = key.split("-").map(Number);
    new NumberModal(this.app, {
      title: tr("{0} · {1}년 {2}월 목표", name, y, m), desc: tr("하루에 몇 {0} 하면 달성으로 볼까요? 비워 두면 앞 달 목표를 이어서 써요.", unitLabel(u)),
      value: cur, unit: u, allowClear: true,
      onSubmit: async (v) => this.app.fileManager.processFrontMatter(await this.mainFileOf(target, u), (fm) => {
        const goals = Object.assign({}, fm["월별목표"] || {});
        if (v > 0) goals[key] = Math.round(v * 10000) / 10000; else delete goals[key];
        const sorted = {};
        for (const k of Object.keys(goals).sort()) sorted[k] = goals[k];
        fm["월별목표"] = sorted;
      }),
    }).open();
  }

  newHabit() {
    new NewHabitModal(this.app, async ({ name, kind, unit, goal, freq, days, period }) => {
      const path = this.habitFilePath(name);
      if (this.app.vault.getAbstractFileByPath(path) || this.app.vault.getAbstractFileByPath(normalizePath(`${this.settings.folder}/${name}.md`))) { new Notice(tr("같은 이름의 습관이 이미 있어요")); return; }
      await this.ensureHabitDir();
      const key = monthKey(new Date());
      const fm = [];
      if (kind === "measure") {
        fm.push(`\ub2e8\uc704: ${unit}`);
        if (goal > 0) fm.push("\uc6d4\ubcc4\ubaa9\ud45c:", `  "${key}": ${Math.round(goal * 10000) / 10000}`);
      }
      if (days && days.length) fm.push("\uc6d4\ubcc4\uc694\uc77c:", `  "${key}": [${WD_ORDER.filter((d) => days.includes(d)).join(", ")}]`);
      else if (freq > 0) fm.push("\uc6d4\ubcc4\ud69f\uc218:", `  "${key}": ${freq}`);
      if (period > 0) fm.push(`\uae30\uac04: ${period}`, `\uc2dc\uc791: ${fmt(new Date())}`);
      await this.app.vault.create(path, fm.length ? `---\n${fm.join("\n")}\n---\n` : "");
      if (kind === "items") {
        // 미리 알림 제목이 '이름 + 내용'이면 내용이 항목으로 모이도록, 이름을 묶음 이름으로 등록
        const nfc = (x) => x.normalize("NFC");
        const list = this.settings.groupPrefixes || [];
        if (!list.map(nfc).includes(nfc(name))) { this.settings.groupPrefixes = [...list, name]; await this.saveSettings(); }
      }
      new Notice(kind === "measure" ? tr("'{0}' 습관을 만들었어요. 대시보드에서 칸을 눌러 기록하세요", name) : tr("'{0}' 습관을 만들었어요", name));
      this.app.workspace.trigger("habit-grid:refresh");
    }).open();
  }

  async dedupe(file) {
    try {
      await this.app.vault.process(file, (text) => dedupeText(text) ?? text);
    } catch (e) { console.error("habit-grid dedupe", e); }
  }

  openGoalMenu(evt, h, current) {
    const menu = new Menu();
    const set = async (goal) => this.app.fileManager.processFrontMatter(await this.mainFileOf(h.target, h.kind === "measure" ? h.unit : null), (fm) => {
      delete fm.goal; delete fm["주간목표"];
      if (goal) fm["목표"] = goal; else delete fm["목표"];
    });
    menu.addItem((i) => i.setTitle(tr("매일")).setChecked(!current).onClick(() => set(0)));
    menu.addSeparator();
    for (let n = 1; n <= 6; n++) {
      menu.addItem((i) => i.setTitle(tr("주 {0}회", n)).setChecked(current === n).onClick(() => set(n)));
    }
    menu.showAtMouseEvent(evt);
  }

  async saveSettings() { await this.saveData(this.settings); }
}

class HabitGridSettingTab extends PluginSettingTab {
  constructor(app, plugin) { super(app, plugin); this.plugin = plugin; }
  display() {
    const { containerEl } = this;
    const s = this.plugin.settings;
    const save = () => this.plugin.saveSettings();
    containerEl.empty();

    new Setting(containerEl).setName(tr("언어")).setDesc(tr("대시보드와 설정 화면의 표시 언어") + " · " + tr("명령 이름과 왼쪽 아이콘 이름은 옵시디언을 다시 시작하거나 플러그인을 껐다 켜면 바뀌어요."))
      .addDropdown((d) => d.addOption("auto", tr("자동 (옵시디언 언어)")).addOption("ko", "한국어").addOption("en", "English")
        .setValue(["ko", "en"].includes(s.lang) ? s.lang : "auto").onChange(async (v) => { s.lang = v; setLang(resolveLang(v)); await save(); this.plugin.app.workspace.trigger("habit-grid:refresh"); this.display(); }));

    new Setting(containerEl).setName(tr("습관 폴더")).setDesc(tr("습관 기록 파일이 들어 있는 폴더 경로"))
      .addText((t) => t.setPlaceholder("Habits").setValue(s.folder).onChange(async (v) => { s.folder = v.trim() || "Habits"; await save(); }));

    new Setting(containerEl).setName(tr("대시보드 노트 이름")).setDesc(tr("습관 폴더 안에 만들어지고, 습관 목록에서는 빠져요"))
      .addText((t) => t.setPlaceholder(DEFAULT_SETTINGS.dashboardName).setValue(s.dashboardName).onChange(async (v) => { s.dashboardName = v.trim() || DEFAULT_SETTINGS.dashboardName; await save(); }))
      .addButton((b) => b.setButtonText(tr("지금 만들기")).onClick(() => this.plugin.setup(true)));

    new Setting(containerEl).setName(tr("보여줄 기간")).setDesc(tr("전체 기록: 첫 기록부터 오늘까지 모두 보여줘요 (옆으로 넘겨 보기)"))
      .addDropdown((d) => d.addOption("year", tr("연도별 (넘겨 보기)")).addOption("all", tr("전체 기록")).addOption("recent", tr("최근 몇 주만"))
        .setValue(s.range).onChange(async (v) => { s.range = v; await save(); this.display(); }));

    if (s.range !== "year") new Setting(containerEl).setName(s.range === "all" ? tr("최소 표시 주 수") : tr("보여줄 주 수"))
      .setDesc(s.range === "all" ? tr("기록이 적을 때도 이만큼은 칸을 그려요") : tr("격자에 표시할 최근 주 수"))
      .addSlider((sl) => sl.setLimits(4, 104, 1).setValue(s.weeks).setDynamicTooltip().onChange(async (v) => { s.weeks = v; await save(); }));

    new Setting(containerEl).setName(tr("메인 화면 격자")).setDesc(tr("6개월: 큰 칸으로 반년씩 넘겨 봐요 · 1년: 한 해가 한 줄에 다 보이고 1년씩 넘겨 봐요"))
      .addDropdown((d) => d.addOption("year", tr("1년 (1년씩 넘기기)")).addOption("half", tr("6개월 (반년씩 넘기기)"))
        .setValue(s.gridMode === "half" ? "half" : "year").onChange(async (v) => { s.gridMode = v; await save(); this.plugin.app.workspace.trigger("habit-grid:refresh"); }));

    new Setting(containerEl).setName(tr("한 주의 시작")).addDropdown((d) => d.addOption("1", tr("월요일")).addOption("0", tr("일요일"))
      .setValue(String(s.weekStart)).onChange(async (v) => { s.weekStart = Number(v); await save(); }));

    new Setting(containerEl).setName(tr("칸 색깔")).setDesc(tr("비워 두면 테마 강조색을 써요"))
      .addColorPicker((c) => c.setValue(s.color || "#7c5cff").onChange(async (v) => { s.color = v; await save(); }))
      .addExtraButton((b) => b.setIcon("rotate-ccw").setTooltip(tr("테마 색으로 되돌리기")).onClick(async () => { s.color = ""; await save(); this.display(); }));

    new Setting(containerEl).setName(tr("칸을 눌러 기록 고치기")).setDesc(tr("빠뜨린 날을 직접 채우거나 지울 수 있어요"))
      .addToggle((t) => t.setValue(s.clickToToggle).onChange(async (v) => { s.clickToToggle = v; await save(); }));

    containerEl.createEl("p", { cls: "setting-item-description", text: tr("설정을 바꾼 뒤에는 노트를 다시 열면 반영돼요.") });
  }
}

HabitGridPlugin.__test = { renderWeekTop, weekMonthKey, freqOfWeek, parseAmount, fmtDur, fmtDurShort, writeQty, recentDaysOf, renderRecent, renderTodayBar, parseTitle, parseEntries, goalForMonth, renderMeasured, dedupeText, parseDates, computeStats, computeWeeklyStats, renderHabit, parseBlock, fmt, renderCompact, renderArchiveRow, compactGrid, HabitView, NewHabitModal, HabitGridPlugin, setLang, tr, DayItemsModal, NumberModal, GoalsModal, RecordModal };
module.exports = HabitGridPlugin;
