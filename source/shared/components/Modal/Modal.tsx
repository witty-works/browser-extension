import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import CSS from 'csstype';
import { browser } from 'webextension-polyfill-ts';

import { IAlert } from '../../types';
import { useTranslation } from 'react-i18next';
import { namespaces } from '../../../i18n/i18n.constants';

import './Modal.scss';
import { useAnalytics } from '../../ApiServices/useAnalytics';
export interface ModalData {
  alert: IAlert;
  position: DOMRect;
  node: HTMLElement;
  originalNode: HTMLTextAreaElement | HTMLInputElement | null;
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
  const analytics = useAnalytics();
  const [isToggleOpen, setIsToggleOpen] = useState<boolean>(false);
  const { t, i18n } = useTranslation(namespaces.modal);

  useEffect(() => {
    //Dynamically sets the language depending on the text language
    i18n.changeLanguage(data.alert.data.language);
  }, [data.alert.data.language]);

  const modalWidth =
    window.innerWidth > 720 ? window.innerWidth * 0.3 : window.innerWidth * 0.5;

  const modalLeftPos =
    modalWidth < window.innerWidth - data.position.left
      ? data.position.left -
      parseFloat(getComputedStyle(document.documentElement).fontSize)
      : data.position.left -
      (modalWidth - data.position.width) +
      parseFloat(getComputedStyle(document.documentElement).fontSize);

  //Positions the modal dinamically
  const ModalStyling: CSS.Properties = {
    top: `${data.position.top + data.position.height + 10}px`, //TODO convert this
    left: `${modalLeftPos}px`,
    width: `${modalWidth}px`,
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
    analytics.alternativeLog(data.alert, data.alert.data.alternatives[index]);

    //Replace text with the new alternative or simply remove it
    //This only replaces the specific occurrence. If there are other identical terms in the text
    //they will keep highlighted

    const splitText = (data.node.nodeValue as string).split('') as string[];

    // In case we have to remove the term it's necessary also to delete the surrounding spaces
    splitText.splice(
      index === -1 ? data.alert.startOffset - 1 : data.alert.startOffset,
      index === -1
        ? data.alert.endOffset - data.alert.startOffset + 1
        : data.alert.endOffset - data.alert.startOffset,
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

  const toggleText = () => {
    setIsToggleOpen(!isToggleOpen);
  };

  const clickIgnoreTerm = () => {
    hide();
    //Log when user chooses to ignore a term
    analytics.ignoreLog(data.alert);
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
            {/* TODO: change this to understandable label when available from backend */}
            <div className='modal-row-title'>
              {data.alert.data.label !== '' ? data.alert.data.label : data.alert.data.category}
            </div>
          </div>

          <hr className='modal-separator' />

          {data.alert.data.alternatives.filter(word => word != ' ').length > 0 && (<div className='modal-row'>
            <div className='modal-row-title-alternative'>
              {t('insteadTry')}
            </div>
            <div className='modal-row-alternatives-container'>
              {data.alert.data.alternatives.slice(0, 5).map((alternative, index) =>
                alternative.localeCompare('-') === 0 ? (
                  <div className='modal-link remove-text' key={`${index}-remove-it`} onClick={() => clickAlternative(-1)}>
                    {data.alert.data.text}
                  </div>
                ) : (
                  <div className='modal-link' key={`${index}-${alternative}`} onClick={() => clickAlternative(index)}>
                    {alternative}
                  </div>
                )
              )}
            </div>
            <div className='modal-row-ignore' onClick={() => clickIgnoreTerm()}>
              <img
                className='modal-icon'
                alt='Ignore Alternatives'
                src={browser.runtime.getURL('../../../assets/icons/modal/ignore.svg')}
              />
              {t('ignoreTerm')}
            </div>
          </div>)}

          <hr className='modal-separator' />

          <div className='modal-row'>
            <div className='modal-row-more-title' onClick={() => toggleText()}>
              <img
                className='modal-icon'
                alt='How To Improve'
                src={browser.runtime.getURL('../../../assets/icons/modal/more.svg')}
              />
              {t('howToImprove')}
            </div>
            {isToggleOpen && <div className='modal-row-more-text'>{data.alert.data.solution + ' ' + data.alert.data.reason}</div>}
          </div>

          <hr className='modal-separator' />

          <div className='modal-row'>
            <img
              className='modal-icon-large'
              alt='Witty Works Logo' //TODO translation
              src={browser.runtime.getURL('../../../assets/icons/w-logo-wire-color.svg')}
            />
            <a className='modal-row-url' href='https://www.witty.works/'>Witty.Works</a>
            {/* TODO: when settings page available, add link here */}
            {/* <img
              className='modal-icon-large modal-icon-float-right'
              alt='Settings'
              src={browser.runtime.getURL('../../../assets/icons/modal/settings.svg')}
            /> */}
          </div>
        </div>
      </div>
    </React.Fragment>
  );

  return isOpen ? createPortal(modal, document.body) : null;
};

export default Modal;
