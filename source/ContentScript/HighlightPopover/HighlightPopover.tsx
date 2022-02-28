import React, { useEffect, useState } from 'react';
import CSS from 'csstype';
import { useFloating, flip, offset, shift } from '@floating-ui/react-dom';

import { CustomInputElement, IAlert } from '../../shared/types';
import { useTranslation } from 'react-i18next';
import { namespaces } from '../../i18n/i18n.constants';
import { useAnalytics } from '../../shared/ApiServices/useAnalytics';

import CloseIcon from '../../assets/icons/popover/close.svg';
import WittyLogo from '../../assets/icons/popover/logo.svg';
import ArrowIcon from '../../assets/icons/popover/arrow.svg';
import IgnoreIcon from '../../assets/icons/popover/ignore.svg';

import './HighlightPopover.scss';
import { getColor } from '../../shared/constants';

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
  const [backgroundColor, setBackgroundColor] = useState<string>(
    getColor(data.alert.data.category).highlight
  );

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

  const { x, y, reference, floating, strategy, refs } = useFloating({
    placement: 'bottom-start',
    middleware: [elementCords(data), flip(), offset(4), shift()],
  });

  useEffect(() => reference(element), [reference]);

  useEffect(() => {
    document.addEventListener('click', handleClickOutside);
    document.addEventListener('input', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('input', handleClickOutside);
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
    analytics.alternativeLog(
      data.alert,
      index == -1
        ? data.alert.data.text
        : data.alert.data.alternatives[index].text
    );
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
      index === -1 ? '' : data.alert.data.alternatives[index].text
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

  return (
    <div id='wittyworks-popover' ref={floating} style={PopoverStyling}>
      <div id='wittyworks-popover-content'>
        <div className='wittyworks-popover-row'>
          <div className='wittyworks-popover-row-navigation'>
            <a href='https://www.witty.works/'>
              <WittyLogo className='wittyworks-popover-icon' />
            </a>
            <div className='wittyworks-popover-icon-float-right'>
              <CloseIcon
                className='wittyworks-popover-icon'
                onClick={() => {
                  hide();
                }}
              />
            </div>
          </div>
        </div>

        <hr className='wittyworks-popover-separator' />

        <div className='wittyworks-popover-row'>
          <div
            className='wittyworks-popover-row-explanation'
            style={{
              backgroundColor: backgroundColor,
              borderRadius: '4px',
              padding: '8px 8px 12px',
            }}
            onMouseEnter={() => {
              setBackgroundColor(getColor(data.alert.data.category).hover);
            }}
            onMouseLeave={() => {
              setBackgroundColor(getColor(data.alert.data.category).highlight);
            }}
          >
            <div className='wittyworks-popover-icon'>
              {data.alert.data.explanation.icon}
            </div>
            <div>
              {data.alert.data.explanation.text}
              {data.alert.data.explanation.url && (
                <a
                  className='wittyworks-popover-row-explanation-title'
                  href={data.alert.data.explanation.url}
                >
                  {data.alert.data.gravity
                    ? t('learnMoreNegative')
                    : t('learnMorePositive')}
                  <ArrowIcon className='wittyworks-popover-icon' />
                </a>
              )}
            </div>
          </div>
        </div>

        <hr className='wittyworks-popover-separator' />

        {data.alert.data.alternatives.filter((word) => word.text != ' ')
          .length > 0 && (
          <>
            <div className='wittyworks-popover-row'>
              <div className='wittyworks-popover-row-title-alternative'>
                {t('insteadTry')}
              </div>
              <div className='wittyworks-popover-row-alternatives-container'>
                {data.alert.data.alternatives
                  .slice(0, 5)
                  .map((alternative, index) =>
                    alternative.remove ? (
                      <div
                        className='wittyworks-popover-alternative-btn remove-text'
                        key={`${index}-remove-it`}
                        onClick={() => clickAlternative(-1)}
                      >
                        {data.alert.data.text}
                      </div>
                    ) : (
                      <div
                        className='wittyworks-popover-alternative-btn-container'
                        key={`${index}-${alternative}-container`}
                      >
                        <div
                          className='wittyworks-popover-alternative-btn'
                          onClick={() => clickAlternative(index)}
                        >
                          {alternative.text}
                        </div>
                        {alternative.context && (
                          <div className='wittyworks-popover-alternative-context'>
                            {alternative.context}
                          </div>
                        )}
                      </div>
                    )
                  )}
              </div>
              <div className='wittyworks-popover-row-ignore-container'>
                <div
                  className='wittyworks-popover-ignore-btn'
                  onClick={() => clickIgnoreTerm()}
                >
                  <IgnoreIcon className='wittyworks-popover-icon' />
                  {t('ignoreTerm')}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default HighlightPopover;
