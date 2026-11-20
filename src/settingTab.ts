import { Notice, Platform, PluginSettingTab, Setting, requireApiVersion } from "obsidian";
import type { App, ButtonComponent, ColorComponent, DropdownComponent, ExtraButtonComponent, SettingDefinitionGroup, SettingDefinitionItem, TextComponent, ToggleComponent } from "obsidian";
import type { HabitGridPlugin } from "./plugin";
import { DEFAULT_SETTINGS, MAC_UNINSTALL_CMD } from "./constants";
import { resolveLang, setLang, tr } from "./i18n";
import type { Lang, Prefs } from "./types";

interface Row {
  heading?: string;
  name?: string;
  desc?: string;
  visible?: boolean;
  build?: (st: Setting) => unknown;
  extra?: (host: HTMLElement) => void;
}

export class HabitGridSettingTab extends PluginSettingTab {
  plugin: HabitGridPlugin;
  installCmd?: string;
  constructor(app: App, plugin: HabitGridPlugin) { super(app, plugin); this.plugin = plugin; }

  // display() is deprecated in 1.13+ but still the only way to draw the tab on older versions (minAppVersion 1.4.4),
  // so it is called through a cast.
  // Obsidian 1.13+ builds the tab from getSettingDefinitions() so the settings show up in the settings
  // search; older versions call display(). Both use the same rows().
  rerender() { if (requireApiVersion("1.13.0")) this.update(); else (this as { display(): void }).display(); }

  getSettingDefinitions(): SettingDefinitionItem[] {
    const out: SettingDefinitionItem[] = [];
    let group: SettingDefinitionGroup | null = null;
    for (const r of this.rows()) {
      if (r.heading) { group = { type: "group", heading: r.heading, items: [] }; out.push(group); continue; }
      const def = {
        name: r.name ?? "",
        desc: r.desc,
        visible: r.visible,
        searchable: !!r.name,
        render: (setting: Setting) => {
          r.build?.(setting);
          if (r.extra) { const host = createDiv(); r.extra(host); setting.settingEl.insertAdjacentElement("afterend", host); }
        },
      };
      if (group) (group.items ??= []).push(def); else out.push(def);
    }
    return out;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();
    for (const r of this.rows()) {
      if (r.visible === false) continue;
      const st = new Setting(containerEl);
      if (r.heading) { st.setName(r.heading).setHeading(); continue; }
      st.setName(r.name ?? "");
      if (r.desc) st.setDesc(r.desc);
      r.build?.(st);
      if (r.extra) r.extra(containerEl.createDiv());
    }
  }

  rows(): Row[] {
    const s = this.plugin.prefs;
    const save = () => this.plugin.saveSettings();
    const refresh = () => this.plugin.app.workspace.trigger("habit-grid:refresh");
    const mac = Platform.isMacOS;
    const dir = `${s.folder}/mac-sync`;
    return [
      { name: tr("언어"), desc: tr("대시보드와 설정 화면의 표시 언어") + " · " + tr("명령 이름과 왼쪽 아이콘 이름은 옵시디언을 다시 시작하거나 플러그인을 껐다 켜면 바뀌어요."),
        build: (st: Setting) => st.addDropdown((d: DropdownComponent) => d.addOption("auto", tr("자동 (옵시디언 언어)")).addOption("ko", "한국어").addOption("en", "English")
          .setValue(["ko", "en"].includes(s.lang) ? s.lang : "auto").onChange(async (v: string) => { s.lang = v as Lang; setLang(resolveLang(v)); await save(); refresh(); this.rerender(); })) },

      { name: tr("습관 폴더"), desc: tr("습관 기록 파일이 들어 있는 폴더 경로"),
        build: (st: Setting) => st.addText((t: TextComponent) => t.setPlaceholder(DEFAULT_SETTINGS.folder).setValue(s.folder).onChange(async (v: string) => { s.folder = v.trim() || DEFAULT_SETTINGS.folder; await save(); })) },

      { name: tr("속성 이름"), desc: tr("습관 파일의 속성(frontmatter)을 새로 적을 때 쓰는 이름이에요. 이미 파일에 있는 속성은 지금 이름을 그대로 써요."),
        build: (st: Setting) => st.addDropdown((d: DropdownComponent) => d.addOption("auto", tr("자동 (표시 언어 따라감)")).addOption("ko", "한국어").addOption("en", "English")
          .setValue(["ko", "en"].includes(s.keyStyle) ? s.keyStyle : "auto").onChange(async (v: string) => { s.keyStyle = v as Lang; await save(); })) },

      { name: tr("미리 알림 기록 파일 이름"), desc: tr("단축어가 덧붙이는 기록 파일의 이름(확장자 없이)이에요."),
        build: (st: Setting) => st.addText((t: TextComponent) => t.setPlaceholder(DEFAULT_SETTINGS.logName).setValue(s.logName).onChange(async (v: string) => { s.logName = v.trim() || DEFAULT_SETTINGS.logName; await save(); refresh(); })) },

      { name: tr("로그 정리"), desc: tr("단축어가 같은 줄을 여러 번 덧붙여 로그가 길어졌다면 중복 줄을 지워요. 습관 기록은 바뀌지 않아요."),
        build: (st: Setting) => st.addButton((b: ButtonComponent) => b.setButtonText(tr("로그 정리")).onClick(async () => {
          const n = await this.plugin.tidyLog();
          new Notice(n ? tr("중복 {0}줄을 지웠어요", n) : tr("지울 중복 줄이 없어요"));
        })) },

      { name: tr("대시보드 노트 이름"), desc: tr("습관 폴더 안에 만들어지고, 습관 목록에서는 빠져요"),
        build: (st: Setting) => st
          .addText((t: TextComponent) => t.setPlaceholder(DEFAULT_SETTINGS.dashboardName).setValue(s.dashboardName).onChange(async (v: string) => { s.dashboardName = v.trim() || DEFAULT_SETTINGS.dashboardName; await save(); }))
          .addButton((b: ButtonComponent) => b.setButtonText(tr("지금 만들기")).onClick(() => this.plugin.setup(true))) },

      { name: tr("메인 화면 격자"), desc: tr("6개월: 큰 칸으로 반년씩 넘겨 봐요 · 1년: 한 해가 한 줄에 다 보이고 1년씩 넘겨 봐요"),
        build: (st: Setting) => st.addDropdown((d: DropdownComponent) => d.addOption("year", tr("1년 (1년씩 넘기기)")).addOption("half", tr("6개월 (반년씩 넘기기)"))
          .setValue(s.gridMode === "half" ? "half" : "year").onChange(async (v: string) => { s.gridMode = v as Prefs["gridMode"]; await save(); refresh(); })) },

      { name: tr("한 주의 시작"),
        build: (st: Setting) => st.addDropdown((d: DropdownComponent) => d.addOption("1", tr("월요일")).addOption("0", tr("일요일"))
          .setValue(String(s.weekStart)).onChange(async (v: string) => { s.weekStart = Number(v); await save(); })) },

      { name: tr("칸 색깔"), desc: tr("비워 두면 테마 강조색을 써요"),
        build: (st: Setting) => st
          .addColorPicker((c: ColorComponent) => c.setValue(s.color || "#7567d9").onChange(async (v: string) => { s.color = v; await save(); }))
          .addExtraButton((b: ExtraButtonComponent) => b.setIcon("rotate-ccw").setTooltip(tr("테마 색으로 되돌리기")).onClick(async () => { s.color = ""; await save(); this.rerender(); })) },

      { name: tr("칸을 눌러 기록 고치기"), desc: tr("빠뜨린 날을 직접 채우거나 지울 수 있어요"),
        build: (st: Setting) => st.addToggle((t: ToggleComponent) => t.setValue(s.clickToToggle).onChange(async (v: boolean) => { s.clickToToggle = v; await save(); })) },

      { heading: tr("Mac 동기화") },
      { name: tr("Mac 동기화 안내"), desc: tr("Mac에서 동기화 스크립트를 쓸 때만 필요해요. 단축어를 쓰거나 Mac이 없다면 이 구역은 신경 쓰지 않아도 돼요. 단축어와 Mac 동기화는 둘 중 하나만 쓰세요.") },

      { name: tr("Mac에 설치"), visible: mac,
        desc: tr("설치 파일을 볼트에 만들고, 터미널에 붙여 넣을 명령을 보여 줘요. 실행은 직접 해요. 옵시디언 파일 목록에는 .sh 파일이 보이지 않으니 Finder에서 확인하세요. 설치 뒤에 아래 '사용'을 켜세요."),
        build: (st: Setting) => st.addButton((b: ButtonComponent) => b.setButtonText(tr("설치 파일 만들기")).onClick(async () => {
          try { this.installCmd = await this.plugin.createMacSyncFiles(); this.rerender(); } catch (e) { console.error("habit-grid mac files", e); new Notice(tr("설치 파일을 만들지 못했어요")); }
        })),
        extra: (host: HTMLElement) => {
          if (!mac || !this.installCmd) return;
          const box = host.createDiv({ cls: "hg-cmdbox" });
          box.createEl("p", { cls: "setting-item-description", text: tr("터미널에 붙여 넣어 실행하고, 미리 알림 접근 허용 창이 뜨면 허용하세요.") });
          box.createEl("p", { cls: "setting-item-description", text: tr("만든 파일: {0}", `${dir}/habit-log-sync.sh, ${dir}/install-mac-sync.sh`) });
          box.createEl("code", { text: this.installCmd });
          box.createEl("p", { cls: "setting-item-description", text: tr("명령을 누르면 전체가 선택돼요. Cmd+C로 복사하세요.") });
          explain(box, [
            tr("스크립트를 ~/.habit-grid-sync/ 폴더에 복사해요."),
            tr("로그인할 때와 5분마다 실행되는 백그라운드 작업을 등록해요 (~/Library/LaunchAgents/md.habitgrid.sync.plist)."),
            tr("한 번 실행해서 macOS가 미리 알림 접근을 묻게 해요."),
            tr("인터넷에서 내려받는 것은 없어요."),
          ]);
          new Setting(box).addButton((b: ButtonComponent) => b.setButtonText(tr("Finder에서 보기")).onClick(() => {
            const app = this.plugin.app as App & { showInFolder?: (p: string) => void };
            if (typeof app.showInFolder === "function") app.showInFolder(`${dir}/install-mac-sync.sh`);
            else new Notice(tr("Finder에서 볼트의 {0} 폴더를 열어 보세요", dir));
          }));
        } },

      { name: tr("Mac 동기화 사용"), desc: tr("스크립트를 설치했다면 켜 주세요. 꺼져 있으면 Mac 동기화 스크립트가 아무것도 가져오지 않아요. 스크립트는 실행될 때마다 이 설정을 확인해요."),
        build: (st: Setting) => st.addToggle((t: ToggleComponent) => t.setValue(s.macSync === true).onChange(async (v: boolean) => { s.macSync = v; await save(); })) },

      { name: tr("동기화할 미리 알림 목록"), desc: tr("Mac 동기화 스크립트가 읽을 미리 알림 목록 이름이에요. 쉼표로 여러 개를 적고, 미리 알림 앱의 이름과 똑같이 적어요."),
        build: (st: Setting) => st.addText((t: TextComponent) => t.setPlaceholder(DEFAULT_SETTINGS.syncLists).setValue(s.syncLists).onChange(async (v: string) => { s.syncLists = v.trim() || DEFAULT_SETTINGS.syncLists; await save(); })) },

      { name: tr("가져올 기간 (일)"), desc: tr("한 번에 최근 며칠 치 완료 항목을 읽어요. Mac을 오래 꺼 두는 편이면 길게 잡아요."),
        build: (st: Setting) => st.addText((t: TextComponent) => t.setPlaceholder(String(DEFAULT_SETTINGS.syncDays)).setValue(String(s.syncDays)).onChange(async (v: string) => {
          const n = Math.round(Number(v));
          s.syncDays = n >= 1 && n <= 365 ? n : DEFAULT_SETTINGS.syncDays; await save();
        })) },

      { name: tr("동기화 간격"), desc: tr("스크립트가 이 간격마다 새 완료 항목을 가져와요. 자동 실행을 5분 단위로 깨워서 이 값을 확인해요."),
        build: (st: Setting) => st.addDropdown((d: DropdownComponent) => { for (const m of [5, 15, 30, 60, 120]) d.addOption(String(m), tr("{0}분마다", m)); d.setValue(String(s.syncMinutes)).onChange(async (v: string) => { s.syncMinutes = Number(v); await save(); }); }) },

      { name: tr("지금 동기화"), desc: tr("로그에 이미 있는 내용은 바로 가져와요. Mac에서 새로 완료한 미리 알림은 바로 반영되지 않아요. Mac 동기화를 설치했다면 최대 5분 안에 가져와요."),
        build: (st: Setting) => st.addButton((b: ButtonComponent) => b.setButtonText(tr("지금 동기화")).onClick(async () => {
          await this.plugin.importLog();
          s.syncRequest = Date.now(); await save();
          refresh();
          new Notice(tr("로그의 내용을 가져왔어요. Mac의 새 완료 항목은 설치했다면 5분 안에 반영돼요."));
        })) },

      { name: tr("Mac 동기화 지우기"), desc: tr("플러그인을 지우기 전에 터미널에서 먼저 실행하세요. 플러그인만 지우면 Mac의 백그라운드 작업이 남아요."), visible: mac,
        extra: (host: HTMLElement) => {
          if (!mac) return;
          const rm = host.createDiv({ cls: "hg-cmdbox" });
          rm.createEl("code", { text: MAC_UNINSTALL_CMD });
          rm.createEl("p", { cls: "setting-item-description", text: tr("명령을 누르면 전체가 선택돼요. Cmd+C로 복사하세요.") });
          explain(rm, [
            tr("백그라운드 작업을 멈춰요 (launchctl bootout)."),
            tr("자동 실행 설정(~/Library/LaunchAgents/md.habitgrid.sync.plist)과 복사한 스크립트 폴더(~/.habit-grid-sync)를 지워요."),
            tr("볼트 안의 습관 기록과 설정은 지우지 않아요."),
          ]);
        } },

      { name: tr("설정 적용 안내"), desc: tr("설정을 바꾼 뒤에는 노트를 다시 열면 반영돼요.") },
    ];
  }
}

// 명령이 하는 일을 복사 버튼보다 먼저 보여 준다
function explain(box: HTMLElement, lines: string[]) {
  box.createEl("p", { cls: "setting-item-description", text: tr("이 명령이 하는 일:") });
  const ul = box.createEl("ul", { cls: "hg-cmdlist" });
  for (const t of lines) ul.createEl("li", { text: t });
}
