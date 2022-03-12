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

import './HighlightPopover.scss';
import { getColor } from '../../shared/constants';
export interface PopoverData {
  index: number;
  totalAlerts: number;
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
  updatePopover: (direction: string) => void;
  // selectedAlertIndex: number;
  // totalAlerts: number;
}

const HighlightPopover: React.FC<PopoverProps> = ({
  element,
  data,
  hide,
  resendText,
  addIgnoredTerm,
  updatePopover,
}: PopoverProps) => {
  const doc = document.documentElement || document.body;

  const analytics = useAnalytics();
  const { t, i18n } = useTranslation(namespaces.popover);
  const [isHovered, setIsHovered] = useState<boolean>(false);

  useEffect(() => {
    console.log('log popoveropen');
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
      analytics.popoverLogs(data.alert, 'popover_close');
      hide();
    }
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

  const clickAlternative = (index: number) => {
    //Log the clicked alternative
    analytics.alternativeLog(
      data.alert,
      index == -1
        ? data.alert.data.text
        : data.alert.data.alternatives[index].text
    );
    //Replace text with the new alternative or simply remove it
    //This only replaces the specific occurrence.
    //If there are other identical terms in the text they will keep highlighted

    const text: string = data.node.nodeValue as string;

    const termToBeReplaced: string = text.slice(
      data.alert.startOffset,
      data.alert.endOffset
    );

    const regex: RegExp = new RegExp(
      index === -1
        ? data.alert.startOffset === 0
          ? `${termToBeReplaced}[ ,]+`
          : `(?<=(.|\n){${data.alert.startOffset}})${termToBeReplaced}[ ,]+`
        : data.alert.startOffset === 0
        ? `${termToBeReplaced}`
        : `(?<=(.|\n){${data.alert.startOffset}})${termToBeReplaced}`
    );

    const replacingTerm: string =
      index === -1 ? '' : data.alert.data.alternatives[index].text;

    const newTextToInsert = text.replace(regex, replacingTerm);

    console.log(' data.originalNode', data.originalNode);

    data.originalNode
      ? (data.originalNode.value = newTextToInsert)
      : (data.node.nodeValue = newTextToInsert);

    hide();

    //Send again all the text to recalculate highlight positions
    resendText();
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
          <div className='wittyworks-popover-row-navigation'>
            <a href='https://www.witty.works/' target='_blank'>
              <WittyLogo className='wittyworks-popover-icon' />
            </a>
            {/* {selectedAlertIndex >= 0 && totalAlerts >= 0 && (
              <div className='wittyworks-popover-counter'>{`${selectedAlertIndex}
                ${t('alertOftotal')} ${totalAlerts}`}</div>
            )} */}
            <div className='wittyworks-popover-counter'>{`${data.index}
                ${t('alertOftotal')} ${data.totalAlerts}`}</div>
            <div className='wittyworks-popover-icon-float-right'>
              {data.index === 1 ? (
                <PreviousIcon
                  className='wittyworks-popover-navigation-icon'
                  style={{
                    filter:
                      'invert(79%) sepia(6%) saturate(62%) hue-rotate(155deg) brightness(109%) contrast(85%)',
                  }}
                />
              ) : (
                <PreviousIcon
                  className='wittyworks-popover-navigation-icon'
                  style={{
                    cursor: 'pointer',
                  }}
                  onClick={() => updatePopover('previous')}
                />
              )}
              {data.index === data.totalAlerts ? (
                <NextIcon
                  className='wittyworks-popover-navigation-icon'
                  style={{
                    filter:
                      'invert(79%) sepia(6%) saturate(62%) hue-rotate(155deg) brightness(109%) contrast(85%)',
                  }}
                />
              ) : (
                <NextIcon
                  className='wittyworks-popover-navigation-icon'
                  style={{
                    cursor: 'pointer',
                  }}
                  onClick={() => updatePopover('next')}
                />
              )}

              <CloseIcon
                className='wittyworks-popover-close-icon'
                onClick={() => {
                  analytics.popoverLogs(data.alert, 'popover_close');
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
              backgroundColor: isHovered
                ? getColor(data.alert.data.gravity).hover
                : getColor(data.alert.data.gravity).highlight,
              borderRadius: '4px',
              padding: '8px 8px 12px',
            }}
            onMouseEnter={() => {
              setIsHovered(true);
            }}
            onMouseLeave={() => {
              setIsHovered(false);
            }}
          >
            <div className='wittyworks-popover-emoji'>
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

        {data.alert.data.alternatives.filter((word) => word.text != ' ')
          .length > 0 && (
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
