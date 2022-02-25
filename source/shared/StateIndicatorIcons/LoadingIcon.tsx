import React, { useEffect, useState } from 'react';
import { animated, useTransition } from 'react-spring';

import LoadingIconFrameOne from '../../assets/icons/wittyStateIndicator/loadingFrames/frame_1.svg';
import LoadingIconFrameTwo from '../../assets/icons/wittyStateIndicator/loadingFrames/frame_2.svg';
import LoadingIconFrameThree from '../../assets/icons/wittyStateIndicator/loadingFrames/frame_3.svg';
import LoadingIconFrameFour from '../../assets/icons/wittyStateIndicator/loadingFrames/frame_4.svg';
import LoadingIconFrameFive from '../../assets/icons/wittyStateIndicator/loadingFrames/frame_5.svg';
import LoadingIconFrameSix from '../../assets/icons/wittyStateIndicator/loadingFrames/frame_6.svg';
import LoadingIconFrameSeven from '../../assets/icons/wittyStateIndicator/loadingFrames/frame_7.svg';
import LoadingIconFrameEight from '../../assets/icons/wittyStateIndicator/loadingFrames/frame_8.svg';

const LoadingIcon: React.FC = () => {
  const framesCollection = [
    <LoadingIconFrameOne />,
    <LoadingIconFrameTwo />,
    <LoadingIconFrameThree />,
    <LoadingIconFrameFour />,
    <LoadingIconFrameFive />,
    <LoadingIconFrameSix />,
    <LoadingIconFrameSeven />,
    <LoadingIconFrameEight />,
  ];

  const [loop, setLoop] = useState(true);
  const [mounted, setMounted] = useState(true);

  useEffect(() => {
    return () => {
      setMounted(false);
    };
  }, []);

  const transition = useTransition(framesCollection, {
    loop: loop,
    from: { opacity: 0 },
    enter: { opacity: 1 },
    trail: 100,
    config: {
      duration: 1500,
    },
    onRest: () => mounted && setLoop(!loop),
  });

  const fragment = transition((style, frame) => (
    <animated.div style={{ ...style, gridRowStart: 1, gridColumnStart: 1 }}>
      {frame}
    </animated.div>
  ));

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr' }}>
      {fragment}
    </div>
  );
};

export default LoadingIcon;
