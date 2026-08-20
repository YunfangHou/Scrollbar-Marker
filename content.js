(() => {
  if (window.top !== window || document.getElementById("scrollbar-marker-host")) return;

  const STORAGE_PREFIX = "scrollbar-markers:";
  const MERGE_DISTANCE = 0.004;
  const DEFAULT_COLOR = "#f97316";
  const ADD_BUTTON_SIZE = 18;
  const ADD_BUTTON_EDGE_MARGIN = 6;
  const DRAG_THRESHOLD = 4;
  const t = (key, substitutions) => {
    try {
      return chrome.i18n.getMessage(key, substitutions);
    } catch {
      return key;
    }
  };
  const COLORS = [
    ["colorRed", "#ef4444"], ["colorOrange", "#f97316"], ["colorYellow", "#eab308"],
    ["colorGreen", "#22c55e"], ["colorBlue", "#3b82f6"], ["colorPurple", "#a855f7"],
    ["colorBlack", "#111827"], ["colorWhite", "#ffffff"]
  ];
  const VALID_COLORS = new Set(COLORS.map(([, value]) => value));

  let markers = [];
  let pageKey = getPageKey();
  let defaultColor = DEFAULT_COLOR;
  let showAddButton = true;
  let addButtonPosition = null;
  let addButtonDrag = null;
  let suppressAddClick = false;
  let toastTimer;
  let deleteAllConfirmTimer;
  let urlPollTimer;
  let contextStopped = false;
  let editingMarker = null;
  let editingColor = DEFAULT_COLOR;

  const host = document.createElement("div");
  host.id = "scrollbar-marker-host";
  host.style.cssText = [
    "all:initial", "position:fixed", "inset:0", "width:100vw", "height:100vh",
    "z-index:2147483647", "pointer-events:none", "contain:layout style"
  ].join(";");

  const shadow = host.attachShadow({ mode: "closed" });
  shadow.innerHTML = `
    <style>
      :host { color-scheme: light dark; }
      * { box-sizing: border-box; }
      #rail { position:absolute; inset:0 0 0 auto; width:8px; pointer-events:none; }
      .marker {
        appearance:none; position:absolute; right:0; display:block; min-width:32px; width:32px;
        max-width:5vw; height:7px; padding:0; overflow:hidden; border:0; border-radius:4px 0 0 4px;
        color:#fff; box-shadow:0 0 0 1px rgba(15,23,42,.45),0 1px 3px rgba(0,0,0,.3);
        cursor:pointer; pointer-events:auto; transform:translateY(-50%);
        transition:min-width 260ms ease,max-width 320ms cubic-bezier(.2,.8,.2,1),filter 180ms ease;
        font:600 11px/18px ui-sans-serif,system-ui,sans-serif;
        text-align:left; white-space:nowrap; text-overflow:ellipsis;
      }
      .marker.has-note { width:max-content; height:18px; padding:0 6px; border-radius:9px 0 0 9px; }
      .marker:hover,.marker:focus-visible { min-width:40px; max-width:10vw; filter:brightness(1.08); outline:2px solid #fff; outline-offset:1px; }
      #add {
        appearance:none; position:absolute; right:28px; bottom:18px; width:18px; height:18px; padding:0 0 1px;
        border:1px solid rgba(15,23,42,.35); border-radius:50%; background:#2563eb; color:white;
        font:700 16px/15px ui-sans-serif,system-ui,sans-serif; box-shadow:0 2px 7px rgba(0,0,0,.3);
        cursor:grab; pointer-events:auto; opacity:.35; touch-action:none; user-select:none;
        transition:opacity 120ms ease,transform 120ms ease;
      }
      #add:hover,#add:focus-visible { opacity:1; transform:scale(1.12); outline:none; }
      #add.dragging { cursor:grabbing; opacity:1; transform:none; }
      #add[hidden] { display:none; }
      #editor {
        position:absolute; right:22px; width:280px; padding:12px; border:1px solid #cbd5e1; border-radius:10px;
        background:#fff; color:#0f172a; box-shadow:0 8px 28px rgba(0,0,0,.28);
        font:12px/1.4 ui-sans-serif,system-ui,sans-serif; pointer-events:auto;
      }
      #editor[hidden] { display:none; }
      #editor::after {
        content:""; position:absolute; top:var(--arrow-top,18px); right:-6px; width:10px; height:10px;
        border-top:1px solid #cbd5e1; border-right:1px solid #cbd5e1; background:#fff; transform:rotate(45deg);
      }
      .palette { display:flex; flex-wrap:wrap; gap:7px; margin-bottom:10px; }
      .swatch {
        appearance:none; width:20px; height:20px; padding:0; border:1px solid #94a3b8; border-radius:50%;
        box-shadow:inset 0 0 0 1px #fff; cursor:pointer;
      }
      .swatch.selected { outline:2px solid #2563eb; outline-offset:2px; }
      ::slotted(#scrollbar-marker-note-input) {
        all:initial !important; box-sizing:border-box !important; display:block !important;
        width:100% !important; height:32px !important; padding:6px 8px !important;
        border:1px solid #cbd5e1 !important; border-radius:6px !important;
        background:#fff !important; color:#0f172a !important;
        font:12px/1.4 ui-sans-serif,system-ui,sans-serif !important;
        outline:none !important; pointer-events:auto !important;
      }
      ::slotted(#scrollbar-marker-note-input:focus) {
        border-color:#2563eb !important; box-shadow:0 0 0 2px rgba(37,99,235,.18) !important;
      }
      .editor-actions { display:grid; grid-template-columns:auto auto 1fr; align-items:center; gap:7px; margin-top:10px; }
      .editor-actions button {
        appearance:none; padding:5px 9px; border:1px solid #cbd5e1; border-radius:6px;
        background:#f8fafc; color:#0f172a; font:inherit; cursor:pointer;
      }
      #delete-marker { color:#dc2626; }
      #delete-all-marker { justify-self:end; color:#dc2626; }
      #delete-all-marker.confirming { border-color:#dc2626; background:#dc2626; color:#fff; }
      #toast {
        position:absolute; right:28px; bottom:16px; width:max-content; max-width:240px; padding:7px 10px;
        border-radius:7px; background:rgba(15,23,42,.92); color:#fff; font:12px/1.4 ui-sans-serif,system-ui,sans-serif;
        box-shadow:0 3px 12px rgba(0,0,0,.25); pointer-events:none; opacity:0; transform:translateY(5px);
        transition:opacity 150ms ease,transform 150ms ease;
      }
      #toast.show { opacity:1; transform:translateY(0); }
      @media (prefers-color-scheme:dark) {
        #editor { background:#1e293b; color:#e2e8f0; border-color:#475569; }
        #editor::after { background:#1e293b; border-color:#475569; }
        ::slotted(#scrollbar-marker-note-input) {
          background:#0f172a !important; color:#e2e8f0 !important; border-color:#475569 !important;
        }
        .editor-actions button { background:#334155; color:#e2e8f0; border-color:#475569; }
        #delete-marker { color:#fca5a5; }
        #delete-all-marker { color:#fca5a5; }
        #delete-all-marker.confirming { color:#fff; }
      }
    </style>
    <div id="rail" aria-label="${t("markerRailLabel")}"></div>
    <button id="add" type="button" title="${t("addMarker")}" aria-label="${t("addMarker")}">+</button>
    <div id="editor" role="dialog" aria-label="${t("editMarker")}" hidden>
      <div id="palette" class="palette" role="radiogroup" aria-label="${t("markerColorLabel")}"></div>
      <slot name="note-input"></slot>
      <div class="editor-actions">
        <button id="delete-marker" type="button">${t("deleteMarker")}</button>
        <button id="cancel-edit" type="button">${t("close")}</button>
        <button id="delete-all-marker" type="button">${t("deleteAllMarkers")}</button>
      </div>
    </div>
    <div id="toast" role="status" aria-live="polite"></div>
  `;

  const noteInput = document.createElement("input");
  noteInput.id = "scrollbar-marker-note-input";
  noteInput.slot = "note-input";
  noteInput.type = "text";
  noteInput.maxLength = 200;
  noteInput.placeholder = t("notePlaceholder");
  noteInput.setAttribute("aria-label", t("markerNoteLabel"));
  noteInput.setAttribute("autocomplete", "off");
  host.appendChild(noteInput);
  document.documentElement.appendChild(host);
  const rail = shadow.getElementById("rail");
  const addButton = shadow.getElementById("add");
  const editor = shadow.getElementById("editor");
  const palette = shadow.getElementById("palette");
  const toast = shadow.getElementById("toast");
  const deleteAllButton = shadow.getElementById("delete-all-marker");

  function hasExtensionContext() {
    try {
      return Boolean(chrome.runtime?.id);
    } catch {
      return false;
    }
  }

  function stopInvalidContext() {
    if (contextStopped) return;
    contextStopped = true;
    clearInterval(urlPollTimer);
    clearTimeout(toastTimer);
    clearTimeout(deleteAllConfirmTimer);
    host.remove();
  }

  function getPageKey() {
    const url = new URL(location.href);
    url.hash = "";
    return STORAGE_PREFIX + url.href;
  }

  function getScrollRoot() { return document.scrollingElement || document.documentElement; }

  function getScrollRatio() {
    const root = getScrollRoot();
    const max = Math.max(0, root.scrollHeight - root.clientHeight);
    return max ? Math.min(1, Math.max(0, root.scrollTop / max)) : 0;
  }

  function isValidAddButtonPosition(position) {
    return position && Number.isFinite(position.x) && Number.isFinite(position.y)
      && position.x >= 0 && position.x <= 1 && position.y >= 0 && position.y <= 1;
  }

  function getAddButtonBounds() {
    return {
      maxLeft: Math.max(ADD_BUTTON_EDGE_MARGIN, window.innerWidth - ADD_BUTTON_SIZE - ADD_BUTTON_EDGE_MARGIN),
      maxTop: Math.max(ADD_BUTTON_EDGE_MARGIN, window.innerHeight - ADD_BUTTON_SIZE - ADD_BUTTON_EDGE_MARGIN)
    };
  }

  function placeAddButton(left, top) {
    const { maxLeft, maxTop } = getAddButtonBounds();
    addButton.style.right = "auto";
    addButton.style.bottom = "auto";
    addButton.style.left = `${Math.min(maxLeft, Math.max(ADD_BUTTON_EDGE_MARGIN, left))}px`;
    addButton.style.top = `${Math.min(maxTop, Math.max(ADD_BUTTON_EDGE_MARGIN, top))}px`;
  }

  function applySavedAddButtonPosition() {
    if (!isValidAddButtonPosition(addButtonPosition)) {
      addButton.style.left = "auto";
      addButton.style.top = "auto";
      addButton.style.right = "28px";
      addButton.style.bottom = "18px";
      return;
    }
    const { maxLeft, maxTop } = getAddButtonBounds();
    placeAddButton(
      ADD_BUTTON_EDGE_MARGIN + addButtonPosition.x * (maxLeft - ADD_BUTTON_EDGE_MARGIN),
      ADD_BUTTON_EDGE_MARGIN + addButtonPosition.y * (maxTop - ADD_BUTTON_EDGE_MARGIN)
    );
  }

  function saveAddButtonPosition() {
    const { maxLeft, maxTop } = getAddButtonBounds();
    addButtonPosition = {
      x: maxLeft === ADD_BUTTON_EDGE_MARGIN ? 0 : (addButton.offsetLeft - ADD_BUTTON_EDGE_MARGIN) / (maxLeft - ADD_BUTTON_EDGE_MARGIN),
      y: maxTop === ADD_BUTTON_EDGE_MARGIN ? 0 : (addButton.offsetTop - ADD_BUTTON_EDGE_MARGIN) / (maxTop - ADD_BUTTON_EDGE_MARGIN)
    };
    try {
      chrome.storage.sync.set({ addButtonPosition });
    } catch {
      stopInvalidContext();
    }
  }

  function contrastColor(color) {
    return color === "#ffffff" || color === "#eab308" ? "#111827" : "#ffffff";
  }

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 1800);
  }

  function save() {
    if (!hasExtensionContext()) {
      stopInvalidContext();
      return;
    }
    try {
      if (markers.length) chrome.storage.local.set({ [pageKey]: markers });
      else chrome.storage.local.remove(pageKey);
    } catch {
      stopInvalidContext();
    }
  }

  function resetDeleteAllConfirmation() {
    clearTimeout(deleteAllConfirmTimer);
    deleteAllButton.classList.remove("confirming");
    deleteAllButton.textContent = t("deleteAllMarkers");
  }

  function closeEditor() {
    resetDeleteAllConfirmation();
    editor.hidden = true;
    editingMarker = null;
  }

  function renderPalette() {
    palette.replaceChildren();
    COLORS.forEach(([nameKey, value]) => {
      const name = t(nameKey);
      const swatch = document.createElement("button");
      swatch.type = "button";
      swatch.className = `swatch${value === editingColor ? " selected" : ""}`;
      swatch.style.background = value;
      swatch.title = name;
      swatch.setAttribute("role", "radio");
      swatch.setAttribute("aria-label", name);
      swatch.setAttribute("aria-checked", String(value === editingColor));
      swatch.addEventListener("click", () => {
        if (!editingMarker) return;
        editingMarker.color = value;
        editingMarker.note = noteInput.value.trim();
        save();
        render();
      });
      palette.appendChild(swatch);
    });
  }

  function openEditor(marker, markerButton) {
    editingMarker = marker;
    editingColor = VALID_COLORS.has(marker.color) ? marker.color : defaultColor;
    noteInput.value = marker.note || "";
    renderPalette();
    editor.hidden = false;

    const markerRect = markerButton.getBoundingClientRect();
    const editorHeight = editor.offsetHeight;
    const top = Math.max(8, Math.min(window.innerHeight - editorHeight - 8, markerRect.top - 18));
    editor.style.top = `${top}px`;
    editor.style.setProperty("--arrow-top", `${Math.max(12, Math.min(editorHeight - 18, markerRect.top - top))}px`);
    noteInput.focus();
    noteInput.select();
  }

  function render() {
    closeEditor();
    rail.replaceChildren();
    markers.forEach((marker) => {
      const button = document.createElement("button");
      const color = VALID_COLORS.has(marker.color) ? marker.color : defaultColor;
      const note = typeof marker.note === "string" ? marker.note.trim() : "";
      button.className = `marker${note ? " has-note" : ""}`;
      button.type = "button";
      button.style.top = `clamp(4px, ${marker.ratio * 100}%, calc(100% - 4px))`;
      button.style.background = color;
      button.style.color = contrastColor(color);
      button.textContent = note;
      const percentage = String(Math.round(marker.ratio * 100));
      button.title = note
        ? t("markerJumpTitleWithNote", [note, percentage])
        : t("markerJumpTitle", percentage);
      button.setAttribute("aria-label", button.title);
      button.addEventListener("click", () => jumpTo(marker.ratio));
      button.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        event.stopPropagation();
        openEditor(marker, button);
      });
      rail.appendChild(button);
    });
  }

  function jumpTo(ratio) {
    closeEditor();
    const root = getScrollRoot();
    window.scrollTo({ top: ratio * Math.max(0, root.scrollHeight - root.clientHeight), behavior: "smooth" });
  }

  function addMarker() {
    const root = getScrollRoot();
    if (root.scrollHeight <= root.clientHeight + 1) {
      showToast(t("pageDoesNotScroll"));
      return;
    }
    const ratio = getScrollRatio();
    if (markers.some((marker) => Math.abs(marker.ratio - ratio) < MERGE_DISTANCE)) {
      showToast(t("markerAlreadyHere"));
      return;
    }
    markers.push({ ratio, color: defaultColor, note: "", createdAt: Date.now() });
    markers.sort((a, b) => a.ratio - b.ratio);
    save();
    render();
    showToast(t("markerAdded", String(Math.round(ratio * 100))));
  }

  function load() {
    if (!hasExtensionContext()) {
      stopInvalidContext();
      return;
    }
    try {
      chrome.storage.local.get(pageKey, (result) => {
        const stored = result[pageKey];
        markers = Array.isArray(stored)
          ? stored
              .filter((item) => item && Number.isFinite(item.ratio) && item.ratio >= 0 && item.ratio <= 1)
              .map((item) => ({
                ...item,
                color: VALID_COLORS.has(item.color) ? item.color : defaultColor,
                note: typeof item.note === "string" ? item.note : ""
              }))
          : [];
        render();
      });
    } catch {
      stopInvalidContext();
    }
  }

  function saveNoteAndClose() {
    if (!editingMarker) return;
    editingMarker.note = noteInput.value.trim();
    save();
    render();
  }

  function closeEditorFromOutside() {
    if (!editingMarker) return;
    editingMarker.note = noteInput.value.trim();
    save();
    render();
  }

  shadow.getElementById("delete-marker").addEventListener("click", () => {
    if (!editingMarker) return;
    markers = markers.filter((marker) => marker !== editingMarker);
    save();
    render();
    showToast(t("markerDeleted"));
  });

  deleteAllButton.addEventListener("click", () => {
    if (!deleteAllButton.classList.contains("confirming")) {
      deleteAllButton.classList.add("confirming");
      deleteAllButton.textContent = t("confirmDeleteAllMarkers");
      clearTimeout(deleteAllConfirmTimer);
      deleteAllConfirmTimer = setTimeout(resetDeleteAllConfirmation, 5000);
      return;
    }
    markers = [];
    save();
    render();
    showToast(t("allMarkersDeleted"));
  });

  noteInput.addEventListener("input", () => {
    if (!editingMarker) return;
    editingMarker.note = noteInput.value.trim();
    save();
  });
  shadow.getElementById("cancel-edit").addEventListener("click", saveNoteAndClose);
  editor.addEventListener("click", (event) => event.stopPropagation());
  editor.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || editor.hidden) return;
    event.preventDefault();
    event.stopPropagation();
    saveNoteAndClose();
  });
  document.addEventListener("click", () => {
    if (!editor.hidden) closeEditorFromOutside();
  });
  noteInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === "Escape") {
      event.preventDefault();
      saveNoteAndClose();
    }
  });
  for (const eventName of ["keydown", "keypress", "keyup"]) {
    noteInput.addEventListener(eventName, (event) => event.stopPropagation());
  }
  addButton.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    addButtonDrag = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startLeft: addButton.offsetLeft,
      startTop: addButton.offsetTop,
      moved: false
    };
    addButton.setPointerCapture(event.pointerId);
  });
  addButton.addEventListener("pointermove", (event) => {
    if (!addButtonDrag || event.pointerId !== addButtonDrag.pointerId) return;
    const deltaX = event.clientX - addButtonDrag.startX;
    const deltaY = event.clientY - addButtonDrag.startY;
    if (!addButtonDrag.moved && Math.hypot(deltaX, deltaY) < DRAG_THRESHOLD) return;
    addButtonDrag.moved = true;
    addButton.classList.add("dragging");
    placeAddButton(addButtonDrag.startLeft + deltaX, addButtonDrag.startTop + deltaY);
    event.preventDefault();
  });
  function finishAddButtonDrag(event) {
    if (!addButtonDrag || event.pointerId !== addButtonDrag.pointerId) return;
    const moved = addButtonDrag.moved;
    addButtonDrag = null;
    addButton.classList.remove("dragging");
    if (!moved) return;
    suppressAddClick = true;
    setTimeout(() => { suppressAddClick = false; }, 0);
    saveAddButtonPosition();
    event.preventDefault();
  }
  addButton.addEventListener("pointerup", finishAddButtonDrag);
  addButton.addEventListener("pointercancel", finishAddButtonDrag);
  addButton.addEventListener("click", (event) => {
    if (suppressAddClick) {
      suppressAddClick = false;
      event.preventDefault();
      return;
    }
    addMarker();
  });
  window.addEventListener("resize", applySavedAddButtonPosition);
  try {
    chrome.runtime.onMessage.addListener((message) => {
      if (message?.type === "SCROLLBAR_MARKER_ADD") addMarker();
    });

    chrome.storage.sync.get({ defaultMarkerColor: DEFAULT_COLOR, showAddButton: true, addButtonPosition: null }, (settings) => {
      if (VALID_COLORS.has(settings.defaultMarkerColor)) defaultColor = settings.defaultMarkerColor;
      showAddButton = settings.showAddButton !== false;
      addButtonPosition = isValidAddButtonPosition(settings.addButtonPosition) ? settings.addButtonPosition : null;
      addButton.hidden = !showAddButton;
      applySavedAddButtonPosition();
      load();
    });
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === "sync") {
        if (VALID_COLORS.has(changes.defaultMarkerColor?.newValue)) {
          defaultColor = changes.defaultMarkerColor.newValue;
        }
        if (changes.showAddButton) {
          showAddButton = changes.showAddButton.newValue !== false;
          addButton.hidden = !showAddButton;
        }
        if (changes.addButtonPosition) {
          const nextPosition = changes.addButtonPosition.newValue;
          addButtonPosition = isValidAddButtonPosition(nextPosition) ? nextPosition : null;
          if (!addButtonDrag) applySavedAddButtonPosition();
        }
      }
      if (areaName === "local" && changes[pageKey]?.newValue === undefined) {
        markers = [];
        render();
      }
    });
  } catch {
    stopInvalidContext();
  }

  if (contextStopped) return;
  let lastHref = location.href;
  urlPollTimer = setInterval(() => {
    if (!hasExtensionContext()) {
      stopInvalidContext();
      return;
    }
    if (location.href === lastHref) return;
    lastHref = location.href;
    const nextKey = getPageKey();
    if (nextKey === pageKey) return;
    pageKey = nextKey;
    load();
  }, 750);
})();
