// src/buildStamp.ts
// Build stamp containing branch@short-hash, timestamp, and mode

declare const __BUILD_STAMP__: string;

export const BUILD_STAMP: string =
  typeof __BUILD_STAMP__ !== 'undefined'
    ? __BUILD_STAMP__
    : `main@ca97ff0 | ${new Date().toISOString().replace('T', ' ').substring(0, 19)} UTC | dev`;
