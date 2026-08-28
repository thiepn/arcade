import { useEffect, useMemo, useState, type RefObject } from 'react';

type KeyCode =
  | 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown'
  | 'Space' | 'Escape' | 'ShiftLeft'
  | 'KeyA' | 'KeyD' | 'KeyW' | 'KeyS' | 'KeyG' | 'KeyR' | 'KeyN' | 'KeyL'
  | 'KeyF' | 'KeyJ' | 'KeyK'
  | 'Digit1' | 'Digit2' | 'Digit3' | 'Digit4';

interface GamepadBridgeOptions {
  gameId: string;
  targetRef: RefObject<HTMLElement | null>;
  cursorRef: RefObject<HTMLDivElement | null>;
  paused: boolean;
  gameOver: boolean;
}

interface GamepadBridgeState {
  connected: boolean;
  controllerName: string | null;
  pointerMode: boolean;
}

const POINTER_GAMES = new Set([
  'oneline',
  'blade',
  'chain',
  'gravity',
  'matrix',
  'typerush',
  'bubblebuster',
  'airhockey',
]);

const KEY_META: Record<KeyCode, { key: string; code: string }> = {
  ArrowLeft: { key: 'ArrowLeft', code: 'ArrowLeft' },
  ArrowRight: { key: 'ArrowRight', code: 'ArrowRight' },
  ArrowUp: { key: 'ArrowUp', code: 'ArrowUp' },
  ArrowDown: { key: 'ArrowDown', code: 'ArrowDown' },
  Space: { key: ' ', code: 'Space' },
  Escape: { key: 'Escape', code: 'Escape' },
  ShiftLeft: { key: 'Shift', code: 'ShiftLeft' },
  KeyA: { key: 'a', code: 'KeyA' },
  KeyD: { key: 'd', code: 'KeyD' },
  KeyW: { key: 'w', code: 'KeyW' },
  KeyS: { key: 's', code: 'KeyS' },
  KeyG: { key: 'g', code: 'KeyG' },
  KeyR: { key: 'r', code: 'KeyR' },
  KeyN: { key: 'n', code: 'KeyN' },
  KeyL: { key: 'l', code: 'KeyL' },
  KeyF: { key: 'f', code: 'KeyF' },
  KeyJ: { key: 'j', code: 'KeyJ' },
  KeyK: { key: 'k', code: 'KeyK' },
  Digit1: { key: '1', code: 'Digit1' },
  Digit2: { key: '2', code: 'Digit2' },
  Digit3: { key: '3', code: 'Digit3' },
  Digit4: { key: '4', code: 'Digit4' },
};

function emitKey(type: 'keydown' | 'keyup', code: KeyCode): void {
  const meta = KEY_META[code];
  window.dispatchEvent(new KeyboardEvent(type, {
    key: meta.key,
    code: meta.code,
    bubbles: true,
    cancelable: true,
  }));
}

function faceMapping(gameId: string, paused: boolean, gameOver: boolean): Array<KeyCode | null> {
  if (gameOver) return ['Space', 'Escape', 'KeyN', 'KeyL'];
  if (paused) return ['Escape', 'Escape', 'KeyR', null];
  if (gameId === 'merge') return ['Digit1', 'Digit2', 'Digit3', 'Digit4'];
  if (gameId === 'rhythm') return ['KeyF', 'KeyJ', 'KeyD', 'KeyK'];
  if (gameId === 'astroblaster') return ['Space', 'Escape', 'ShiftLeft', null];
  return ['Space', 'Escape', 'ShiftLeft', 'KeyG'];
}

function directionMapping(gameId: string): Record<'left' | 'right' | 'up' | 'down', KeyCode | null> {
  if (gameId === 'astroblaster') {
    return { left: 'KeyA', right: 'KeyD', up: 'KeyW', down: 'KeyS' };
  }
  return { left: 'ArrowLeft', right: 'ArrowRight', up: 'ArrowUp', down: 'ArrowDown' };
}

function dispatchPointer(target: Element, type: 'pointerdown' | 'pointermove' | 'pointerup', x: number, y: number, pressed: boolean): void {
  const pointerInit: PointerEventInit = {
    bubbles: true,
    cancelable: true,
    clientX: x,
    clientY: y,
    button: 0,
    buttons: pressed ? 1 : 0,
    pointerId: 91,
    pointerType: 'mouse',
    isPrimary: true,
  };
  try {
    target.dispatchEvent(new PointerEvent(type, pointerInit));
  } catch {}

  const mouseType = type === 'pointerdown' ? 'mousedown' : type === 'pointerup' ? 'mouseup' : 'mousemove';
  target.dispatchEvent(new MouseEvent(mouseType, {
    bubbles: true,
    cancelable: true,
    clientX: x,
    clientY: y,
    button: 0,
    buttons: pressed ? 1 : 0,
  }));

  if (type === 'pointerup') {
    target.dispatchEvent(new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      clientX: x,
      clientY: y,
      button: 0,
    }));
  }
}

export function useGamepadBridge({
  gameId,
  targetRef,
  cursorRef,
  paused,
  gameOver,
}: GamepadBridgeOptions): GamepadBridgeState {
  const pointerMode = useMemo(() => POINTER_GAMES.has(gameId), [gameId]);
  const [connected, setConnected] = useState(false);
  const [controllerName, setControllerName] = useState<string | null>(null);

  useEffect(() => {
    if (!('getGamepads' in navigator)) return;

    let frame = 0;
    let lastTime = performance.now();
    let activeIndex: number | null = null;
    let pointerPressed = false;
    let cursorX = 0;
    let cursorY = 0;
    let cursorInitialized = false;
    let reportedConnected = false;
    let reportedName: string | null = null;
    const heldKeys = new Set<KeyCode>();
    const previousButtons = new Map<number, boolean>();

    const releaseKey = (code: KeyCode) => {
      if (!heldKeys.has(code)) return;
      heldKeys.delete(code);
      emitKey('keyup', code);
    };

    const holdKey = (code: KeyCode, down: boolean) => {
      if (down && !heldKeys.has(code)) {
        heldKeys.add(code);
        emitKey('keydown', code);
      } else if (!down) {
        releaseKey(code);
      }
    };

    const releaseAll = () => {
      for (const code of [...heldKeys]) releaseKey(code);
      pointerPressed = false;
      previousButtons.clear();
    };

    const updateConnection = () => {
      const pads = Array.from(navigator.getGamepads?.() ?? []).filter((pad): pad is Gamepad => Boolean(pad?.connected));
      const active = activeIndex !== null ? pads.find((pad) => pad.index === activeIndex) : pads[0];
      const next = active ?? pads[0] ?? null;
      activeIndex = next?.index ?? null;
      const nextConnected = Boolean(next);
      const nextName = next?.id || null;
      if (nextConnected !== reportedConnected) {
        reportedConnected = nextConnected;
        setConnected(nextConnected);
      }
      if (nextName !== reportedName) {
        reportedName = nextName;
        setControllerName(nextName);
      }
      return next;
    };

    const onConnected = (event: GamepadEvent) => {
      activeIndex = event.gamepad.index;
      setConnected(true);
      setControllerName(event.gamepad.id || 'Gamepad');
    };
    const onDisconnected = (event: GamepadEvent) => {
      if (event.gamepad.index === activeIndex) activeIndex = null;
      releaseAll();
      updateConnection();
    };

    window.addEventListener('gamepadconnected', onConnected);
    window.addEventListener('gamepaddisconnected', onDisconnected);
    updateConnection();

    const tick = (now: number) => {
      const delta = Math.min(40, Math.max(0, now - lastTime));
      lastTime = now;
      const pad = updateConnection();
      const target = targetRef.current;
      const cursor = cursorRef.current;

      if (!pad || !target) {
        releaseAll();
        if (cursor) cursor.style.display = 'none';
        frame = requestAnimationFrame(tick);
        return;
      }

      const deadzone = 0.55;
      const axisX = Math.abs(pad.axes[0] ?? 0) >= deadzone ? (pad.axes[0] ?? 0) : 0;
      const axisY = Math.abs(pad.axes[1] ?? 0) >= deadzone ? (pad.axes[1] ?? 0) : 0;
      const dpadLeft = Boolean(pad.buttons[14]?.pressed);
      const dpadRight = Boolean(pad.buttons[15]?.pressed);
      const dpadUp = Boolean(pad.buttons[12]?.pressed);
      const dpadDown = Boolean(pad.buttons[13]?.pressed);

      if (pointerMode && !paused && !gameOver) {
        const rect = target.getBoundingClientRect();
        if (!cursorInitialized) {
          cursorX = rect.left + rect.width / 2;
          cursorY = rect.top + rect.height / 2;
          cursorInitialized = true;
        }
        const dx = dpadLeft ? -1 : dpadRight ? 1 : axisX;
        const dy = dpadUp ? -1 : dpadDown ? 1 : axisY;
        const speed = 0.72 * delta;
        cursorX = Math.max(rect.left + 4, Math.min(rect.right - 4, cursorX + dx * speed));
        cursorY = Math.max(rect.top + 4, Math.min(rect.bottom - 4, cursorY + dy * speed));

        if (cursor) {
          cursor.style.display = 'block';
          cursor.style.transform = `translate3d(${Math.round(cursorX)}px, ${Math.round(cursorY)}px, 0)`;
        }

        if (dx !== 0 || dy !== 0) {
          const element = document.elementFromPoint(cursorX, cursorY) ?? target;
          dispatchPointer(element, 'pointermove', cursorX, cursorY, pointerPressed);
        }
      } else {
        if (cursor) cursor.style.display = 'none';
        cursorInitialized = false;
        const directions = directionMapping(gameId);
        if (directions.left) holdKey(directions.left, dpadLeft || axisX < 0);
        if (directions.right) holdKey(directions.right, dpadRight || axisX > 0);
        if (directions.up) holdKey(directions.up, dpadUp || axisY < 0);
        if (directions.down) holdKey(directions.down, dpadDown || axisY > 0);
      }

      const faces = faceMapping(gameId, paused, gameOver);
      for (let index = 0; index < 4; index += 1) {
        const pressed = Boolean(pad.buttons[index]?.pressed);
        const wasPressed = previousButtons.get(index) ?? false;

        if (pointerMode && !paused && !gameOver && index === 0) {
          if (pressed !== wasPressed) {
            const element = document.elementFromPoint(cursorX, cursorY) ?? target;
            if (pressed) {
              pointerPressed = true;
              dispatchPointer(element, 'pointerdown', cursorX, cursorY, true);
            } else {
              dispatchPointer(element, 'pointerup', cursorX, cursorY, false);
              pointerPressed = false;
            }
          }
        } else {
          const code = faces[index];
          if (code) holdKey(code, pressed);
        }
        previousButtons.set(index, pressed);
      }

      // Back/Select and Start both map to the shell's Escape behavior.
      for (const index of [8, 9]) {
        const pressed = Boolean(pad.buttons[index]?.pressed);
        const wasPressed = previousButtons.get(index) ?? false;
        if (pressed && !wasPressed) emitKey('keydown', 'Escape');
        if (!pressed && wasPressed) emitKey('keyup', 'Escape');
        previousButtons.set(index, pressed);
      }

      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('gamepadconnected', onConnected);
      window.removeEventListener('gamepaddisconnected', onDisconnected);
      releaseAll();
      if (cursorRef.current) cursorRef.current.style.display = 'none';
    };
  }, [cursorRef, gameId, gameOver, paused, pointerMode, targetRef]);

  return { connected, controllerName, pointerMode };
}
