import React, { useEffect, useState } from 'react';
import CSS from 'csstype';
import { useFloating, flip, offset, shift } from '@floating-ui/react-dom';

import { CustomInputElement, IAlert } from '../../shared/types';
import { useTranslation } from 'react-i18next';
import { namespaces } from '../../i18n/i18n.constants';
import { useAnalytics } from '../../shared/ApiServices/useAnalytics';

import CloseIcon from '../../assets/icons/popover/close.svg';
import WittyLogo from '../../assets/icons/popover/logo.svg';
import ArrowIcon from '../../shared/animations/Arrow';
import IgnoreIcon from '../../assets/icons/popover/ignore.svg';
import NextIcon from '../../assets/icons/popover/next.svg';
import PreviousIcon from '../../assets/icons/popover/previous.svg';

import '../../i18n/i18n';
import './HighlightPopover.scss';
import { getColor } from '../../shared/constants';
export interface PopoverData {
  index: number;
  totalAlerts: number;
  alert: IAlert;
  position: DOMRect;
  node: Node;
}

interface PopoverProps {
  element: CustomInputElement;
  data: PopoverData;
  hide: () => void;
  updateTextWithAlternative: (alternative: string) => void;
  addIgnoredTerm: (term: string) => void;
  movePopoverNextOrPrev: (direction: string) => void;
}

const HighlightPopover: React.FC<PopoverProps> = ({
  element,
  data,
  hide,
  updateTextWithAlternative,
  addIgnoredTerm,
  movePopoverNextOrPrev: updatePopover,
}: PopoverProps) => {
  const doc = document.documentElement || document.body;

  const analytics = useAnalytics();
  const { t, i18n } = useTranslation(namespaces.popover);
  const [isHovered, setIsHovered] = useState<boolean>(false);

  useEffect(() => {
    analytics.popoverLogs(data.alert, 'popover_open');
  }, [data]);

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
    document.addEventListener('input', handleClickOutside as EventListener);
    return () => {
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener(
        'input',
        handleClickOutside as EventListener
      );
    };
  }, [refs.floating.current]);

  const handleClickOutside = (event: MouseEvent) => {
    const hasClickedOutsidePopOver: boolean | null =
      refs.floating.current &&
      !refs.floating.current.contains(event.target as HTMLElement);

    const doc = document.documentElement || document.body;
    const posX = event.pageX + doc.scrollLeft;
    const posY = event.pageY - doc.scrollTop;

    const hasClickedThisHighlight: boolean =
      posX >= data.position.x &&
      posX <= data.position.x + data.position.width &&
      posY >= data.position.y &&
      posY <= data.position.y + data.position.height;

    if (hasClickedOutsidePopOver && !hasClickedThisHighlight) {
      hidePopover();
    }
  };

  const hidePopover = () => {
    analytics.popoverLogs(data.alert, 'popover_close');
    hide();
  };

  // Dynamically define the max width of the popover, so it does not grow
  // too much when toggleText is open
  // useEffect(() => {
  //   if (refs.floating.current) {
  //     const thirdOfScreenWidth: number = window.innerWidth * 0.33;
  //     const popoverWidth: number = refs.floating.current.clientWidth;

  //     refs.floating.current.style.maxWidth =
  //       popoverWidth < thirdOfScreenWidth
  //         ? `${thirdOfScreenWidth}px`
  //         : `${popoverWidth}px`;
  //   }
  // }, []);

  const PopoverStyling: CSS.Properties = {
    position: strategy,
    top: `${y}px`,
    left: `${x}px`,
  };

  const clickAlternative = (alternative: string) => {
    //Log the clicked alternative
    analytics.alternativeLog(data.alert, alternative);
    updateTextWithAlternative(alternative);
  };

  const clickIgnoreTerm = () => {
    //Log when user chooses to ignore a term
    analytics.ignoreLog(data.alert);
    addIgnoredTerm(data.alert.data.text);
    hide();
  };

  return (
    <div id='wittyworks-popover' ref={floating} style={PopoverStyling}>
      <div id='wittyworks-popover-content'>
        <div className='wittyworks-popover-row'>
          <div className='wittyworks-popover-nav'>
            <div className='wittyworks-popover-nav-www-logo'>
              <a href='https://www.witty.works/' target='_blank'>
                <WittyLogo />
              </a>
            </div>
            <div className='wittyworks-popover-nav-counter'>{`${data.index}
                ${t('alertOftotal')} ${data.totalAlerts}`}</div>
            <div className='wittyworks-popover-nav-buttons'>
              {data.index === 1 ? (
                <div className='wittyworks-popover-nav-btn disabled'>
                  <PreviousIcon />
                </div>
              ) : (
                <div
                  className='wittyworks-popover-nav-btn'
                  onClick={() => updatePopover('previous')}
                >
                  <PreviousIcon />
                </div>
              )}
              {data.index === data.totalAlerts ? (
                <div className='wittyworks-popover-nav-btn disabled'>
                  <NextIcon />
                </div>
              ) : (
                <div
                  className='wittyworks-popover-nav-btn'
                  onClick={() => updatePopover('next')}
                >
                  <NextIcon />
                </div>
              )}

              <div
                className='wittyworks-popover-nav-btn'
                onClick={() => {
                  hidePopover();
                }}
              >
                <CloseIcon />
              </div>
            </div>
          </div>
        </div>

        <hr className='wittyworks-popover-separator' />

        <div className='wittyworks-popover-row'>
          <div
            className='wittyworks-popover-row-explanation'
            style={{
              backgroundColor: isHovered
                ? getColor(data.alert.data.gravity).hover
                : getColor(data.alert.data.gravity).highlight,
            }}
            onMouseEnter={() => {
              setIsHovered(true);
            }}
            onMouseLeave={() => {
              setIsHovered(false);
            }}
          >
            <div className='wittyworks-popover-row-explanation-emoji'>
              {data.alert.data.explanation.icon}
            </div>
            <div className='wittyworks-popover-row-explanation-text'>
              {data.alert.data.explanation.text}
              {data.alert.data.explanation.url && (
                <a
                  className='wittyworks-popover-row-explanation-url'
                  onClick={() => {
                    analytics.popoverLogs(data.alert, 'learning_bites');
                  }}
                  href={data.alert.data.explanation.url}
                  target='_blank'
                >
                  {data.alert.data.gravity
                    ? t('learnMoreNegative')
                    : t('learnMorePositive')}
                  <ArrowIcon play={isHovered} />
                </a>
              )}
            </div>
          </div>
        </div>

        {data.alert.data.alternatives.length > 0 && (
          <>
            <hr className='wittyworks-popover-separator' />
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
                        onClick={() => clickAlternative('')}
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
                          onClick={() =>
                            clickAlternative(
                              data.alert.data.alternatives[index].text
                            )
                          }
                        >
                          {alternative.text === ' ' ? (
                            <i>{t('removeSpaces')}</i>
                          ) : (
                            alternative.text
                          )}
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
                  <IgnoreIcon />
                  <span>{t('ignoreTerm')}</span>
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
