import React, { useEffect, useState } from 'react';
import CSS from 'csstype';
import { useFloating, flip, offset, shift } from '@floating-ui/react-dom';

import { CustomInputElement, IAlert } from '../../shared/types';
import { useTranslation } from 'react-i18next';
import '../../i18n/i18n';
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
import { getActiveDocument } from '../ContentScriptApp';
import { appID, getBaseUrls } from '../../shared/ApiServices/requests';
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
  userIsSignedIn: boolean;
}

const HighlightPopover: React.FC<PopoverProps> = ({
  element,
  data,
  hide,
  updateTextWithAlternative,
  addIgnoredTerm,
  movePopoverNextOrPrev: updatePopover,
  userIsSignedIn,
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
    getActiveDocument().addEventListener('click', handleClickOutside);
    getActiveDocument().addEventListener(
      'input',
      handleClickOutside as EventListener
    );
    return () => {
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener(
        'input',
        handleClickOutside as EventListener
      );
      getActiveDocument().removeEventListener('click', handleClickOutside);
      getActiveDocument().removeEventListener(
        'input',
        handleClickOutside as EventListener
      );
    };
  }, [refs.floating.current]);

  const handleClickOutside = (event: MouseEvent) => {
    const hasClickedOutsidePopOver: boolean | null =
      refs.floating.current &&
      !refs.floating.current.contains(event.target as HTMLElement);

    const doc = getActiveDocument().documentElement || getActiveDocument().body;
    const posX = event.pageX + doc.scrollLeft;
    const posY = event.pageY - doc.scrollTop;

    const hasClickedThisHighlight: boolean =
      posX >= data.position.x &&
      posX <= data.position.x + data.position.width &&
      posY >= data.position.y &&
      posY <= data.position.y + data.position.height;

    if (hasClickedOutsidePopOver && !hasClickedThisHighlight) hidePopover();
  };

  const hidePopover = () => {
    analytics.popoverLogs(data.alert, 'popover_close');
    hide();
  };

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
    <div
      id='witty-works-ext-popover'
      ref={floating}
      style={PopoverStyling}
      onMouseDown={(e) => e.preventDefault()}
    >
      <div
        id='witty-works-ext-popover-content'
        className='witty-works-ext-lato-popover-text'
      >
        {/* HEADER */}
        <div className='witty-works-ext-section witty-works-ext-wittyworks-container witty-works-ext-container-row witty-works-ext-justify-space-between'>
          <a
            className='witty-works-ext-margin-right witty-works-ext-cursor-pointer'
            href='https://www.witty.works/'
            target='_blank'
          >
            <WittyLogo />
          </a>
          <div className='witty-works-ext-container-row' style={{}}>
            <div
              className={
                data.index === 1
                  ? 'witty-works-ext-margin-right witty-works-ext-lato-popover-text-light-gray witty-works-ext-margin-auto'
                  : 'witty-works-ext-margin-right witty-works-ext-lato-popover-text-gray witty-works-ext-cursor-pointer witty-works-ext-margin-auto'
              }
              onClick={() =>
                data.index === 1 ? '' : updatePopover('previous')
              }
            >
              <PreviousIcon />
            </div>
            <div className='witty-works-ext-margin-right witty-works-ext-lato-popover-text-gray witty-works-ext-margin-right'>{`${
              data.index
            }
                ${t('alertOftotal')} ${data.totalAlerts}`}</div>
            <div
              className={
                data.index === data.totalAlerts
                  ? 'witty-works-ext-margin-right witty-works-ext-lato-popover-text-light-gray witty-works-ext-margin-auto'
                  : 'witty-works-ext-margin-right witty-works-ext-lato-popover-text-gray witty-works-ext-cursor-pointer witty-works-ext-margin-auto'
              }
              onClick={() =>
                data.index === data.totalAlerts ? '' : updatePopover('next')
              }
            >
              <NextIcon />
            </div>
          </div>

          <div
            className='witty-works-ext-lato-popover-text-gray witty-works-ext-cursor-pointer'
            onClick={() => {
              hidePopover();
            }}
          >
            <CloseIcon />
          </div>
        </div>

        <div className='witty-works-ext-separator' />

        {/* LEARNIGN BITES */}
        <div
          className='witty-works-ext-wittyworks-container witty-works-ext-container-rounded witty-works-ext-container-row witty-works-ext-full-padding witty-works-ext-justify-start witty-works-ext-margin-top witty-works-ext-cursor-pointer'
          onClick={() => {
            analytics.popoverLogs(data.alert, 'learning_bites');
            window.open(data.alert.data.explanation.url, '_blank');
          }}
          style={{
            backgroundColor: isHovered
              ? getColor(data.alert.data.gravity, userIsSignedIn).hover
              : getColor(data.alert.data.gravity, userIsSignedIn).highlight,
          }}
          onMouseEnter={() => {
            setIsHovered(true);
          }}
          onMouseLeave={() => {
            setIsHovered(false);
          }}
        >
          {/* controls icon size */}
          <div
            className='witty-works-ext-margin-right'
            style={{ fontSize: '1.5em' }}
          >
            {data.alert.data.explanation.icon}
          </div>
          <div className='witty-works-ext-lato-popover-text'>
            {data.alert.data.explanation.text}
            {data.alert.data.explanation.context && (
              <span className=''>
                &nbsp;({data.alert.data.explanation.context})
              </span>
            )}
            {data.alert.data.explanation.url && (
              <div
                className='witty-works-ext-wittyworks-container witty-works-ext-container-row witty-works-ext-lato-popover-text-gray witty-works-ext-cursor-pointer '
                style={{ padding: '0.5em 0 0 0' }}
              >
                <div className='witty-works-ext-margin-right'>
                  {data.alert.data.gravity
                    ? t('learnMoreNegative')
                    : t('learnMorePositive')}
                </div>
                <ArrowIcon play={isHovered} />
              </div>
            )}
          </div>
        </div>

        {/* TRY INSTEAD */}
        {data.alert.data.alternatives.length > 0 && (
          <>
            <div
              className='witty-works-ext-separator'
              style={{ marginBottom: '1em', marginTop: '1em' }}
            />
            <div className='witty-works-ext-wittyworks-popover-row'>
              <div className='witty-works-ext-wittyworks-popover-alternative-btn-container'>
                {t('insteadTry')}
              </div>
              <div>
                {data.alert.data.alternatives
                  .slice(0, 5)
                  .map((alternative, index) =>
                    alternative.remove ? (
                      <div
                        className='witty-works-ext-wittyworks-popover-alternative-btn-container witty-works-ext-wittyworks-popover-alternative-btn witty-works-ext-lato-popover-text-green witty-works-ext-remove-text'
                        key={`${index}-remove-it`}
                        //string can not be empty because of replacement issue on firefox
                        onClick={() => clickAlternative(' ')}
                      >
                        {data.alert.data.text}
                      </div>
                    ) : (
                      <div
                        className='witty-works-ext-wittyworks-popover-alternative-btn-container'
                        key={`${index}-${alternative}-container`}
                      >
                        <div
                          className='witty-works-ext-wittyworks-popover-alternative-btn witty-works-ext-lato-popover-text-green'
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
                          <div className='witty-works-ext-wittyworks-popover-alternative-context'>
                            {alternative.context}
                          </div>
                        )}
                      </div>
                    )
                  )}
              </div>
            </div>
          </>
        )}
      </div>
      <div
        onClick={() => clickIgnoreTerm()}
        className='witty-works-ext-ignore-section witty-works-ext-wittyworks-container witty-works-ext-container-row witty-works-ext-justify-start witty-works-ext-ignore-color-transformer'
      >
        <span className='witty-works-ext-margin-right witty-works-ext-cursor-pointer'>
          <IgnoreIcon />
        </span>
        <span className='witty-works-ext-lato-popover-text-gray'>
          {t('ignoreTerm')}
        </span>
      </div>
      {data.alert.plan == 'witty_free' && (
        <div className='witty-works-ext-left' style={{ marginBottom: '1em' }}>
          <div
            className='witty-works-ext-button witty-works-ext-primary-button-red'
            onClick={() => {
              analytics.dashboardLog('popover', appID);
              window.open(
                getBaseUrls().dashboard + 'user/language/language-settings',
                '_blank'
              );
            }}
          >
            {t('customizeSuggestions')}
          </div>
        </div>
      )}
    </div>
  );
};

export default HighlightPopover;
