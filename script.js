document.addEventListener("DOMContentLoaded", async function () {
  // Centralized application state
  const appState = {
    selectedBubble: null,
    audioContext: null,
    selectSoundBuffer: null,
    siteData: {},
    timeouts: {
      typewriter: null,
    },
    typewriterSpeed: 30,
  };

  // Cached DOM elements
  const elements = {
    urlDisplay: document.getElementById("url-display"),
    modsGrid: document.getElementById("mods-grid"),
    bubbles: null,
  };

  await initializeApplication();

  async function initializeApplication() {
    await loadSiteData();
    setupBubbleElements();
    setupEventListeners();
  }

  async function loadSiteData() {
    try {
      const response = await fetch("SITELIST.json");
      appState.siteData = await response.json();
    } catch (error) {
      console.error("Failed to load site data:", error);
    }
  }

  function setupBubbleElements() {
    elements.bubbles = document.querySelectorAll(".bubble");
    elements.bubbles.forEach((bubble) => {
      bubble.style.cursor = "inherit";
      bubble.addEventListener("click", handleBubbleClick);
    });
  }

  function setupEventListeners() {
    document.addEventListener("click", handleDocumentClick);
    document.addEventListener("keydown", handleKeyDown);
  }

  async function initializeAudioContext() {
    if (!appState.audioContext) {
      appState.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (appState.audioContext.state === "suspended") {
      await appState.audioContext.resume();
    }
  }

  async function loadSelectSound() {
    if (appState.selectSoundBuffer) return;

    try {
      const response = await fetch("static/ui_select.ogg");
      const arrayBuffer = await response.arrayBuffer();
      appState.selectSoundBuffer = await appState.audioContext.decodeAudioData(arrayBuffer);
    } catch (error) {
      console.warn("Failed to load select sound", error);
    }
  }

  async function playSelectSound() {
    try {
      await initializeAudioContext();
      await loadSelectSound();

      if (appState.selectSoundBuffer) {
        const source = appState.audioContext.createBufferSource();
        const gainNode = appState.audioContext.createGain();

        source.buffer = appState.selectSoundBuffer;
        gainNode.gain.value = 0.8;
        source.connect(gainNode);
        gainNode.connect(appState.audioContext.destination);
        source.start();
      }
    } catch (err) {
    }
  }

  function clearAllTimeouts() {
    if (appState.timeouts.typewriter) {
      clearTimeout(appState.timeouts.typewriter);
      appState.timeouts.typewriter = null;
    }
  }

  function clearTypewriterEffect(shouldHide = true) {
    if (elements.urlDisplay) {
      if (shouldHide) {
        elements.urlDisplay.classList.remove("visible");
      }
      elements.urlDisplay.textContent = "";
    }
    clearAllTimeouts();
  }

  function selectBubble(bubble, hadPreviousSelection = false) {
    clearTypewriterEffect(!hadPreviousSelection);

    appState.selectedBubble = bubble;
    bubble.focus();
    playSelectSound();

    const siteKey = bubble.dataset.siteKey;
    const rawUrl = bubble.getAttribute("href");
    const url = appState.siteData[siteKey] || (rawUrl && rawUrl !== "#" ? rawUrl.replace(/^https?:\/\//, "") : null);
    if (url) {
      appState.timeouts.typewriter = setTimeout(() => startTypewriterEffect(url, appState.typewriterSpeed), 50);
    }
  }

  function clearSelection() {
    if (appState.selectedBubble) {
      appState.selectedBubble.blur();
      appState.selectedBubble = null;
    }
    clearTypewriterEffect(true);
  }

  function openBubbleLink(bubble) {
    const href = bubble.getAttribute("href");
    if (href && href !== "#") {
      window.open(href, "_blank", "noopener,noreferrer");
    }
  }

  // Dual-click interaction: 1st click selects/types, 2nd click opens
  function handleBubbleClick(event) {
    event.preventDefault();
    const bubble = this;

    if (appState.selectedBubble === bubble) {
      openBubbleLink(bubble);
      clearSelection();
      return;
    }

    const hadPreviousSelection = appState.selectedBubble !== null;
    if (hadPreviousSelection) {
        appState.selectedBubble.blur();
    }
    selectBubble(bubble, hadPreviousSelection);
  }

  // --- Grid Navigation Logic ---
  function getBubblesArray() {
    if (!elements.bubbles) {
      elements.bubbles = document.querySelectorAll(".bubble");
    }
    return Array.from(elements.bubbles);
  }

  function calculateGridColumns() {
    if (!elements.modsGrid) return 1;
    return getComputedStyle(elements.modsGrid).gridTemplateColumns.split(" ").length;
  }

  function getNextBubbleIndex(currentIndex, direction, bubblesCount, cols) {
    switch (direction) {
      case "ArrowLeft":
        return currentIndex > 0 ? currentIndex - 1 : bubblesCount - 1;
      case "ArrowRight":
        return currentIndex < bubblesCount - 1 ? currentIndex + 1 : 0;
      case "ArrowUp":
        let upIndex = currentIndex - cols;
        if (upIndex < 0) {
          upIndex = currentIndex + Math.floor((bubblesCount - 1) / cols) * cols;
          if (upIndex >= bubblesCount) upIndex -= cols;
        }
        return upIndex;
      case "ArrowDown":
        let downIndex = currentIndex + cols;
        return downIndex >= bubblesCount ? currentIndex % cols : downIndex;
      default:
        return currentIndex;
    }
  }

  function navigateGrid(direction) {
    const bubblesArray = getBubblesArray();
    const currentIndex = bubblesArray.indexOf(document.activeElement);

    if (currentIndex === -1) {
      if (bubblesArray[0]) selectBubble(bubblesArray[0]);
      return;
    }

    const cols = calculateGridColumns();
    const newIndex = getNextBubbleIndex(currentIndex, direction, bubblesArray.length, cols);
    const newElement = bubblesArray[newIndex];

    if (newElement) {
      const hadPreviousSelection = appState.selectedBubble !== null;
      selectBubble(newElement, hadPreviousSelection);
    }
  }

  function handleDocumentClick(event) {
    if (!event.target.closest(".bubble")) {
      clearSelection();
    }
  }

  function handleKeyDown(event) {
    if (event.key === "Escape") {
      clearSelection();
    } else if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) {
      event.preventDefault();
      navigateGrid(event.key);
    } else if (event.key === "Enter" && appState.selectedBubble) {
      event.preventDefault();
      openBubbleLink(appState.selectedBubble);
    }
  }

  // --- Typewriter Logic ---
  function startTypewriterEffect(text, speed = 50) {
    if (!elements.urlDisplay) return;

    clearAllTimeouts();
    elements.urlDisplay.textContent = "";
    elements.urlDisplay.classList.add("visible");

    let charIndex = 0;

    function typeNextCharacter() {
      if (charIndex < text.length) {
        elements.urlDisplay.textContent += text.charAt(charIndex);
        charIndex++;
        appState.timeouts.typewriter = setTimeout(typeNextCharacter, speed);
      }
    }

    typeNextCharacter();
  }
});
