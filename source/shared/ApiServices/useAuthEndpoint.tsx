import { useMemo, useState } from 'react';
import useApiResults from './useApiResults';
import { getConfiguration } from './requests';
import { IRequest, /* IOrganizationConfig, */ IAuthResponse } from '../types';
// import { JSONSchemaType } from 'ajv';

export const useAuthEndpoint = () => {
  // const authConfigSchema: JSONSchemaType<IOrganizationConfig> = {
  //   title: 'authConfig',
  //   type: 'object',
  //   properties: {
  //     primary_language: {
  //       description: 'main language used',
  //       type: 'string',
  //     },
  //     preferred_languages: {
  //       description: 'Preferred languages used',
  //       type: 'array',
  //       items: {
  //         title: 'preferred languages',
  //         type: 'string',
  //       },
  //     },
  //     preferred_variants: {
  //       description: 'Preferred languages variants',
  //       type: 'array',
  //       items: {
  //         title: 'preferred variants',
  //         type: 'string',
  //       },
  //     },
  //     german_gender_ending: {
  //       description: 'Preferred language ending',
  //       type: 'string',
  //     },
  //     gendered_roles_format: {
  //       description: 'Gendered roles format',
  //       type: 'string',
  //     },
  //     disabled_categories: {
  //       description: 'Disabled settings',
  //       type: 'array',
  //       items: {
  //         title: 'disabled categories',
  //         type: 'string',
  //       },
  //     },
  //     singular_they: {
  //       description: 'use of singular they',
  //       type: 'string',
  //     },
  //     show_inspiration_alternatives: {
  //       description: 'Show inspirations alternatives',
  //       type: 'boolean',
  //     },
  //     maximum_importance: {
  //       description: 'Level of maximum importance',
  //       type: 'number',
  //     },
  //   },
  //   required: [],
  // };

  // const authResponseSchema: JSONSchemaType<IAuthResponse> = {
  //   title: 'authResponse',
  //   description: 'response from the /auth NLP API endpoint',
  //   type: 'object',
  //   properties: {
  //     forced: authConfigSchema,
  //     suggestion: authConfigSchema,
  //     id: {
  //       description: 'teams ID',
  //       type: 'string',
  //     },
  //     name: {
  //       description: 'Name of the team',
  //       type: 'string',
  //     },
  //     plan: {
  //       description: 'Defined plan',
  //       type: 'string',
  //     },
  //     store_context: {
  //       description: 'Context is stored or not',
  //       type: 'boolean',
  //     },
  //   },
  //   required: [
  //     /* 'forced', 'suggestion', 'id', 'name', 'plan', 'store_context' */
  //   ],
  // };

  const [config, setConfig] = useState<boolean>();
  const getConfig = () => {
    console.log('auth getConfig');
    setConfig(true);
  };

  const request: IRequest = useMemo(() => {
    console.log('auth request');
    console.log('auth request config', config);
    return getConfiguration();
  }, [config]);

  const [authResponse, authErrorResponse] = useApiResults<IAuthResponse>(
    request,
    // authResponseSchema
    null
  );

  return [authResponse, authErrorResponse, getConfig] as const;
};
