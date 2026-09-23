/**
 * Types for mockApi.js, so the TypeScript unit tests (packages/editor) can use
 * the same canned API as the Playwright suite.
 */
import type {BrowserContext} from '@playwright/test';

export const SAMPLE_TEXT: string;
export const ALERTS: Record<string, unknown>[];
export const CATEGORIES: {
  groups: {key: string; label: string}[];
  categories: {
    key: string;
    label: string;
    parent: string;
    advanced_key: string | null;
    proficiency_level: string;
  }[];
};
export const CONFIG_OPTIONS: Record<string, unknown>;
export function authResponse(): Record<string, unknown>;
export function checkResponse(text: string): {
  results: Record<string, unknown>[];
  language: string;
} & Record<string, unknown>;
export function mockApiResponse(
  pathname: string,
  requestBody?: string
): Record<string, unknown> | null;
export function mockNlpApi(context: BrowserContext): Promise<void>;
export function blockExternalRequests(
  context: BrowserContext,
  allowedHosts?: string[]
): Promise<void>;
