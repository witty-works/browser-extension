import { useEffect, useMemo, useState } from 'react';
import useApiResults from './useApiResults';
import { getAnalyzedTextResults } from './requests';
import { IRequest } from '../types';
import { JSONSchemaType } from 'ajv';

export const useCheckEndpoint = () => {
  interface ICheckResponseResult {
    text: string;
    context: string;
    category: string;
    subcategory: string;
    start: number;
    end: number;
    alternatives: string[];
    label: string;
    reason: string;
    solution: string;
  }

  const checkResponseResultSchema: JSONSchemaType<ICheckResponseResult> = {
    title: 'checkResponseResult',
    type: 'object',
    properties: {
      text: {
        description: 'the problematic word',
        type: 'string',
      },
      context: {
        description: 'the context of the problematic word',
        type: 'string',
      },
      category: {
        description: 'the category of the problematic word',
        type: 'string',
      },
      subcategory: {
        description: 'the subcategory of the problematic word',
        type: 'string',
      },
      start: {
        description: 'the start index of the problematic word',
        type: 'integer',
      },
      end: {
        description: 'the end index of the problematic word',
        type: 'integer',
      },
      alternatives: {
        description:
          'the list of alternative words to replace the problematic word',
        type: 'array',
        items: {
          type: 'string',
        },
      },
      label: {
        description: 'the label of the problematic word',
        type: 'string',
      },
      reason: {
        description: 'the reason why the word is problematic',
        type: 'string',
      },
      solution: {
        description: 'How the problematic word can be eliminated',
        type: 'string',
      },
    },
    required: [
      'text',
      'context',
      'category',
      'subcategory',
      'start',
      'end',
      'alternatives',
      'label',
      'reason',
      'solution',
    ],
  };

  interface ICheckResponse {
    results: ICheckResponseResult[];
    language: string;
  }

  const checkResponseSchema: JSONSchemaType<ICheckResponse> = {
    title: 'checkResponse',
    description: 'response from the /check NLP API endpoint',
    type: 'object',
    properties: {
      results: {
        description: 'contains information about each problematic word',
        type: 'array',
        items: checkResponseResultSchema,
      },
      language: {
        description: 'language used by the user',
        type: 'string',
      },
    },
    required: ['results', 'language'],
  };

  const [textToAnalyze, setTextToAnalyse] = useState<string>('');

  useEffect(() => {
    return () => {
      setTextToAnalyse('');
    };
  }, []);

  const request: IRequest = useMemo(() => {
      return getAnalyzedTextResults(textToAnalyze)
    },
    [textToAnalyze]
  );

  const [loading, checkResponse, errorResponse] = useApiResults<ICheckResponse>(
    request,
    checkResponseSchema
  );

  return [loading, checkResponse, errorResponse, setTextToAnalyse] as const;
};
