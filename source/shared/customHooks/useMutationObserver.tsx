import { useEffect, useState } from 'react';

const DEFAULT_OPTIONS = {
  config: { attributes: true, childList: true, subtree: true },
};

export const useMutationObserver = (
  targetElement: HTMLElement,
  callback: ([]) => void,
  options = DEFAULT_OPTIONS
) => {
  const [observer, setObserver] = useState<MutationObserver>();

  useEffect(() => {
    const obs = new MutationObserver(callback);
    setObserver(obs);
  }, [callback, options, setObserver]);

  useEffect(() => {
    if (!observer) return;
    const { config } = options;
    observer.observe(targetElement, config);
    return () => {
      if (observer) {
        observer.disconnect();
      }
    };
  }, [observer, targetElement, options]);
};
