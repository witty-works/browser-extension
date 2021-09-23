import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import CSS from 'csstype';
import { browser } from 'webextension-polyfill-ts';

import { IAlert, IAlternative } from '../../types';
import { getDarkerColor } from '../../constants';
import { useLogEndpoint } from '../../ApiServices/useEndpoint';
import { DEV_ENV } from '../../constants';

import './Modal.scss';
export interface ModalData {
  alert: IAlert;
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
  const [, logResponse, logError, sendAlternative] = useLogEndpoint();

  const modalWidth =
    window.innerWidth > 640 ? window.innerWidth * 0.3 : window.innerWidth * 0.5;

  const modalLeftPos =
    modalWidth < window.innerWidth - data.position.left
      ? data.position.left -
        parseFloat(getComputedStyle(document.documentElement).fontSize)
      : data.position.left -
        (modalWidth - data.position.width) +
        parseFloat(getComputedStyle(document.documentElement).fontSize);

  //Positions the modal dinamically
  const ModalStyling: CSS.Properties = {
    top: `${data.position.top + data.position.height + 3}px`, //TODO convert this 3
    left: `${modalLeftPos}px`,
    width: `${modalWidth}px`,
  };

  const AlternativeButtonStyling: CSS.Properties = {
    color: `${getDarkerColor(data.alert.data.category)}`,
  };

  useEffect(() => {
    if (DEV_ENV) console.log('logResponse = ', logResponse);
  }, [logResponse]);

  useEffect(() => {
    if (DEV_ENV) console.log('logError = ', logError);
  }, [logError]);

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

  const clickAlternative = (index: number) => {
    //Log the clicked alternative
    sendAlternative({
      text: data.alert.data.text,
      alternative: index === -1 ? '' : data.alert.data.alternatives[index],
      start: data.alert.startOffset,
      end: data.alert.endOffset,
    } as IAlternative);

    //switch alternative on text
    switchAlternative(index);
  };

  const clickAccept = () => {
    hide();
  };

  const hoveredAlternativeButton = (event: React.MouseEvent) => {
    const currentTarget = event.currentTarget as HTMLElement;

    currentTarget.style.backgroundColor = `${getDarkerColor(
      data.alert.data.category
    )}`;
    currentTarget.style.color = '#ffffff';
  };

  const resetAlternativeButton = (event: React.MouseEvent) => {
    const currentTarget = event.currentTarget as HTMLElement;

    currentTarget.style.backgroundColor = `transparent`;
    currentTarget.style.color = `${getDarkerColor(data.alert.data.category)}`;
  };

  const modal = (
    <React.Fragment>
      <div id='backdrop' onClick={hide} />
      <div
        id='modal'
        aria-modal
        aria-labelledby='Correction'
        tabIndex={-1}
        role='dialog'
        style={ModalStyling}
        ref={ref}
      >
        <div id='modal-container'>
          <div className='modal-row'>
            <span className='modal-main-text'>{data.alert.data.solution}</span>
          </div>
          <div className='modal-row'>
            <div className='list-links-container'>
              {data.alert.data.alternatives.length === 0 ? (
                <a
                  style={AlternativeButtonStyling}
                  onMouseEnter={hoveredAlternativeButton}
                  onMouseLeave={resetAlternativeButton}
                  onClick={clickAccept}
                >
                  Ok, Verstanden!
                </a>
              ) : data.alert.data.alternatives[0].localeCompare('-') === 0 ? (
                <a
                  style={AlternativeButtonStyling}
                  onMouseEnter={hoveredAlternativeButton}
                  onMouseLeave={resetAlternativeButton}
                  onClick={() => clickAlternative(-1)}
                  className='remove-text'
                >
                  {data.alert.data.text}
                </a>
              ) : (
                data.alert.data.alternatives.map((alternative, index) => (
                  <a
                    key={`${index}-${alternative}`}
                    style={AlternativeButtonStyling}
                    onMouseEnter={hoveredAlternativeButton}
                    onMouseLeave={resetAlternativeButton}
                    onClick={() => clickAlternative(index)}
                  >
                    {alternative}
                  </a>
                ))
              )}
            </div>
          </div>
          <div className='modal-row'>
            <span className='modal-sub-text'>{data.alert.data.reason}</span>
          </div>
          <div className='modal-row'>
            <img
              src={browser.runtime.getURL(
                '../../../assets/icons/ww-wire-logo.svg'
              )}
            />
          </div>
        </div>
      </div>
    </React.Fragment>
  );

  return isOpen ? createPortal(modal, document.body) : null;
};

export default Modal;
