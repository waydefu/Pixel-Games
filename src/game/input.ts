export interface MovementInput {
  x: number;
  y: number;
  sprint: boolean;
}
export function createMovementInput(joystick: HTMLElement, knob: HTMLElement) {
  const pressed = new Set<string>();
  let touchX = 0, touchY = 0, pointerId: number | null = null;
  const keys = new Set(["w","a","s","d","arrowup","arrowdown","arrowleft","arrowright","shift"]);
  const onKeyDown = (event: KeyboardEvent) => {
    const k = event.key.toLowerCase();
    if (keys.has(k) && !(event.target instanceof HTMLInputElement) && !(event.target instanceof HTMLSelectElement)) {
      pressed.add(k);
      if (k.startsWith("arrow")) event.preventDefault();
    }
  };
  const onKeyUp = (event: KeyboardEvent) => { pressed.delete(event.key.toLowerCase()); };
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
