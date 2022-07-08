import React, { useRef } from 'react';

import { CustomInputElement } from '../types';
import LoadingIcon from './LoadingIcon';
import ActiveIcon from '../../assets/icons/wittyStateIndicator/witty-active.svg';
import PassiveIcon from '../../assets/icons/wittyStateIndicator/witty-passive.svg';
import { usePositionCorrection } from '../../shared/customHooks/usePositionCorrection';

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

  const textareaStyle = {
    position: 'absolute',
    marginTop: '5px',
    left: `${elementRect.width + correctedPosition.left - 30}px`,
  };

  const contenteditableStyle = {
    position: 'fixed',
    marginTop: `10px`,
    marginRight: `10px`,
    right: `${window.innerWidth - elementRect.right}px`,
  };

  return (
    <div
      ref={ref}
      style={
        //twitter never has a scrollbar, so it can be treated as textarea
        element.tagName === 'TEXTAREA' || location.hostname == 'twitter.com'
          ? (textareaStyle as React.CSSProperties)
          : (contenteditableStyle as React.CSSProperties)
      }
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
