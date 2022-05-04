import {
  ICheckResponse,
  ICheckResponseResult,
  IAuthResponse,
  ConfigProperty,
} from '../types';
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
            type: 'integer',
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

export const checkResponseOrgConfigSchema: JSONSchemaType<IAuthResponse> = {
  title: 'checkResponseOrgConfig',
  type: 'object',
  properties: {
    config: {
      description: 'Defines the configuration',
      type: 'object',
      properties: {
        gendered_roles_format: checkResponseOrgConfigPropertySchema,
        german_gender_ending: checkResponseOrgConfigPropertySchema,
        inclusive: checkResponseOrgConfigPropertySchema,
        maximum_importance: checkResponseOrgConfigPropertySchema,
        orthography: checkResponseOrgConfigPropertySchema,
        preferred_variants: checkResponseOrgConfigPropertySchema,
        show_inspiration_alternatives: checkResponseOrgConfigPropertySchema,
        singular_they: checkResponseOrgConfigPropertySchema,
        store_context: checkResponseOrgConfigPropertySchema,
        style: checkResponseOrgConfigPropertySchema,
      },
      required: [
        'gendered_roles_format',
        'german_gender_ending',
        'inclusive',
        'maximum_importance',
        'orthography',
        'preferred_variants',
        'show_inspiration_alternatives',
        'singular_they',
        'store_context',
        'style',
      ],
    },
    id: {
      type: 'string',
    },
    name: {
      type: 'string',
    },
    plan: {
      type: 'string',
    },
  },
  required: ['config', 'id', 'name', 'plan'],
};

export const checkResponseResultSchema: JSONSchemaType<ICheckResponseResult> = {
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
    organization_config: checkResponseOrgConfigSchema,
    language: {
      description: 'language used by the user',
      type: 'string',
    },
  },
  required: ['results', 'language'],
};
