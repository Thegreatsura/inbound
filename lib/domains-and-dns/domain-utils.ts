/**
 * Domain parsing and utility functions
 * Handles root domain extraction and subdomain detection
 */

/**
 * Get the root domain from a domain string
 * Always returns the last two parts (TLD + domain)
 * 
 * @example
 * getRootDomain('mail.example.com') // 'example.com'
 * getRootDomain('docs.app.example.com') // 'example.com' (NOT 'app.example.com')
 * getRootDomain('app.example.com') // 'example.com'
 * getRootDomain('example.com') // 'example.com'
 */
export function getRootDomain(domain: string): string | null {
  const parts = domain.split('.')
  if (parts.length < 2) return null
  
  // Return last two parts as root domain
  // mail.example.com → example.com
  // docs.app.example.com → example.com (NOT app.example.com)
  // app.example.com → example.com
  return parts.slice(-2).join('.')
}

/**
 * Check if a domain is a root domain (exactly 2 parts)
 * 
 * @example
 * isRootDomain('example.com') // true
 * isRootDomain('mail.example.com') // false
 */
export function isRootDomain(domain: string): boolean {
  const parts = domain.split('.')
  return parts.length === 2 // example.com = true, mail.example.com = false
}

/**
 * Check if a domain is a subdomain (more than 2 parts)
 * 
 * @example
 * isSubdomain('mail.example.com') // true
 * isSubdomain('docs.app.example.com') // true
 * isSubdomain('example.com') // false
 */
export function isSubdomain(domain: string): boolean {
  const parts = domain.split('.')
  return parts.length > 2
}

