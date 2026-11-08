export interface MovementInput {
  x: number;
  y: number;
  sprint: boolean;
}
// Use physical key positions when available. KeyboardEvent.key can be IME text
// or a different character on non-US layouts; fallback to key for virtual keyboards.
const physicalMovementKeys: Record<string,string> = {
  KeyW:"w",KeyA:"a",KeyS:"s",KeyD:"d",
  ArrowUp:"arrowup",ArrowDown:"arrowdown",ArrowLeft:"arrowleft",ArrowRight:"arrowright",
  ShiftLeft:"shift",ShiftRight:"shift",
};
const logicalMovementKeys = new Set(["w","a","s","d","arrowup","arrowdown","arrowleft","arrowright","shift"]);
export function movementKey(event: Pick<KeyboardEvent,"key"|"code">): string | null {
  const physical = physicalMovementKeys[event.code];
  if (physical) return physical;
  const logical = event.key.toLowerCase();
  return logicalMovementKeys.has(logical) ? logical : null;
}
function isEditingTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable);
}
export function createMovementInput(joystick: HTMLElement, knob: HTMLElement) {
  const pressed = new Set<string>();
  let touchX = 0, touchY = 0, pointerId: number | null = null;
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.isComposing || isEditingTarget(event.target)) return;
    const k = movementKey(event);
    if (k) {
      pressed.add(k);
      if (k.startsWith("arrow")) event.preventDefault();
    }
  };
  const onKeyUp = (event: KeyboardEvent) => {
    const k = movementKey(event);
    if (k) pressed.delete(k);
  };
  const reset = () => { pressed.clear(); touchX=0; touchY=0; pointerId=null; knob.style.transform="translate(-50%,-50%)"; };
  const onBlur = () => reset();
  function movePointer(e: PointerEvent) {
    if (pointerId !== e.pointerId) return;
    const r = joystick.getBoundingClientRect();
    const cx = r.left+r.width/2, cy = r.top+r.height/2-10;
    let dx=(e.clientX-cx)/43,dy=(e.clientY-cy)/43;
    const length = Math.max(1,Math.hypot(dx,dy));
    dx/=length;dy/=length;touchX=dx;touchY=dy;
    knob.style.transform=`translate(calc(-50% + ${Math.round(dx*39)}px),calc(-50% + ${Math.round(dy*39)}px))`;
  }
  const down = (e: PointerEvent) => {
    if (pointerId !== null) return;
    pointerId=e.pointerId;joystick.setPointerCapture(e.pointerId);movePointer(e);e.preventDefault();
  };
  const up=(e:PointerEvent) => {if(pointerId!==e.pointerId)return;pointerId=null;touchX=0;touchY=0;knob.style.transform="translate(-50%,-50%)";};
  window.addEventListener("keydown",onKeyDown);
  window.addEventListener("keyup",onKeyUp);
  window.addEventListener("blur",onBlur);
  joystick.addEventListener("pointerdown",down);
  joystick.addEventListener("pointermove",movePointer);
  joystick.addEventListener("pointerup",up);
  joystick.addEventListener("pointercancel",up);
  function read():MovementInput {
    const x=(pressed.has("d")||pressed.has("arrowright")?1:0)-(pressed.has("a")||pressed.has("arrowleft")?1:0)+touchX;
    const y=(pressed.has("s")||pressed.has("arrowdown")?1:0)-(pressed.has("w")||pressed.has("arrowup")?1:0)+touchY;
    const length=Math.max(1,Math.hypot(x,y));
    return {x:x/length,y:y/length,sprint:pressed.has("shift")};
  }
  function destroy(){
    window.removeEventListener("keydown",onKeyDown);window.removeEventListener("keyup",onKeyUp);window.removeEventListener("blur",onBlur);
    joystick.removeEventListener("pointerdown",down);joystick.removeEventListener("pointermove",movePointer);
    joystick.removeEventListener("pointerup",up);joystick.removeEventListener("pointercancel",up);
    reset();
  }
  return {read,destroy};
}
