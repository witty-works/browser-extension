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
  isOpen: boolean;
  data: ModalData;
}

const Popup: React.FC<PopupProps> = ({ element, isOpen, data }: PopupProps) => {
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

  const { x, y, reference, floating, strategy } = useFloating({
    placement: 'bottom-start',
    middleware: [elementCords(data), flip(), offset(4), shift()],
  });

  useEffect(() => reference(element), [reference]);

  useEffect(() => {
    console.log('data: ', data);
  }, [data]);

  // useEffect(() => {
  //   if (!refs.reference.current) {
  //     return;
  //   }

  //   refs.reference.current.addEventListener('click', update);

  //   return () => {
  //     refs.reference.current.removeEventListener('click', update);
  //   };
  // }, [refs.reference, update]);

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

  return isOpen ? (
    <div id='popup' ref={floating} style={PopupStyling}>
      This is the popup
    </div>
  ) : null;
};

export default Popup;
