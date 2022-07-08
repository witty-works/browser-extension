import * as Sentry from '@sentry/react';

const sendErrorToSentry = (error: unknown) => {
  Sentry.captureException(error);
  //It's possible to capture a message with Sentry.captureMessage
  //but then you don't receive all the data send with Sentry.captureException
  // Sentry.captureMessage(
  //   '[Highlights] Something went wrong setting the range'
  // );
};

export { sendErrorToSentry };
