from pathlib import Path
import json

Path('src/hooks/useModalFocus.ts').write_text("""import { useEffect, type RefObject } from 'react';

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex=\"-1\"])',
].join(',');

export function useModalFocus(dialogRef: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusInitial = () => {
      const autofocus = dialog.querySelector<HTMLElement>('[autofocus]');
      const first = autofocus ?? dialog.querySelector<HTMLElement>(FOCUSABLE) ?? dialog;
      first.focus({ preventScroll: true });
    };
    const frame = requestAnimationFrame(focusInitial);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const focusable = Array.from(dialog.querySelectorAll(FOCUSABLE)) as HTMLElement[];
      const visible = focusable.filter((element) => !element.hidden && element.getAttribute('aria-hidden') !== 'true');
      if (!visible.length) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = visible[0];
      const last = visible[visible.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    dialog.addEventListener('keydown', onKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      dialog.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      previous?.focus({ preventScroll: true });
    };
  }, [dialogRef]);
}
""", encoding='utf-8')

package_path = Path('package.json')
package = json.loads(package_path.read_text(encoding='utf-8'))
package.setdefault('devDependencies', {})['@types/react'] = '^19.0.0'
package.setdefault('devDependencies', {})['@types/react-dom'] = '^19.0.0'
package_path.write_text(json.dumps(package, indent=2) + '\n', encoding='utf-8')

print('MA4 TypeScript compatibility patch applied')
