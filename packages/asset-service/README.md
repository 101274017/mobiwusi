# Asset service

This package implements the E06/E09 asset boundary without a server, network client, provider credential, or claim of real generated quality. `PetGenerationPort` and the signing/verification ports are injected; the in-memory stores are test fixtures.

- generation jobs are owner-authorized, queryable, cancellable, and generation-fenced;
- generated bundles must pass the existing local pet-engine structural gate and file/hash checks;
- assets are saved as preview-only and never replace the current pet until the owner confirms the preview;
- cancelled, stale, malformed, or hash-mismatched output is never applied;
- flow/config releases are canonicalized, signed, verified, versioned, and rollbackable;
- production signing keys, provider quality, network access, and human design review remain outside this package.
