import { useMemo, useState } from 'react';
import useApiResults from './useApiResults';
import { getAnalyzedTextResults } from './requests';
import { ICheckResponse, ICheckResponseResult, IRequest } from '../types';
import { JSONSchemaType } from 'ajv';

export const useCheckEndpoint = () => {
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
          title: 'alternative',
          type: 'object',
          properties: {
            text: {
              description: 'the alternative word',
              type: 'string',
            },
            remove: {
              description: 'whether the alternative word should be removed',
              type: 'boolean',
            },
            inspiration: {
              description: 'the inspiration of the alternative word',
              type: 'boolean',
            },
            context: {
              description: 'the context of the alternative word',
              type: 'string',
            },
          },
          required: [],
        },
      },
      label: {
        description: 'the label of the problematic word',
        type: 'string',
      },
      explanation: {
        description: 'the explanation of the problematic word',
        type: 'object',
        properties: {
          text: {
            description: 'the explanation text',
            type: 'string',
          },
          icon: {
            description: 'the icon for the explanation',
            type: 'string',
          },
          url: {
            description: 'the url to the explanation',
            type: 'string',
          },
        },
        required: ['text'],
      },
      gravity: {
        description: 'the gravity of the problematic word',
        type: 'number',
      },
    },
    required: [
      'text',
      'category',
      'subcategory',
      'start',
      'end',
      'alternatives',
      'label',
      'explanation',
    ],
  };

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

  const request: IRequest = useMemo(() => {
    return getAnalyzedTextResults(textToAnalyze);
  }, [textToAnalyze]);

  const [checkResponse, errorResponse] = useApiResults<ICheckResponse>(
    request,
    checkResponseSchema
  );

  return [checkResponse, errorResponse, setTextToAnalyse] as const;
};
