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
      id='wittyworks-popover'
      ref={floating}
      style={PopoverStyling}
      onMouseDown={(e) => e.preventDefault()}
    >
      <div id='wittyworks-popover-content' className='lato-popover-text'>
        {/* HEADER */}
        <section className='wittyworks-container container-row justify-space-between'>
          <a
            className='margin-right cursor-pointer'
            href='https://www.witty.works/'
            target='_blank'
          >
            <WittyLogo />
          </a>
          <div className='container-row' style={{}}>
            <div
              className={
                data.index === 1
                  ? 'margin-right lato-popover-text-light-gray'
                  : 'margin-right lato-popover-text-gray cursor-pointer'
              }
              onClick={() =>
                data.index === 1 ? '' : updatePopover('previous')
              }
            >
              <PreviousIcon />
            </div>
            <div className='margin-right lato-popover-text-gray margin-right'>{`${
              data.index
            }
                ${t('alertOftotal')} ${data.totalAlerts}`}</div>
            <div
              className={
                data.index === data.totalAlerts
                  ? 'margin-right lato-popover-text-light-gray'
                  : 'margin-right lato-popover-text-gray cursor-pointer'
              }
              onClick={() =>
                data.index === data.totalAlerts ? '' : updatePopover('next')
              }
            >
              <NextIcon />
            </div>
          </div>

          <div
            className='lato-popover-text-gray cursor-pointer'
            onClick={() => {
              hidePopover();
            }}
          >
            <CloseIcon />
          </div>
        </section>

        <div className='separator' />

        {/* LEARNIGN BITES */}
        <div
          className='wittyworks-container container-rounded container-row full-padding justify-start margin-top cursor-pointer'
          onClick={() => {
            analytics.popoverLogs(data.alert, 'learning_bites');
            window.open(data.alert.data.explanation.url, '_blank');
          }}
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
          {/* controls icon size */}
          <div className='margin-right' style={{ fontSize: '2em' }}>
            {data.alert.data.explanation.icon}
          </div>
          <div className='lato-popover-text'>
            {data.alert.data.explanation.text}
            {data.alert.data.explanation.context && (
              <span className=''>
                &nbsp;({data.alert.data.explanation.context})
              </span>
            )}
            {data.alert.data.explanation.url && (
              <div
                className='wittyworks-container container-row lato-popover-text-gray cursor-pointer '
                style={{ padding: 0 }}
              >
                <div className='margin-right'>
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
              className='separator'
              style={{ marginBottom: '1em', marginTop: '1em' }}
            />
            <div className='wittyworks-popover-row'>
              <div className='wittyworks-popover-alternative-btn-container'>
                {t('insteadTry')}
              </div>
              <div>
                {data.alert.data.alternatives
                  .slice(0, 5)
                  .map((alternative, index) =>
                    alternative.remove ? (
                      <div
                        className='wittyworks-popover-alternative-btn lato-popover-text-green remove-text'
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
                          className='wittyworks-popover-alternative-btn lato-popover-text-green'
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
            </div>
          </>
        )}
      </div>

      <div className='separator' style={{ marginTop: '0.5em' }} />

      {/* FOOTER */}
      <section
        onClick={() => clickIgnoreTerm()}
        className='wittyworks-container container-row justify-start ignore-color-transformer'
      >
        <span className='margin-right cursor-pointer'>
          <IgnoreIcon />
        </span>
        <span className='lato-popover-text-gray'>{t('ignoreTerm')}</span>
      </section>
    </div>
  );
};

export default HighlightPopover;
