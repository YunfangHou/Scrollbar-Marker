const COLORS = [
  ["colorRed", "#ef4444"],
  ["colorOrange", "#f97316"],
  ["colorYellow", "#eab308"],
  ["colorGreen", "#22c55e"],
  ["colorBlue", "#3b82f6"],
  ["colorPurple", "#a855f7"],
  ["colorBlack", "#111827"],
  ["colorWhite", "#ffffff"]
];
const DEFAULT_COLOR = "#f97316";
const STORAGE_PREFIX = "scrollbar-markers:";
const colors = document.getElementById("colors");
const status = document.getElementById("status");
const showAddButton = document.getElementById("show-add-button");
const markedPages = document.getElementById("marked-pages");
const noMarkedPages = document.getElementById("no-marked-pages");
const pageCount = document.getElementById("page-count");
const t = (key, substitutions) => chrome.i18n.getMessage(key, substitutions);

document.documentElement.lang = chrome.i18n.getUILanguage().replace("_", "-");
document.querySelectorAll("[data-i18n]").forEach((element) => {
  element.textContent = t(element.dataset.i18n);
});
document.querySelectorAll("[data-i18n-aria-label]").forEach((element) => {
  element.setAttribute("aria-label", t(element.dataset.i18nAriaLabel));
});

function renderColors(selected) {
  colors.replaceChildren();
  COLORS.forEach(([nameKey, value]) => {
    const name = t(nameKey);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "color";
    button.style.background = value;
    button.title = name;
    button.setAttribute("role", "radio");
    button.setAttribute("aria-label", name);
    button.setAttribute("aria-checked", String(value === selected));
    button.addEventListener("click", () => {
      chrome.storage.sync.set({ defaultMarkerColor: value }, () => {
        renderColors(value);
        status.textContent = t("defaultColorSet", name);
        setTimeout(() => { status.textContent = ""; }, 1600);
      });
    });
    colors.appendChild(button);
  });
}

function faviconUrl(url) {
  const resource = new URL(chrome.runtime.getURL("_favicon/"));
  resource.searchParams.set("pageUrl", url);
  resource.searchParams.set("size", "32");
  return resource.href;
}

function loadMarkedPages() {
  chrome.storage.local.get(null, (items) => {
    const pages = Object.entries(items)
      .filter(([key, value]) => key.startsWith(STORAGE_PREFIX) && Array.isArray(value) && value.length)
      .map(([key, markers]) => ({ key, url: key.slice(STORAGE_PREFIX.length), count: markers.length }))
      .sort((a, b) => a.url.localeCompare(b.url));

    markedPages.replaceChildren();
    noMarkedPages.hidden = pages.length > 0;
    pageCount.textContent = pages.length ? t("markedPagesCount", String(pages.length)) : "";

    pages.forEach((page) => {
      const item = document.createElement("li");
      item.className = "marked-page";

      const icon = document.createElement("img");
      icon.className = "favicon";
      icon.src = faviconUrl(page.url);
      icon.alt = "";

      const link = document.createElement("a");
      link.className = "page-link";
      link.href = page.url;
      link.target = "_blank";
      link.rel = "noreferrer";
      link.title = page.url;
      link.textContent = `${page.url} (${page.count})`;

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "delete-page";
      remove.textContent = t("deletePageMarkers");
      remove.addEventListener("click", () => {
        if (!confirm(t("confirmDeletePageMarkers", page.url))) return;
        chrome.storage.local.remove(page.key, loadMarkedPages);
      });

      item.append(icon, link, remove);
      markedPages.appendChild(item);
    });
  });
}

chrome.storage.sync.get({ showAddButton: true }, (settings) => {
  showAddButton.checked = settings.showAddButton;
});
showAddButton.addEventListener("change", () => {
  chrome.storage.sync.set({ showAddButton: showAddButton.checked });
});

chrome.storage.sync.get({ defaultMarkerColor: DEFAULT_COLOR }, ({ defaultMarkerColor }) => {
  renderColors(defaultMarkerColor);
});

function loadShortcut() {
  chrome.commands.getAll((commands) => {
    const command = commands.find((item) => item.name === "add-scroll-marker");
    document.getElementById("shortcut").textContent = command?.shortcut || t("shortcutNotSet");
  });
}
loadShortcut();
window.addEventListener("focus", loadShortcut);

document.getElementById("change-shortcut").addEventListener("click", () => {
  chrome.tabs.create({ url: "chrome://extensions/shortcuts" });
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local" && Object.keys(changes).some((key) => key.startsWith(STORAGE_PREFIX))) {
    loadMarkedPages();
  }
});
loadMarkedPages();
