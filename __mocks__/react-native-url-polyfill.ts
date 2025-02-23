// Mock URL implementation
class MockURL {
  protocol: string;
  hostname: string;
  pathname: string;
  search: string;
  hash: string;

  constructor(url: string) {
    const parsed = new URL(url);
    this.protocol = parsed.protocol;
    this.hostname = parsed.hostname;
    this.pathname = parsed.pathname;
    this.search = parsed.search;
    this.hash = parsed.hash;
  }

  toString() {
    return `${this.protocol}//${this.hostname}${this.pathname}${this.search}${this.hash}`;
  }
}

// Mock Blob implementation
class MockBlob {
  size: number;
  type: string;

  constructor(parts: any[], options: { type?: string } = {}) {
    this.size = parts.reduce((size, part) => size + part.length, 0);
    this.type = options.type || '';
  }
}

// Export mocks
global.URL = MockURL as any;
global.Blob = MockBlob as any;

export default {};
