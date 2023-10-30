import React, { useEffect, useState } from 'react';
import { useFloating, flip, offset, shift } from '@floating-ui/react-dom';

import { CustomInputElement, IAlert } from '../../shared/types';
import { useTranslation } from 'react-i18next';
import '../../i18n/i18n';
import { namespaces } from '../../i18n/i18n.constants';
import { useAnalytics } from '../../shared/ApiServices/useAnalytics';

import CloseIcon from '../../assets/icons/popover/close.svg';
import WittyLogo from '../../assets/icons/popover/logo.svg';
import IgnoreIcon from '../../assets/icons/popover/ignore.svg';
import NextIcon from '../../assets/icons/popover/next.svg';
import PreviousIcon from '../../assets/icons/popover/previous.svg';
import VideoIcon from '../../assets/icons/popover/video.svg';
import ArrowUpIcon from '../../assets/icons/popover/arrow-up.svg';
import ArrowDownIcon from '../../assets/icons/popover/arrow-down.svg';
import LoadingIcon from '../../shared/StateIndicatorIcons/LoadingIcon';

import './HighlightPopover.scss';
import { StorageKeys, getColor } from '../../shared/constants';
import { getActiveDocument } from '../ContentScriptApp';
import { iframePositionRecquired } from '../../shared/DOMutils';
import { useStateRef } from '../../shared/customHooks/useStateRef';
import { getScrollableParentClosestToElement, storeInLocalStorage } from '../../shared/utils';
import { browser } from 'webextension-polyfill-ts';
import ReactDOM from 'react-dom';
import Notification from '../../Notifications/Notification';

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
  updateTextWithAlternative: (alternative: string, category: string) => void;
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
  const [alternativeHovered, setAlternativeHovered] = useState<string | null>(
    null
  );
  const [showLearningBite, setShowLearningBite, showLearningBiteRef] =
    useStateRef<boolean>(false);
  const [iframeLoaded, setIframeLoaded] = useState<boolean>(false);

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
      let iframeRects = { top: 0, left: 0, bottom: 0, right: 0 };
      if (iframePositionRecquired(element)) {
        const iframes = document.getElementsByTagName('iframe');
        const iframe = Array.from(iframes).find((iframe) => {
          try {
            const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
            return iframeDoc?.contains(dat.node);
          } catch (error) {
            console.error('Failed to access iframe content: ', error);
            return false;
          }
        });
        try {
          if (iframe?.getBoundingClientRect()) {
            iframeRects = iframe?.getBoundingClientRect();
          }
        } catch (error) {
          console.error('Failed to get iframe bounding rect: ', error);
        }
      }
  
      const calcNewX: number =
        dat.position.x + iframeRects.left + doc.scrollLeft;
      const calcNewY: number = placement.includes('bottom')
        ? dat.position.y +
          dat.position.height +
          iframeRects.top +
          doc.scrollTop
          //scrollTop
        : dat.position.y -
          rects.floating.height +
          iframeRects.top +
          doc.scrollTop
          //scrollTop;
      return {
        x: showLearningBiteRef.current ? calcNewX / 2 : calcNewX,
        y: calcNewY,
      };
    },
  });

  const { x, y, reference, floating, strategy, refs } = useFloating({
    placement: 'bottom-start',
    middleware: [elementCords(data), flip(), offset(4), shift()],
  });

  useEffect(() => {
    reference(element);
    showLearningBiteRef.current = showLearningBite;
  }, [reference, showLearningBite]);

  useEffect(() => {
    getScrollableParentClosestToElement(element)?.addEventListener('scroll', handleElementScroll);
    element.addEventListener('scroll', handleElementScroll);
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
      getScrollableParentClosestToElement(element)?.removeEventListener('scroll', handleElementScroll); 
      element.removeEventListener('scroll', handleElementScroll);
      getActiveDocument().removeEventListener('click', handleClickOutside);
      getActiveDocument().removeEventListener(
        'input',
        handleClickOutside as EventListener
      );
    };
  }, [refs.floating.current]);

  const handleElementScroll = () => {
    hidePopover();
  };

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

  const hidePopover = (logClose: boolean = false) => {
    logClose && analytics.popoverLogs(data.alert, 'popover_close');
    setShowLearningBite(false);
    setIframeLoaded(false);

    hide();
    //in case input is removed from the dom before popover is closed (clicking outside the element), also remove it here
    const popoverContainer = window.document.getElementsByTagName('ww-popover')[0];
    ReactDOM.unmountComponentAtNode(popoverContainer as HTMLElement);
  };
  
  const incrementAlternativesAccepted = (storage: any) => 
    storeInLocalStorage(StorageKeys.NUMBER_OF_ALTERNATIVES_ACCEPTED, storage[StorageKeys.NUMBER_OF_ALTERNATIVES_ACCEPTED] ? storage[StorageKeys.NUMBER_OF_ALTERNATIVES_ACCEPTED] + 1 : 1);
  
  const renderNotification = (type: string) => {
    if(!window.top) return;
    const notificationWrapper = document.createElement('div');
    notificationWrapper.id = 'ww-notification';
    
    ReactDOM.render(
      <Notification notificationType={type} element={element} />,
      window.top.document.body.insertBefore(notificationWrapper, window.top.document.body.firstChild)
    );
  };

  const clickAlternative = (e: MouseEvent, alternative: string, category: string) => {
    //Log the clicked alternative
    e.preventDefault();
    e.stopImmediatePropagation();
    analytics.alternativeLog(data.alert, alternative);

    browser.storage.local.get(null).then((result) => {
      const {
        [StorageKeys.NUMBER_OF_ALTERNATIVES_ACCEPTED]: alternativesAccepted,
        [StorageKeys.SALES_DEMO_FEATURE_FLAG]: salesDemoFlag,
        [StorageKeys.INVITE_TEAM_FEATURE_FLAG]: teamInviteFlag,
        [StorageKeys.INVITE_FRIENDS_FEATURE_FLAG]: friendInviteFlag,
      } = result;
    
      if (!salesDemoFlag.active || !teamInviteFlag.active || !friendInviteFlag.active) { //reset counter if a feature flag is diabled, maybe need to rethink this?
        storeInLocalStorage(StorageKeys.NUMBER_OF_ALTERNATIVES_ACCEPTED, 0); 
      } else {
        const incrementedAlternativesAccepted = alternativesAccepted + 1;
        if (
          (incrementedAlternativesAccepted === salesDemoFlag.triggerNumber && salesDemoFlag.active) ||
          (incrementedAlternativesAccepted === teamInviteFlag.triggerNumber && teamInviteFlag.active) ||
          (incrementedAlternativesAccepted === friendInviteFlag.triggerNumber && friendInviteFlag.active)
        ) {
          const notificationType = incrementedAlternativesAccepted === salesDemoFlag.triggerNumber ? 'salesDemo'
            : incrementedAlternativesAccepted === teamInviteFlag.triggerNumber ? 'inviteTeam'
            : 'inviteFriends';
    
          renderNotification(notificationType);
        }
      }
      incrementAlternativesAccepted(result);
    });
    

    updateTextWithAlternative(alternative, category);
  };

  const clickIgnoreTerm = () => {
    //Log when user chooses to ignore a term
    analytics.ignoreLog(data.alert);
    addIgnoredTerm(data.alert.data?.text);
    hide();
  };

  return (
    <div
      id='witty-works-ext-popover'
      ref={floating}
      style={{
        position: strategy,
        top: `${y}px`,
        left: `${x}px`,
        maxWidth: `${showLearningBite ? 850 : 350}px`,
      }}
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
            <WittyLogo alt={t('wittyLogo')} />
          </a>
          <div className='witty-works-ext-container-row'>
            <div
              className={
                'witty-works-ext-margin-right witty-works-ext-lato-popover-text-gray witty-works-ext-cursor-pointer witty-works-ext-margin-auto'
              }
              style={data.index === 1 ? { display: 'none' } : {}}
              onClick={() => {
                data.index !== 1 && updatePopover('previous');
                setShowLearningBite(false);
                setIframeLoaded(false);
              }}
            >
              <PreviousIcon alt={t('previous')} />
            </div>
            <div className='witty-works-ext-margin-right witty-works-ext-lato-popover-text-gray witty-works-ext-margin-right'>{`${
              data.index
            }
                ${t('alertOftotal')} ${data.totalAlerts}`}</div>
            <div
              className={
                'witty-works-ext-margin-right witty-works-ext-lato-popover-text-gray witty-works-ext-cursor-pointer witty-works-ext-margin-auto'
              }
              style={data.index === data.totalAlerts ? { display: 'none' } : {}}
              onClick={() => {
                data.index !== data.totalAlerts && updatePopover('next');
                setShowLearningBite(false);
                setIframeLoaded(false);
              }}
            >
              <NextIcon alt={t('next')} />
            </div>
          </div>

          <div
            className='witty-works-ext-lato-popover-text-gray witty-works-ext-cursor-pointer'
            onClick={() => {
              hidePopover(true);
            }}
          >
            <CloseIcon alt={t('close')} />
          </div>
        </div>


        {/* LEARNIGN BITES */}
        {data.alert.data.explanation?.text &&
          <>
          <div className='witty-works-ext-separator' />

          <div 
            className='witty-works-ext-wittyworks-container witty-works-ext-container-rounded witty-works-ext-container-column witty-works-ext-full-padding witty-works-ext-justify-start witty-works-ext-margin-top'
            onClick={() => {
              analytics.popoverLogs(data.alert, 'learning_bites');
              setShowLearningBite(!showLearningBite);
            }}
            style={{
              cursor:
                data.alert.data.explanation?.url
                  ? 'pointer'
                  : 'default',
              backgroundColor: getColor(data.alert.data.gravity, userIsSignedIn).highlight,
            }}
          >
            <div
              className='witty-works-ext-lato-popover-text witty-works-ext-justify-space-between'
              style={{
                display: 'flex',
                flexDirection: showLearningBite ? 'row' : 'column',
                alignItems: showLearningBite ? 'center' : 'flex-start',
              }}
            >
              <div className='witty-works-ext-container-row witty-works-ext-justify-start'>
                <div style={{ fontSize: '2em', marginRight: '0.5em' }}>{data.alert.data.explanation?.icon}</div>
                {data.alert.data.explanation?.text}
                {data.alert.data.explanation?.context &&
                  ' (' + data.alert.data.explanation?.context + ')'}
              </div>
              {data.alert.data.explanation?.url && (
                <div className='witty-works-ext-container-row witty-works-ext-justify-end witty-works-ext-lato-popover-text-gray witty-works-ext-cursor-pointer'
                style={{marginTop: showLearningBite ? '0em' : '1em'}}
                >
                  <div className='witty-works-ext-secondary-button-red witty-works-ext-container-row'>
                      {t('learnMore')}
                      {data.alert.data.explanation?.content === 'video' && (
                        <VideoIcon className='witty-works-ext-margin-left' style={{ marginTop: '0.2em'}} alt={t('video')} />
                      )}
                    <div
                      className='witty-works-ext-margin-left'
                      style={{ pointerEvents: 'none' }}
                    >
                      {showLearningBite ? <ArrowUpIcon /> : <ArrowDownIcon />}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>}
        <div
          style={{
            display: showLearningBite ? 'flex' : 'none',
          }}
        >
          <div
            className='witty-works-ext-learning-bite-iframe'
            style={{
              display: iframeLoaded ? 'none' : 'flex',
            }}
          >
            <LoadingIcon />
          </div>
          <iframe
            src={data.alert.data.explanation?.url}
            style={{
              display: iframeLoaded ? 'flex' : 'none',
            }}
            className='witty-works-ext-learning-bite-iframe'
            title='learning bite'
            onLoad={() => {
              setIframeLoaded(true);
            }}
          ></iframe>
        </div>

        {/* TRY INSTEAD */}
        {data.alert.data.alternatives.length > 0 && !showLearningBite && (
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
                {data.alert.data.alternatives.map((alternative, index) =>
                  alternative.remove ? (
                    <div
                      className='witty-works-ext-wittyworks-popover-alternative-btn-container'
                      key={`${index}-${alternative}-container`}
                    >
                      <div
                        className='witty-works-ext-wittyworks-popover-alternative-btn witty-works-ext-lato-popover-text-green witty-works-ext-remove-text witty-works-ext-margin-right'
                        key={`${index}-remove-it`}
                        //string can not be empty because of replacement issue on firefox
                        onPointerDown={(e) =>
                          clickAlternative(e.nativeEvent,' ', data.alert.data.category)
                        }
                      >
                        {data.alert.data?.text}
                      </div>
                      {alternative.context && (
                        <div className='witty-works-ext-wittyworks-popover-alternative-context'>
                          {alternative.context}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div
                      className='witty-works-ext-wittyworks-popover-alternative-btn-container'
                      key={`${index}-${alternative}-container`}
                      onMouseEnter={() => {
                        setAlternativeHovered(alternative?.text);
                      }}
                      onMouseLeave={() => {
                        setAlternativeHovered(null);
                      }}
                    >
                      <div
                        className='witty-works-ext-wittyworks-popover-alternative-btn witty-works-ext-lato-popover-text-green witty-works-ext-margin-right'
                        onPointerDown={(e) =>
                          clickAlternative(
                            e.nativeEvent,
                            data.alert.data.alternatives[index]?.text,
                            data.alert.data.category
                          )
                        }
                      >
                        {alternative && alternative.text === ' ' 
                          ? (<i>{t('removeSpaces')}</i>) 
                          : alternative.text.length > 25 && alternative.context && alternativeHovered !== alternative.text 
                          ? (alternative.text.substring(0, 25) + '...') 
                          : alternative.text.length > 35 && alternativeHovered !== alternative.text 
                          ? (alternative.text.substring(0, 35) + '...') 
                          : alternative.text
                        }
                      </div>
                      {alternative && alternative.context && (
                        <div className='witty-works-ext-wittyworks-popover-alternative-context'>
                          {alternative.context.length > 25 &&
                          alternativeHovered !== alternative.text
                            ? alternative.context.substring(0, 25) + '...'
                            : alternative.context}
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
      {!showLearningBite && (
        <>
          <div
            onClick={() => clickIgnoreTerm()}
            className='witty-works-ext-ignore-section witty-works-ext-wittyworks-container witty-works-ext-container-row witty-works-ext-justify-start witty-works-ext-ignore-color-transformer witty-works-ext-margin-top'
          >
            <span className='witty-works-ext-margin-right witty-works-ext-cursor-pointer'>
              <IgnoreIcon alt={t('ignore')} />
            </span>
            <span className='witty-works-ext-lato-popover-text-gray'>
              {t('ignoreTerm')}
            </span>
          </div>
        </>
      )}
    </div>
  );
};

export default HighlightPopover;
