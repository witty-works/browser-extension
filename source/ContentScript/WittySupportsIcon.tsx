import React from 'react';
import { browser } from 'webextension-polyfill-ts';

import { CustomInputElement } from '../shared/types';

interface WittySupportsIconProps {
  iconType: string;
  elementReference: CustomInputElement;
}

const WittySupportIcon: React.FC<WittySupportsIconProps> = ({
  iconType,
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
      src={browser.runtime.getURL(`../../../assets/icons/wittyStateIndicator/witty-${iconType}.svg`)}
    />
  );
};

export default WittySupportIcon;
