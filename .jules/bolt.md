
## 2024-05-18: Performance Optimization for Object Keys Search

**Issue:** Repeated `Object.keys()` calls on the `currentAccounts` cache inside `App.tsx` were causing `O(N)` memory allocation and iterations. Specifically, this issue occurred during account matching loops (like verifying the UID in an unsorted object). `Object.keys(currentAccounts)` creates a new array every time it is called.

**Optimization:** Instead of `Object.keys(accounts).find(...)`, we use a dedicated `for...in` loop helper function `findAccountKeyByUid`.

**Benchmark Data:**
Using a mock database with 10,000 accounts and searching near the end of the accounts object (for worst-case scenario), executed over 1,000 iterations:

*   **Original Method (`Object.keys().find`):** ~2.164s
*   **Optimized Method (`for...in`):** ~2.099s
*   **Object.entries Method:** ~4.739s

**Learnings:**
*   `Object.keys()` allocates a new array of strings. If the object has many keys, this allocation is relatively costly.
*   While `Object.keys().find()` might seem elegant, standard `for...in` iteration avoids creating an intermediate array and operates slightly faster for direct key lookups, especially as the number of keys increases.
*   `Object.entries` is significantly slower because it allocates both the keys array and values array pairs before iteration even begins.
