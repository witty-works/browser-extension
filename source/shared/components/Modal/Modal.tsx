import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import CSS from 'csstype';

import { IAlertContentData } from '../../types';
export interface ModalData {
  content: IAlertContentData;
  position: DOMRect;
}
interface ModalProps {
  isOpen: boolean;
  data: ModalData;
  hide: () => void;
}

const Modal: React.FC<ModalProps> = ({ isOpen, data, hide }: ModalProps) => {
  const modalWidth =
    window.innerWidth > 640 ? window.innerWidth * 0.3 : window.innerWidth * 0.5;

  const ModalStyling: CSS.Properties = {
    padding: '1rem',
    backgroundColor: 'white',
    position: 'fixed',
    zIndex: 10,
    top: `${data.position.top - 100}px`,
    left:
      data.position.left + data.position.width < window.innerWidth / 2
        ? `${data.position.left + data.position.width + 10}px`
        : `${data.position.left - modalWidth - 10}px`,
    width: `${modalWidth}px`,
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

  const onKeyDown = () => {
    // event: KeyboardEvent not needed
    if (isOpen) {
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
          <strong>Category:</strong> {data.content.category}
        </p>
        <p>
          <strong>Label:</strong> {data.content.label}
        </p>
        <p>
          <strong>Reason:</strong> {data.content.reason}
        </p>
        <p>
          <strong>Solution:</strong> {data.content.solution}
        </p>
        <p>
          <strong>Alternatives:</strong> {data.content.alternatives.join(', ')}
        </p>
      </div>
    </React.Fragment>
  );

  return isOpen ? createPortal(modal, document.body) : null;
};

export default Modal;
