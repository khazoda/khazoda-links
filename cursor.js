const cursor = document.getElementById("wii-cursor");
const animationToggle = document.getElementById("cursor-toggle");
const customCursorToggle = document.getElementById("custom-cursor-toggle");
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
const images = [...cursor.children];
let lastMove, settleTimer, moveFrame, pendingMove;

function animationsEnabled() {
  return animationToggle.checked && !reducedMotion.matches;
}

function clamp(value, limit) {
  return Math.max(-limit, Math.min(limit, value));
}

function resetMotion() {
  clearTimeout(settleTimer);
  cursor.classList.remove("moving", "pressed");
  cursor.style.rotate = "0deg";
}

function hideCursor() {
  cancelAnimationFrame(moveFrame);
  moveFrame = null;
  pendingMove = null;
  if (!lastMove) return;
  resetMotion();
  lastMove = null;
  cursor.hidePopover();
}

export function syncCursorSettings() {
  animationToggle.disabled = !customCursorToggle.checked;
  if (!customCursorToggle.checked) hideCursor();
}

function positionCursor(event) {
  cursor.style.translate = `${event.clientX}px ${event.clientY}px`;
}

function moveCursor(event) {
  if (!customCursorToggle.checked || event.pointerType !== "mouse") return hideCursor();
  // keep native cursor until both cursor SVGs have loaded
  if (!images.every((image) => image.complete && image.naturalWidth > 0)) return;

  // render latest position one per frame maximum. was causing issues with high polling rate mouse b4
  // https://web.dev/articles/debounce-your-input-handlers
  pendingMove = event;
  if (moveFrame == null) moveFrame = requestAnimationFrame(renderCursor);
}

function renderCursor() {
  const event = pendingMove;
  moveFrame = null;
  pendingMove = null;

  const animated = animationsEnabled();
  const elapsed = event.timeStamp - (lastMove?.time ?? 0);
  let speed = 0;
  if (animated && lastMove && elapsed > 0 && elapsed < 100) {
    speed = clamp((event.clientX - lastMove.x) / Math.max(elapsed, 1), 3);
  }

  // leaning animation
  const acceleration = speed - (lastMove?.speed ?? 0);
  const lean = clamp(speed * 20 + acceleration * 6, 26);
  const restingAngle = ((event.clientX / innerWidth) * 2 - 1) * 30;
  lastMove = { x: event.clientX, time: event.timeStamp, speed };

  positionCursor(event);
  cursor.classList.toggle("moving", animated);
  cursor.style.rotate = `${animated ? restingAngle + lean : 0}deg`;
  clearTimeout(settleTimer);
  if (animated) {
    settleTimer = setTimeout(() => {
      cursor.classList.remove("moving");
      cursor.style.rotate = `${restingAngle}deg`;
    }, 60);
  }

  if (!cursor.matches(":popover-open")) cursor.showPopover();
}

function pressCursor(event) {
  if (event.pointerType !== "mouse") return hideCursor();
  if (!lastMove || !animationsEnabled() || event.button !== 0) return;
  if (!event.target.closest("a[href], button, input, label")) return;

  cursor.classList.add("pressed");
}

if (cursor.showPopover) {
  customCursorToggle.addEventListener("change", syncCursorSettings);
  document.addEventListener("pointermove", moveCursor);
  document.addEventListener("pointerdown", pressCursor);
  window.addEventListener("pointerup", (event) => {
    if (event.button === 0) cursor.classList.remove("pressed");
  });

  // reopen above dialog when it enters the top z layer
  for (const dialog of document.querySelectorAll("dialog")) {
    dialog.addEventListener("toggle", () => {
      if (!lastMove) return;
      cursor.hidePopover();
      cursor.showPopover();
    });
  }

  document.documentElement.addEventListener("pointerleave", (event) => {
    if (!event.relatedTarget) hideCursor();
  });
  for (const event of ["blur", "pagehide", "contextmenu", "dragstart", "pointercancel"]) {
    window.addEventListener(event, hideCursor);
  }
  animationToggle.addEventListener("change", resetMotion);
  reducedMotion.addEventListener("change", resetMotion);
}
