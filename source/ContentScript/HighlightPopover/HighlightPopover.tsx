import React, { useEffect, useState } from 'react';
import { useFloating, flip, offset, shift } from '@floating-ui/react-dom';

import { CustomInputElement, IAlert, IAlternatives, ResponseConfig } from '../../shared/types';
import { useTranslation } from 'react-i18next';
import '../../i18n/i18n';
import { namespaces } from '../../i18n/i18n.constants';
import { useAnalytics } from '../../shared/ApiServices/useAnalytics';

import CloseIcon from '../../assets/icons/popover/close.svg';
import WittyLogo from '../../assets/icons/popover/logo.svg';
import NextIcon from '../../assets/icons/popover/next.svg';
import PreviousIcon from '../../assets/icons/popover/previous.svg';
import VideoIcon from '../../assets/icons/popover/video.svg';
import ArrowUpIcon from '../../assets/icons/popover/arrow-up.svg';
import ArrowDownIcon from '../../assets/icons/popover/arrow-down.svg';
import LoadingIcon from '../../shared/StateIndicatorIcons/LoadingIcon';
import CheckIcon from '../../assets/icons/popover/success.svg';
import ErrorIcon from '../../assets/icons/popover/failure.svg';
import LockIcon from '../../assets/icons/popover/lock.svg';

import './HighlightPopover.scss';
import { DEV_ENV, StorageKeys, getColor } from '../../shared/constants';
import { getActiveDocument } from '../ContentScriptApp';
import { iframePositionRecquired } from '../../shared/DOMutils';
import { useStateRef } from '../../shared/customHooks/useStateRef';
import { getScrollableParentClosestToElement, storeInLocalStorage } from '../../shared/utils';
import { browser } from 'webextension-polyfill-ts';
import { createRoot } from 'react-dom/client';
import Notification from '../../Notifications/Notification';
import { sendErrorToSentry } from '../../shared/errorUtils';
import { createUrl, getBaseUrls } from '../../shared/ApiServices/requests';

export interface PopoverData {
  index: number;
  totalAlerts: number;
  alert: IAlert;
  position: DOMRect;
  node: Node;
  organizationConfig?: ResponseConfig;
}

interface PopoverProps {
  element: CustomInputElement;
  data: PopoverData;
  prevData: PopoverData | null;
  hide: () => void;
  updateTextWithAlternative: (alternative: string, category: string) => void;
  addIgnoredTerm: (term: string) => void;
  movePopoverNextOrPrev: (direction: string) => void;
  userIsSignedIn: boolean;
}

const HighlightPopover: React.FC<PopoverProps> = ({
  element,
  data,
  prevData,
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
  const [showLearningBite, setShowLearningBite, showLearningBiteRef] = useStateRef<boolean>(false);
  const [showIgnoreSection, setShowIgnoreSection] = useState<boolean>(false);
  const [iframeLoaded, setIframeLoaded] = useState<boolean>(false);
  const [accessToken, setAccessToken] = useState<string>('');
  const [isLoading, setIsLoading] = useState<string>('');
  const [isSuccess, setIsSuccess] = useState<string>('');
  const [isFailure, setIsFailure] = useState<string>('');
  const [diversityDimensionLocked, setDiversityDimensionLocked] = useState<boolean>(false);

  useEffect(() => {
    if (prevData && prevData.alert.id === data.alert.id) {
      return;
    }
    analytics.popoverLogs(data.alert, 'popover_open');
  }, [data]);

  useEffect(() => {
    //Dynamically sets the language depending on the text language
    i18n.changeLanguage(data.alert.data?.language);
  }, [data.alert.data?.language]);

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
    const organizationConfigSubCategories = data?.organizationConfig?.categories as any;
    const currentWordSubCategory = data?.alert?.data?.subcategory;
    const currentWordCategoryLocked = organizationConfigSubCategories?.[currentWordSubCategory]?.value;
    setDiversityDimensionLocked(currentWordCategoryLocked);
    
    browser.storage.local.get(null).then((result) => {
      setAccessToken(
        result[StorageKeys.ACCESS_TOKEN]
          ? result[StorageKeys.ACCESS_TOKEN]
          : ''
      );
    });
  }, []);

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
    const hasClickedOutsidePopOver = !refs.floating.current?.contains(event.target as HTMLElement);

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
    const popoverContainers = window.document.getElementsByTagName('ww-popover');
      Array.from(popoverContainers).forEach((popoverContainer) => {
        popoverContainer.remove();
    });
  };
  
  const incrementAlternativesAccepted = (storage: any) => 
    storeInLocalStorage(StorageKeys.NUMBER_OF_ALTERNATIVES_ACCEPTED, storage[StorageKeys.NUMBER_OF_ALTERNATIVES_ACCEPTED] ? storage[StorageKeys.NUMBER_OF_ALTERNATIVES_ACCEPTED] + 1 : 1);
  

  const renderNotification = (notificationType: string) => {
    try {
      if (!window.top) return;
  
      const notificationWrapper = document.createElement('div');
      notificationWrapper.id = 'ww-notification';
  
      window.top.document.body.insertBefore(notificationWrapper, window.top.document.body.firstChild);
      const root = createRoot(notificationWrapper);
      
      root.render(
        <Notification
          notificationType={notificationType}
          element={element}
        />
      );
    } catch (error) {
      DEV_ENV && console.error("Error in renderNotification:", error);
    }
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
    
      if (!salesDemoFlag?.active || !teamInviteFlag?.active || !friendInviteFlag?.active) { //reset counter if a feature flag is diabled, maybe need to rethink this?
        storeInLocalStorage(StorageKeys.NUMBER_OF_ALTERNATIVES_ACCEPTED, 0); 
      } else {
        const incrementedAlternativesAccepted = alternativesAccepted + 1;
        if (
          (incrementedAlternativesAccepted === salesDemoFlag?.triggerNumber && salesDemoFlag?.active) ||
          (incrementedAlternativesAccepted === teamInviteFlag?.triggerNumber && teamInviteFlag?.active) ||
          (incrementedAlternativesAccepted === friendInviteFlag?.triggerNumber && friendInviteFlag?.active)
        ) {
          const notificationType = incrementedAlternativesAccepted === salesDemoFlag?.triggerNumber 
            ? 'salesDemo'
            : incrementedAlternativesAccepted === teamInviteFlag?.triggerNumber 
            ? 'inviteTeam'
            : 'inviteFriends';
    
          renderNotification(notificationType);
        }
      }
      incrementAlternativesAccepted(result);
    }).catch((error) => {
     sendErrorToSentry(error);
    });
    updateTextWithAlternative(alternative, category);
  };

  const handleIgnoreClick = (ignoreType: string) => () => {
    analytics.ignoreLog(data.alert);
    if(ignoreType === 'ignore_once') {
      addIgnoredTerm(data.alert.data?.text);
      hidePopover();
    } else if (ignoreType === 'ignore_permanently') {
      const requestUrlIgnore = createUrl(getBaseUrls().dashboard, `api/user/language/ignore-words?false_positive=${data.alert.data?.text}`);
      makeDashboardRequest(requestUrlIgnore, ignoreType);
    } else if (ignoreType === 'reduce_dimension') {
      const requestUrlReduce = createUrl(getBaseUrls().dashboard, `api/user/language/customize-witty?diversity_dimension=${data.alert.data?.subcategory}&direction=down`);
      makeDashboardRequest(requestUrlReduce, ignoreType);
    }
  };

  const makeDashboardRequest = (requestUrl: string, ignoreType: string) => {
    setIsLoading(ignoreType);
    setIsSuccess('');
    setIsFailure('');
    fetch(
      requestUrl,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        }
      }
    ).then(async (response) => {
        setIsLoading('');
      if (response.status === 204) {
        addIgnoredTerm(data.alert.data?.text);
        setIsSuccess(ignoreType);
        setTimeout(() => {
          hidePopover();
        }, 1000);
      } else {
        setIsLoading('');
        setIsFailure(ignoreType);
      }
    }).catch((error) => {
      sendErrorToSentry(error);
    });
  };

  const renderAlternative = (alternative: IAlternatives, alternativeHovered: string | null) => {
    if (alternative && alternative.text === ' ') {
      return <i>{t('removeSpaces')}</i>;
    } else {
      const regex = /\(\((.*?)\)\)/;
      const matches = RegExp(regex).exec(alternative.text);
      if (matches) {
        const splitText = alternative.text.split(regex);
        return (
          <span>
            {splitText[0]}&nbsp; 
            {'['}<i>{splitText[1]}</i>{']'}&nbsp;
            {splitText[2]}
          </span>
        );
      } else if (alternative.text.length > 25 && alternative.context && alternativeHovered !== alternative.text) {
        return alternative.text.substring(0, 25) + '...';
      } else if (alternative.text.length > 35 && alternativeHovered !== alternative.text) {
        return alternative.text.substring(0, 35) + '...';
      } else {
        return alternative.text;
      }
    }
  } 

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
        {data.alert.data?.explanation?.text &&
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
                data.alert.data?.explanation?.url
                  ? 'pointer'
                  : 'default',
              backgroundColor: getColor(data.alert.data?.gravity, userIsSignedIn).highlight,
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
                <div style={{ fontSize: '2em', marginRight: '0.5em' }}>{data.alert.data?.explanation?.icon}</div>
                <div>
                  <b>{data.alert.data?.label.split(':').pop()}</b><br />
                  {data.alert.data?.explanation?.text}
                  {data.alert.data?.explanation?.context &&
                    ' (' + data.alert.data?.explanation?.context + ')'}
                </div>
              </div>
              {data.alert.data?.explanation?.url && (
                <div className='witty-works-ext-container-row witty-works-ext-justify-end witty-works-ext-lato-popover-text-gray witty-works-ext-cursor-pointer'
                style={{marginTop: showLearningBite ? '0em' : '1em'}}
                >
                  <div className='witty-works-ext-dropdown-select witty-works-ext-container-row'>
                      {t('learnMore')}
                      {data.alert.data?.explanation?.content === 'video' && (
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
            src={data.alert.data?.explanation?.url}
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
        <div className='witty-works-ext-separator' style={{ marginBottom: '1em', marginTop: '1em' }} />

        {/* TRY INSTEAD */}
        {data.alert.data?.alternatives?.length > 0 && !showLearningBite && !showIgnoreSection && (
          <>
            <div className='witty-works-ext-wittyworks-popover-row'>
              <div className='witty-works-ext-wittyworks-popover-alternative-btn-container'>
                {t('insteadTry')}
              </div>
              <div>
                {data.alert.data?.alternatives.map((alternative, index) =>
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
                          clickAlternative(e.nativeEvent,' ', data.alert.data?.category)
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
                            data.alert.data?.alternatives[index]?.text,
                            data.alert.data?.category
                          )
                        }
                      >
                       {renderAlternative(alternative, alternativeHovered)}
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
          <button onClick={() => { setShowIgnoreSection(!showIgnoreSection); }}
            className='witty-works-ext-cursor-pointer witty-works-ext-ignore-section witty-works-ext-wittyworks-container witty-works-ext-container-row witty-works-ext-justify-start witty-works-ext-ignore-color-transformer'
          >
            <span className='witty-works-ext-lato-popover-text-gray witty-works-ext-margin-right'>
              {t('ignoreTerm')}
            </span>
            <span style={{ pointerEvents: 'none' }}>
              {showIgnoreSection ? <ArrowUpIcon /> : <ArrowDownIcon />}
            </span>
          </button>

          <div style={{ display: showIgnoreSection ? 'flex' : 'none', flexDirection: 'column'}}>
          <div className='witty-works-ext-wittyworks-popover-alternative-btn-container'>
            <button
              className='witty-works-ext-secondary-button-red'
              onClick={handleIgnoreClick('ignore_once')}
              style={{padding: '2px 6px'}}
            >
                {t('ignoreOnce')}
              </button>
            </div>
            <div className='witty-works-ext-wittyworks-popover-alternative-btn-container'>
            <button
              className='witty-works-ext-secondary-button-red witty-works-ext-margin-right witty-works-ext-ignore-button'
              onClick={handleIgnoreClick('ignore_permanently')}
            >
                {t('ignorePermanently')}
              </button>
              {isLoading === 'ignore_permanently' && <LoadingIcon />}
              {isSuccess === 'ignore_permanently' && <CheckIcon />}
              {isFailure === 'ignore_permanently' &&  <><ErrorIcon /> <span className='witty-works-ext-margin-left'>{t('failedRequestText')}</span></>}
            </div>
            <div className='witty-works-ext-wittyworks-popover-alternative-btn-container'>
              <button
                className='witty-works-ext-secondary-button-red witty-works-ext-margin-right witty-works-ext-ignore-button'
                onClick={handleIgnoreClick('reduce_dimension')}
                style={{ pointerEvents: diversityDimensionLocked ? 'none' : 'auto' }}
              >
                  {t('reduceDimension')}
                </button>
                {diversityDimensionLocked && <><LockIcon /> <span className='witty-works-ext-margin-left'>{t('lockedByAdmin')}</span></>}
                {isLoading === 'reduce_dimension' && <LoadingIcon />}
                {isSuccess === 'reduce_dimension' && <CheckIcon />}
                {isFailure === 'reduce_dimension' && <><ErrorIcon /> <span className='witty-works-ext-margin-left'>{t('failedRequestText')}</span></>}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default HighlightPopover;
