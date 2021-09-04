import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import CSS from 'csstype';

import { IAlertContentData } from '../../types';
import { getColor } from '../../constants';
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
  const ref = useRef<HTMLDivElement>({} as HTMLDivElement);

  const modalWidth =
    window.innerWidth > 640 ? window.innerWidth * 0.3 : window.innerWidth * 0.5;

  const ModalStyling: CSS.Properties = {
    padding: '1rem 1rem 0 1rem',
    backgroundColor: 'white',
    position: 'fixed',
    zIndex: 10,
    top: `${data.position.top + data.position.height + 3}px`,
    left: `${data.position.left}px`,
    width: `${modalWidth}px`,
    boxShadow: '0 3px 5px rgba(0, 0, 0, 0.3)',
    backgroundClip: 'padding-box',
    border: '1px solid #cccccc',
    borderRadius: '5px',
    fontSize: '.8rem',
  };

  const BackdropStyling: CSS.Properties = {
    position: 'fixed',
    width: '100%',
    height: '100%',
    top: '0',
    left: '0',
    zIndex: 9,
  };

  const RowStyling: CSS.Properties = {
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
    backgroundColor: `${getColor(data.content.category)}`,
    color: '#ffffff',
    opacity: '.83',
    padding: '.3rem',
    border: 'none',
    borderRadius: '3px',
    cursor: 'pointer',
    fontWeight: 600,
  };

  const RemoveButtonStyling: CSS.Properties = {
    marginRight: '.5rem',
    marginBottom: '.5rem',
    backgroundColor: `${getColor(data.content.category)}`,
    color: '#ffffff',
    opacity: '.83',
    padding: '.3rem',
    border: 'none',
    borderRadius: '3px',
    cursor: 'pointer',
    textDecoration: 'line-through',
    fontWeight: 600,
  };

  const TitleStyling: CSS.Properties = {
    fontWeight: 600,
    color: '#000000',
  };

  const SeparatorStyling: CSS.Properties = {
    marginBottom: '.5rem',
    borderBottom: '1px solid #cccccc',
  };

  const RowTitleStyling: CSS.Properties = {
    fontWeight: 600,
    color: '#000000',
    marginBottom: '6px',
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

  useEffect(() => {
    if (ref.current !== null && ref.current.style && ref.current.clientHeight) {
      ref.current.style.top =
        data.position.top < window.innerHeight / 2
          ? `${data.position.top + data.position.height + 3}px`
          : `${data.position.top - ref.current.clientHeight}px`;
    }
  });

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
        ref={ref}
      >
        <div style={RowStyling}>
          <span style={TitleStyling}>{data.content.label}</span>
        </div>
        {data.content.alternatives.length === 0 ? null : (
          <div style={RowStyling}>
            <div>
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
        <div style={SeparatorStyling}></div>
        <div style={RowStyling}>
          <div style={RowTitleStyling}>Begründung</div>
          <div>{data.content.reason}</div>
        </div>
        <div style={RowStyling}>
          <div style={RowTitleStyling}>Lösung</div>{' '}
          <div>{data.content.solution}</div>
        </div>
      </div>
    </React.Fragment>
  );

  return isOpen ? createPortal(modal, document.body) : null;
};

export default Modal;
