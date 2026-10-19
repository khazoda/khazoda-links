import { playSound } from "./sound.js";
import "./cursor.js";

document.getElementById("copyright-year").textContent = new Date().getFullYear();

const urlDisplay = document.getElementById("url-display");
const urlSlug = document.getElementById("url-slug");
const grid = document.getElementById("mods-grid");
const panel = document.getElementById("mods-panel");
const modName = document.getElementById("mod-name");
const soundToggle = document.getElementById("sound-toggle");
const keyboardHelp = document.getElementById("keyboard-help");
const helpToggle = document.getElementById("help-toggle");
const shortcutToggle = document.getElementById("shortcut-toggle");
const cursorToggle = document.getElementById("cursor-toggle");
const quicklinks = document.getElementById("quicklinks");
const modLinks = [urlDisplay, ...quicklinks.querySelectorAll("a")];
const bubbles = [...grid.querySelectorAll(".bubble")];

let selected = null;
let typewriterTimer, nameTimer;

for (const [toggle, key] of [
  [shortcutToggle, "keyboardShortcuts"],
  [cursorToggle, "cursorAnimations"],
]) {
  try {
    toggle.checked = localStorage.getItem(key) !== "false";
  } catch {}
  toggle.addEventListener("change", () => {
    try {
      localStorage.setItem(key, toggle.checked);
    } catch {}
  });
}

helpToggle.hidden = false;
new ResizeObserver(fitName).observe(grid);
document.fonts.ready.then(fitName);

helpToggle.addEventListener("click", () => {
  if (keyboardHelp.open) keyboardHelp.close();
  else keyboardHelp.showModal();
});

keyboardHelp.addEventListener("click", (event) => {
  const { left, right, top, bottom } = keyboardHelp.getBoundingClientRect();
  const outside = event.clientX < left || event.clientX > right || event.clientY < top || event.clientY > bottom;
  if (event.target === keyboardHelp && outside) keyboardHelp.close();
});

for (const link of [...bubbles, ...modLinks]) {
  link.addEventListener("pointerdown", handleLinkEvent);
  link.addEventListener("click", handleLinkEvent);
}

document.addEventListener("click", (event) => {
  if (!event.target.closest(".bubble, #url-display, .mod-heading, #sound-toggle, #help-toggle, #keyboard-help")) clearSelection();
});

grid.addEventListener("focusin", (event) => {
  const bubble = event.target.closest(".bubble");
  if (panel.classList.contains("keyboard-navigation") && bubble) selectBubble(bubble);
});

document.getElementById("keyboard-instructions").hidden = false;
bubbles[0].setAttribute("aria-describedby", "keyboard-instructions");

document.addEventListener("keydown", (event) => {
  updateCtrlState(event);
  panel.classList.add("keyboard-navigation");
  const typing = event.target.closest("textarea, select, input:not([type=checkbox]), [contenteditable]:not([contenteditable='false'])");
  if (event.defaultPrevented || typing) return;
  const key = event.key.toLowerCase();
  const modified = event.ctrlKey || event.metaKey || event.altKey;
  if (key === "k" && shortcutToggle.checked && !event.repeat && !modified) {
    event.preventDefault();
    helpToggle.click();
    return;
  }
  if (keyboardHelp.open || event.target.closest("input")) return;
  const active = document.activeElement;
  const index = bubbles.indexOf(active);
  if (event.key === " " && (index !== -1 || modLinks.includes(active))) {
    event.preventDefault();
    // Preserve modifier keys when Space activates an anchor.
    if (!event.repeat) active.dispatchEvent(new MouseEvent("click", event));
    return;
  }
  if (modified) return;
  if (event.key === "Escape") {
    if (modLinks.includes(active) && selected) selected.focus();
    else clearSelection();
  } else if (["Home", "End", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) {
    event.preventDefault();
    const current = index === -1 ? bubbles.indexOf(selected) : index;
    selectBubble(bubbles[nextBubbleIndex(current, event.key)]);
  } else if (shortcutToggle.checked && key === "n" && selected) {
    const links = modLinks.filter((link) => link.hasAttribute("href") && link.getClientRects().length);
    const current = links.indexOf(active);
    event.preventDefault();
    let next;
    if (current === -1) next = event.shiftKey ? links.length - 1 : 0;
    else {
      const step = event.shiftKey ? -1 : 1;
      next = (current + step + links.length) % links.length;
    }
    links[next].focus();
  } else if (shortcutToggle.checked && key === "m" && !event.repeat) {
    event.preventDefault();
    soundToggle.click();
  }
});

document.addEventListener("keyup", updateCtrlState);
document.addEventListener(
  "pointerdown",
  (event) => {
    panel.classList.remove("keyboard-navigation");
    updateCtrlState(event);
  },
  true
);

window.addEventListener("blur", () => panel.classList.remove("ctrl-held"));
window.addEventListener("pageshow", () => {
  panel.classList.remove("departing");
  panel.style.removeProperty("transform-origin");
  restoreSelectionFromUrl();
});
window.addEventListener("hashchange", restoreSelectionFromUrl);
window.addEventListener("popstate", restoreSelectionFromUrl);

function updateSelectionUrl() {
  const url = new URL(window.location.href);
  url.hash = selected ? encodeURIComponent(selected.dataset.modId) : "";
  if (url.href !== window.location.href) history.replaceState(history.state, "", url);
}

function restoreSelectionFromUrl() {
  let modId;
  try {
    modId = decodeURIComponent(window.location.hash.slice(1));
  } catch {
    modId = "";
  }
  const bubble = bubbles.find((bubble) => bubble.dataset.modId === modId);
  if (bubble) selectBubble(bubble, false, { focus: false, updateUrl: false });
  else clearSelection({ focus: false, updateUrl: false });
}

function updateCtrlState(event) {
  panel.classList.toggle("ctrl-held", event.ctrlKey);
}

// play sound on press for selection/new tabs, on activation for same-tab navigation
function handleLinkEvent(event) {
  if (event.button !== 0 || event.shiftKey || event.altKey) return;
  const pressing = event.type === "pointerdown";
  const keyboard = !pressing && event.detail === 0 && !event.pointerType;
  const selecting = this.classList.contains("bubble") && this !== selected;
  if (event.ctrlKey || event.metaKey) {
    if (pressing || keyboard) playSound({ playbackRate: 1.25 });
  } else if (pressing) {
    if (selecting) playSound();
  } else if (selecting && !keyboard) {
    event.preventDefault();
    selectBubble(this, false);
  } else {
    playSound({ reverse: true });
    const bounds = panel.getBoundingClientRect();
    panel.style.transformOrigin = `${window.innerWidth / 2 - bounds.left}px ${window.innerHeight / 2 - bounds.top}px`;
    panel.classList.add("departing");
  }
}

function selectBubble(bubble, playAudio = true, { focus = true, updateUrl = true } = {}) {
  if (selected === bubble) {
    if (focus) bubble.focus();
    if (updateUrl) updateSelectionUrl();
    return;
  }
  clearTimeout(typewriterTimer);
  const changing = !!selected;
  quicklinks.classList.remove("hopping");
  selected?.classList.remove("selected");
  selected = bubble;
  bubble.classList.add("selected");
  updateName(bubble.dataset.name, bubble.dataset.colors);
  if (focus) bubble.focus();
  if (playAudio) playSound();
  const href = bubble.getAttribute("href");
  for (const link of modLinks) {
    const destination = link.dataset.link === "modrinth" ? href : bubble.dataset[link.dataset.link];
    link.setAttribute("aria-label", `${bubble.dataset.name} on ${link.dataset.label}`);
    link.hidden = !destination;
    if (destination) link.setAttribute("href", destination);
    else link.removeAttribute("href");
  }
  panel.classList.add("selected");
  if (changing) {
    // restart the hop even if previous selection is still animating
    void quicklinks.offsetWidth;
    quicklinks.classList.add("hopping");
  }
  typeUrl(href.split("/").pop());
  if (updateUrl) updateSelectionUrl();
}

function clearSelection({ focus = true, updateUrl = true } = {}) {
  if (!selected) {
    if (updateUrl) updateSelectionUrl();
    return;
  }
  selected.classList.remove("selected");
  if (focus) selected.blur();
  selected = null;
  updateName("");
  clearTimeout(typewriterTimer);
  urlSlug.textContent = "";
  panel.classList.remove("selected");
  urlDisplay.removeAttribute("aria-label");
  for (const link of modLinks) link.removeAttribute("href");
  if (updateUrl) updateSelectionUrl();
}

function updateName(name, colors = "#496950") {
  if (modName.classList.contains("visible") && modName.textContent === name) return;
  clearTimeout(nameTimer);
  modName.classList.remove("visible");
  nameTimer = setTimeout(
    () => {
      modName.replaceChildren();
      modName.setAttribute("aria-label", name);
      const palette = colors.split(", ");
      let letterIndex = 0;
      if (name)
        name.split(" ").forEach((word, index) => {
          const span = document.createElement("span");
          for (const character of word) {
            const letter = document.createElement("span");
            letter.textContent = character;
            letter.style.color = palette[letterIndex++ % palette.length];
            span.append(letter);
          }
          span.style.setProperty("--word", index);
          modName.append(index ? " " : "", span);
        });
      fitName();
      modName.classList.toggle("visible", !!name);
    },
    modName.textContent ? 100 : 0
  );
}

function fitName() {
  if (!modName.textContent) return;
  const words = [...modName.children];
  // find the largest font size that fits. now you dont gotta hardcode it for every new mod :)
  let low = 16;
  let high = 72;
  let best = low;
  while (low <= high) {
    const size = Math.floor((low + high) / 2);
    modName.style.fontSize = `${size}px`;
    if (words.every((word) => word.offsetWidth <= modName.clientWidth) && modName.offsetHeight <= 88) {
      best = size;
      low = size + 1;
    } else high = size - 1;
  }
  modName.style.fontSize = `${best}px`;
}

function typeUrl(slug) {
  if (!urlDisplay.offsetWidth || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    urlSlug.textContent = slug;
    return;
  }
  let deleting = !!urlSlug.textContent;
  function typeCharacter() {
    if (deleting) urlSlug.textContent = urlSlug.textContent.slice(0, -1);
    else urlSlug.textContent += slug[urlSlug.textContent.length];
    if (!urlSlug.textContent) deleting = false;
    if (deleting || urlSlug.textContent !== slug) typewriterTimer = setTimeout(typeCharacter, deleting ? 15 : 30);
  }
  typeCharacter();
}

function nextBubbleIndex(index, direction) {
  const count = bubbles.length;
  if (direction === "End") return count - 1;
  if (direction === "Home" || index === -1) return 0;
  if (direction === "ArrowLeft") return (index + count - 1) % count;
  if (direction === "ArrowRight") return (index + 1) % count;
  // use the rendered rows so vertical navigation also works on mobile
  const cells = bubbles.map((bubble) => bubble.parentElement);
  const current = cells[index];
  const rows = [...new Set(cells.map((cell) => cell.offsetTop))];
  const step = direction === "ArrowUp" ? -1 : 1;
  const row = rows[(rows.indexOf(current.offsetTop) + step + rows.length) % rows.length];
  let nearest = index;
  let distance = Infinity;
  cells.forEach((cell, i) => {
    const gap = Math.abs(cell.offsetLeft - current.offsetLeft);
    if (cell.offsetTop === row && gap < distance) {
      nearest = i;
      distance = gap;
    }
  });
  return nearest;
}
