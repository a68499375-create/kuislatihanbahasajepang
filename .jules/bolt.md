## 2025-06-15

### Performance Optimization: O(N^2) Lookup in mergeDatabases for Reports

- **Issue:** The `mergeDatabases` function in `server/db.ts` contained an O(N^2) array lookup `merged.reports.findIndex` when merging remote reports into local reports.
- **Optimization:** Refactored the linear `findIndex` to use an O(1) `Map` lookup (`localReportMap`), which stores the report ID to its current index.
- **Impact:** Benchmark results indicated a significant speedup for merging 10,000 reports, reducing execution time from ~1500 ms to ~8 ms.
