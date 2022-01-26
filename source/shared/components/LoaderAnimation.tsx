import React from 'react';

export interface LoaderAnimationProps {
  color?: string;
  label?: string;
  radius?: number;
}

const LoaderAnimation: React.FC<LoaderAnimationProps> = ({
  color = '#BCD485',
  radius = 16,
  label = 'loading',
}: LoaderAnimationProps) => (
  <svg
    width={radius * 2}
    height={radius * 2}
    xmlns='http://www.w3.org/2000/svg'
    aria-label={label}
  >
    <circle
      fill={color}
      cx='0'
      cy='0'
      r={radius}
      transform={`translate(${radius} ${radius})`}
    >
      <animateTransform
        attributeName='transform'
        type='scale'
        additive='sum'
        from='0 0'
        to='1 1'
        begin='0s'
        dur='1s'
        repeatCount='indefinite'
      />
      <animate
        id='opacityAnimation'
        attributeName='opacity'
        from='0'
        to='0.7'
        begin='0s'
        dur='1s'
        repeatCount='indefinite'
      />
    </circle>
  </svg>
);

export default LoaderAnimation;
