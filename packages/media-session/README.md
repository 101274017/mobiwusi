# Media session

This package is the E10 controlled-session boundary. It models invitation, acceptance, short leases, grant revisions, disconnect/expiry termination, runtime stop fencing, and allocation release through injected ports.

The default ports are in-memory only. `SyntheticMediaTicketPort` returns a clearly synthetic relay-only fixture and never contacts TURN, signaling, WebRTC, or a provider. Real credentials, TURN allocation, WebRTC device behavior, and on-device acceptance remain outside this package.

Revocation increments the session generation, marks the lease unusable, aborts pending allocation, stops the runtime, and releases the allocation. A late allocation result is rejected and released instead of becoming active.
