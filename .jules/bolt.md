# 2025-02-20
## DB Performance Optimization
When multiple operations need to read and update a file-based storage database simultaneously, it's significantly faster to load the database once into memory and utilize a debounced async flush-to-disk operation to bundle writes instead of using synchronous blocking file reading and writing. This prevents blocking the Node.js event loop and significantly speeds up concurrent db operations like `updateUser`, demonstrating a 200x performance improvement in benchmarks.
