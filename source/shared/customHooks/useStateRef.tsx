import React from 'react';

export const useStateRef = <T,>(defaultValue: T) => {
  const [state, setState] = React.useState<T>(defaultValue);
  const ref = React.useRef(state);

  const dispatch = React.useCallback(function (val: T) {
    ref.current = typeof val === 'function' ? val(ref.current) : val;

    setState(ref.current);
  }, []);

  return [state, dispatch, ref] as const;
};
