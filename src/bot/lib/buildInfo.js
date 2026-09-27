// Static build / runtime metadata, read once at startup. Used by the !version
// and !about commands and kept in step with what /health reports on the web.
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const pkg = require('../../../package.json');

export const REPO_URL = 'https://github.com/Ferdinand99/Sylo-Fluxer';

/** @type {{ version: string, fluxerJs: string, node: string }} */
export const BUILD = Object.freeze({
  version: pkg.version,
  // The SDK is pinned to an exact version in package.json (it doesn't export its own).
  fluxerJs: pkg.dependencies['@fluxerjs/core'],
  node: process.versions.node,
});
