import { ICheckResponse, ICheckResponseResult, ConfigProperty } from '../types';
import { JSONSchemaType } from 'ajv';

export const checkResponseOrgConfigPropertySchema: JSONSchemaType<ConfigProperty> =
  {
    type: 'object',
    properties: {
      value: {
        anyOf: [
          {
            type: 'string',
          },
          {
            type: 'array',
            items: {
              title: 'config type string[]',
              type: 'string',
            },
          },
          {
            type: 'boolean',
          },
          {
            type: 'number',
          },
        ],
      },
      status: {
        type: 'string',
        nullable: true,
      },
    },
    required: ['value'],
    additionalProperties: false,
  };

export const checkResponseResultSchema: JSONSchemaType<ICheckResponseResult> = {
  title: 'checkResponseResult',
  type: 'object',
  properties: {
    text: {
      description: 'the problematic word',
      type: 'string',
    },
    text_id: {
      description: 'the text_id of the problematic word',
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
            description: 'the alternative is an inspiration',
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
        context: {
          description: 'the context of the explanation',
          type: 'string',
        },
        content: {
          description: 'the content of the explanation, e.g. a video',
          type: 'string',
        },
      },
      required: ['text'],
    },
    gravity: {
      description: 'the gravity of the problematic word',
      type: 'number',
    },
    language: {
      description: 'the language of the problematic word',
      type: 'string',
    },
    limit_reached: {
      description: 'whether the limit of the free plan has been reached',
      type: 'boolean',
    },
  },
  required: ['text', 'start', 'end'],
};

export const checkResponseSchema: JSONSchemaType<ICheckResponse> = {
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
    limit_reached: {
      description: 'whether the limit of the free plan has been reached',
      type: 'boolean',
    },
    config_changed: {
      description: 'whether the config has changed',
      type: 'boolean',
    },
    notifications: {
      description: 'number of notifications from the dashboard',
      type: 'integer',
    },
  },
  required: ['results', 'language'],
};
