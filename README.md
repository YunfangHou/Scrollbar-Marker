# Scrollbar Tag

English | [简体中文](README_zh.md)

A lightweight Chrome extension that places position tags beside the native scrollbar, letting you return to important spots on a webpage with one click.

## Installation

1. Download or clone this repository.
2. Open `chrome://extensions/` in Chrome.
3. Enable **Developer mode** in the top-right corner.
4. Click **Load unpacked** and select this project folder.

## Usage

- Click the translucent `+` button near the bottom-right corner of the page to tag your current position. You can also drag the button, and its position is preserved across webpages.
- Alternatively, click the extension icon in the Chrome toolbar or configure a keyboard shortcut on the settings page. No shortcut is assigned by default.
- Click a tag to scroll smoothly back to that position.
- Right-click a tag to open the editor. From there, you can choose from eight colors, add a note, delete the tag, or delete every tag on the current page.
- Notes are saved automatically as you type. Pressing Enter, Escape, or **Close** simply closes the editor.
- The note field works with keyboard-navigation extensions such as Vimium, and typing in it will not trigger webpage shortcuts.
- Notes appear directly on tags. A tag uses at most 5% of the page width normally and can expand to 10% on hover.
- Tags are stored in Chrome's local extension storage and grouped by full URL, excluding the `#` fragment.

## Settings

Right-click the extension icon in the Chrome toolbar and select **Custom settings** to:

- Show or hide the `+` button in the bottom-right corner.
- Choose the default color for newly created tags.
- View the current keyboard shortcut and open Chrome's extension shortcut page to change it.
- Browse all tagged pages with their favicons and tag counts, and delete their tags individually.

## Browser limitation

Chrome does not allow webpage scripts to place interactive elements inside the browser's native scrollbar. Scrollbar Tag therefore renders its tag rail immediately to the left of the scrollbar.
