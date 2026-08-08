import React, {useEffect, useRef, useState} from 'react';

import {
  CustomInputElement,
  IAlternatives,
  IGetLLMSuggestionsRequest,
} from '../../shared/types';
import {useAnalytics} from '../../shared/ApiServices/useAnalytics';
import {useStateRef} from '../../shared/customHooks/useStateRef';
import {LLMAlternativesCacheValue} from '../../shared/ApiServices/useLLMAlternativesCache';
import type {PopoverData} from './HighlightPopover';

/**
 * Data and behavior of the highlight popover, separated from its rendering
 * (EDITOR_COMPONENT_PLAN.md, Phase 1 item 8): the state machine for
 * alternatives, ignore actions, navigation, and the learning-bite toggle. The
 * React view consumes this hook; positioning and DOM event wiring stay with
 * the view. Phase 2 exports this as the framework-facing surface of the
 * popover, with the remaining DOM touch points (container cleanup in
 * hidePopover) pushed out to the host.
 */
export interface PopoverViewModelDeps {
  element: CustomInputElement;
  data: PopoverData;
  prevData: PopoverData | null;
  hide: () => void;
  updateTextWithAlternative: (alternative: string) => void;
  addIgnoredTerm: (term: string) => void;
  movePopoverNextOrPrev: (direction: string) => void;
  setLLMSuggestionsRequest: (req: IGetLLMSuggestionsRequest) => void;
  getLLMSuggestions: (
    req: IGetLLMSuggestionsRequest
  ) => LLMAlternativesCacheValue | undefined;
  llmAlternativesEnabled: boolean;
  ignoreTermPermanently: (term: string) => Promise<void>;
  onAlternativeAccepted: () => void;
}

export const usePopoverViewModel = ({
  element,
  data,
  prevData,
  hide,
  updateTextWithAlternative,
  addIgnoredTerm,
  movePopoverNextOrPrev,
  setLLMSuggestionsRequest,
  getLLMSuggestions,
  llmAlternativesEnabled,
  ignoreTermPermanently,
  onAlternativeAccepted,
}: PopoverViewModelDeps) => {
  const analytics = useAnalytics();
  const [alternativeHovered, setAlternativeHovered] =
    useState<IAlternatives | null>(null);
  const [showLearningBite, setShowLearningBite, showLearningBiteRef] =
    useStateRef<boolean>(false);
  const [isLoading, setIsLoading] = useState<string>('');
  const [isSuccess, setIsSuccess] = useState<string>('');
  const [isFailure, setIsFailure] = useState<string>('');
  // Delayed auto-close after a successful permanent ignore.
  const hideTimeoutRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (hideTimeoutRef.current !== null) {
        clearTimeout(hideTimeoutRef.current);
      }
    },
    []
  );

  const llmAlternativesResponse = getLLMSuggestions({
    alert: data.alert,
  });

  useEffect(() => {
    if (prevData && prevData.alert.id === data.alert.id) {
      return;
    }
    analytics.popoverLogs(data.alert, 'popover_open');

    if (llmAlternativesEnabled && data.alert.data.alternatives.length > 0) {
      setLLMSuggestionsRequest({
        alert: data.alert,
      });
    }
  }, [data, llmAlternativesEnabled]);

  const hidePopover = (logClose = false) => {
    logClose && analytics.popoverLogs(data.alert, 'popover_close');
    setShowLearningBite(false);

    hide();
    //in case input is removed from the dom before popover is closed (clicking outside the element), also remove it here
    const popoverContainers =
      window.document.getElementsByTagName('ww-popover');
    Array.from(popoverContainers).forEach((popoverContainer) => {
      popoverContainer.remove();
    });
  };

  const clickAlternative = (
    e: MouseEvent | KeyboardEvent,
    alternative: string
  ) => {
    //Log the clicked alternative
    e.preventDefault();
    e.stopImmediatePropagation();
    analytics.alternativeLog(data.alert, alternative);
    // Accept counters and invite nags are host concerns, not popover UI.
    onAlternativeAccepted();
    updateTextWithAlternative(alternative);
  };

  /**
   * Keyboard counterpart of the pointer handlers on the alternative buttons.
   * Applying an alternative targets the focused element (`execCommand` and the
   * selection APIs), so focus is returned to the input before replacing.
   */
  const alternativeKeyDown =
    (alternative: string) => (e: React.KeyboardEvent) => {
      if (e.key !== 'Enter' && e.key !== ' ') {
        return;
      }
      (element as HTMLElement).focus?.();
      clickAlternative(e.nativeEvent, alternative);
    };

  const handleIgnoreClick = (ignoreType: string) => () => {
    analytics.ignoreLog(data.alert);
    if (ignoreType === 'ignore_once') {
      addIgnoredTerm(data.alert.data?.text);
      hidePopover();
    } else if (ignoreType === 'ignore_permanently') {
      setIsLoading(ignoreType);
      setIsSuccess('');
      setIsFailure('');

      ignoreTermPermanently(data.alert.data?.text)
        .then(() => {
          setIsLoading('');
          addIgnoredTerm(data.alert.data?.text);
          setIsSuccess(ignoreType);

          // Show the success check briefly, then close. This was previously a
          // browser.alarms call — an API that content scripts cannot use at
          // all, so the popover never auto-closed and the throw vanished into
          // the error reporter. A timeout is what was always meant.
          hideTimeoutRef.current = window.setTimeout(() => {
            hidePopover();
          }, 1000);
        })
        .catch(() => {
          setIsLoading('');
          setIsFailure(ignoreType);
        });
    }
  };

  /** Arrow-button navigation collapses the learning bite before moving. */
  const goToAdjacentAlert = (direction: 'previous' | 'next') => {
    movePopoverNextOrPrev(direction);
    setShowLearningBite(false);
  };

  return {
    analytics,
    alternativeHovered,
    setAlternativeHovered,
    showLearningBite,
    setShowLearningBite,
    showLearningBiteRef,
    isLoading,
    isSuccess,
    isFailure,
    llmAlternativesResponse,
    hidePopover,
    clickAlternative,
    alternativeKeyDown,
    handleIgnoreClick,
    goToAdjacentAlert,
  };
};
