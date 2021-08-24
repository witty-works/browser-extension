import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import CSS from 'csstype';

import { IHighlightData } from '../../types';

interface ModalProps {
  isOpen: boolean;
  highlightRect: DOMRect;
  data: IHighlightData;
  hide: () => void;
}

const Modal: React.FC<ModalProps> = ({
  isOpen,
  highlightRect,
  data,
  hide,
}: ModalProps) => {
  console.log('isOpen = ', isOpen);

  const ModalStyling: CSS.Properties = {
    padding: '1rem',
    backgroundColor: 'white',
    position: 'fixed',
    zIndex: 10,
    top: `${highlightRect.top - highlightRect.top / 2}px`,
    left:
      highlightRect.left + highlightRect.width < window.innerWidth / 2
        ? `${highlightRect.left + highlightRect.width + 10}px`
        : `${highlightRect.left - 10}px`,
    width: window.innerWidth > 640 ? '30%' : '50%',
    boxShadow: '0 3px 7px rgba(0, 0, 0, 0.3)',
    backgroundClip: 'padding-box',
  };

  const BackdropStyling: CSS.Properties = {
    position: 'fixed',
    width: '100%',
    height: '100%',
    top: '0',
    left: '0',
    zIndex: 9,
  };

  useEffect(() => {
    document.addEventListener('keydown', onKeyDown, false);
    return () => {
      document.removeEventListener('keydown', onKeyDown, false);
    };
  }, [isOpen]);

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.keyCode === 27 && isOpen) {
      hide();
    }
  };

  const modal = (
    <React.Fragment>
      <div id='backdrop' style={BackdropStyling} onClick={hide} />
      <div
        id='modal'
        aria-modal
        aria-labelledby='Correction'
        tabIndex={-1}
        role='dialog'
        style={ModalStyling}
      >
        <p>
          <strong>Category:</strong> {data.category}
        </p>
        <p>
          <strong>Reason:</strong> {data.reason}
        </p>
        <p>
          <strong>Solution:</strong> {data.solution}
        </p>
      </div>
    </React.Fragment>
  );

  return isOpen ? createPortal(modal, document.body) : null;
};

export default Modal;
