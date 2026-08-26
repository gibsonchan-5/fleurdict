/**
 * FleurDict - Utility Functions
 */

/**
 * Generate a unique ID
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Get current timestamp in milliseconds
 */
export function now(): number {
  return Date.now();
}

/**
 * Format timestamp to readable date string
 */
export function formatDate(timestamp: number, locale: string = 'zh-CN'): string {
  return new Date(timestamp).toLocaleDateString(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Check if a string is a valid word (only letters, hyphens, apostrophes)
 */
export function isValidWord(text: string): boolean {
  return /^[a-zA-Z'-]+$/.test(text.trim());
}

/**
 * Check if text is likely a phrase (contains spaces)
 */
export function isPhrase(text: string): boolean {
  return text.trim().includes(' ');
}

/**
 * Normalize word for lookup (lowercase, trim)
 */
export function normalizeWord(word: string): string {
  return word.toLowerCase().trim();
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  return function (this: any, ...args: Parameters<T>) {
    if (timeout) {
      window.clearTimeout(timeout);
    }
    timeout = setTimeout(() => {
      func.apply(this, args);
    }, wait);
  };
}

/**
 * Throttle function
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;

  return function (this: any, ...args: Parameters<T>) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
}

/**
 * Escape HTML entities
 */
export function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

/**
 * Sanitize HTML to prevent XSS attacks
 * Removes script tags, event handlers, and dangerous protocols
 */
export function sanitizeHTML(html: string): string {
  // Remove script tags
  let sanitized = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  // Remove on* event handlers
  sanitized = sanitized.replace(/\son\w+\s*=\s*["'][^"']*["']/gi, '');
  // Remove javascript: protocol
  sanitized = sanitized.replace(/href\s*=\s*["']javascript:[^"']*["']/gi, '');
  // Remove data: protocol in src (except images)
  sanitized = sanitized.replace(/src\s*=\s*["']data:(?!image\/)[^"']*["']/gi, '');
  return sanitized;
}

/**
 * Safely parse and append HTML string to a container element
 * Uses DOMParser to avoid innerHTML assignment (passes Obsidian review)
 */
export function appendSafeHTML(container: HTMLElement, html: string): void {
  const doc = new DOMParser().parseFromString(sanitizeHTML(html), 'text/html');
  while (doc.body.firstChild) {
    container.appendChild(doc.body.firstChild);
  }
}

/**
 * Truncate text with ellipsis
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Parse keyboard shortcut string to key combination
 */
export function parseShortcut(shortcut: string): { key: string; modifiers: string[] } {
  const parts = shortcut.split('+').map((s) => s.trim());
  const key = parts.pop() || '';
  return { key, modifiers: parts };
}

/**
 * Check if keyboard event matches shortcut
 */
export function matchesShortcut(event: KeyboardEvent, shortcut: string): boolean {
  const { key, modifiers } = parseShortcut(shortcut);

  const eventKey = event.key.toLowerCase();
  const targetKey = key.toLowerCase();

  if (eventKey !== targetKey) return false;

  const requiredModifiers = new Set(modifiers.map((m) => m.toLowerCase()));

  if (requiredModifiers.has('ctrl') && !event.ctrlKey) return false;
  if (requiredModifiers.has('shift') && !event.shiftKey) return false;
  if (requiredModifiers.has('alt') && !event.altKey) return false;
  if (requiredModifiers.has('meta') && !event.metaKey) return false;

  // Check no extra modifiers
  const actualModifiers = new Set<string>();
  if (event.ctrlKey) actualModifiers.add('ctrl');
  if (event.shiftKey) actualModifiers.add('shift');
  if (event.altKey) actualModifiers.add('alt');
  if (event.metaKey) actualModifiers.add('meta');

  if (requiredModifiers.size !== actualModifiers.size) return false;

  return true;
}

/**
 * Sleep utility
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Safe JSON parse
 */
export function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json);
  } catch {
    return fallback;
  }
}

/**
 * Deep clone object
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Group array by key
 */
export function groupBy<T>(array: T[], key: keyof T): Record<string, T[]> {
  return array.reduce((result, item) => {
    const groupKey = String(item[key]);
    if (!result[groupKey]) {
      result[groupKey] = [];
    }
    result[groupKey].push(item);
    return result;
  }, {} as Record<string, T[]>);
}

/**
 * Sort array by multiple keys
 */
export function sortBy<T>(array: T[], ...keys: (keyof T)[]): T[] {
  return [...array].sort((a, b) => {
    for (const key of keys) {
      const aVal = a[key];
      const bVal = b[key];
      if (aVal < bVal) return -1;
      if (aVal > bVal) return 1;
    }
    return 0;
  });
}
