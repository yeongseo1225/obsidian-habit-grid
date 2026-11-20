// Units stored in habit files. Hours, minutes and pages are kept as these Korean words
// internally and translated when shown.
export const UNIT_HOURS = "시간";
export const UNIT_MINUTES = "분";
export const UNIT_PAGES = "쪽";

// Defaults
export const DEFAULT_LOG_NAME = "Reminders log";

export const DEFAULT_SETTINGS = {
  folder: "habit-grid",
  lang: "auto",       // 화면 언어: "auto"(옵시디언 언어 따라감) | "ko" | "en"
  keyStyle: "auto",   // 습관 파일에 적는 속성 이름: "auto"(화면 언어 따라감) | "ko" | "en"
  color: "",
  weekStart: 1, // 0 = 일요일, 1 = 월요일
  todayCollapsed: false, // 맨 위 줄을 접어 둘지
  todayMode: "day",  // 맨 위 줄 보기: "day"(일간) | "week"(주간)
  gridMode: "year", // 메인 화면 격자: "year" = 1년씩, "half" = 6개월씩
  clickToToggle: true,
  dashboardName: "Habits Dashboard",
  logName: DEFAULT_LOG_NAME,
  habitsDir: "list",   // 습관 파일(공부.md 등)이 들어가는 하위 폴더
  archiveDir: "archive", // 보관한 습관 파일이 옮겨지는 하위 폴더
  syncDir: "sync",   // 단축어가 쓰는 미리 알림 기록이 들어가는 하위 폴더
  initialized: false,
};

export const DASHBOARD_TEMPLATE = `---
habit-dashboard: true
---

\`\`\`habit
\`\`\`
`;

export const DONE_RE = /^\s*[-*]\s*\[[xX]\]\s*(\d{4}-\d{2}-\d{2})(.*)$/;

// "공부 3시간 이상" 같은 미리 알림 이름에서 습관 이름·목표량·단위를 읽는다
export const TITLE_RE = /^(.+?)\s+(\d+(?:\.\d+)?)\s*(시간|분|회|쪽|페이지|km|hours?|hrs?|h|minutes?|mins?|m|pages?)\s*(?:이상)?$/i;
// "공부 1h 30m" 처럼 시간과 분을 같이 적은 영어 제목
export const TITLE_HM_EN_RE = /^(.+?)\s+(\d+)\s*(?:hours?|hrs?|h)\s*(\d+)\s*(?:minutes?|mins?|m)\s*$/i;

export const WD_ORDER = [1, 2, 3, 4, 5, 6, 0];

export const SKIP_RE = /^\s*[-*]\s*\[ \]\s*(\d{4}-\d{2}-\d{2})/;

export const LOG_RE = /^\s*[-*]\s*\[[xX]\]\s*(\d{4}-\d{2}-\d{2})\s*(.*?)\s*$/;

export const PRESET_COLORS = [
  ["보라", "#7567d9"], ["파랑", "#3f7fd1"], ["청록", "#2c9a92"], ["초록", "#4f9d5d"],
  ["노랑", "#c98a2b"], ["주황", "#d57a45"], ["빨강", "#cf5f66"], ["분홍", "#c55f95"],
];

// ── v24: 메인 화면용 요약 카드 (윗줄을 누르면 상세로) ──
export const WEEK_MS = 7 * 86400000;
