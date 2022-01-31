import React, { useEffect } from 'react';
import CSS from 'csstype';
import { useFloating, flip, offset, shift } from '@floating-ui/react-dom';

import { CustomInputElement } from '../shared/types';
import { IAlert } from '../shared/types';

export interface ModalData {
  alert: IAlert;
  position: DOMRect;
  node: HTMLElement;
  originalNode: HTMLTextAreaElement | HTMLInputElement | null;
}

interface PopupProps {
  element: CustomInputElement;
  data: ModalData;
  hide: () => void;
}

const Popup: React.FC<PopupProps> = ({ element, data, hide }: PopupProps) => {
  const doc = document.documentElement || document.body;

  const elementCords = (dat: ModalData) => ({
    name: 'elementCords',
    options: dat,
    fn: ({ x, y, placement, rects }: any) => {
      const calcNewX: number = dat.position.x;
      const calcNewY: number = placement.includes('bottom')
        ? dat.position.y + dat.position.height + doc.scrollTop
        : dat.position.y - rects.floating.height + doc.scrollTop;

      return {
        x: calcNewX,
        y: calcNewY,
      };
    },
  });

  const { x, y, reference, floating, strategy, refs } = useFloating({
    placement: 'bottom-start',
    middleware: [elementCords(data), flip(), offset(4), shift()],
  });

  useEffect(() => reference(element), [reference]);

  useEffect(() => {
    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [refs.floating.current]);

  const handleClickOutside = (event: Event) => {
    if (
      refs.floating.current &&
      !refs.floating.current.contains(event.target as HTMLElement)
    ) {
      console.log('You clicked outside of me!');
      hide();
    }
  };

  const PopupStyling: CSS.Properties = {
    display: 'block',
    background: '#222',
    color: 'white',
    position: strategy,
    top: `${y}px`,
    left: `${x}px`,
    zIndex: 999999,
    width: '800px',
    height: '300px',
  };

  return (
    <div id='popup' ref={floating} style={PopupStyling}>
      This is the popup
    </div>
  );
};

export default Popup;
