# Algorithm references

The Mulberry32 implementation in `src/core/random.ts` follows Tommy Ettinger's
[public-domain C reference](https://gist.github.com/tommyettinger/46a874533244883189143505d203312c).
The reference identifies Tommy Ettinger as its author and dedicates it under
[CC0](https://creativecommons.org/publicdomain/zero/1.0/). It is a reproducible game
random stream, not a cryptographic generator.

FNV-1a uses the 32-bit constants and byte-wise algorithm described in the
[IETF FNV draft](https://www.ietf.org/archive/id/draft-eastlake-fnv-25.html).
Project text is encoded as UTF-8; values are kept unsigned modulo 2^32.

Build and test dependencies are recorded with exact versions and resolved package
integrity in `package-lock.json`; their own licenses remain with their packages.
