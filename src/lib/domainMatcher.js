/**
 * Domain Matcher Utility
 * Supports wildcard patterns like *.domain.com
 */
export class DomainMatcher {
  /**
   * Convert wildcard pattern to RegExp
   * @param {string} pattern - e.g., "*.google.com"
   * @returns {RegExp}
   */
  static patternToRegex(pattern) {
    // Remove http/https prefix if present
    pattern = pattern.replace(/^https?:\/\//, "");
    // Escape special regex characters, then convert * to regex .*
    const escaped = pattern
      .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
      .replace(/\*/g, ".*");
    return new RegExp(`^${escaped}$`, "i");
  }

  /**
   * Extract domain from URL
   * @param {string} url
   * @returns {string}
   */
  static extractDomain(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch {
      // If not a full URL, assume it's already a domain
      return url.replace(/^https?:\/\//, "").split("/")[0];
    }
  }

  /**
   * Check if URL is in whitelist
   * @param {string} url - URL to check
   * @param {string[]} patterns - Whitelist patterns array
   * @returns {boolean}
   */
  static isAllowed(url, patterns) {
    const domain = this.extractDomain(url);
    return patterns.some((pattern) => {
      const regex = this.patternToRegex(pattern);
      return regex.test(domain);
    });
  }

  /**
   * Validate domain pattern format
   * @param {string} pattern
   * @returns {boolean}
   */
  static isValidPattern(pattern) {
    // Allow: *.domain.com, domain.com, sub.domain.com
    const regex = /^(\*\.)?([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/;
    return regex.test(pattern);
  }

  /**
   * Normalize domain input (strip protocol, trailing slashes, etc.)
   * @param {string} input
   * @returns {string}
   */
  static normalizeDomain(input) {
    return input
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/\/.*$/, "");
  }
}
