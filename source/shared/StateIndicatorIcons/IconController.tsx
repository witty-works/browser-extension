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
        position: 'fixed',
        zIndex: 99999999,
        bottom: `${
          window.innerHeight - elementsReferenceRect.bottom + iconPadding
        }px`,
        right: `${
          window.innerWidth - elementsReferenceRect.right + iconPadding
        }px`,
      }}
      onMouseDown={(e) => {
        e.stopPropagation();
        e.preventDefault();
      }}
    >
      {iconType == 'loading' && <LoadingIcon />}
      {iconType == 'active' && <ActiveIcon />}
      {iconType == 'passive' && isHovered && <PassiveIcon />}
    </div>
  );
};

export default IconController;
