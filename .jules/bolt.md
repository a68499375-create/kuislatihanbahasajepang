
### 2025-02-12
**Performance Optimization: DB JSON Serialization & Blocking Event Loop**
- Identified an issue in `getUsers()` and other local database getter methods where `fs.readFileSync` and `JSON.parse` were invoked on every call, blocking the Node.js event loop on each request.
- Implemented an in-memory caching mechanism (`dbCache`) using `readDbSync` and `writeDbSync` custom helpers to maintain state.
- **Critical Fix:** Prevented accidental persistence of virtual fields. The original code temporarily appended a `role = 'dev'` label to the users list in memory for downstream requests. Returning the cached object reference would have mutated the cache with this virtual label, eventually persisting it onto disk during the next DB write. We bypassed this by shallow-copying objects via `.map((u) => ({...u}))` before modifying them dynamically.
- **Benchmark:** Processing 10,000 records 100 times improved from `1613ms` down to `235ms`.
