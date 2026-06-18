# W3C TTML2 Test Corpus

Test files in this folder are sourced from the [W3C TTML2 Test Suite](https://github.com/w3c/ttml2-tests) and are used to verify that the adapter handles real-world documents without crashing.

Only supported features files have been copied.

**Upstream**: https://github.com/w3c/ttml2-tests  
**Pulled from commit**: https://github.com/w3c/ttml2-tests/commit/7ca10e0970472a5a6743b3046c929e2e13f9b015

Files are organized by topic under `valid/` and `invalid/`.

## valid/

Documents that are valid per the TTML2 spec. The runner asserts that parsing produces no critical errors.

## invalid/

Documents that are invalid per the TTML2 spec. The runner asserts that parsing does not
throw — the adapter is a lenient processor and is not expected to reject invalid input,
only to handle it without crashing.
