import React from 'react';
import { browser } from 'webextension-polyfill-ts';

import { CustomInputElement } from '../shared/types';

interface WittySupportsIconProps {
  active: boolean;
  elementReference: CustomInputElement;
}

const WittySupportIcon: React.FC<WittySupportsIconProps> = ({
  active,
  elementReference,
}: WittySupportsIconProps) => {
  const elementsReferenceRect = elementReference.getBoundingClientRect();

  return (
    <img
      style={{
        zIndex: 9999999, //needed for linkedin
        position: 'fixed',
        top: `${elementsReferenceRect.bottom - 30}px`,
        left: `${elementsReferenceRect.right - 35}px`,
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
