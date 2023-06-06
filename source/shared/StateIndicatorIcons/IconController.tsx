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
import { getZIndex } from '../DOMutils';
import CloseIcon from '../../assets/icons/close-white.svg';
import { useTranslation } from 'react-i18next';
import { namespaces } from '../../i18n/i18n.constants';
import { useAnalytics } from '../ApiServices/useAnalytics';

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
  const { t } = useTranslation([namespaces.iconController]);

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
        top: `${elementRect.top - windowScroll.top}px`,
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
      {userIsLoggedIn && iconType == 'warning' && <WarningIcon onClick = {() => {
        const maxLengthWarning = document.getElementById("maxLengthWarning");
        if (!maxLengthWarning) return;
        maxLengthWarning.style.visibility = maxLengthWarning.style.visibility == "visible" ? "hidden" : "visible";
        maxLengthWarning.style.visibility == "visible" && useAnalytics().maxCharLengthReachedLog('max_char_length_icon_clicked');

      }}/>}
      
      <div id="maxLengthWarning" className="witty-works-warning-wrapper">
        <div className="witty-works-ext-container-row witty-works-warning-headline-wrapper">
          <div className="witty-works-warning-headline">{t('limitReached')}</div>
          <CloseIcon onClick = {() => {
            const maxLengthWarning = document.getElementById("maxLengthWarning");
            if (!maxLengthWarning) return;
            maxLengthWarning.style.visibility = "hidden";
          }}/>
        </div>
        <div className="witty-works-warning-text">
          {t('limitReachedText')}
        </div>
      </div>

    </div>
  );
};

export default IconController;
