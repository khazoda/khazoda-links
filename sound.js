const button = document.getElementById("sound-toggle");
let context, gain, buffers, loading;
let muted = false;

try {
  muted = localStorage.getItem("muted") === "true";
} catch {}

updateButton();
button.hidden = false;
button.addEventListener("click", () => {
  muted = !muted;
  updateButton();
  button.animate([{ background: "#f0efe1", opacity: 1 }, {}], { duration: 450 });
  document.getElementById("keyboard-status").textContent = muted ? "Sound muted" : "Sound unmuted";
  try {
    localStorage.setItem("muted", muted);
  } catch {}
});

loadSounds().catch((error) => console.warn("Failed to load sounds", error));
document.addEventListener("pointerdown", () => context?.resume().catch(() => {}), { once: true });

function updateButton() {
  const label = muted ? "Unmute sound" : "Mute sound";
  button.setAttribute("aria-label", label);
  button.setAttribute("aria-pressed", muted);
  button.title = label;
  if (gain) gain.gain.value = muted ? 0 : 0.8;
}

async function loadSounds() {
  if (!context) {
    context = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: "interactive" });
    gain = context.createGain();
    gain.gain.value = muted ? 0 : 0.8;
    gain.connect(context.destination);
  }
  // reuse the preload, but allow a later click to retry a failed request
  loading ||= Promise.all(
    ["ui_select.ogg", "ui_select_reversed.ogg"].map(async (file) => {
      const response = await fetch(`static/${file}`);
      if (!response.ok) throw new Error(`Sound request failed: ${response.status}`);
      return context.decodeAudioData(await response.arrayBuffer());
    })
  )
    .then((loaded) => {
      buffers = loaded;
    })
    .catch((error) => {
      loading = null;
      throw error;
    });
  return loading;
}

export async function playSound({ playbackRate = 1, reverse = false } = {}) {
  if (muted) return;
  try {
    if (context.state !== "running" || !buffers) await Promise.all([context.resume(), loadSounds()]);
    if (muted || !buffers) return;
    const source = context.createBufferSource();
    source.buffer = buffers[reverse ? 1 : 0];
    source.playbackRate.value = playbackRate;
    source.connect(gain);
    source.start();
  } catch {}
}
