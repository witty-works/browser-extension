import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import CSS from 'csstype';
import { browser } from 'webextension-polyfill-ts';

import { IAlert, ILog } from '../../types';
import { getColor } from '../../constants';
import { useLogEndpoint } from '../../ApiServices/useEndpoint';
import { useTranslation } from 'react-i18next';
import { namespaces } from '../../../i18n/i18n.constants';

import './Modal.scss';
export interface ModalData {
  alert: IAlert;
  position: DOMRect;
  node: HTMLElement;
  originalNode: HTMLTextAreaElement | null;
}
interface ModalProps {
  isOpen: boolean;
  data: ModalData;
  hide: () => void;
  resendText: () => void;
  addIgnoredTerm: (term: string) => void;
}

const Modal: React.FC<ModalProps> = ({
  isOpen,
  data,
  hide,
  resendText,
  addIgnoredTerm,
}: ModalProps) => {
  const ref = useRef<HTMLDivElement>({} as HTMLDivElement);
  const [, , , sendLog] = useLogEndpoint();
  const [isToggleOpen, setIsToggleOpen] = useState<boolean>(false);
  const { t, i18n } = useTranslation(namespaces.modal);

  useEffect(() => {
    //Dynamically sets the language depending on the text language
    i18n.changeLanguage(data.alert.data.language);
  }, [data.alert.data.language]);

  const modalWidth =
    window.innerWidth > 640 ? window.innerWidth * 0.3 : window.innerWidth * 0.5;

  const modalMaxHeight = Math.min(
    (window.innerHeight - data.position.top) * 0.9,
    window.innerHeight * 0.5
  );

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
    maxHeight: `${modalMaxHeight}px`,
  };

  const CategoryDotStyling: CSS.Properties = {
    backgroundColor: `${getColor(data.alert.data.category)}`,
  };

  useEffect(() => {
    if (isOpen && isToggleOpen) setIsToggleOpen(false); //if modal is open and description text is also expanded, collapse it
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
    sendLog({
      language: data.alert.data.language,
      type: 'alternative',
      text: data.alert.data.text,
      context: data.alert.data.context,
      start: data.alert.originalStartOffset,
      end: data.alert.originalEndOffset,
      details: {
        alternative: index === -1 ? '' : data.alert.data.alternatives[index],
      },
    } as ILog);

    //Replace text with the new alternative or simply remove it
    //This only replaces the specific occurrence. If there are other identical terms in the text
    //they will keep highlighted

    const text = data.node.nodeValue;

    const splitText: string[] = text?.split('') as string[];
    splitText.splice(
      data.alert.startOffset,
      data.alert.endOffset - data.alert.startOffset,
      index === -1 ? '' : data.alert.data.alternatives[index]
    );
    const textToInsert = splitText.join('');

    data.originalNode
      ? (data.originalNode.value = textToInsert)
      : (data.node.nodeValue = textToInsert);

    //Close Modal
    hide();

    //Send again all the text to recalculate highlight positions
    resendText();
  };

  const clickAccept = () => {
    hide();
  };

  const hoveredAlternativeButton = (event: React.MouseEvent) => {
    const currentTarget = event.currentTarget as HTMLElement;

    currentTarget.style.backgroundColor = `#9489DB`;
    currentTarget.style.color = `#ffffff`;
  };

  const resetAlternativeButton = (event: React.MouseEvent) => {
    const currentTarget = event.currentTarget as HTMLElement;

    currentTarget.style.backgroundColor = `transparent`;
    currentTarget.style.color = `#9489DB`;
  };

  const toggleText = () => {
    setIsToggleOpen(!isToggleOpen);
  };

  const hoveredIgnoreButton = (event: React.MouseEvent) => {
    const currentTarget = event.currentTarget as HTMLElement;
    currentTarget.style.backgroundColor = `#f3f3f3`;
  };

  const resetIgnoreButton = (event: React.MouseEvent) => {
    const currentTarget = event.currentTarget as HTMLElement;
    currentTarget.style.backgroundColor = `transparent`;
  };

  const clickIgnoreTerm = () => {
    hide();
    sendLog({
      language: data.alert.data.language,
      type: 'ignore',
      text: data.alert.data.text,
      context: data.alert.data.context,
      start: data.alert.originalStartOffset,
      end: data.alert.originalEndOffset,
      details: {
        ignore: data.alert.data.text,
      },
    } as ILog);
    addIgnoredTerm(data.alert.data.text);
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
            <span
              className='modal-category-dot'
              style={CategoryDotStyling}
            ></span>
            <span className='modal-main-text'>{data.alert.data.solution}</span>
          </div>
          <div className='modal-row'>
            {data.alert.data.alternatives.length === 0 ? null : (
              <>
                <div className='modal-row-title'>
                  {t('insteadTry')}
                  {isToggleOpen ? (
                    <a onClick={toggleText} className='modal-expand-link'>
                      {t('understood')}
                    </a>
                  ) : (
                    <a onClick={toggleText} className='modal-expand-link'>
                      {t('whyQuestionMark')}
                    </a>
                  )}
                </div>
                {isToggleOpen ? (
                  <div className='modal-sub-text'>{data.alert.data.reason}</div>
                ) : null}
              </>
            )}
          </div>
          <div className='list-links-container'>
            {data.alert.data.alternatives.length === 0 ? (
              <a
                className='modal-link'
                onMouseEnter={hoveredAlternativeButton}
                onMouseLeave={resetAlternativeButton}
                onClick={clickAccept}
              >
                {t('okUnderstood')}
              </a>
            ) : data.alert.data.alternatives[0].localeCompare('-') === 0 ? (
              <a
                className='modal-link remove-text'
                onMouseEnter={hoveredAlternativeButton}
                onMouseLeave={resetAlternativeButton}
                onClick={() => clickAlternative(-1)}
              >
                {data.alert.data.text}
              </a>
            ) : (
              data.alert.data.alternatives.map((alternative, index) => (
                <a
                  className='modal-link'
                  key={`${index}-${alternative}`}
                  // style={AlternativeButtonStyling}
                  onMouseEnter={hoveredAlternativeButton}
                  onMouseLeave={resetAlternativeButton}
                  onClick={() => clickAlternative(index)}
                >
                  {alternative}
                </a>
              ))
            )}
          </div>
          <hr className='modal-separator' />
          <div className='modal-row'>
            <a
              className='modal-link modal-sub-link'
              onMouseEnter={hoveredIgnoreButton}
              onMouseLeave={resetIgnoreButton}
              onClick={() => clickIgnoreTerm()}
            >
              Ø Ignore this term
            </a>
            <hr className='modal-separator' />
          </div>
          <div>
            <img
              className='modal-icon'
              alt='Witty Works Logo' //TODO translation
              height='100%'
              src={browser.runtime.getURL(
                '../../../assets/icons/w-logo-wire-color.svg'
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
