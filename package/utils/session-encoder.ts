/**
 * Session encoder/decoder for shareable command links
 */

export class SessionEncoder {
  static encode(commands: string[]): string {
    if (commands.length === 0) {
      return '';
    }
    
    const json = JSON.stringify(commands);
    const compressed = this.compressString(json);
    
    return btoa(compressed)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  static decode(encoded: string): string[] {
    if (!encoded || encoded.length === 0) {
      return [];
    }
    
    try {
      const base64 = encoded
        .replace(/-/g, '+')
        .replace(/_/g, '/');
      
      const padding = (4 - (base64.length % 4)) % 4;
      const padded = base64 + '='.repeat(padding);
      const decompressed = atob(padded);
      const json = this.decompressString(decompressed);
      const commands = JSON.parse(json);
      
      return Array.isArray(commands) ? commands : [];
    } catch (error) {
      console.error('Failed to decode session:', error);
      return [];
    }
  }

  private static compressString(str: string): string {
    let compressed = str;
    
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
    
    for (const [pattern, replacement] of Object.entries(patterns)) {
      compressed = compressed.replace(new RegExp(this.escapeRegex(pattern), 'g'), replacement);
    }
    
    compressed = compressed.replace(/\s{3,}/g, (match) => {
      return `_${match.length}`;
    });
    
    return compressed;
  }

  private static decompressString(compressed: string): string {
    let decompressed = compressed;
    
    decompressed = decompressed.replace(/_(\d+)/g, (_, count) => {
      return ' '.repeat(parseInt(count));
    });
    
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
    
    const sortedPatterns = Object.entries(patterns).sort((a, b) => b[0].length - a[0].length);
    for (const [code, pattern] of sortedPatterns) {
      decompressed = decompressed.replace(new RegExp(this.escapeRegex(code), 'g'), pattern);
    }
    
    return decompressed;
  }

  private static escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  static generateShareUrl(commands: string[], baseUrl?: string): string {
    const encoded = this.encode(commands);
    if (!encoded) {
      return '';
    }
    
    const url = baseUrl || window.location.origin + window.location.pathname;
    return `${url}?sesh=${encoded}`;
  }

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

