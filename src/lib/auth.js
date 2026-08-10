/**
 * Authentication utilities.
 *
 * createBearerToken was extracted from src/cli/index.js so it can be used
 * without importing the 4,000-line interactive layer.
 *
 * @module auth
 */

import { AuthenticationError } from './errors.js';
import colorizer from '../utils/colorizer.js';

/**
 * Generate a bearer token using API credentials.
 *
 * @param {string} keyId - API key ID
 * @param {string} keySecret - API key secret
 * @param {string} apiUrl - API URL (e.g. https://api.glia.com)
 * @param {string} [siteId] - Site ID to validate token access against
 * @returns {Promise<Object>} `{ token, expiresAt, suggestedSiteId?, availableSites? }`
 */
export async function createBearerToken(keyId, keySecret, apiUrl, siteId) {
  if (!keyId || !keySecret) {
    throw new AuthenticationError('API key ID and secret are required');
  }

  console.log(colorizer.blue(`Requesting token from ${apiUrl}/operator_authentication/tokens...`));

  const response = await fetch(`${apiUrl}/operator_authentication/tokens`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/vnd.salemove.v1+json'
    },
    body: JSON.stringify({
      api_key_id: keyId,
      api_key_secret: keySecret
    })
  });

  if (!response.ok) {
    throw new AuthenticationError(
      `Authentication failed (${response.status}): ${response.statusText}`
    );
  }

  const data = await response.json();

  // Glia tokens expire after 1 hour. Default to 55 minutes for a safety margin.
  const expiresInMs = data.expires_in ? data.expires_in * 1000 : 55 * 60 * 1000;
  const tokenInfo = {
    token: data.token,
    expiresAt: Date.now() + expiresInMs
  };

  // When a site ID is provided, verify the token has access so the caller
  // discovers a permission problem immediately rather than on the first real
  // request.
  if (siteId) {
    await _validateSiteAccess(tokenInfo, apiUrl, siteId);
  }

  return tokenInfo;
}

/**
 * Check whether a token has access to a specific site, and discover
 * alternatives when it does not.
 *
 * @private
 * @param {Object} tokenInfo - Token object to annotate
 * @param {string} apiUrl - API URL
 * @param {string} siteId - Site ID to check
 */
async function _validateSiteAccess(tokenInfo, apiUrl, siteId) {
  try {
    console.log(colorizer.blue(`Validating token has access to site ${siteId}...`));

    const siteResponse = await fetch(`${apiUrl}/sites/${siteId}`, {
      headers: {
        'Authorization': `Bearer ${tokenInfo.token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.salemove.v1+json'
      }
    });

    if (siteResponse.ok) {
      console.log(colorizer.green(`✓ Token has confirmed access to site ${siteId}`));
      return;
    }

    console.log(colorizer.yellow(
      `Warning: Token was generated but does not have access to site ${siteId}`
    ));

    if (siteResponse.status !== 403) return;

    // Look for sites the key does have access to.
    const sitesResponse = await fetch(`${apiUrl}/sites`, {
      headers: {
        'Authorization': `Bearer ${tokenInfo.token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.salemove.v1+json'
      }
    });

    if (!sitesResponse.ok) return;

    const sitesData = await sitesResponse.json();
    const sites = sitesData.sites || [];

    if (sites.length === 0) {
      console.log(colorizer.yellow('This token does not have access to any sites.'));
      return;
    }

    console.log(colorizer.green(`Found ${sites.length} accessible site(s).`));
    sites.slice(0, 3).forEach(site => {
      console.log(colorizer.green(`- ${site.id}: ${site.name || '[No name]'}`));
    });
    if (sites.length > 3) {
      console.log(colorizer.green(`  and ${sites.length - 3} more...`));
    }

    tokenInfo.availableSites = sites;

    if (sites.length === 1) {
      tokenInfo.suggestedSiteId = sites[0].id;
      console.log(colorizer.blue(`Suggest using site ID: ${sites[0].id}`));
    }
  } catch (error) {
    console.log(colorizer.yellow(
      `Warning: Could not validate token access to site: ${error.message}`
    ));
  }
}
