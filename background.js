const MENU_ID = "add-scroll-tag";
const OPTIONS_MENU_ID = "scroll-tag-options";
const t = (key) => chrome.i18n.getMessage(key);

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_ID,
      title: t("addTag"),
      contexts: ["page"]
    });
    chrome.contextMenus.create({
      id: OPTIONS_MENU_ID,
      title: t("optionsContextMenu"),
      contexts: ["action"]
    });
  });
});

function addTagToTab(tabId) {
  if (!tabId) return;
  chrome.tabs.sendMessage(tabId, { type: "SCROLLBAR_TAG_ADD" }).catch(() => {
    // Chrome 内部页、扩展商店等页面不允许注入内容脚本。
  });
}

chrome.action.onClicked.addListener((tab) => addTagToTab(tab.id));

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === MENU_ID) addTagToTab(tab?.id);
  if (info.menuItemId === OPTIONS_MENU_ID) chrome.runtime.openOptionsPage();
});

chrome.commands.onCommand.addListener((command) => {
  if (command !== "add-scroll-tag") return;
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    addTagToTab(tab?.id);
  });
});
