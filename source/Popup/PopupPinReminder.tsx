import React from 'react';
import '../i18n/i18n';
import './styles.scss';
import { storeInLocalStorage } from '../shared/utils';
import { StorageKeys } from '../shared/constants';

const PopupPinReminder: React.FC = () => {
  return (
    <>
      {/* <PopupHeader /> */}
      <div className='section'>
        <div>Remember to pin witty!</div>
        <div>SOME IMG HERE</div>
      </div>
      <footer>
        <div
          className='enable-witty'
          onClick={() => {
            storeInLocalStorage(StorageKeys.IS_PINNED, true);
          }}
        >
          DONE!
        </div>
      </footer>
    </>
  );
};

export default PopupPinReminder;
