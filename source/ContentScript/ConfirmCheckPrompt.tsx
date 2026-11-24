import React, {useId} from 'react';
import {useTranslation} from 'react-i18next';

import {namespaces} from '../i18n/i18n.constants';
import {isTrustedEvent} from '../shared/trustedEvent';

interface ConfirmCheckPromptProps {
  /** Show the question and its buttons; otherwise only the empty live region. */
  open: boolean;
  /** Distance from the field's top edge, so the prompt sits below it. */
  top: number;
  onConfirm: () => void;
  onDismiss: () => void;
}

// Inline: the prompt sits in the highlights' closed shadow root, which the
// page's contentScript.css does not reach.
const BOX: React.CSSProperties = {
  position: 'absolute',
  left: 0,
  zIndex: 2147483647,
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '6px 8px',
  background: '#ffffff',
  color: '#000000',
  border: '1px solid #9489db',
  borderRadius: '5px',
  boxShadow: '1px 0 18px 7px rgba(50, 50, 50, 0.1)',
  fontFamily: 'Lato, Arial, Helvetica, sans-serif',
  fontSize: '14px',
  lineHeight: '20px',
  whiteSpace: 'nowrap',
};

const BUTTON: React.CSSProperties = {
  font: 'inherit',
  cursor: 'pointer',
  borderRadius: '5px',
  padding: '2px 8px',
};

/**
 * Asks whether to check the focused field, when the user or their
 * organisation chose to be asked first (shared/confirmBeforeChecking.ts).
 * Nothing from the field is sent before the user's own click or key press on
 * "Check with Witty"; a page script's synthetic click does not count.
 *
 * The question is a live region, so a screen reader announces it when the
 * field gets focus; the buttons come before the field in the tab order
 * (Shift+Tab). Escape closes the prompt until the field is focused again.
 */
const ConfirmCheckPrompt: React.FC<ConfirmCheckPromptProps> = ({
  open,
  top,
  onConfirm,
  onDismiss,
}) => {
  const {t} = useTranslation(namespaces.popover);
  const questionId = useId();

  return (
    <div
      role='group'
      aria-labelledby={questionId}
      style={
        open
          ? {...BOX, top}
          : {position: 'absolute', width: 0, height: 0, overflow: 'hidden'}
      }
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          onDismiss();
        }
      }}
    >
      <span id={questionId} role='status'>
        {open ? t('confirmCheckQuestion') : ''}
      </span>
      {open && (
        <>
          <button
            type='button'
            id='witty-confirm-check'
            style={{
              ...BUTTON,
              background: '#9489db',
              color: '#ffffff',
              border: 'none',
            }}
            onClick={(event) => {
              if (!isTrustedEvent(event.nativeEvent)) return;
              onConfirm();
            }}
          >
            {t('confirmCheckYes')}
          </button>
          <button
            type='button'
            id='witty-confirm-check-dismiss'
            style={{
              ...BUTTON,
              background: '#ffffff',
              color: '#000000',
              border: '1px solid #656565',
            }}
            onClick={onDismiss}
          >
            {t('confirmCheckDismiss')}
          </button>
        </>
      )}
    </div>
  );
};

export default ConfirmCheckPrompt;
