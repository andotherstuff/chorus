// ABOUTME: Debug utility to replace console.log statements throughout the codebase
// ABOUTME: Provides conditional logging that only runs in development mode

// Debug flags - set to true to enable specific debugging
export const DEBUG_IMAGES = false; // Set to true to enable image debugging
export const DEBUG_NIP29_VALIDATION = false; // Set to true to see NIP-29 validation details
export const DEBUG_GROUP_CACHE = false; // Set to true to see cache operations

// Environment detection
export const isDevelopment = import.meta.env.MODE === 'development';

/**
 * Development-only console.log replacement
 * Only logs in development mode, prevents console pollution in production
 */
export function log(...args: unknown[]): void {
  if (isDevelopment) {
    console.log(...args);
  }
}

/**
 * Development-only console.error replacement
 * Only logs in development mode, prevents console pollution in production
 */
export function error(...args: unknown[]): void {
  if (isDevelopment) {
    console.error(...args);
  }
}

/**
 * Development-only console.warn replacement
 * Only logs in development mode, prevents console pollution in production
 */
export function warn(...args: unknown[]): void {
  if (isDevelopment) {
    console.warn(...args);
  }
}

/**
 * Development-only console.info replacement
 * Only logs in development mode, prevents console pollution in production
 */
export function info(...args: unknown[]): void {
  if (isDevelopment) {
    console.info(...args);
  }
}

/**
 * Always logs regardless of environment (for critical errors that need to be seen)
 * Use sparingly and only for errors that users/operators need to see
 */
export function logAlways(...args: unknown[]): void {
  console.log(...args);
}

/**
 * Always logs errors regardless of environment
 * Use for critical errors that need to be visible in production
 */
export function errorAlways(...args: unknown[]): void {
  console.error(...args);
}