import { useState, useEffect } from 'react';

const DEFAULT_OPTIONS = { attributes: true, childList: true, subtree: true };

export const useMutationObserver = (
  element: HTMLElement,
  mutationListener: (mutationlist: MutationRecord[]) => void,
  config: MutationObserverInit = DEFAULT_OPTIONS
) => {
  const [mutationObserver] = useState(new MutationObserver(mutationListener));

  useEffect(() => {
    mutationObserver.disconnect();
    mutationObserver.observe(element, config);
    return () => {
      mutationObserver.disconnect();
    };
  }, [element]);
};
