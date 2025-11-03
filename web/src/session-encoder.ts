// Session encoder/decoder for shareable command links
// Uses compression to make URLs shorter

export class SessionEncoder {
  /**
   * Encode and compress commands array to a shareable string
   */
  static encode(commands: string[]): string {
    if (commands.length === 0) {
      return '';
    }
    
    // Convert commands array to JSON string
    const json = JSON.stringify(commands);
    
    // Compress using simple encoding (base64 + URL-safe encoding)
    // For better compression, we could use a library, but for now we'll use a simple approach
    const compressed = this.compressString(json);
    
    // URL-safe base64 encoding
    return btoa(compressed)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  /**
   * Decode and decompress shareable string back to commands array
   */
  static decode(encoded: string): string[] {
    if (!encoded || encoded.length === 0) {
      return [];
    }
    
    try {
      // URL-safe base64 decoding
      const base64 = encoded
        .replace(/-/g, '+')
        .replace(/_/g, '/');
      
      // Add padding if needed
      const padding = (4 - (base64.length % 4)) % 4;
      const padded = base64 + '='.repeat(padding);
      
      // Decode base64
      const decompressed = atob(padded);
      
      // Decompress
      const json = this.decompressString(decompressed);
      
      // Parse JSON
      const commands = JSON.parse(json);
      
      return Array.isArray(commands) ? commands : [];
    } catch (error) {
      console.error('Failed to decode session:', error);
      return [];
    }
  }

  /**
   * Simple string compression using run-length encoding and character substitution
   * This is a lightweight compression for common terminal patterns
   */
  private static compressString(str: string): string {
    // Replace common patterns with shorter codes
    let compressed = str;
    
    // Common command patterns
    const patterns: { [key: string]: string } = {
      'cd ': 'c',
      'ls ': 'l',
      'cat ': 't',
      'echo ': 'e',
      'mkdir ': 'm',
      'rm ': 'r',
      'grep ': 'g',
      'find ': 'f',
      'git ': 'i',
      'npm ': 'n',
      'python ': 'p',
      'node ': 'o',
      'sudo ': 's',
      '../': 'u',
      './': 'd',
      ' && ': '&',
      ' | ': '|',
      '~': 'h',
    };
    
    // Apply pattern replacements
    for (const [pattern, replacement] of Object.entries(patterns)) {
      compressed = compressed.replace(new RegExp(this.escapeRegex(pattern), 'g'), replacement);
    }
    
    // Simple run-length encoding for repeated spaces/newlines
    compressed = compressed.replace(/\s{3,}/g, (match) => {
      return `_${match.length}`;
    });
    
    return compressed;
  }

  /**
   * Decompress string back to original
   */
  private static decompressString(compressed: string): string {
    let decompressed = compressed;
    
    // Reverse run-length encoding
    decompressed = decompressed.replace(/_(\d+)/g, (_, count) => {
      return ' '.repeat(parseInt(count));
    });
    
    // Reverse pattern replacements
    const patterns: { [key: string]: string } = {
      'c': 'cd ',
      'l': 'ls ',
      't': 'cat ',
      'e': 'echo ',
      'm': 'mkdir ',
      'r': 'rm ',
      'g': 'grep ',
      'f': 'find ',
      'i': 'git ',
      'n': 'npm ',
      'p': 'python ',
      'o': 'node ',
      's': 'sudo ',
      'u': '../',
      'd': './',
      '&': ' && ',
      '|': ' | ',
      'h': '~',
    };
    
    // Apply reverse pattern replacements (in reverse order to avoid conflicts)
    const sortedPatterns = Object.entries(patterns).sort((a, b) => b[0].length - a[0].length);
    for (const [code, pattern] of sortedPatterns) {
      decompressed = decompressed.replace(new RegExp(this.escapeRegex(code), 'g'), pattern);
    }
    
    return decompressed;
  }

  private static escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Generate shareable URL from commands
   */
  static generateShareUrl(commands: string[], baseUrl?: string): string {
    const encoded = this.encode(commands);
    if (!encoded) {
      return '';
    }
    
    const url = baseUrl || window.location.origin + window.location.pathname;
    return `${url}?sesh=${encoded}`;
  }

  /**
   * Parse shareable URL and extract commands
   */
  static parseShareUrl(url?: string): string[] {
    const targetUrl = url || window.location.href;
    const urlObj = new URL(targetUrl);
    const seshParam = urlObj.searchParams.get('sesh');
    
    if (!seshParam) {
      return [];
    }
    
    return this.decode(seshParam);
  }
}

