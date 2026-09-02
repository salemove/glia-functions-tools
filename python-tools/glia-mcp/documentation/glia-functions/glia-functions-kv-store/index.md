---
title: Glia Functions KV Store
type: basic
hidden: false
order: 10
link_external: false
---

Glia functions' key-value store (Functions KV Store) allows you to store data within your functions, enabling context to be maintained across multiple invocations. Functions KV Store is automatically accessible within Glia functions and also via the REST API.

The Functions KV Store SDK within Glia functions provides methods to manage either a single item or a batch of items. The REST API endpoints support only batch operations.

Functions KV Store supports string and boolean data type for items.

The data stored in Functions KV Store have a Time-To-Live (TTL) of 72 hours. A data item is automatically deleted 72 hours after its creation or last update.

# Initializing Functions KV Store

When a function's `onInvoke(request, env, kvStoreFactory)` method is called, the third parameter, `kvStoreFactory`, is your entry point to interact with the KV Store.

All your functions have access to your data in Functions KV Store. By default, each function has its own namespace, which is the function's ID, but you can use a custom namespace whenever you initialize the KV Store.

To initialize the KV Store, call the `initializeKvStore(namespace)` method within your function.

```javascript
export async function onInvoke(request, env, kvStoreFactory) {
    // Initialize using the default namespace
    const defaultKvStore = kvStoreFactory.initializeKvStore();

    // Initialize for a specific use case
    const userKvStore = kvStoreFactory.initializeKvStore("my_app_data");
}
```

Note that a namespace can only contain alphanumeric characters, underscores, and hyphens. The maximum namespace length is 128 bytes.

# Managing a Single Item

To create or update a single data item in Functions KV Store, use the `async set(key, value)` method:

```javascript
export async function onInvoke(request, env, kvStoreFactory) {
    const myKvStore = kvStoreFactory.initializeKvStore();

    // Store a string value
    const flow_status = await myKvStore.set({key: "flow_status", value: "processing"});
    // A response looks like: {key: "flow_status", value: "processing", expires:"2025-07-07T12:29:20Z"}

    // Store a boolean value
    const use_dark_theme = await myKvStore.set({key: "use_dark_theme", value: true});
    // A response looks like: {key: "use_dark_theme", value: true, expires:"2025-07-07T12:29:20Z"}

    return new Response(JSON.stringify({flow_status: flow_status.value, use_dark_theme: use_dark_theme.value}));
}
```

Note that the maximum length is 512 bytes for a key and 16,000 bytes for a value. A key can only contain alphanumeric characters (a-z, A-Z, 0-9), underscores (`_`), and hyphens (`-`).

To fetch an item, use the `async get(key)` method:

```javascript
export async function onInvoke(request, env, kvStoreFactory) {
    const myKvStore = kvStoreFactory.initializeKvStore();

    // Fetch a value of an item
    const flowStatus = await myKvStore.get("flow_status");
    // A response looks like: {key: "flow_status", value: "processing", expires:"2025-07-07T12:29:20Z"}

    if (flowStatus !== null) {
        console.log("The flow status is:", flowStatus.value);
    } else {
        console.log("Flow status not found.");
    }

    return new Response(JSON.stringify({flow_status: flowStatus.value}));
}
```

To delete an item, use the `async delete(key)` method or set the value to `null` using `async set(key, value)`:

```javascript
export async function onInvoke(request, env, kvStoreFactory) {
    const myKvStore = kvStoreFactory.initializeKvStore();

    // Delete a value
    const useDarkTheme = await myKvStore.delete("use_dark_theme");
    // A response looks like: {key: "use_dark_theme", value: null}

    // Alternatively, delete by setting the item's value to null
    const flowStatus = await myKvStore.set({key: "flow_status", value: null});
    // A response looks like: {key: "flow_status", value: null}

    return new Response(JSON.stringify({use_dark_theme: useDarkTheme.value, flow_status: flowStatus.value}));
}
```

# Conditionally Creating or Updating a Single Item

Functions KV Store provides a separate method to conditionally create, update, or delete an item based on its current value. This allows, for example, for easier state management.

The `async testAndSet({key, oldValue, newValue})` method checks the values of an item and makes the changes as follows:
- If the existing value of the item is the same as `oldValue`, the value will be set to `newValue`.
- If the existing value of the item is something other than `oldValue`, the entry will not be modified.
- If `oldValue` is `null`, the entry must not exist for the condition to pass.
- If the `newValue` is `null`, the item is deleted upon successful execution.

The `testAndSet` method returns the value in the store after the operation. This means that if the item's value was successfully updated from `oldValue` to `newValue`, it returns `newValue`; if the value was something other than `oldValue`, the condition did not pass, and it returns the existing value.

```javascript
export async function onInvoke(request, env, kvStoreFactory) {
    const myKvStore = kvStoreFactory.initializeKvStore();

    // Update the token only if its value is "old-token"
    const myToken = await myKvStore.testAndSet({key: "token", oldValue: "old-token", newValue: "new-token"});
    // A response looks like: {key: "token", value: "new-token", expires: "2025-07-07T14:02:19Z"}

    return new Response(JSON.stringify(myToken));
}
```

# Fetching All Items

To retrieve all items belonging to a namespace, Functions KV Store offers an SDK method for use within Glia functions. Additionally, the <a href="https://docs.glia.com/glia-dev/reference/get_api-v2-functions-storage-kv-namespaces-namespace" target="get_api-v2-functions-storage-kv-namespaces-namespace">List key-value pairs</a> REST API endpoint is available for use outside of Glia functions.

The `async itemsAsyncIterator()` SDK method returns all items within the initialized namespace. It handles pagination automatically, allowing you to iterate over items seamlessly regardless of their count.

The `async itemsAsyncIterator(options)` method returns an <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Symbol/asyncIterator" target="developer.mozilla.org/asyncIterator">AsyncIterator</a> object where each `item` is an object with the following fields:
- `key` (String) - The key of the item.
- `value` (Any) - The value of the item.
- `expires` (String) - The timestamp in ISO 8601 format when the item will be deleted.

```javascript
export async function onInvoke(request, env, kvStoreFactory) {
    const myKvStore = kvStoreFactory.initializeKvStore();

    try {
        const itemIterator = myKvStore.itemsAsyncIterator();
        let itemCount = 0;
        for await (const item of itemIterator) {
            console.log(`Key: ${item.key}, Value:`, item.value);
            itemCount++;
        }
        console.log(`Items count: ${itemCount}`);

    } catch (error) {
        console.error("Error listing items:", error.message);
    }
}
```

# Managing Multiple Items Using Batch Operations

Functions KV Store batch operations are available as an SDK within Glia functions and via REST API endpoints. This guide explains the SDK. For more information on using the REST API, see <a href="https://docs.glia.com/glia-dev/reference/post_api-v2-functions-storage-kv-namespaces-namespace" target="post_api-v2-functions-storage-kv-namespaces-namespace">Bulk key-value operations</a> REST API endpoint.

The `async processBatchOperations(operations)` SDK method allows you to perform multiple CRUD (create, read, update, delete) operations on items within the initialized namespace in a single batch request.

> ℹ️
> Note that atomicity is not guaranteed. Each operation within the batch is processed iteratively by the server.

## Operations List Parameter

The `operations` parameter of the `processBatchOperations` method is an array of objects, each consisting of an operation to perform. The objects must be of the following structure:

- `op` (string, required) - The type of operation to perform. Supported values:
  - `get` - Retrieves an item from the store.
  - `set` - Creates a new item or overwrites an existing item.
  - `delete` - Deletes an item from the store.
  - `testAndSet` - Conditionally creates, updates, or deletes an item based on its current value.
    For more information on how the `testAndSet` operation works, see [Conditionally Create or Update a Single Item](#conditionally-create-or-update-a-single-item).
- `key` (string, required) - The key of the item for the operation. Must satisfy the following constraints:
  - Must not be empty.
  - Maximum length is 512 bytes.
  - Contains only alphanumeric characters (a-z, A-Z, 0-9), underscores (`_`), and hyphens (`-`).
- `value` (string or boolean) - The value to be stored.
  - Required for the `set` operation. Not allowed for other operations.
  - The JSON string representation of the value cannot exceed 16,000 bytes.
- `oldValue` (string, boolean, or null) - The expected current value of the item.
  - Required for the `testAndSet` operation. Not allowed for other operations.
  - Can be `null` to indicate that the item is expected to not exist, or that its current value is expected to be `null`.
  - The JSON string representation of the value cannot exceed 16,000 bytes.
- `newValue` (string, boolean, or null) - The new value to set if the condition (based on `oldValue`) passes.
  - Required for the `testAndSet` operation. Not allowed for other operations.
  - If `newValue` is `null` and the condition on `oldValue` passes, the operation attempts to delete the item.
  - The JSON string representation of the value cannot exceed 16,000 bytes.

## Response Structure

The `async processBatchOperations(operations)` method returns a promise that resolves to an array of result objects.

- Each result object in the array corresponds to an operation in the input `operations` array, maintaining the same order.
- The structure of each result object depends on the outcome of the individual operation.

If the validation fails (for example, a key length exceeds 512 bytes), the `processBatchOperations` promise will reject with an `Error` object. No array of results is returned.

On success, the structure of the result objects is the following, depending on the operation:

- `get`, if an item was found:
  `{ key: "the-key", value: "retrieved_value", expires: "timestamp-iso8601" }`
- `get`, if an item was not found:
  `{ key: "the-key", value: null, expires: null }`
- `set`, if an item was created or updated:
  `{ key: "the-key", value: "set_value", expires: "timestamp-iso8601" }`
- `delete`, if an item was deleted:
  `{ key: "the-key", value: "value-of-deleted-item-if-any" }`
  Here `value` is the item's value before deletion, or `null` if it did not exist or had no value.
- `delete`, if and item was not found:
  `{ key: "the-key", value: null }`
- `testAndSet`, if the condition was met and an item created or updated with `newValue`:
  `{ key: "the-key", value: "newValue", expires: "timestamp-iso8601" }`
- `testAndSet`, if the condition was met and an item deleted because `newValue` was `null`:
  `{ key: "the-key", value: "value-of-deleted-item-if-any" }`
- `testAndSet`, if the condition failed (for example, `oldValue` did not match):
    - If the operation was a conditional put (non-null `newValue`):
    `{ key: "the-key", value: null, expires: null }`
    - If the operation was a conditional delete (null `newValue`):
    `{ key: "the-key", value: null }`

## Error Handling

When using the `async processBatchOperations(operations)` method, the following error situations may occur:

- **Client-Side Validation Errors** - If the input `operations` array or any individual operation object fails validation (for example, an invalid `op` type, a missing `key`, a malformed key or value, or if a size limit exceeded), the `processBatchOperations` method will throw an `Error` synchronously, and the promise it returns will be rejected.
-  **Conditional Failures** (`testAndSet` operation only) - When a `testAndSet` operation's condition is not met, it is not treated as a hard error that stops code execution. Instead, it returns with a specific body (for example, `value: null, expires: null`; see [Response Structure](#response-structure)) to indicate that the conditional check failed but the communication was successful.
- **Backend/Network Errors** - For errors occurring during the communication with the backend service for an individual operation (for example, a network failure or HTTP 500 from the server), the corresponding result object in the resolved array will contain a specific body (for example, `value: null, expires: null`; see [Response Structure](#response-structure)). The overall batch operation will still attempt to process subsequent operations.

## Example

```javascript
export async function onInvoke(request, env, kvStoreFactory) {
    const myKvStore = kvStoreFactory.initializeKvStore("my_app_data");

    const operations = [
      { op: "set", key: "user_123_profile_name", value: "Alice" },
      { op: "get", key: "config_featureFlags" },
      { op: "testAndSet", key: "session_xyz_token", oldValue: "oldToken", newValue: "newToken" },
      { op: "testAndSet", key: "user_123_profile_name", oldValue: "Bob", newValue: "Alice V2" }, // This will likely be a conditional failure
      { op: "delete", key: "cache_oldData" },
      { op: "get", key: "nonExistentKey" }
    ];

    try {
        const results = await myKvStore.processBatchOperations(ops);
        results.forEach(result => {
            if (!result.value || result.value === null) {
                console.error(`Operation for key ${result.key} failed.`);
            } else {
                console.log("Operation successful:", result);
            }
        });
    } catch (error) {
        console.error("Bulk operations validation error:", error.message);
    }
}
```

# Notes

Functions KV Store is also subject to general Glia functions limits.

See:
- <a href="https://docs.glia.com/glia-dev/docs/glia-functions#function-requirements-and-limits" target="glia-functions">Function Requirements and Limits</a>
- <a href="https://docs.glia.com/glia-how-to/docs/custom-integrations-with-glia-functions#pricing-and-availability" target="custom-integrations-with-glia-functions">Pricing and Availability</a>

# Related Articles

- <a href="https://docs.glia.com/glia-dev/docs/glia-functions" target="glia-functions">Glia Functions</a>
- <a href="https://docs.glia.com/glia-how-to/docs/writing-and-deploying-glia-functions" target="writing-and-deploying-glia-functions">Writing and Deploying Glia Functions</a>
- <a href="https://docs.glia.com/glia-dev/reference/functions-kv-store" target="reference/functions-kv-store">Functions KV Store</a> REST API endpoints
