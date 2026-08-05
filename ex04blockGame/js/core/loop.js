import { update } from "../systems/update.js";
import { render } from "../systems/render.js";
import { consumeFrameInputs } from "../systems/input.js";
import { syncHud } from "../ui/hud.js";
import { syncOverlay } from "../ui/overlay.js";

/**
 * 루프: update → render → HUD/Overlay 동기화 → 일회성 입력 소비
 */
export function startLoop(ctx, state) {
  function frame() {
    update(state);
    render(ctx, state);
    syncHud(state);
    syncOverlay(state);
    consumeFrameInputs(state.input);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
