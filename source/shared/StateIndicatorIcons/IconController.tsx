import React, { useRef } from 'react';

import { CustomInputElement } from '../types';
import LoadingIcon from './LoadingIcon';
import ActiveIcon from '../../assets/icons/wittyStateIndicator/witty-active.svg';
import PassiveIcon from '../../assets/icons/wittyStateIndicator/witty-passive.svg';
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
      top: elementRect.height + correctedPosition.top - 21 - iconPadding,
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
        zIndex: getZIndex(),
      }}
      onMouseDown={(e) => {
        e.stopPropagation();
        e.preventDefault();
      }}
    >
      {userIsLoggedIn && iconType == 'loading' && <LoadingIcon />}
      {userIsLoggedIn && iconType == 'active' && <ActiveIcon />}
      {userIsLoggedIn && iconType == 'passive' && isHovered && <PassiveIcon />}
    </div>
  );
};

export default IconController;
