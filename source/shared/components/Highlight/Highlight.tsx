import React, { useState } from 'react';
import CSS from 'csstype';

import { IAlertContentData } from '../../types';
import Modal from '../Modal/Modal';

type HandleClick = () => void;

export interface HighlightProps {
  alertID: string;
  rect: DOMRect;
  data: IAlertContentData;
}
const Highlight: React.FC<HighlightProps> = ({
  rect,
  data,
}: HighlightProps) => {
  console.log('data = ', data);
  const [isOpen, setIsOpen] = useState<boolean>(false);

  const HighlightStyling: CSS.Properties = {
    position: 'fixed',
    zIndex: 1,
    top: `${rect.top}px`,
    left: `${rect.left + 2}px`,
    width: `${rect.width}px`,
    height: `${rect.height + 1}px`,
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
