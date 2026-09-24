import React, {useEffect, useRef, useState} from 'react';

export interface MenuItem {
  key: string;
  label: string;
  /** A link opens in a new tab; otherwise `run`. */
  href?: string;
  run?: () => void;
  disabled?: boolean;
  note?: string;
}

/**
 * The W icon's menu (the ARIA menu button pattern): arrow keys, Home and End
 * move, Enter or Space activates, Escape closes and returns focus to the icon,
 * Tab closes.
 */
export const WittyMenu: React.FC<{
  id: string;
  label: string;
  items: MenuItem[];
  /** The button that opens the menu: moving focus there is not leaving it. */
  anchor: () => HTMLElement | null;
  onClose: (returnFocus: boolean) => void;
}> = ({id, label, items, anchor, onClose}) => {
  const refs = useRef<(HTMLElement | null)[]>([]);
  const [active, setActive] = useState(0);

  useEffect(() => {
    refs.current[0]?.focus();
  }, []);

  const move = (index: number): void => {
    const next = (index + items.length) % items.length;
    setActive(next);
    refs.current[next]?.focus();
  };

  const onKeyDown = (event: React.KeyboardEvent): void => {
    // The menu sits inside the toolbar, whose keys are not the menu's.
    event.stopPropagation();
    const focused = refs.current.indexOf(document.activeElement as HTMLElement);
    const from = focused < 0 ? active : focused;
    const keys: Record<string, number> = {
      ArrowDown: from + 1,
      ArrowUp: from - 1,
      Home: 0,
      End: items.length - 1,
    };
    if (event.key in keys) {
      event.preventDefault();
      move(keys[event.key]);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      onClose(true);
    } else if (event.key === 'Tab') {
      onClose(false);
    }
  };

  return (
    <div
      id={id}
      className='witty-editor-menu'
      role='menu'
      // Focus goes to the items; this only keeps a click on the gaps inside.
      tabIndex={-1}
      aria-label={label}
      onKeyDown={onKeyDown}
      // Clicking or tabbing elsewhere closes it.
      onBlur={(event) => {
        const next = event.relatedTarget as Node | null;
        if (next && (event.currentTarget.contains(next) || next === anchor())) {
          return;
        }
        onClose(false);
      }}
    >
      {items.map((item, index) => {
        const common = {
          ref: (element: HTMLElement | null): void => {
            refs.current[index] = element;
          },
          role: 'menuitem',
          tabIndex: index === active ? 0 : -1,
          className: 'witty-editor-menu-item',
          onFocus: (): void => setActive(index),
          // Safari does not focus a clicked button, which would blur the menu
          // and close it before the click.
          onMouseDown: (event: React.MouseEvent): void =>
            event.preventDefault(),
        };
        return (
          <div key={item.key} role='none'>
            {item.href ? (
              <a
                {...common}
                href={item.href}
                target='_blank'
                rel='noopener noreferrer'
                // The page opens in a new tab; back here, focus is on the icon.
                onClick={() => onClose(true)}
              >
                {item.label}
              </a>
            ) : (
              <button
                {...common}
                type='button'
                aria-disabled={item.disabled || undefined}
                onClick={() => !item.disabled && item.run?.()}
              >
                {item.label}
                {item.note && (
                  <span className='witty-editor-menu-note'>{item.note}</span>
                )}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
};
