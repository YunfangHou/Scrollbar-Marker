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
const STORAGE_PREFIX = "scrollbar-tags:";
const colors = document.getElementById("colors");
const status = document.getElementById("status");
const showAddButton = document.getElementById("show-add-button");
const taggedPages = document.getElementById("tagged-pages");
const noTaggedPages = document.getElementById("no-tagged-pages");
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
      chrome.storage.sync.set({ defaultTagColor: value }, () => {
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

function loadTaggedPages() {
  chrome.storage.local.get(null, (items) => {
    const pages = Object.entries(items)
      .filter(([key, value]) => key.startsWith(STORAGE_PREFIX) && Array.isArray(value) && value.length)
      .map(([key, tags]) => ({ key, url: key.slice(STORAGE_PREFIX.length), count: tags.length }))
      .sort((a, b) => a.url.localeCompare(b.url));

    taggedPages.replaceChildren();
    noTaggedPages.hidden = pages.length > 0;
    pageCount.textContent = pages.length ? t("taggedPagesCount", String(pages.length)) : "";

    pages.forEach((page) => {
      const item = document.createElement("li");
      item.className = "tagged-page";

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
      remove.textContent = t("deletePageTags");
      remove.addEventListener("click", () => {
        if (!confirm(t("confirmDeletePageTags", page.url))) return;
        chrome.storage.local.remove(page.key, loadTaggedPages);
      });

      item.append(icon, link, remove);
      taggedPages.appendChild(item);
    });
  });
}

chrome.storage.sync.get({ showAddButton: true }, (settings) => {
  showAddButton.checked = settings.showAddButton;
});
showAddButton.addEventListener("change", () => {
  chrome.storage.sync.set({ showAddButton: showAddButton.checked });
});

chrome.storage.sync.get({ defaultTagColor: DEFAULT_COLOR }, ({ defaultTagColor }) => {
  renderColors(defaultTagColor);
});

function loadShortcut() {
  chrome.commands.getAll((commands) => {
    const command = commands.find((item) => item.name === "add-scroll-tag");
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
    loadTaggedPages();
  }
});
loadTaggedPages();
