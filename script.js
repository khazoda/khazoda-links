document.addEventListener("DOMContentLoaded", () => {
  const urlDisplay = document.getElementById("url-display");
  const urlText = document.getElementById("url-text");
  const grid = document.getElementById("mods-grid");
  const panel = document.getElementById("mods-panel");
  const bubbles = Array.from(grid.querySelectorAll(".bubble"));
  let selected = null;
  let typewriterTimer, audioContext, audioGain, soundBuffers, soundPromise;

  loadSounds();
  for (const link of [...bubbles, urlDisplay]) {
    link.addEventListener("pointerdown", handleLinkEvent);
    link.addEventListener("click", handleLinkEvent);
  }
  document.addEventListener("click", (event) => {
    if (!event.target.closest(".bubble, #url-display")) clearSelection();
  });
  document.addEventListener("keydown", (event) => {
    updateUrlArrow(event);
    if (event.key === "Escape") clearSelection();
    else if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) {
      event.preventDefault();
      const index = bubbles.indexOf(document.activeElement);
      const columns = getComputedStyle(grid).gridTemplateColumns.split(" ").length;
      selectBubble(bubbles[index === -1 ? 0 : nextBubbleIndex(index, event.key, columns)]);
    }
  });
  document.addEventListener("keyup", updateUrlArrow);
  document.addEventListener("pointerdown", updateUrlArrow);
  document.addEventListener("pointerdown", () => resumeAudio().catch(() => {}), { once: true });
  window.addEventListener("blur", () => urlDisplay.classList.remove("ctrl-held"));
  window.addEventListener("pageshow", () => {
    panel.classList.remove("departing");
    panel.style.removeProperty("transform-origin");
    clearSelection();
  });

  function updateUrlArrow(event) {
    urlDisplay.classList.toggle("ctrl-held", event.ctrlKey);
  }

  function getAudioContext() {
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: "interactive" });
      audioGain = audioContext.createGain();
      audioGain.gain.value = 0.8;
      audioGain.connect(audioContext.destination);
    }
    return audioContext;
  }

  async function resumeAudio() {
    const context = getAudioContext();
    if (context.state === "suspended") await context.resume();
  }

  function loadSounds() {
    if (!soundPromise) {
      soundPromise = (async () => {
        const context = getAudioContext();
        soundBuffers = await Promise.all(
          ["ui_select.ogg", "ui_select_reversed.ogg"].map(async (file) => {
            const response = await fetch(`static/${file}`);
            if (!response.ok) throw new Error(`Sound request failed: ${response.status}`);
            return context.decodeAudioData(await response.arrayBuffer());
          })
        );
      })().catch((error) => {
        soundPromise = null;
        console.warn("Failed to load sounds", error);
      });
    }
    return soundPromise;
  }

  async function playSound({ playbackRate = 1, reverse = false } = {}) {
    try {
      const context = getAudioContext();
      if (context.state !== "running" || !soundBuffers) await Promise.all([resumeAudio(), loadSounds()]);
      if (!soundBuffers) return;
      const source = context.createBufferSource();
      source.buffer = soundBuffers[reverse ? 1 : 0];
      source.playbackRate.value = playbackRate;
      source.connect(audioGain);
      source.start();
    } catch {}
  }

  // Play on press for selection/new tabs, on activation for same-tab navigation
  function handleLinkEvent(event) {
    if (event.button !== 0 || event.shiftKey || event.altKey) return;
    const pressing = event.type === "pointerdown";
    const keyboard = !pressing && event.detail === 0;
    if (event.ctrlKey || event.metaKey) {
      if (pressing || keyboard) playSound({ playbackRate: 1.25 });
    } else if (pressing) {
      if (this !== urlDisplay && this !== selected) playSound();
    } else if (this === urlDisplay || keyboard || this === selected) {
      playSound({ reverse: true });
      const bounds = panel.getBoundingClientRect();
      panel.style.transformOrigin = `${window.innerWidth / 2 - bounds.left}px ${window.innerHeight / 2 - bounds.top}px`;
      panel.classList.add("departing");
    } else {
      event.preventDefault();
      selectBubble(this, false);
    }
  }

  function clearTypewriter(hide = true) {
    clearTimeout(typewriterTimer);
    urlText.textContent = "";
    if (hide) {
      urlDisplay.classList.remove("visible");
      urlDisplay.removeAttribute("href");
      urlDisplay.removeAttribute("aria-label");
    }
  }

  function selectBubble(bubble, playAudio = true) {
    clearTypewriter(!selected);
    selected = bubble;
    bubble.focus();
    if (playAudio) playSound();
    const href = bubble.getAttribute("href");
    if (!href || href === "#") return;
    const url = href.replace(/^https?:\/\//, "");
    urlDisplay.setAttribute("href", href);
    urlDisplay.setAttribute("aria-label", `Open ${url}`);
    typewriterTimer = setTimeout(() => typeUrl(url), 50);
  }

  function clearSelection() {
    selected?.blur();
    selected = null;
    clearTypewriter();
  }

  function typeUrl(url) {
    urlDisplay.classList.add("visible");
    let index = 0;
    function typeCharacter() {
      urlText.textContent += url[index++];
      if (index < url.length) typewriterTimer = setTimeout(typeCharacter, 30);
    }
    typeCharacter();
  }

  function nextBubbleIndex(index, direction, columns) {
    const count = bubbles.length;
    switch (direction) {
      case "ArrowLeft":
        return (index + count - 1) % count;
      case "ArrowRight":
        return (index + 1) % count;
      case "ArrowUp":
        return index >= columns ? index - columns : index + Math.floor((count - 1 - index) / columns) * columns;
      case "ArrowDown":
        return index + columns < count ? index + columns : index % columns;
      default:
        return index;
    }
  }
});
