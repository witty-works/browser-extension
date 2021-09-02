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
  switchAlternative: (index: number) => void;
}

const Modal: React.FC<ModalProps> = ({
  isOpen,
  data,
  hide,
  switchAlternative,
}: ModalProps) => {
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

  const ParagraphStyling: CSS.Properties = {
    marginBottom: '1rem',
  };

  const AlternativesContainerStyling: CSS.Properties = {
    display: 'flex',
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
  };

  const AlternativeButtonStyling: CSS.Properties = {
    marginRight: '.5rem',
    marginBottom: '.5rem',
    backgroundColor: 'rgb(88, 0, 208)',
    color: '#ffffff',
    opacity: '.83',
    padding: '.3rem',
    border: 'none',
    borderRadius: '3px',
    cursor: 'pointer',
  };

  const RemoveButtonStyling: CSS.Properties = {
    marginRight: '.5rem',
    marginBottom: '.5rem',
    backgroundColor: 'rgb(88, 0, 208)',
    color: '#ffffff',
    opacity: '.83',
    padding: '.3rem',
    border: 'none',
    borderRadius: '3px',
    cursor: 'pointer',
    textDecoration: 'line-through',
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
        <p style={ParagraphStyling}>
          <strong>Category:</strong> {data.content.category}
        </p>
        <p style={ParagraphStyling}>
          <strong>Label:</strong> {data.content.label}
        </p>
        <p style={ParagraphStyling}>
          <strong>Reason:</strong> {data.content.reason}
        </p>
        <p style={ParagraphStyling}>
          <strong>Solution:</strong> {data.content.solution}
        </p>
        {data.content.alternatives.length === 0 ? null : (
          <div style={ParagraphStyling}>
            <div>
              <strong>Alternatives:</strong>
              <div style={AlternativesContainerStyling}>
                {data.content.alternatives[0].localeCompare('-') === 0 ? (
                  <button
                    style={RemoveButtonStyling}
                    onClick={() => switchAlternative(-1)}
                  >
                    {data.content.text}
                  </button>
                ) : (
                  data.content.alternatives.map((alternative, index) => (
                    <button
                      key={`${index}-${alternative}`}
                      style={AlternativeButtonStyling}
                      onClick={() => switchAlternative(index)}
                    >
                      {alternative}
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </React.Fragment>
  );

  return isOpen ? createPortal(modal, document.body) : null;
};

export default Modal;
