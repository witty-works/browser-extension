import React, { useRef } from 'react';

import { CustomInputElement } from '../types';
import LoadingIcon from './LoadingIcon';
import ActiveIcon from '../../assets/icons/wittyStateIndicator/witty-active.svg';
import PassiveIcon from '../../assets/icons/wittyStateIndicator/witty-passive.svg';
import { usePositionCorrection } from '../../shared/customHooks/usePositionCorrection';
import { browser } from 'webextension-polyfill-ts';
import { StorageKeys } from '../constants';
import { sendErrorToSentry } from '../errorUtils';

interface IconControllerProps {
  iconType: string;
  element: CustomInputElement;
  isHovered: boolean;
}

const IconController: React.FC<IconControllerProps> = ({
  iconType,
  element,
  isHovered,
}: IconControllerProps) => {
  const ref = useRef<HTMLDivElement>({} as HTMLDivElement);
  const correctedPosition = usePositionCorrection(
    element,
    ref.current.parentElement
  );
  const elementRect = element.getBoundingClientRect();
  const iconPadding: number = 8;
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
        position: 'absolute',
        //TODO don't hardcode icons width & height
        top: `${
          elementRect.height + correctedPosition.top - 21 - iconPadding
        }px`,
        left: `${
          elementRect.width + correctedPosition.left - 25 - iconPadding
        }px`,
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
