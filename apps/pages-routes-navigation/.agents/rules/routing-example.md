# Routing documentation example

This application demonstrates page and route behavior with public fictional project fixtures. Draft forms intentionally preview only; they do not claim persistence and must not silently acquire real business writes. Authentication, page authorization, system user/role management and navigation use the normal application capabilities.

`client/route-overrides.ts` is explicitly passed to `defineAppRuntime` in `client/runtime.ts`. The locally defined client-only reporting contribution demonstrates cross-package route ownership without publishing an npm package. Keep its package ID stable because the override and parent reference use it.

The README maps documented usages to routes, source files and validation. Keep this mapping and both documentation languages in sync when changing scenarios. Every UI usage and its important states have actual screenshots in the documentation repository. Screenshots use the English interface; the capture and viewer preparation scripts make them reproducible.
