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
  const iconPadding: number = 8;

  const textareaStyle = {
    display: 'flex',
    position: 'absolute',
    top: `${elementRect.height + correctedPosition.top - 21 - iconPadding}px`,
    left: `${elementRect.width + correctedPosition.left - 25 - iconPadding}px`,
  };

  const contenteditableStyle = {
    position: 'fixed',
    top: `${elementRect.bottom - elementRect.top + 21 + iconPadding}px`,
    right: `${window.innerWidth - elementRect.right + iconPadding}px`,
  };

  return (
    <div
      ref={ref}
      style={
        element.tagName === 'TEXTAREA'
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
