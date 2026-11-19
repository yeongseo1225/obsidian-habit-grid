// Minimal stand-in for the "obsidian" module so pure logic can run in Node.
class Empty { constructor(...args) { this.args = args; } }
export const Plugin = Empty, PluginSettingTab = Empty, Setting = Empty, MarkdownRenderChild = Empty;
export const TFile = Empty, TFolder = Empty, Notice = Empty, Menu = Empty, Modal = Empty;
export const normalizePath = (p) => p;
export const moment = { locale: () => globalThis.__locale || "en" };
