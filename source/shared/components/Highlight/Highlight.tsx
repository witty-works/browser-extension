import React, { useState } from 'react';
import CSS from 'csstype';

import { IHighlightData } from '../../types';
import Modal from '../Modal/Modal';

type HandleClick = () => void;

export interface HighlightProps {
  alertID: string;
  rect: DOMRect;
  data: IHighlightData;
}
const Highlight: React.FC<HighlightProps> = ({
  rect,
  data,
}: HighlightProps) => {
  console.log('data = ', data);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  // const toggle = () => setIsOpen(!isOpen);

  const HighlightStyling: CSS.Properties = {
    position: 'fixed',
    zIndex: 1,
    top: `${rect.top}px`,
    left: `${rect.left - 2}px`,
    width: `${rect.width + 6}px`,
    height: `${rect.height + 3}px`,
    backgroundColor: `rgba(88,0,208,.1)`,
    borderBottom: '3px solid rgb(88,0,208)',
    borderRadius: '2px',
    cursor: 'pointer',
  };

  const handleClick: HandleClick = () => {
    console.log('click! ', event);
    setIsOpen(!isOpen);
  };

  return (
    <div>
      <div style={HighlightStyling} onClick={handleClick}></div>
      <Modal
        isOpen={isOpen}
        highlightRect={rect}
        data={data}
        hide={handleClick}
      />
    </div>
  );
};

export default Highlight;
