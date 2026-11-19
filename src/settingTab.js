import { PluginSettingTab, Setting } from "obsidian";
import { DEFAULT_SETTINGS } from "./constants";
import { resolveLang, setLang, tr } from "./i18n";

export class HabitGridSettingTab extends PluginSettingTab {
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
      .addText((t) => t.setPlaceholder(DEFAULT_SETTINGS.folder).setValue(s.folder).onChange(async (v) => { s.folder = v.trim() || DEFAULT_SETTINGS.folder; await save(); }));

    new Setting(containerEl).setName(tr("속성 이름")).setDesc(tr("습관 파일의 속성(frontmatter)을 새로 적을 때 쓰는 이름이에요. 이미 파일에 있는 속성은 지금 이름을 그대로 써요."))
      .addDropdown((d) => d.addOption("auto", tr("자동 (표시 언어 따라감)")).addOption("ko", "한국어").addOption("en", "English")
        .setValue(["ko", "en"].includes(s.keyStyle) ? s.keyStyle : "auto").onChange(async (v) => { s.keyStyle = v; await save(); }));

    new Setting(containerEl).setName(tr("미리 알림 기록 파일 이름")).setDesc(tr("단축어가 덧붙이는 기록 파일의 이름(확장자 없이)이에요."))
      .addText((t) => t.setPlaceholder(DEFAULT_SETTINGS.logName).setValue(s.logName).onChange(async (v) => { s.logName = v.trim() || DEFAULT_SETTINGS.logName; await save(); this.plugin.app.workspace.trigger("habit-grid:refresh"); }));

    new Setting(containerEl).setName(tr("대시보드 노트 이름")).setDesc(tr("습관 폴더 안에 만들어지고, 습관 목록에서는 빠져요"))
      .addText((t) => t.setPlaceholder(DEFAULT_SETTINGS.dashboardName).setValue(s.dashboardName).onChange(async (v) => { s.dashboardName = v.trim() || DEFAULT_SETTINGS.dashboardName; await save(); }))
      .addButton((b) => b.setButtonText(tr("지금 만들기")).onClick(() => this.plugin.setup(true)));

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
