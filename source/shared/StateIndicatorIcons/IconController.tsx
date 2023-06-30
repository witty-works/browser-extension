import React, { useRef } from 'react';
import './styles.scss';
import { CustomInputElement, Position } from '../types';
import LoadingIcon from './LoadingIcon';
import ActiveIcon from '../../assets/icons/wittyStateIndicator/witty-active.svg';
import PassiveIcon from '../../assets/icons/wittyStateIndicator/witty-passive.svg';
import WarningIcon from '../../assets/icons/wittyStateIndicator/witty-warning.svg';
import { sendErrorToSentry } from '../errorUtils';
import { StorageKeys } from '../constants';
import { browser } from 'webextension-polyfill-ts';
import { getZIndex, isTinyMceEditor } from '../DOMutils';
import CloseIcon from '../../assets/icons/close-white.svg';
import { useTranslation } from 'react-i18next';
import { namespaces } from '../../i18n/i18n.constants';
import { useAnalytics } from '../ApiServices/useAnalytics';
import { getBaseUrls } from '../ApiServices/requests';

interface IconControllerProps {
  element: CustomInputElement;
  elementRect?: DOMRect;
  iconType: string;
  isHovered: boolean;
  windowScroll: Position;
}

const IconController: React.FC<IconControllerProps> = ({
  element,
  elementRect,
  iconType,
  isHovered,
  windowScroll,
}: IconControllerProps) => {
  const ref = useRef<HTMLDivElement>({} as HTMLDivElement);
  if (!elementRect) {
    elementRect = element.getBoundingClientRect();
  }
  const [userIsLoggedIn, setUserIsLoggedIn] = React.useState(true);
  const { t, i18n } = useTranslation(namespaces.iconController);
  const analytics = useAnalytics();

  browser.storage.local
    .get(StorageKeys.ACCESS_TOKEN)
    .then((result) => {
      setUserIsLoggedIn(!result[StorageKeys.ACCESS_TOKEN] ? false : true);
    })
    .catch((error: unknown) => {
      sendErrorToSentry(error);
    });

  return (
    <div
      ref={ref}
      style={{
        zIndex: getZIndex(element),
        position: 'fixed',
        margin: `10px`,
        top: `${elementRect.top - (isTinyMceEditor(element) ? 0 : windowScroll.top)}px`, //FUTURE TODO: problem with icon top position in iframes 
        right: `${window.innerWidth - elementRect.right}px`,
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
        maxLengthWarning.style.visibility = maxLengthWarning.style.visibility == "visible" ? "hidden" : "visible";
        maxLengthWarning.style.visibility == "visible" && analytics.maxCharLengthReachedLog('max_char_length_icon_clicked');
      }}/>}
  
      <div id="maxLengthWarning" className="witty-works-warning-wrapper" 
      style={{ 
        visibility: 'hidden',
        position: 'absolute',
        width: '300px',
        backgroundColor: '#f5f5f5',
        zIndex: 'auto',
        margin: '1em',
        right: 0,
        borderRadius: '4px',
        left: '-300px',
        top: '10px',
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
          }}>{t('limitReached')}</div>
          <CloseIcon  
            style={{cursor: 'pointer', marginRight: '-1em'}} 
            onClick = {() => {
              const maxLengthWarning = element.ownerDocument.getElementById("maxLengthWarning");
              if (!maxLengthWarning) return;
              maxLengthWarning.style.visibility = "hidden";
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
        {i18n.language.split('-')[0] === 'en' ? 
        <>With your current pricing plan, Witty only checks a limited text length. <a className="witty-works-link" href="https://dashboard.witty.works/team/subscription">Upgrade</a> now to <a className="witty-works-link" href="https://www.witty.works/pricing">Witty Teams</a>. You get:<ul><li>Unlimited text length</li><li>Unlimited analytics</li><li>Invite more team members</li></ul></> :
        <>Mit Ihrem aktuellen Preisplan überprüft Witty nur eine begrenzte Textlänge. <a className="witty-works-link" href="https://dashboard.witty.works/team/subscription">Wechseln Sie</a> jetzt auf <a className="witty-works-link" href="https://www.witty.works/pricing">Witty Teams</a>. Vorteile:<ul><li>Unbegrenzte Textlänge</li><li>Unbegrenzte Statistiken</li><li>Mehr Teammitglieder einladen</li></ul></>
        }
          <div className='witty-works-ext-left' style={{ 
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'flex-start'
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
