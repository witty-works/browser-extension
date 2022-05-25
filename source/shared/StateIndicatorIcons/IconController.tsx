import React, { useRef } from 'react';

import { CustomInputElement } from '../types';
import LoadingIcon from './LoadingIcon';
import ActiveIcon from '../../assets/icons/wittyStateIndicator/witty-active.svg';
import PassiveIcon from '../../assets/icons/wittyStateIndicator/witty-passive.svg';

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

  const elementRect = element.getBoundingClientRect();
  const iconPadding: number = 8;

  //TODO This function is repeated in several components, move it to DOMUtils file
  const calculatePositionCorrection = () => {
    const elementRect: DOMRect = element.getBoundingClientRect();

    return ref.current.parentElement
      ? {
          top:
            elementRect.top -
            ref.current.parentElement.getBoundingClientRect().top,
          left:
            elementRect.left -
            ref.current.parentElement.getBoundingClientRect().left,
        }
      : {
          top: elementRect.top,
          left: elementRect.left,
        };
  };

  return (
    <div
      ref={ref}
      style={{
        display: 'flex',
        position: 'absolute',
        //TODO don't hardcode icons width & height
        top: `${
          elementRect.height +
          calculatePositionCorrection().top -
          21 -
          iconPadding
        }px`,
        left: `${
          elementRect.width +
          calculatePositionCorrection().left -
          25 -
          iconPadding
        }px`,
      }}
    >
      {iconType == 'loading' && <LoadingIcon />}
      {iconType == 'active' && <ActiveIcon />}
      {iconType == 'passive' && isHovered && <PassiveIcon />}
    </div>
  );
};

export default IconController;
