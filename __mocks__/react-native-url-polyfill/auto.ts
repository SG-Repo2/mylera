// Mock URL implementation
class MockURL {
  protocol: string;
  hostname: string;
  pathname: string;
  search: string;
  hash: string;

  constructor(url: string) {
    const urlParts = url.match(/^(https?:)\/\/([^/]+)(\/[^?#]*)?(\?[^#]*)?(#.*)?$/);
    this.protocol = urlParts?.[1] || '';
    this.hostname = urlParts?.[2] || '';
    this.pathname = urlParts?.[3] || '/';
    this.search = urlParts?.[4] || '';
    this.hash = urlParts?.[5] || '';
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
    this.size = parts.reduce((size, part) => size + String(part).length, 0);
    this.type = options.type || '';
  }
}

// Export mocks
(global as any).URL = MockURL;
(global as any).Blob = MockBlob;

// Mock BlobModule
(global as any).BlobModule = {
  createFromParts: () => {},
  release: () => {},
  addNetworkingHandler: () => {},
  enableBlobSupport: () => {},
  disableBlobSupport: () => {}
};

export default {};
