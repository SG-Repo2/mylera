declare global {
  var URL: typeof URL;
  var Blob: typeof Blob;
  var BlobModule: {
    createFromParts: () => void;
    release: () => void;
    addNetworkingHandler: () => void;
    enableBlobSupport: () => void;
    disableBlobSupport: () => void;
  };
}

export {};
