// CORS proxy configuration for Cashu mints
// This allows the app to work with mints that don't have proper CORS headers

// List of known CORS proxies (in order of preference)
const CORS_PROXIES = [
  'https://corsproxy.io/?',
  'https://api.allorigins.win/raw?url=',
  'https://cors-anywhere.herokuapp.com/',
];

// List of mints known to have CORS issues
const CORS_PROBLEM_MINTS = [
  'https://testnut.cashu.space',
  'https://mint.minibits.cash',
];

/**
 * Check if a mint URL is known to have CORS issues
 */
export function hasCorsIssues(mintUrl: string): boolean {
  return CORS_PROBLEM_MINTS.some(mint => mintUrl.includes(mint));
}

/**
 * Get a CORS-friendly URL for a mint
 */
export function getCorsProxyUrl(mintUrl: string, proxyIndex = 0): string {
  if (!hasCorsIssues(mintUrl) || proxyIndex >= CORS_PROXIES.length) {
    return mintUrl;
  }
  
  const proxy = CORS_PROXIES[proxyIndex];
  return `${proxy}${encodeURIComponent(mintUrl)}`;
}

/**
 * Try to fetch with CORS proxy fallback
 */
export async function fetchWithCorsFailback(url: string): Promise<Response> {
  // First try direct request
  try {
    const response = await fetch(url);
    if (response.ok) return response;
  } catch (error) {
    console.log('Direct request failed, trying CORS proxy...');
  }

  // Try with CORS proxies
  for (let i = 0; i < CORS_PROXIES.length; i++) {
    try {
      const proxyUrl = getCorsProxyUrl(url, i);
      const response = await fetch(proxyUrl);
      if (response.ok) {
        console.log(`Successfully used CORS proxy: ${CORS_PROXIES[i]}`);
        return response;
      }
    } catch (error) {
      continue;
    }
  }

  throw new Error('All CORS proxy attempts failed');
}

/**
 * Create a CORS-friendly CashuMint instance
 */
export function createCorsFriendlyMint(mintUrl: string): null {
  // This would require modifying the CashuMint class to use our fetch wrapper
  // For now, we'll just document this as a future enhancement
  console.warn('CORS-friendly mint creation not yet implemented');
  return null;
}