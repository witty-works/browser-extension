import React from 'react';
import { browser } from 'webextension-polyfill-ts';

// import { CustomInputElement } from '../shared/types';

interface WittySupportsIconProps {
  active: boolean;
  elementReference: HTMLElement;
}

const WittySupportIcon: React.FC<WittySupportsIconProps> = ({
  active,
  elementReference,
}: WittySupportsIconProps) => {
  const elementsReferenceRect = elementReference.getBoundingClientRect();
  const iconPadding: number = 8;

  return (
    <img
      style={{
        zIndex: 9999999, //needed for linkedin
        position: 'fixed',
        bottom: `${
          window.innerHeight - elementsReferenceRect.bottom + iconPadding
        }px`,
        right: `${
          window.innerWidth - elementsReferenceRect.right + iconPadding
        }px`,
      }}
      src={
        active
          ? browser.runtime.getURL(
              '../../../assets/icons/canvas/witty-active.svg'
            )
          : browser.runtime.getURL(
              '../../../assets/icons/canvas/witty-passive.svg'
            )
      }
    />
  );
};

export default WittySupportIcon;
