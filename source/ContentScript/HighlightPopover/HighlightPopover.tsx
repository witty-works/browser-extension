import React, { useEffect, useState } from 'react';
import CSS from 'csstype';
import { useFloating, flip, offset, shift } from '@floating-ui/react-dom';
import { browser } from 'webextension-polyfill-ts';

import { CustomInputElement } from '../../shared/types';
import { IAlert } from '../../shared/types';
import { useTranslation } from 'react-i18next';
import { namespaces } from '../../i18n/i18n.constants';
import { useAnalytics } from '../../shared/ApiServices/useAnalytics';

import './HighlightPopover.scss';

export interface PopoverData {
  alert: IAlert;
  position: DOMRect;
  node: Node;
  originalNode: HTMLTextAreaElement | HTMLInputElement | null;
}

interface PopoverProps {
  element: CustomInputElement;
  data: PopoverData;
  hide: () => void;
  resendText: () => void;
  addIgnoredTerm: (term: string) => void;
}

const HighlightPopover: React.FC<PopoverProps> = ({
  element,
  data,
  hide,
  resendText,
  addIgnoredTerm,
}: PopoverProps) => {
  const doc = document.documentElement || document.body;

  const analytics = useAnalytics();
  const { t, i18n } = useTranslation(namespaces.popover);
  const [isToggleOpen, setIsToggleOpen] = useState<boolean>(false);

  useEffect(() => {
    //Dynamically sets the language depending on the text language
    i18n.changeLanguage(data.alert.data.language);
  }, [data.alert.data.language]);

  const elementCords = (dat: PopoverData) => ({
    name: 'elementCords',
    options: dat,
    fn: ({ placement, rects }: any) => {
      const calcNewX: number = dat.position.x;
      const calcNewY: number = placement.includes('bottom')
        ? dat.position.y + dat.position.height + doc.scrollTop
        : dat.position.y - rects.floating.height + doc.scrollTop;

      return {
        x: calcNewX,
        y: calcNewY,
      };
    },
  });

  const { x, y, reference, floating, strategy, refs, update } = useFloating({
    placement: 'bottom-start',
    middleware: [elementCords(data), flip(), offset(4), shift()],
  });

  useEffect(() => reference(element), [reference]);

  useEffect(() => {
    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [refs.floating.current]);

  const handleClickOutside = (event: Event) => {
    if (
      refs.floating.current &&
      !refs.floating.current.contains(event.target as HTMLElement)
    ) {
      hide();
    }
  };

  // Dynamically define the max width of the popover, so it does not grow
  // too much when toggleText is open
  useEffect(() => {
    if (refs.floating.current) {
      const thirdOfScreenWidth: number = window.innerWidth * 0.33;
      const popoverWidth: number = refs.floating.current.clientWidth;

      refs.floating.current.style.maxWidth =
        popoverWidth < thirdOfScreenWidth
          ? `${thirdOfScreenWidth}px`
          : `${popoverWidth}px`;
    }
  }, []);

  const PopoverStyling: CSS.Properties = {
    position: strategy,
    top: `${y}px`,
    left: `${x}px`,
  };

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

    //Close Popover
    hide();

    //Send again all the text to recalculate highlight positions
    resendText();
  };

  const clickIgnoreTerm = () => {
    hide();
    //Log when user chooses to ignore a term
    analytics.ignoreLog(data.alert);
    addIgnoredTerm(data.alert.data.text);
  };

  const toggleText = () => {
    setIsToggleOpen(!isToggleOpen);
  };

  // When toggle opens or closes, popover size change,
  // therefore the positioning needs to be updated
  useEffect(() => {
    update();
  }, [isToggleOpen]);

  return (
    <div id='wittyworks-popover' ref={floating} style={PopoverStyling}>
      <div id='wittyworks-popover-content'>
        <div className='wittyworks-popover-row'>
          {/* TODO: change this to understandable label when available from backend */}
          <div className='wittyworks-popover-row-title'>
            {data.alert.data.label !== ''
              ? data.alert.data.label
              : data.alert.data.category}
          </div>
        </div>

        <hr className='wittyworks-popover-separator' />

        {data.alert.data.alternatives.filter((word) => word != ' ').length >
          0 && (
          <>
            <div className='wittyworks-popover-row'>
              <div className='wittyworks-popover-row-title-alternative'>
                {t('insteadTry')}
              </div>
              <div className='wittyworks-popover-row-alternatives-container'>
                {data.alert.data.alternatives
                  .slice(0, 5)
                  .map((alternative, index) =>
                    alternative.localeCompare('-') === 0 ? (
                      <div
                        className='wittyworks-popover-alternative-btn remove-text'
                        key={`${index}-remove-it`}
                        onClick={() => clickAlternative(-1)}
                      >
                        {data.alert.data.text}
                      </div>
                    ) : (
                      <div
                        className='wittyworks-popover-alternative-btn'
                        key={`${index}-${alternative}`}
                        onClick={() => clickAlternative(index)}
                      >
                        {alternative}
                      </div>
                    )
                  )}
              </div>
              <div className='wittyworks-popover-row-ignore-container'>
                <div
                  className='wittyworks-popover-ignore-btn'
                  onClick={() => clickIgnoreTerm()}
                >
                  <img
                    className='wittyworks-popover-icon'
                    alt='Ignore Alternatives'
                    src={browser.runtime.getURL(
                      '../../../assets/icons/popover/ignore.svg'
                    )}
                  />

                  {t('ignoreTerm')}
                </div>
              </div>
            </div>
            <hr className='wittyworks-popover-separator' />
          </>
        )}

        <div className='wittyworks-popover-row'>
          <div
            className='wittyworks-popover-row-more-title'
            onClick={() => toggleText()}
          >
            <img
              className='wittyworks-popover-icon'
              alt='How To Improve'
              src={browser.runtime.getURL(
                '../../../assets/icons/popover/more.svg'
              )}
            />
            {t('howToImprove')}
          </div>
          {isToggleOpen && (
            <div className='wittyworks-popover-row-more-text'>
              {data.alert.data.solution}
              <br />
              {data.alert.data.reason}
            </div>
          )}
        </div>

        <hr className='wittyworks-popover-separator' />

        <div className='wittyworks-popover-row'>
          <div className='wittyworks-popover-home-link-container'>
            <img
              className='wittyworks-popover-icon-large'
              alt='Witty Works Logo' //TODO translation
              src={browser.runtime.getURL(
                '../../../assets/icons/w-logo-wire-color.svg'
              )}
            />
            <a
              className='wittyworks-popover-home-link'
              href='https://www.witty.works/'
            >
              witty.works
            </a>
            {/* TODO: when settings page available, add link here */}
            {/* <img
              className='wittyworks-popover-icon-large wittyworks-popover-icon-float-right'
              alt='Settings'
              src={browser.runtime.getURL('../../../assets/icons/popover/settings.svg')}
            /> */}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HighlightPopover;
