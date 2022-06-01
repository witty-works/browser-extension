import React from 'react';
import './Toast.scss';

const Toast: React.FC<{ message: string; type: string }> = ({
  message,
  type,
}) => {
  return (
    <div className={`witty-toast ${type}`}>
      <div className='witty-toast-title'>Ouch! Something went wrong!</div>
      <div className='witty-toast-message'>{message}</div>
    </div>
  );
};

export default Toast;
