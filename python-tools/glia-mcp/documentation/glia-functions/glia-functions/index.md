---
title: Glia Functions
type: basic
hidden: false
order: 0
link_external: false
---

From an integrator perspective, Glia functions can be viewed as a hosted back-end middleware between Glia and external APIs. It allows integrators to quickly and securely bridge the functionality of Glia with other services while remaining in the Glia ecosystem. In combination with Glia applets and Glia exports, functions allow building of powerful tools that can be integrated into Glia.

Glia functions run inside a <a href="https://github.com/cloudflare/workerd" target="workerd">workerd</a> runtime environment.

# Concept

A Glia function can be associated with only one site and managed by a user with appropriate permissions.

Glia functions are written in JavaScript.

A function can have multiple versions. To invoke a function, the function must have a current version set (deployed). A function can have only one current version at a time.

A function can access Functions KV Store to save data for a limited time. This data is shared among all your Glia functions and can also be managed via the REST API.

The following diagram captures the general idea of Glia functions flow:

<img src="https://docs-img.glia.com/images/glia_functions_high_level_flow_250609.png" class="center">

- For more information on creating and using functions, see <a href="https://docs.glia.com/glia-how-to/docs/writing-and-deploying-glia-functions" target="writing-and-deploying-glia-functions">Writing and Deploying Glia Functions</a> and <a href="https://docs.glia.com/glia-dev/reference/functions" target="reference/functions">Functions</a> REST API endpoints documentation.
  - Glia recommends using <a href="https://github.com/salemove/glia-functions-tools" target="glia-functions-tools">Functions CLI</a>, a set of tools to build and manage Glia functions. It includes several examples and a local development server for testing functions without deployment.
- For more information on storing and sharing data, see <a href="https://docs.glia.com/glia-dev/docs/glia-functions-kv-store" target="glia-functions-kv-store">Functions KV Store</a>.

# Compatibility

Glia functions ensure compatibility through the concept of compatibility dates, a concept shared by the <a href="https://github.com/cloudflare/workerd" target="workerd">workerd</a> runtime environment. When a function version is created, it gets bound to a specific date. Glia ensures that the code will continue working undisrupted under the condition it worked on the specified date.

When creating a function version, you can supply a specific compatibility date as a parameter. If not specified, Glia assigns the compatibility date from the previous version automatically. In case there is no previous version, the compatibility date will be the maximum compatibility date, which is the release date of the workerd in use.

# Versioning

When you write a new function, it requires three steps for the function to be available in Glia.

1. First, you create a function entity in Glia that contains the basic information about the function. The <a href="https://docs.glia.com/glia-dev/reference/post_functions" target="post_functions">Create function</a> endpoint returns a unique `function_id` and `invocation_uri` for it.

2. After you have the `function_id`, you can create an unlimited number of function versions. Each version is a separate entity, bound to a single function, containing its own function code and environment variables, and having its unique `version_id`. Use the <a href="https://docs.glia.com/glia-dev/reference/post_functions-function-id-versions" target="post_functions-function-id-versions">Create function version</a> or <a href="https://docs.glia.com/glia-dev/reference/patch_functions-function-id-versions-version-id" target="patch_functions-function-id-versions-version-id">Update function version</a> endpoint, the latter in case you want to create a new version based on an existing one.

3. When a function version is tested and stable, you may choose to deploy it - flag it as the current version of the function. To do so, you need to provide the `function_id` and `version_id` to the <a href="https://docs.glia.com/glia-dev/reference/post_functions-function-id-deployments" target="post_functions-function-id-deployments">Change current version of the function</a> endpoint.

If at any point you wish to roll back to a different function version, you can <a href="https://docs.glia.com/glia-dev/reference/post_functions-function-id-deployments" target="post_functions-function-id-deployments">change the current version of the function</a> using the corresponding `version_id` which effectively serves as a rollback.

# Permissions

Function permissions are split into the following categories:

- [Managing Functions](#managing-functions)
- [Invoking Functions](#invoking-functions)

## Managing Functions

To manage functions, a user needs appropriate permissions:

- To create new functions - `functions:create`
- To update or deploy an existing function - `functions:update`
- To view the functions, their versions, and code - `functions:read`

Alternatively, for example, if an application needs to manage functions, it can use a site's bearer access token obtained using a site API key with the appropriate permissions.

To learn the required permissions of each endpoint, see <a href="https://docs.glia.com/glia-dev/reference/functions" target="functions">Functions</a>.

## Invoking Functions

To invoke a function, a user needs the `functions_invoke:create` permission.

A function can also be invoked using a site bearer access token obtained using a site API key with the `functions:invoke` permission within the same site as the function.

See: <a href="https://docs.glia.com/glia-dev/reference/post_integrations-integration-id-endpoint" target="post_integrations-integration-id-endpoint">Invoke function</a>

Note the following:
- AI engines and exports have built-in permissions to trigger function invocations.
  See:
    - <a href="https://docs.glia.com/glia-how-to/docs/connecting-glia-functions-to-ai-engines" target="connecting-glia-functions-to-ai-engines">Connecting Glia Functions to AI Engines</a>
    - <a href="https://docs.glia.com/glia-how-to/docs/connecting-glia-functions-to-exports" target="connecting-glia-functions-to-exports">Connecting Glia Functions to Exports</a>
- In case of unexpectedly excessive usage of functions, Glia may take measures to avoid performance issues.
  See: <a href="https://docs.glia.com/glia-how-to/docs/custom-integrations-with-glia-functions#excessive-usage-and-suspending" target="custom-integrations-with-glia-functions#excessive-usage-and-suspending">Excessive Usage and Suspending</a>

# Audit Logs

Glia logs function creation, update, version creation, and deployment operations in <a href="https://docs.glia.com/glia-support/docs/audit-log" target="audit-log">Audit Log</a> in Glia Hub. Each record in the audit log notes whether there were changes to code or environment variables. The audit log contains the `function_id` as the `resource_id`.

# Runtime Logs

When invoked, a function can explicitly log messages during runtime by using `console.log()`, or in case of an error, automatically log the error message. You can access the logs using the <a href="https://docs.glia.com/glia-dev/reference/get_functions-function-id-logs" target="get_functions-function-id-logs">List function logs</a> endpoint.

The logs are retained for 72 hours, after which they will be deleted.

# Function Requirements and Limits

The following requirements and limits apply to Glia functions:

- Maximum size of the code of a function - 512,000 bytes.
- Maximum duration a function can execute - 20,000 milliseconds.
- Maximum size of the environment variables of a function - 4,000 bytes.
- Maximum concurrent executions per site - 20.
- Maximum number of functions per site - 30.

Please note that some limits also apply on function invocations, Functions KV Store writes, and Functions KV Store deletions. For more information, see <a href="https://docs.glia.com/glia-how-to/docs/custom-integrations-with-glia-functions#pricing-and-availability" target="custom-integrations-with-glia-functions">Pricing and Availability</a>.

## Functions KV Store Limits

Functions KV Store that allows to share data among your Glia functions, has the following limits:

- Time-To-Live (TTL) of a stored item - 72 hours since the creation or last update of the item. The system automatically deletes items once their TTL expires.
- Maximum length of a key of an item - 512 bytes.
- Maximum length of a value - 16,000 bytes.

# Network Requirements

Glia functions are hosted on Amazon Web Services. The outbound requests from functions can originate from any IP in the following range:

- 74.80.252.0/22

# Related Articles

- <a href="https://docs.glia.com/glia-how-to/docs/custom-integrations-with-glia-functions" target="custom-integrations-with-glia-functions">Custom Integrations with Glia Functions</a>
- <a href="https://docs.glia.com/glia-dev/reference/functions" target="functions">Functions</a>
- <a href="https://docs.glia.com/glia-how-to/docs/writing-and-deploying-glia-functions" target="writing-and-deploying-glia-functions">Writing and Deploying Glia Functions</a>
- <a href="https://docs.glia.com/glia-how-to/docs/using-glia-functions-in-applets" target="using-glia-functions-in-applets">Using Glia Functions in Applets</a>
- <a href="https://docs.glia.com/glia-how-to/docs/connecting-glia-functions-to-ai-engines" target="connecting-glia-functions-to-ai-engines">Connecting Glia Functions to AI Engines</a>
- <a href="https://docs.glia.com/glia-how-to/docs/connecting-glia-functions-to-exports" target="connecting-glia-functions-to-exports">Connecting Glia Functions to Exports</a>
