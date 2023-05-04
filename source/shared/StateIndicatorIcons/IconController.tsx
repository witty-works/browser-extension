import React, { useRef } from 'react';

import { CustomInputElement } from '../types';
import LoadingIcon from './LoadingIcon';
import ActiveIcon from '../../assets/icons/wittyStateIndicator/witty-active.svg';
import PassiveIcon from '../../assets/icons/wittyStateIndicator/witty-passive.svg';
import WarningIcon from '../../assets/icons/wittyStateIndicator/witty-warning.svg';
import { getCorrectedPosition } from '../utils';
import { sendErrorToSentry } from '../errorUtils';
import { StorageKeys } from '../constants';
import { browser } from 'webextension-polyfill-ts';
import { getZIndex, isGoogleDocs } from '../DOMutils';
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
  const googleDocsIcon = isGoogleDocs();
  const iconPadding: number = 8;
  let correctedPosition = {} as any;
  // const scrollTop =
  //   (!isTextArea(element) && getScrollParent(element)?.scrollTop) || 0;

  let iconPosition = { top: 0, left: 0 };
  if (!elementRect) {
    elementRect = element.getBoundingClientRect();
    iconPosition = {
      top: elementRect.height - 21 - iconPadding,
      left: elementRect.width - 25 - iconPadding,
    };
  } else if (googleDocsIcon) {
    if (iconType == 'passive') iconType = 'active'; //passive does not make sense on google docs
    correctedPosition = (
      element.firstChild?.firstChild as HTMLElement
    ).getBoundingClientRect();
    iconPosition = {
      top: 250,
      left: correctedPosition.left + correctedPosition.width + 20,
    };
  } else {
    correctedPosition = getCorrectedPosition(
      elementRect,
      ref.current.parentElement,
      element
    );
    iconPosition = {
      top:
        elementRect.height +
        correctedPosition.top -
        21 -
        iconPadding,
        // - scrollTop,
      left: elementRect.width + correctedPosition.left - 25 - iconPadding,
    };
  }

  const [userIsLoggedIn, setUserIsLoggedIn] = React.useState(true);

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
        display: 'flex',
        position: googleDocsIcon ? 'fixed' : 'absolute',
        top: `${iconPosition.top}px`,
        left: `${iconPosition.left}px`,
        zIndex: getZIndex(element),
      }}
      onMouseDown={(e) => {
        e.stopPropagation();
        e.preventDefault();
      }}
    >
      {userIsLoggedIn && iconType == 'loading' && <LoadingIcon />}
      {userIsLoggedIn && iconType == 'active' && <ActiveIcon />}
      {userIsLoggedIn && iconType == 'passive' && isHovered && <PassiveIcon />}
      {iconType == 'warning' && <WarningIcon  
      onClick = {() => {
        const maxLengthWarning = document.getElementById("maxLengthWarning");
        if (!maxLengthWarning) return;
        maxLengthWarning.style.visibility = maxLengthWarning.style.visibility == "visible" ? "hidden" : "visible";
      }}
      />}
      <div 
        id="maxLengthWarning"
        style={{
          position: 'absolute',
          top: '-100px',
          left: '-300px',
          width: '300px',
          height: '80px',
          boxShadow: '0px 0px 1px 0px rgba(0,0,0,0.75)',
          backgroundColor: '#eeeeee',
          fontSize: '12px',
          justifyContent: 'left', 
          alignItems: 'center',
          visibility: 'hidden',
          padding: '1em',
          fontStyle: 'normal',
          fontWeight: 400,
          borderRadius: '4px',
        }}
      >
        With your current pricing plan, Witty only checks a limited text length. Please upgrade (link to pricing) if you would like to have longer texts checked
      </div>
    </div>
  );
};

export default IconController;
