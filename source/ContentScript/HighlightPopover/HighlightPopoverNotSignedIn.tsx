import React, {useEffect, useState} from 'react';
import CSS from 'csstype';
import {useFloating, flip, offset, shift} from '@floating-ui/react-dom';

import {CustomInputElement, IAlert} from '../../shared/types';
import {useTranslation} from 'react-i18next';
import {namespaces} from '../../i18n/i18n.constants';

import CloseIcon from '../../assets/icons/popover/close.svg';
import WittyLogo from '../../assets/icons/popover/logo.svg';
import SadFace from '../../assets/icons/popup/sadFace.svg';
import Star from '../../assets/icons/popup/star.svg';

import './HighlightPopover.scss';
import {getActiveDocument} from '../../shared/activeDocument';
import {
  DefaultBaseUrlKey,
  DEV_ENV,
  StorageKeys,
  X_KEY,
  registerCustomEndpointFromStorage,
} from '../../shared/constants';
import {MessageTypes, SignInMessage, SignInResult} from '../../shared/messages';
import browser from 'webextension-polyfill';
import {setBaseUrls} from '../../shared/ApiServices/requests';
import {sendErrorToSentry} from '../../shared/errorUtils';
import {logTypes, useLog} from '../../shared/customHooks/useLog';
import {useAnalytics} from '../../shared/ApiServices/useAnalytics';

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
  prevData: PopoverData | null;
  hide: () => void;
  /** See HighlightPopover: take focus when opened via the keyboard shortcut. */
  focusOnOpen: boolean;
}

const HighlightPopoverNotSignedIn: React.FC<PopoverProps> = ({
  element,
  data,
  prevData,
  hide,
  focusOnOpen,
}: PopoverProps) => {
  const doc = document.documentElement || document.body;
  const analytics = useAnalytics();

  const {t, i18n} = useTranslation(namespaces.popover);
  const [urls, setUrls] = useState<string>(DefaultBaseUrlKey);
  const [signInError, setSignInError] = useState(false);
  const log = useLog('PopupLogin');

  const onStorageError = (error: unknown) => {
    DEV_ENV && console.log(`onBrowserStorage Error: ${error}`);
    log(`onBrowserStorage Error: ${error}`, logTypes.ERROR);
    sendErrorToSentry(error);
  };

  useEffect(() => {
    if (prevData && prevData.alert.id === data.alert.id) {
      return;
    }
    analytics.popoverLogs(data.alert, 'popover_open');
  }, [data]);

  // Content scripts cannot reach `browser.identity`, so the background worker
  // runs the OAuth flow on our behalf.
  const logIn = async (register = false) => {
    const result = (await browser.runtime.sendMessage({
      type: MessageTypes.SIGN_IN,
      register,
    } as SignInMessage)) as SignInResult | undefined;

    if (result?.status === 'error') {
      log(`Sign-in failed: ${result.message}`, logTypes.ERROR);
      setSignInError(true);
    }
  };

  useEffect(() => {
    browser.storage.local
      .get(null)
      .then((result) => {
        registerCustomEndpointFromStorage(result);
        setUrls(
          result[StorageKeys.API_ENDPOINT_KEY]
            ? result[StorageKeys.API_ENDPOINT_KEY]
            : DefaultBaseUrlKey
        );
      })
      .catch(onStorageError);
    browser.storage.onChanged.addListener(storageChange);

    return () => {
      browser.storage.onChanged.removeListener(storageChange);
    };
  }, []);

  useEffect(() => {
    setBaseUrls(urls);
  }, [urls]);

  // If X_KEY is configured, don't show sign-in flow in popovers
  if (X_KEY) {
    return (
      <div id='witty-works-ext-popover'>
        <div
          id='witty-works-ext-popover-content'
          className='witty-works-ext-lato-popover-text'
        >
          <div className='witty-works-ext-wittyworks-container witty-works-ext-container-row witty-works-ext-full-padding witty-works-ext-justify-start witty-works-ext-margin-top witty-works-ext-cursor-pointer witty-works-ext-full-padding witty-works-ext-light-gray-background'>
            <div className='witty-works-ext-margin-right'>
              <SadFace />
            </div>
            <div
              className='witty-works-ext-lato-popover-text witty-works-ext-margin-left'
              style={{color: '#E6635A'}}
            >
              {t('apiKeyConfiguredNotice')}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const storageChange = (changes: any) => {
    const changedItems = Object.keys(changes);
    for (const item of changedItems) {
      if (item === StorageKeys.API_ENDPOINT_KEY) {
        setUrls(changes[item].newValue);
      }
    }
  };

  useEffect(() => {
    i18n.changeLanguage(data.alert.data.language);
  }, [data.alert.data.language]);

  const elementCords = (dat: PopoverData) => {
    return {
      name: 'elementCords',
      options: dat,
      fn: ({placement, rects}: any) => {
        const calcNewX: number = dat.position.x;
        const calcNewY: number = placement.includes('bottom')
          ? dat.position.y + dat.position.height + doc.scrollTop
          : dat.position.y - rects.floating.height + doc.scrollTop;

        return {
          x: calcNewX,
          y: calcNewY,
        };
      },
    };
  };

  // floating-ui v1 replaced the `reference`/`floating` callback refs with
  // refs.setReference/refs.setFloating; refs.floating still holds the element.
  const {x, y, strategy, refs} = useFloating({
    placement: 'bottom-start',
    middleware: [elementCords(data), flip(), offset(4), shift()],
  });

  useEffect(() => refs.setReference(element), [refs.setReference]);

  useEffect(() => {
    document?.addEventListener('click', handleClickOutside);
    document?.addEventListener('input', handleClickOutside as EventListener);
    getActiveDocument()?.addEventListener('click', handleClickOutside);
    getActiveDocument()?.addEventListener(
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

  useEffect(() => {
    if (!focusOnOpen) {
      return;
    }
    refs.floating.current?.focus();
  }, [data.alert.id, focusOnOpen, refs.floating.current]);

  useEffect(() => {
    const activeDoc = getActiveDocument();
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      const focusWasInside = refs.floating.current?.contains(
        document.activeElement
      );
      hidePopover(true);
      if (focusWasInside) {
        (element as HTMLElement).focus?.();
      }
    };

    document.addEventListener('keydown', handleKeydown, true);
    if (activeDoc !== document) {
      activeDoc?.addEventListener('keydown', handleKeydown, true);
    }
    return () => {
      document.removeEventListener('keydown', handleKeydown, true);
      if (activeDoc !== document) {
        activeDoc?.removeEventListener('keydown', handleKeydown, true);
      }
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

  const hidePopover = (logClose = false) => {
    logClose && analytics.popoverLogs(data.alert, 'popover_close');
    hide();
  };

  const PopoverStyling: CSS.Properties = {
    position: strategy,
    top: `${y}px`,
    left: `${x}px`,
  };

  return (
    <div
      id='witty-works-ext-popover'
      ref={refs.setFloating}
      role='dialog'
      aria-label={t('suggestionsDialog')}
      tabIndex={-1}
      style={PopoverStyling}
      onMouseDown={(e) => e.preventDefault()}
    >
      <div
        id='witty-works-ext-popover-content'
        className='witty-works-ext-lato-popover-text'
      >
        <div className='witty-works-ext-section witty-works-ext-wittyworks-container witty-works-ext-container-row witty-works-ext-justify-space-between'>
          <a
            className='witty-works-ext-margin-right witty-works-ext-cursor-pointer'
            href='https://www.witty.works/'
            target='_blank'
            rel='noreferrer'
          >
            <WittyLogo alt={t('wittyLogo')} />
          </a>
          <button
            type='button'
            className='witty-works-button witty-works-ext-lato-popover-text-gray witty-works-ext-cursor-pointer'
            onClick={() => {
              hidePopover(true);
            }}
            aria-label={t('close')}
            title={t('close')}
          >
            <CloseIcon alt={t('close')} />
          </button>
        </div>

        <div className='witty-works-ext-separator' />

        <div className='witty-works-ext-wittyworks-container witty-works-ext-container-rounded witty-works-ext-container-row witty-works-ext-full-padding witty-works-ext-justify-start witty-works-ext-margin-top witty-works-ext-cursor-pointer witty-works-ext-light-gray-background'>
          <div className='witty-works-ext-margin-right'>
            <SadFace />
          </div>
          <div className='witty-works-ext-lato-popover-text witty-works-ext-margin-left'>
            {t('loginToUnlock')}

            <div
              className='witty-works-ext-wittyworks-container witty-works-ext-container-row witty-works-ext-lato-popover-text-gray witty-works-ext-cursor-pointer '
              style={{padding: 0}}
            >
              <div className='witty-works-ext-margin-right'>
                {t('signedOutText')}
              </div>
            </div>
          </div>
        </div>

        <div className='witty-works-ext-full-padding'>
          <div className='witty-works-ext-wittyworks-container witty-works-ext-container-row'>
            <div className='witty-works-ext-margin-right'>
              <Star />
            </div>
            <div className='witty-works-ext-lato-popover-text'>
              {t('biasDetection')}
            </div>
          </div>
          <div className='witty-works-ext-wittyworks-container witty-works-ext-container-row witty-works-ext-justify-start'>
            <div className='witty-works-ext-margin-right'>
              <Star />
            </div>
            <div className='witty-works-ext-lato-popover-text'>
              {t('inclusiveAlternatives')}
            </div>
          </div>
          <div className='witty-works-ext-container-row witty-works-ext-justify-start'>
            <div className='witty-works-ext-margin-right'>
              <Star />
            </div>
            <div className='witty-works-ext-lato-popover-text'>
              {t('teamFeatures')}
            </div>
          </div>
        </div>

        <div className='witty-works-ext-left witty-works-ext-margin-bottom'>
          <button
            type='button'
            className='witty-works-ext-button witty-works-ext-primary-button-red'
            onClick={() => {
              setSignInError(false);
              logIn().catch((error) => {
                log(`logIn Error: ${error}`, logTypes.ERROR);
                sendErrorToSentry(error);
                setSignInError(true);
              });
            }}
          >
            {t('signIn')}
          </button>
          <div className='witty-works-ext-lato-popup-text witty-works-ext-margin-top-half'>
            {t('dontHaveAccount')}
            &nbsp;
            <button
              type='button'
              className='witty-works-button witty-works-ext-lato-popup-text-purple witty-works-ext-cursor-pointer'
              onClick={() => {
                setSignInError(false);
                logIn(true).catch((error) => {
                  log(`logIn Error: ${error}`, logTypes.ERROR);
                  sendErrorToSentry(error);
                  setSignInError(true);
                });
              }}
            >
              {t('signUp')}
            </button>
          </div>
        </div>
        {/*
          Sign-in no longer opens a window, so there is no popup for the browser
          to block. What can still fail is the OAuth flow itself.
        */}
        {signInError && (
          <div className='witty-works-ext-wittyworks-container witty-works-ext-container-rounded witty-works-ext-full-padding witty-works-ext-margin-bottom witty-works-ext-light-gray-background'>
            <div
              className='witty-works-ext-lato-small-paragraph-title-h4'
              style={{marginRight: 'auto'}}
            >
              {t('signInFailed')}
            </div>
            <div className='witty-works-ext-lato-popup-text'>
              {t('signInFailedText')}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default HighlightPopoverNotSignedIn;
