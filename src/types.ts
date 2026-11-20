import type { TFile } from "obsidian";

export type Lang = "auto" | "ko" | "en";
export type Dict<T> = Record<string, T>;
/** Property bag read from a note's frontmatter. */
export type Frontmatter = Record<string, unknown>;
/** "YYYY-MM-DD" */
export type DateStr = string;

export interface Prefs {
  folder: string;
  lang: Lang;
  keyStyle: Lang;
  color: string;
  weekStart: number;
  todayCollapsed: boolean;
  todayMode: "day" | "week";
  gridMode: "year" | "half";
  clickToToggle: boolean;
  dashboardName: string;
  logName: string;
  macSync: boolean;
  syncDays: number;
  syncMinutes: number;
  syncRequest: number;
  syncLists: string;
  habitsDir: string;
  archiveDir: string;
  syncDir: string;
  initialized: boolean;
  habitOrder?: string[];
  logCursor?: Dict<number>;
  modes?: Dict<string>;
  goalsFolded?: Dict<boolean>;
}

/** Month key ("YYYY-MM") -> value. */
export type MonthMap = Dict<number>;
export type MonthDays = Dict<number[]>;
export type ItemMap = Map<DateStr, string[]>;

export interface Period { days: number; start: DateStr }

export interface Schedule { days?: number[]; n?: number }

export interface LogValue { amount: number; unit: string | undefined }

export interface BlockOptions {
  habits?: string[];
  weeks?: number;
  year?: "this" | number;
  color?: string;
  folder?: string;
  goal?: number;
  view?: "day" | "week" | "today";
}

export interface HabitBase {
  name: string;
  key: string;
  fm: Frontmatter;
  color: string;
  freqs: MonthMap;
  freqsRaw: MonthMap;
  days: MonthDays;
  target: HabitTarget;
  file: TFile | null;
  logDates: Set<DateStr>;
  items: ItemMap | null;
  itemsLog: ItemMap | null;
  itemsFile: ItemMap | null;
  isItems: boolean;
  archived: boolean;
  startDate: DateStr;
  hiddenItems: string[];
}

export interface CheckHabit extends HabitBase {
  kind: "check";
  set: Set<DateStr>;
  period: Period | null;
}

export interface MeasureHabit extends HabitBase {
  kind: "measure";
  set: Set<DateStr>;
  unit: string;
  entries: Map<DateStr, number>;
  explicit: MonthMap;
  inferred: MonthMap;
  monthGoals: MonthMap;
  period?: Period | null;
}

export type Habit = CheckHabit | MeasureHabit;

/** Where a habit's records come from (its own file and/or Reminders log lines). */
export interface HabitTarget {
  name: string;
  main?: TFile | null;
  log: Map<DateStr, LogValue>;
  items?: ItemMap;
}

/** What is needed to write a record for a habit. */
export interface WriteTarget {
  target: HabitTarget | TFile;
  kind: "check" | "measure";
  unit?: string;
}

/** An optional callback (cards only show a control when its callback is given). */
export type Cb<A extends unknown[] = []> = ((...a: A) => void | Promise<unknown>) | null | undefined;

/** Everything a habit card needs to draw itself and react to clicks. */
export interface CardOpts {
  color?: string;
  weekStart?: number;
  weeks?: number;
  range?: "recent" | "year" | "all";
  year?: number;
  yearFixed?: boolean;
  mode?: "year" | "month";
  monthAnchor?: Date;
  weekAnchor?: Date;
  freqs?: MonthMap;
  freqsRaw?: MonthMap;
  days?: MonthDays;
  period?: Period | null;
  today?: Date;
  measure?: boolean;
  unit?: string;
  entries?: Map<DateStr, number>;
  monthGoals?: MonthMap;
  itemsOf?: ((ds: DateStr) => string[]) | null;
  itemsAll?: ItemMap | null;
  selDay?: DateStr;
  goalsFolded?: boolean;
  onColor?: Cb<[MouseEvent]>;
  onMore?: Cb<[MouseEvent]>;
  onYear?: Cb<[number]>;
  onMode?: Cb<["year" | "month"]>;
  onNav?: Cb<[number]>;
  onWeekNav?: Cb<[number]>;
  onExtend?: Cb<[number]>;
  onPeriod?: Cb<[MouseEvent]>;
  onArchive?: Cb;
  onGoals?: Cb<[number]>;
  onFoldGoals?: Cb<[boolean]>;
  onToggle?: Cb<[DateStr, boolean]>;
  onSelect?: Cb<[DateStr]>;
  onValue?: Cb<[DateStr, number]>;
  onMonthGoal?: Cb<[string, number]>;
}

/** What the week strip and the month view need on top of CardOpts. */
export interface PeriodOpts extends CardOpts {
  today: Date;
  weekStart: number;
  kind: "check" | "measure";
  freqOf?: (ws: Date) => number;
  goalOf?: (ds: DateStr) => number;
  minDate?: DateStr;
  value: (ds: DateStr) => number;
  hit: (ds: DateStr) => boolean;
  onTap?: Cb<[DateStr]>;
  onCell?: Cb<[DateStr]>;
}

/** What the "today" bar (day strip and week table) needs. */
export interface TodayOpts {
  colorOf: (h: Habit) => string;
  weekStart?: number;
  mode: "day" | "week";
  collapsed?: boolean;
  onCollapse?: Cb;
  onMode?: Cb<["day" | "week"]>;
  onCheck: (h: Habit, ds: DateStr) => void | Promise<unknown>;
  onValue: (h: Habit, ds: DateStr) => void | Promise<unknown>;
  onItems?: Cb<[Habit, DateStr]>;
}

/** What the summary card on the main screen needs. */
export interface CompactOpts extends Omit<CardOpts, "mode" | "today" | "weekStart"> {
  today: Date;
  weekStart: number;
  mode?: "year" | "half";
  rangeStart: Date;
  rangeEnd: Date;
  rangeText?: string;
  isCurrent?: boolean;
  refDate?: Date;
  onOpen?: Cb;
  onRestore?: Cb;
}
