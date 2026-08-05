import React from 'react';
import {animated, useSpring} from '@react-spring/web';

import ArrowIcon from '../../assets/icons/popover/arrow.svg';

interface ArrowProps {
  play: boolean;
}
const Arrow: React.FC<ArrowProps> = ({play}: ArrowProps) => {
  const springStyles = useSpring({
    from: {x: 0},
    to: {x: play ? 5 : 0},
  });

  return (
    <animated.div
      style={{
        marginLeft: '0.5em',
        ...springStyles,
      }}
    >
      <ArrowIcon />
    </animated.div>
  );
};

export default Arrow;
