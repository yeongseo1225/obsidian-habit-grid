export const DEFAULT_SETTINGS = {
  folder: "Habits",
  lang: "auto",       // 화면 언어: "auto"(옵시디언 언어 따라감) | "ko" | "en"
  keyStyle: "auto",   // 습관 파일에 적는 속성 이름: "auto"(화면 언어 따라감) | "ko" | "en"
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

// 영어 사용자를 위해 항상 같이 인식하는 미리 알림 기록 파일 이름
export const ALT_LOG_NAME = "Reminders log";

export const DASHBOARD_TEMPLATE = `---
habit-dashboard: true
---

\`\`\`habit
\`\`\`
`;

export const DONE_RE = /^\s*[-*]\s*\[[xX]\]\s*(\d{4}-\d{2}-\d{2})(.*)$/;

// "공부 3시간 이상" 같은 미리 알림 이름에서 습관 이름·목표량·단위를 읽는다
export const TITLE_RE = /^(.+?)\s+(\d+(?:\.\d+)?)\s*(시간|분|회|쪽|페이지|km|h)\s*(?:이상)?$/;

export const WD_ORDER = [1, 2, 3, 4, 5, 6, 0];

export const SKIP_RE = /^\s*[-*]\s*\[ \]\s*(\d{4}-\d{2}-\d{2})/;

export const LOG_RE = /^\s*[-*]\s*\[[xX]\]\s*(\d{4}-\d{2}-\d{2})\s*(.*?)\s*$/;

export const PRESET_COLORS = [
  ["보라", "#7c5cff"], ["파랑", "#3b82f6"], ["청록", "#14b8a6"], ["초록", "#2fb67c"],
  ["노랑", "#eab308"], ["주황", "#e8833a"], ["빨강", "#ef4444"], ["분홍", "#ec4899"],
];

// ── v24: 메인 화면용 요약 카드 (윗줄을 누르면 상세로) ──
export const WEEK_MS = 7 * 86400000;
