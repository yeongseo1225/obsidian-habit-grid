# Habit Grid

Track habits in plain Markdown files and see them as a GitHub-style contribution grid inside your notes.

> 한국어 설명은 [아래](#한국어)에 있어요.

<!-- SCREENSHOT: dashboard overview (several habit cards) -->
<!-- SCREENSHOT: challenge card (30/66/100 days) -->
<!-- SCREENSHOT: amount habit with monthly goals -->

## Features

- **Dashboard** – a `habit` code block (and a ready-made "Habits Dashboard" note) renders one card per habit with a year or half-year grid.
- **Three habit types**
  - *Simple check* – done or not done.
  - *Log amounts* – hours, minutes, pages, km, or any unit you type (e.g. "Study 2h").
  - *Log items* – one habit with named items underneath (e.g. Workout → squats, plank).
- **Challenges** – give a habit a duration (30 / 66 / 100 days or custom) and it becomes a challenge card with progress, streak, and a "complete" banner. No duration means a regular card.
- **Repeat rules** – "N times a week" or "specific days" (Mon, Wed, Fri…). Rules can differ per month; a month you leave empty keeps the previous month's rule.
- **Goals** – a daily goal per month for amount habits, plus goal-week statistics.
- **Edit by clicking** – click a cell to add or remove a record, or fill in past days from the log dialog.
- **Today row** – the last 14 days in a sideways-scrolling strip.
- **Archive** – finished habits move to an archive folder; records are kept and can be restored.
- **Languages** – English, Korean, or automatic (follows the app language).
- **Your data stays in your notes** – no database, no network access.

## Installation

### From Community plugins (after approval)

1. Open **Settings → Community plugins → Browse**.
2. Search for "Habit Grid", then install and enable it.

### Manual

1. Download `main.js`, `manifest.json` and `styles.css` from the [latest release](../../releases/latest).
2. Copy them into `<your vault>/.obsidian/plugins/habit-grid/`.
3. Reload the app and enable **Habit Grid** under **Settings → Community plugins**.

On first start the plugin creates the `Habits` folder and a `Habits Dashboard` note. You can also run **Create habits folder and dashboard** from the command palette.

## Commands

| Command | What it does |
| --- | --- |
| Open habits dashboard | Opens the dashboard note (ribbon icon too) |
| Create habits folder and dashboard | Creates the folder and note if missing |
| Create new habit | Opens the new-habit dialog |
| Log a habit (pick a date) | Opens the log dialog (ribbon icon too) |

## Folder structure

Everything lives under one folder (default `Habits`):

```
Habits/
├── Habits Dashboard.md      dashboard note
├── list/                    one file per habit, e.g. Study.md
├── sync/                    imported Reminders log: Reminders log.md
└── archive/                 archived habit files
```

Subfolder names (`list`, `sync`, `archive`) are defaults; files placed directly in `Habits/` are also read.

### Habit files

A habit file is a Markdown note in `Habits/list/`. The file name is the habit name. Settings live in the frontmatter, and manual records are lines in the body.

Every property has a Korean name and an English name. Both are always read; the plugin writes whichever style the file already uses, or the style you pick in settings (see *Property names*).

| English name | Korean name | Meaning |
| --- | --- | --- |
| `unit` | `단위` | Unit for an amount habit: `hours`, `minutes`, `pages`, `km`, or any text (Korean `시간`, `분`, `쪽` also work) |
| `monthGoals` | `월별목표` | Daily goal per month: `"2026-11": 2` |
| `weeklyTimes` | `월별횟수` | Times per week, per month: `"2026-11": 3` |
| `weekdays` | `월별요일` | Specific weekdays per month, `0` = Sunday … `6` = Saturday: `"2026-11": [1, 3, 5]` |
| `duration` | `기간` | Challenge length in days |
| `start` | `시작` | Challenge start date, `YYYY-MM-DD` |
| `archived` | `보관` | `true` when archived |
| `color` | `색` | Card color, e.g. `"#3b82f6"` |
| `goal` | `목표` | Older single goal value (still read) |

Example:

```markdown
---
unit: hours
monthGoals:
  "2026-11": 2
weeklyTimes:
  "2026-11": 5
color: "#3b82f6"
---
- [x] 2026-11-18 1h30m
- [x] 2026-11-19 2h
```

The plugin writes these properties itself when you use its menus.

### Record lines

One record per line:

```
- [x] 2026-11-19 목 스트레칭
```

That is a checked task, a date (`YYYY-MM-DD`), and the Reminders title. Rules:

- The title can carry an amount, e.g. `공부 2시간` or `Study 2h`.
- The title can be a group name plus an item, e.g. `운동 스쿼트` (group `운동`, item `스쿼트`). Group names are configured through the habit type "Log items".
- Identical lines (same date and same title) are counted once.
- Unchecked lines `- [ ] YYYY-MM-DD` in a habit file mark an imported day as removed.

## iPhone Shortcuts integration (Reminders)

Habit logs can be collected from the Reminders app by an iOS Shortcut. It appends completed reminders from a list named **Habit** to `sync/Reminders log.md`.

Build the shortcut with these actions, in order:

1. **Find Reminders** – List is `Habit`, Is Completed is `Yes`, Completion Date is in the last 7 days.
2. **Repeat with Each** item from step 1.
3. Inside the loop: **Format Date** – the item's Completion Date, custom format `yyyy-MM-dd`.
4. Inside the loop: **Text** – `- [x] ` + the formatted date + a space + the reminder's Title.
5. After the loop: **Combine Text** – the repeat results, separated by **New Lines**.
6. **Append to File** – the combined text, to `Habits/sync/Reminders log.md` in your vault (create the file first if needed).

Run it by hand or with a personal automation. Because the shortcut looks back seven days, the same line can be appended more than once; duplicates are counted once. Titles like `Study 2h` or `Workout squats` become amounts and items as described above.

The plugin recognizes the log file by name. The default is `Reminders log`; you can set another name in settings. On first setup the plugin creates `Habits/sync/` and an empty `Reminders log.md` for the shortcut to append to.

## Dashboard code block

````
```habit
```
````

Optional lines inside the block: `habit: Study, Workout` (only these habits), `weeks: 20`, `color: #3b82f6`, `folder: Habits`.

## Settings

| Setting | Description |
| --- | --- |
| Language | Auto (follows the app language), Korean, or English |
| Property names | Names written in habit files: auto, Korean, or English. Existing properties keep their names |
| Reminders log file name | Name of the log file the shortcut appends to (default `Reminders log`) |
| Habits folder | Folder that holds your habit files |
| Dashboard note name | Name of the dashboard note, with a "Create now" button |
| Main screen grid | 1 year or 6 months per page |
| Week starts on | Monday or Sunday |
| Cell color | Grid color; empty uses your theme accent |
| Click cells to add or remove records | Turn off to make the grid read-only |

Changes apply when a note is reopened.

## Limitations

- Reminder titles with an amount are parsed for the units `시간`, `분`, `회`, `쪽`, `페이지`, `km` and `h` (for example `Study 2h`). Other English unit words such as "min" in a reminder title are not parsed yet.
- Amount habits cannot have a challenge duration yet.
- Only the Reminders → Markdown direction is supported; editing a reminder does not change old records.
- Days are counted in the device's local time zone.
- The plugin moves a habit file between `list` and `archive` when you archive or restore it, and tidies already-archived habits at startup.

## Development

The source lives in `src/` and is bundled into `main.js` with esbuild. Edit `src/`, not `main.js`.

```bash
npm install
npm run dev     # rebuild main.js on every save (works with the Hot Reload plugin)
npm run build   # one-off production build
npm run lint    # eslint
npm test        # node tests for the pure logic
```

## License

[MIT](LICENSE)

---

# 한국어

Habit Grid는 마크다운 파일에 적은 습관 기록을 GitHub 잔디 같은 격자로 보여주는 플러그인이에요. 데이터는 전부 보관함의 마크다운 파일이고 별도 DB나 네트워크 사용은 없어요.

## 기능

- `habit` 코드 블록과 "Habits Dashboard" 노트로 습관 카드와 격자를 보여줘요.
- 습관 종류: 기본(체크), 양 기록(시간·쪽·km 등), 항목 기록(운동 → 스쿼트, 플랭크).
- 기간(30/66/100일 등)을 정하면 챌린지 카드, 없으면 일반 카드.
- 반복 방식: 주 N회 또는 요일 지정. 달마다 따로 정할 수 있고 비워 둔 달은 앞 달 값을 이어 써요.
- 하루 목표(월별), 달성 주 통계, 칸을 눌러 기록 고치기, 오늘 줄(최근 14일), 보관함.

## 폴더와 파일

`Habits/` 아래에 `Habits Dashboard.md`, `list/`(습관 파일), `sync/`(`Reminders log.md` 미리 알림 기록), `archive/`(보관한 습관)가 있어요. 습관 파일의 frontmatter 키는 `단위`, `월별목표`, `월별횟수`, `월별요일`(0=일 … 6=토), `기간`, `시작`, `보관`, `색`이에요(일부는 `unit`, `goal`, `color`, `archived` 별칭도 읽어요). 기록은 `- [x] 2026-11-19 목 스트레칭` 한 줄 형식이고, 같은 날짜·같은 제목의 중복 줄은 한 번만 세요.

## 단축어 연동

미리 알림의 `Habit` 목록에서 완료한 항목을 `sync/Reminders log.md` 끝에 덧붙이는 iOS 단축어를 만들어요.

1. **미리 알림 찾기** – 목록 = Habit, 완료됨 = 예, 완료일이 최근 7일 이내
2. **각 항목 반복**
3. 반복 안에서 **날짜 서식** – 완료일, 사용자 지정 `yyyy-MM-dd`
4. 반복 안에서 **텍스트** – `- [x] 날짜 제목`
5. 반복이 끝난 뒤 **텍스트 결합** – 구분자는 새 줄
6. **파일에 추가** – `Habits/sync/Reminders log.md`

7일치를 다시 읽기 때문에 같은 줄이 여러 번 붙을 수 있지만, 중복은 한 번만 세요.

처음 설정할 때 `sync/` 폴더와 빈 `Reminders log.md`를 자동으로 만들어요.
