/**
 * Whether the sign-out the popup is about to show was started from the popup
 * itself. Only then does focus move to the sign-in button: the sign-out
 * button the user pressed is gone. A sign-out from elsewhere (the options
 * page, a refused refresh) leaves focus where it was.
 */
let signingOutHere = false;

export const signOutStartedHere = (started: boolean): void => {
  signingOutHere = started;
};

/** Read once: true only for the sign-out the popup started. */
export const takeSignOutStartedHere = (): boolean => {
  const started = signingOutHere;
  signingOutHere = false;
  return started;
};
