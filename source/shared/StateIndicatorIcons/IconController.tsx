import React, { useRef } from 'react';
import './styles.scss';
import { CustomInputElement } from '../types';
import LoadingIcon from './LoadingIcon';
import ActiveIcon from '../../assets/icons/wittyStateIndicator/witty-active.svg';
import PassiveIcon from '../../assets/icons/wittyStateIndicator/witty-passive.svg';
import WarningIcon from '../../assets/icons/wittyStateIndicator/witty-warning.svg';
import { sendErrorToSentry } from '../errorUtils';
import { StorageKeys } from '../constants';
import { browser } from 'webextension-polyfill-ts';
import CloseIcon from '../../assets/icons/close-white.svg';
import { useTranslation } from 'react-i18next';
import { namespaces } from '../../i18n/i18n.constants';
import { useAnalytics } from '../ApiServices/useAnalytics';
import { getBaseUrls } from '../ApiServices/requests';
import defaultConfig from '../../witty.config.json';
import {getScrollableParentClosestToElement} from "../utils";
import { getTextDividedByNodes } from '../../ContentScript/utils';
import { isGoogleDocs, isHubspot, isMicrosoftOnlineExcel, isMicrosoftOnlineWord, isTrello, isWittyEditor } from '../DOMutils';

interface IconControllerProps {
  element: CustomInputElement;
  elementRect?: DOMRect;
  iconType: string;
  isHovered: boolean;
}

const IconController: React.FC<IconControllerProps> = ({
  element,
  elementRect,
  iconType,
  isHovered,
}: IconControllerProps) => {
  const ref = useRef<HTMLDivElement>({} as HTMLDivElement);
  const fixedPositionIcon = isMicrosoftOnlineWord(window.location.href) || isGoogleDocs();
  let iconPositionGoogleDocs = { top: 0, left: 0 };
  if (!elementRect) {
    elementRect = element.getBoundingClientRect();
  } else if (fixedPositionIcon) {
    if (iconType == 'passive') iconType = 'active'; //passive does not make sense on google docs
    let gDocsPage = element.querySelectorAll('.kix-page-paginated');

    if(gDocsPage.length === 0) {//for pageless format
      gDocsPage = element?.childNodes[0]?.childNodes as NodeListOf<Element>; 
    }

    if(gDocsPage.length > 0) {
      elementRect = (gDocsPage[0]).getBoundingClientRect();
    }

    iconPositionGoogleDocs = {
      top: 250,
      left: elementRect.left + elementRect.width + 20,
    };
  }
  const [userIsLoggedIn, setUserIsLoggedIn] = React.useState(true);
  const { t } = useTranslation(namespaces.iconController);
  const analytics = useAnalytics();
  const totalTextLength = getTextDividedByNodes(element).map((node: any) => node.textContent).join('')?.length || 0;

  browser.storage.local
    .get(StorageKeys.ACCESS_TOKEN)
    .then((result) => {
      setUserIsLoggedIn(!result[StorageKeys.ACCESS_TOKEN] ? false : true);
    })
    .catch((error: unknown) => {
      sendErrorToSentry(error);
    });

  // used to try to stay on top of a scrollable input like in linkedin, may not be desirable
  const scrollContainer = getScrollableParentClosestToElement(element);
  const scrollContainerScrollTop = scrollContainer ? scrollContainer.scrollTop : 0;
  const parentWidth = element.parentElement?.getBoundingClientRect().width || 0;
  const elementWidth = isHubspot() ? parentWidth - 5 : elementRect.width;
  const positionLeft = isWittyEditor() ? -(elementRect.width * 0.05) : isTrello() ? 28 : 50; 
  return (
    <div
      ref={ref}
      style={{
        zIndex: 999999999,
        position: fixedPositionIcon ? 'fixed' : 'absolute',
        top: fixedPositionIcon ? iconPositionGoogleDocs.top : `${scrollContainerScrollTop + (isMicrosoftOnlineExcel(window.location.href) ? 0 : 8)}px`, //add padding like this to minimize clickable area
        left: fixedPositionIcon ? iconPositionGoogleDocs.left : `${0}px`,
        marginLeft:  fixedPositionIcon ? '0px' : `${elementWidth - positionLeft + 20}px`, //add padding like this to minimize clickable area
        pointerEvents: iconType !== 'warning' ? 'none' : 'auto',
        display: 'flex',
        boxSizing: 'border-box',
        justifyContent: 'flex-end', 
        maxHeight: elementRect.height,
      }}
      onMouseDown={(e) => {
        e.stopPropagation();
        e.preventDefault();
      }}
    >
      {userIsLoggedIn && iconType == 'loading' && <LoadingIcon />}
      {userIsLoggedIn && iconType == 'active' && <ActiveIcon />}
      {userIsLoggedIn && iconType == 'passive' && isHovered && <PassiveIcon />}
      {userIsLoggedIn && iconType == 'warning' && <WarningIcon style = {{cursor: 'pointer'}} onClick = {() => {
        const maxLengthWarning = element.ownerDocument.getElementById("maxLengthWarning");
        if (!maxLengthWarning) return;
        maxLengthWarning.style.display = maxLengthWarning.style.display == "block" ? "none" : "block";
        maxLengthWarning.style.display == "block" && analytics.maxCharLengthReachedLog('max_char_length_icon_clicked');
      }}/>}
  
      <div id="maxLengthWarning" className="witty-works-warning-wrapper" 
      style={{
        display: 'none',
        visibility: 'visible',
        position: 'absolute',
        width: '300px',
        backgroundColor: '#f5f5f5',
        zIndex: 'auto',
        margin: '1em',
        borderRadius: '4px',
        left: '-300px',
      }}>
        <div className="witty-works-warning-headline-wrapper"
        style={{
          background: 'linear-gradient(114.59deg, #F06464 1.6%, #F277D0 32.79%, #9489DB 71.64%)',
          height: '2em',
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontFamily: 'Lato, Arial, Helvetica, sans-serif',
          borderTopLeftRadius: '4px',
          borderTopRightRadius: '4px',
          boxShadow: '0px 1px 1px rgba(0, 0, 0, 0.25)',
          padding: '0.9em',
        }}>
          <div className="witty-works-warning-headline" style={{ 
            fontSize: '18px',
            fontWeight: 600,
            color: 'white',
            fontFamily: 'Lato, Arial, Helvetica, sans-serif'
          }}>{t('totalMaxCharLengthReachedNotificationHeadline')}</div>
          <CloseIcon  
            style={{cursor: 'pointer', marginRight: '-1em'}} 
            onClick = {() => {
              const maxLengthWarning = element.ownerDocument.getElementById("maxLengthWarning");
              if (!maxLengthWarning) return;
              maxLengthWarning.style.display = "none";
          }}/>
        </div>
        <div className="witty-works-warning-text" style={{
          color: 'black',
          fontSize: '12px',
          padding: '1em',
          zIndex: 999999999,
          backgroundColor: '#f5f5f5',
          position: 'absolute',
          fontFamily: 'Lato, Arial, Helvetica, sans-serif',
          borderBottomRightRadius: '4px',
          borderBottomLeftRadius: '4px',
          boxShadow: '0px 1px 1px rgba(0, 0, 0, 0.25)',
          maxWidth: '100%',
          wordWrap: 'break-word'
        }}>
        {t('totalMaxCharLengthReachedNotificationText', {limit: defaultConfig.MAX_CHAR_LENGTH_TOTAL_FREEMIUM, total: totalTextLength})}
          <div className='witty-works-ext-left  witty-works-ext-margin-top' style={{ 
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'flex-start',
            marginTop: '1em'
          }}>
            <div className='witty-works-ext-button witty-works-ext-primary-button-red'
              style={{
                padding: '10px 15px',
                gap: '10px',
                fontFamily: 'Lato, Arial, Helvetica, sans-serif',
                fontStyle: 'normal',
                fontWeight: 400,
                fontSize: '16px',
                lineHeight: '14px',
                marginRight: '1em',
                cursor: 'pointer',
                background: '#f06464',
                borderRadius: '8px',
                color: '#ffffff',
              }} 
              onClick={() => { window.open(getBaseUrls().dashboard + 'team/subscription', '_blank'); }}>
              {t('subscriptionButton')}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IconController;
