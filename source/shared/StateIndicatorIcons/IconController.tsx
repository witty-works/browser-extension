import React from 'react';

import { CustomInputElement } from '../types';
import LoadingIcon from './LoadingIcon';
import ActiveIcon from '../../assets/icons/wittyStateIndicator/witty-active.svg';
import PassiveIcon from '../../assets/icons/wittyStateIndicator/witty-passive.svg';

interface IconControllerProps {
  iconType: string;
  elementReference: CustomInputElement;
  isHovered: boolean;
}

const IconController: React.FC<IconControllerProps> = ({
  iconType,
  elementReference,
  isHovered,
}: IconControllerProps) => {
  const elementsReferenceRect = elementReference.getBoundingClientRect();

  const iconPadding: number = 8;

  return (
    <div
      style={{
        display: 'flex',
        position: 'absolute',
        bottom: `${-elementsReferenceRect.height + iconPadding}px`,
        right: `${-elementsReferenceRect.width + iconPadding}px`,
      }}
    >
      {iconType == 'loading' && <LoadingIcon />}
      {iconType == 'active' && <ActiveIcon />}
      {iconType == 'passive' && isHovered && <PassiveIcon />}
    </div>
  );
};

export default IconController;
