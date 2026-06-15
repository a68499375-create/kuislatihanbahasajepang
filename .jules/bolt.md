
### 2025-06-15
**Local Accounts Linear Search to Indexed Search Optimization**
- **Problem**: Repeated linear searches for UID across local accounts via `Object.keys().find` and `Object.values().find`. This was O(N) operations executed inside `useEffect` logic.
- **Fix**: Replaced multiple manual linear searches with a new `getMatchedKeyByUid` helper function that maintains a lightweight mapping index based on JSON string cache invalidation.
- **Benchmark** (for 1000 searches on 50,000 accounts):
  - `Object.keys`: ~20162ms
  - `Object.values`: ~35371ms
  - `Indexed Approach`: ~115ms (including JSON parsing and index build)
  - Speedup is approximately 174x to 300x depending on the original method.
