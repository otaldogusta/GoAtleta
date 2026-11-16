# JPEG XL encoder

The single-threaded encoder assets are from `@jsquash/jxl@1.2.0` (Squoosh).
The release tarball SHA-256 is
`f8a25efa5eba56fcac11ef1bbda3b1fa3f67b3ba8c9099fbc459757f3f31dfe3`.
The accompanying license is in `LICENSE`. The original JavaScript glue is
served as `jxl_enc.mjs`, with the WebAssembly asset beside it.

The web client loads this codec in a worker for eligible profile photos.
