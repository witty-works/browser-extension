import React, { useEffect, useState } from 'react';
import CSS from 'csstype';
import { useFloating, flip, offset, shift } from '@floating-ui/react-dom';

import { CustomInputElement, IAlert } from '../../shared/types';
import { useTranslation } from 'react-i18next';
import '../../i18n/i18n';
import { namespaces } from '../../i18n/i18n.constants';

import CloseIcon from '../../assets/icons/popover/close.svg';
import WittyLogo from '../../assets/icons/popover/logo.svg';
import Checkmark from '../../assets/icons/popup/checkmark.svg';
import Star from '../../assets/icons/popup/star.svg';

import './HighlightPopover.scss';
import { getActiveDocument } from '../ContentScriptApp';
import {
  BaseUrls,
  DefaultBaseUrlKey,
  DEV_ENV,
  StorageKeys,
} from '../../shared/constants';
import { browser } from 'webextension-polyfill-ts';
import { getBaseUrls, setBaseUrls } from '../../shared/ApiServices/requests';
import { sendErrorToSentry } from '../../shared/errorUtils';
import { logTypes, useLog } from '../../shared/customHooks/useLog';

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
}

const HighlightPopoverNotSignedIn: React.FC<PopoverProps> = ({
  element,
  data,
  hide,
}: PopoverProps) => {
  const doc = document.documentElement || document.body;

  const { t, i18n } = useTranslation(namespaces.popover);
  const [urls, setUrls] = useState<string>(DEV_ENV ? 'Dev' : 'Prod');
  const [popupsBlocked, setPopupsBlocked] = useState(false);
  const [loginUrl, setLoginUrl] = useState('');
  const [displayCopiedMessage, setDisplayCopiedMessage] = useState(false);
  const log = useLog('PopupLogin');

  const onStorageError = (error: unknown) => {
    console.log(`onBrowserStorage Error: ${error}`);
    log(`onBrowserStorage Error: ${error}`, logTypes.ERROR);
    sendErrorToSentry(error);
  };

  const logIn = async (urls: string) => {
    const optionsPageUrl = browser.extension.getURL('options.html');

    browser.storage.local.get(null).then((result) => {
      if (!result[StorageKeys.REDIRECT_URL_LOGIN]) {
        const url = `${BaseUrls[urls].dashboard}api/browser-login?redirect_uri=${optionsPageUrl}?target=https://www.witty.works/try-out-witty`;
        if (!window.open(url, '_blank')) {
          setPopupsBlocked(true);
          setLoginUrl(url);
        }
      } else {
        const url = `${
          BaseUrls[urls].dashboard
        }api/browser-login?redirect_uri=${optionsPageUrl}?target=${
          getBaseUrls().dashboard
        }`;
        if (!window.open(url, '_blank')) {
          setPopupsBlocked(true);
          setLoginUrl(url);
        }
      }
    });
  };

  useEffect(() => {
    browser.storage.local
      .get(null)
      .then((result) => {
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

  const storageChange = (changes: any) => {
    let changedItems = Object.keys(changes);
    for (let item of changedItems) {
      if (item === StorageKeys.API_ENDPOINT_KEY) {
        setUrls(changes[item].newValue);
      }
    }
  };

  useEffect(() => {
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
      ref={floating}
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
          >
            <WittyLogo />
          </a>
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

        <div className='witty-works-ext-wittyworks-container witty-works-ext-container-rounded witty-works-ext-container-row witty-works-ext-full-padding witty-works-ext-justify-start witty-works-ext-margin-top witty-works-ext-cursor-pointer witty-works-ext-light-gray-background'>
          <div className='witty-works-ext-margin-right'>
            <Checkmark />
          </div>
          <div className='witty-works-ext-lato-popover-text'>
            {t('loginToUnlock')}

            <div
              className='witty-works-ext-wittyworks-container witty-works-ext-container-row witty-works-ext-lato-popover-text-gray witty-works-ext-cursor-pointer '
              style={{ padding: 0 }}
            >
              <div className='witty-works-ext-margin-right'>
                {t('signedOutText')}
              </div>
            </div>
          </div>
        </div>

        <div className='witty-works-ext-full-padding'>
          <div className='witty-works-ext-wittyworks-container witty-works-ext-container-row witty-works-ext-justify-start'>
            <div className='witty-works-ext-lato-popover-text'>
              {t('signUpFor')}
            </div>
          </div>
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
        </div>

        <div className='witty-works-ext-left witty-works-ext-margin-bottom'>
          <div
            className='witty-works-ext-button witty-works-ext-primary-button-red'
            onClick={() => {
              logIn(urls).catch((error) => {
                log(`logIn Error: ${error}`, logTypes.ERROR);
                sendErrorToSentry(error);
                setPopupsBlocked(true);
              });
            }}
          >
            {t('signUp')}
          </div>
          <div className='witty-works-ext-lato-popup-text'>
            {t('haveAccount')}
            &nbsp;
            <span
              className='witty-works-ext-lato-popup-text-purple witty-works-ext-cursor-pointer'
              onClick={() => {
                logIn(urls).catch((error) => {
                  log(`logIn Error: ${error}`, logTypes.ERROR);
                  sendErrorToSentry(error);
                  setPopupsBlocked(true);
                });
              }}
            >
              {t('signIn')}
            </span>
          </div>
        </div>
        {popupsBlocked && (
          <div className='witty-works-ext-wittyworks-container witty-works-ext-container-rounded witty-works-ext-full-padding witty-works-ext-margin-top witty-works-ext-margin-bottom witty-works-ext-cursor-pointer witty-works-ext-light-gray-background'>
            <div
              className='witty-works-ext-lato-small-paragraph-title-h4'
              style={{ marginRight: 'auto' }}
            >
              {t('popupsBlocked')}
            </div>
            <div className='witty-works-ext-lato-popup-text'>
              {t('popupsBlockedText')}
            </div>
            <div
              className='witty-works-ext-container-row'
              style={{ marginRight: 'auto' }}
            >
              <div
                className='witty-works-ext-button witty-works-ext-primary-button-red witty-works-ext-margin-top'
                onClick={() => {
                  navigator.clipboard.writeText(loginUrl);
                  setDisplayCopiedMessage(true);
                  setTimeout(() => {
                    setDisplayCopiedMessage(false);
                  }, 1500);
                }}
              >
                {t('copyLink')}
              </div>
              {displayCopiedMessage && (
                <div
                  className='witty-works-ext-lato-popup-text'
                  style={{ marginTop: '1.5em' }}
                >
                  {t('copiedConfirmation')}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default HighlightPopoverNotSignedIn;
