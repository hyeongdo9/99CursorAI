import { CANVAS_WIDTH } from "../core/constants.js";

/**
 * launchPressed: 클릭/터치 (발사 또는 레이저)
 * spacePressed: Space
 * firePressed: Z 키 레이저
 */
export function bindInput(canvas, state) {
  const input = state.input;

  function canvasX(clientX) {
    const rect = canvas.getBoundingClientRect();
    return ((clientX - rect.left) / rect.width) * CANVAS_WIDTH;
  }

  window.addEventListener("keydown", (e) => {
    if (e.code === "ArrowLeft" || e.code === "KeyA") input.left = true;
    if (e.code === "ArrowRight" || e.code === "KeyD") input.right = true;
    if (e.code === "Space") {
      e.preventDefault();
      input.spacePressed = true;
    }
    if (e.code === "KeyZ") {
      e.preventDefault();
      input.firePressed = true;
    }
  });

  window.addEventListener("keyup", (e) => {
    if (e.code === "ArrowLeft" || e.code === "KeyA") input.left = false;
    if (e.code === "ArrowRight" || e.code === "KeyD") input.right = false;
  });

  canvas.addEventListener("mousemove", (e) => {
    input.mouseX = canvasX(e.clientX);
  });

  canvas.addEventListener("mouseleave", () => {
    input.mouseX = null;
  });

  canvas.addEventListener("click", () => {
    input.launchPressed = true;
  });

  canvas.addEventListener(
    "touchmove",
    (e) => {
      e.preventDefault();
      input.mouseX = canvasX(e.touches[0].clientX);
    },
    { passive: false }
  );

  canvas.addEventListener(
    "touchstart",
    (e) => {
      e.preventDefault();
      input.mouseX = canvasX(e.touches[0].clientX);
      input.launchPressed = true;
    },
    { passive: false }
  );
}

export function consumeFrameInputs(input) {
  input.launchPressed = false;
  input.spacePressed = false;
  input.firePressed = false;
}
