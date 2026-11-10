# Workflow Studio + Portal + Integration Runtime: Comprehensive Upgrade Specification

**Status:** Implementation-ready requirements and architecture proposal; **not** a verified assessment of the current repository.  
**Audience:** An AI coding agent or engineering team working against the actual source code.  
**Primary goal:** Evolve the existing platform into an extensible low-code workflow builder where administrators can create, configure, validate, publish, and operate new enterprise workflows **without editing application code for each new workflow**, provided their needs fall within the supported component, rule, connector, and BPMN capabilities.

> **MANDATORY INSTRUCTION TO IMPLEMENTING AGENT:** Inspect the existing repositories, compose files, database migrations, BPMN compiler, form-js version, connector storage/execution, Portal form renderer, authentication, and Camunda 7 integration **before editing**. Do not assume filenames, existing APIs, or feature completeness from this specification. Preserve working behavior and extend rather than rewrite. Document discrepancies between requirements and current implementation. Do not claim a feature works until end-to-end tests prove it.

## 1. Current known context (verify in code)

- **Workflow Studio:** React/TypeScript frontend with `bpmn-js`, properties panel and `form-js`; FastAPI backend; PostgreSQL; BPMN editing, form design, connector definitions, deployment/versioning; existing SMTP email configuration; worker/bots service for external tasks.
- **Workflow Portal:** Separate React + FastAPI employee-facing app with workflow catalog, start forms, My Tasks and My Requests; currently has development identity support and needs real SSO/identity integration.
- **Camunda 7:** Shared process engine. Studio deploys BPMN/forms; Portal starts instances and completes user tasks; external task workers execute configured system operations. Generic external task topic reportedly `wf.connector` (verify).
- **Integration worker:** Currently deployed with Studio Docker Compose; may remain there initially or be extracted into a separately deployed shared runtime. It must connect to the **same Camunda engine** as Studio and Portal and be able to resolve published connector definitions/secrets.
- **Company systems:** Master DB / employee directory, HRMS, ITSM, hiring, inventory, email and other company APIs. Actual contracts, auth and availability are **unknown** until provided.
- **Local networking:** Separate Docker Compose projects may need a shared network or `host.docker.internal` to reach host-published Camunda; do not hardcode local addresses into production.
- **Camunda forms:** Inspect actual deployed form format and compatibility. Prior design mentions Camunda Forms/form-js JSON and deployment-bound form references; verify runtime support before changing form schemas.

## 2. Non-negotiable product principles

1. **Studio is the authoring/control plane**: BPMN, forms, API connectors, rules, validations, assignment/delegation policies, email, tests, publishing.
2. **Portal is the employee runtime**: show forms, dynamic fields, approvals, group tasks, delegation and request progress; do not embed per-workflow React logic.
3. **Camunda 7 orchestrates**: process state, service/user tasks, gateways, timers, task lifecycle, history.
4. **Shared integration services execute APIs**: external task workers for BPMN service tasks; separate secure request/response endpoint for interactive form data and pre-submit validation. Reuse common connector definitions and credential resolution.
5. **Configuration, not new code, for ordinary new workflows**: no new worker, Portal route, React component, or backend endpoint for each leave/hiring/IT/travel workflow. New platform primitives or unsupported protocols may require platform development.
6. **Version everything published**: BPMN, form schemas, connector references, transformations, validations, group/assignment rules and UI metadata. Preserve existing instances.
7. **Security by default**: no company API secrets or arbitrary executable code in browser; server-side validation; least-privilege access; strict auditability.
8. **No HTML is required** to build dynamic forms. Primary experience is a visual drag-and-drop form editor. **Optional separate HTML-to-editable-form converter** is described in §5.8; it must not block the core visual designer. Do not confuse this with merely rendering pasted HTML.

## 3. End-to-end target architecture

```text
[Workflow Studio: BPMN + visual forms + connectors + rules + publishing]
                  |                  \
                  | deploy BPMN/forms  \ publish versioned metadata
                  v                    v
           [Camunda 7]       [Configuration Registry]
               ^  ^                   ^       ^
               |  |                   |       |
     start/complete |              read    read
               |  |                   |       |
        [Workflow Portal] ----> [Form Data / Validation API]
               |                       |
               |                   [Connector Runtime]
               |                       |
               |             [Company Master DB / HRMS / etc.]
               |
         [SSO / identity]

[External Task Worker(s)] <---- fetch-and-lock ----> [Camunda 7]
         |                       |
         +-- read published connector config from Registry
         +-- call approved company APIs, email API or SMTP
         +-- complete/fail external task with process variables
```

The registry may initially live in Studio's existing PostgreSQL/backend with a restricted runtime API. **Do not** require Portal to call Studio's interactive authoring endpoints; expose a stable, read-only published-runtime contract instead. Studio and Portal may remain separate Docker deployments.

### Critical distinction: three API execution modes

| Mode | Trigger | Executor | Blocking behavior |
|---|---|---|---|
| **Form-data lookup** | On form load / field change | Portal backend → secure form-data connector runtime | Update form data, show errors; no BPMN service task needed |
| **Before-submit validation** | Start form submit OR any user-task submit | Portal backend → secure validation runtime | **Block Camunda start/task completion** on failure |
| **Workflow service task** | Process reaches BPMN service task | Camunda external task worker (`wf.connector` or supported topic) | Complete/retry/fail BPMN task; instance already exists |

These must not be conflated. A Camunda external-task worker **cannot** directly populate an unstarted form's dropdown by itself.

## 4. Flexible BPMN authoring and start behavior

### 4.1 Requirements

- Start Event is a first-class, independently editable BPMN element, **not automatically an initial User Task**.
- Permit valid BPMN sequences: Start → Service Task, Start → User Task, Start → Gateway, Start → other supported elements, including loops, parallel branches and timers where supported.
- Allow an optional **start form attached to the Start Event**; it is not the same as a User Task form.
- Allow workflows with **no start form** (initiated by authorized user, message, timer or API as supported).
- Allow pre-start form data loading and pre-start validation **before creating** an instance.
- If the first actual BPMN step is a system task and a user form is required later, create the instance and show the user task only when Camunda reaches it; do not pretend the system task ran before an unstarted instance.
- BPMN validation: start events, reachable end paths, assignments, connector configuration, form references, supported expressions, gateway conditions, deployment compatibility.
- Support variable mapping and safe default values across tasks; preserve process key and deployment compatibility.

### 4.2 Acceptance cases

- Start → system employee lookup → user task form → manager approval → end.
- Start form → pre-submit eligibility validation → Start → system task → user task.
- Start → user task directly; existing workflows continue working.
- Invalid BPMN cannot be published; useful error locations are displayed in Studio.

## 5. Advanced visual dynamic form designer (core priority)

### 5.1 Visual editor UX

Provide a **component palette**, **drag/drop canvas**, **field properties panel**, **conditional logic editor**, **data source picker**, **validation/action panel**, **style/layout settings**, **responsive preview**, **schema inspector** and **publish/test flow**. Admins must be able to create and modify forms without writing HTML/React/Python.

Supported components should include:

- Text, textarea, number, date/time/date range, dropdown, multi-select, radio, checkbox, toggle, email, phone, file upload, read-only value, hidden variable, calculated field.
- Sections, headings, cards, tabs, accordions, separators, grid/columns, responsive containers and repeatable groups.
- **Editable/repeating table** with configurable columns (text, dropdown, date, numeric, lookup), row add/remove/reorder, row-level validation, min/max rows, defaults and submitted JSON arrays.
- **Data table** (read-only or selectable) backed by APIs, with configurable columns, pagination, sorting/filtering where feasible; avoid loading huge result sets in the browser.
- Optional custom components through a documented registry/extension API. Any new component must have Studio editor, Portal renderer, serialization, validation, and versioning support.
- Visual styling controls: labels, spacing, widths, grid layout, card/section styles, allowed theme tokens, responsive behavior. Prefer a shared corporate theme with per-form configurable overrides, not arbitrary executable CSS.

### 5.2 Conditional forms

- Show/hide **fields, sections, tabs, table columns and repeatable groups** based on other field values, user attributes, API responses, or safe expressions.
- Example: `leave_type == 'SICK'` shows medical details and attachment; `leave_type == 'EARNED'` shows an editable handover table.
- Support `AND`, `OR`, comparisons, membership, nested conditions and clear preview/debug messages.
- Define behavior for hidden values: clear or retain per configurable policy; **never submit stale hidden sensitive values accidentally**.
- Conditional requiredness/validation must be enforced server-side on the effective visible/active schema.

### 5.3 API-backed fields and dependent data

- Dropdown/static-vs-API source selector; choose an approved connector, request parameters, option list path, label key and value key.
- Example `GET /leave-types` returns `{"leave_types":[{"id":"CL","name":"Casual Leave"}]}`; map list `$.leave_types`, label `name`, value `id`.
- Trigger on load, on field change, manual refresh; dependent dropdowns (department → employee; country → state → city).
- Support loading, empty state, error, retries, debounce, cancellation of stale requests, cache TTL and per-user authorization.
- API response may populate read-only fields, calculated fields, table rows and hidden process variables, with explicit mapping and sanitization.
- Preview must allow **mock responses**; live tests must be permission-gated and not modify production data.

### 5.4 Form validation and actions — UNIVERSAL FOR ALL WORKFLOWS

This feature applies to **start forms AND every User Task form** (manager, HR, recruiter, IT, etc.), not just leave requests.

Configure an ordered **Actions & Validation** panel for each form:

| Trigger | Typical behavior |
|---|---|
| On Form Load | Fetch employee details, options, reference data |
| On Field Change | Dependent API, calculations, conditional display |
| Before Submit | Local/schema validation + server-side API/business-rule checks; block submit if invalid |
| After Successful Submit | Optional non-critical notifications/analytics; reliable side effects should generally be BPMN tasks/outbox |
| On API Error | Display controlled message, retry where safe, block if authoritative validation unavailable |

Each action should configure: connector/rule reference, input mapping, condition, ordering/dependencies, timeout, retry, success predicate, output mapping, failure policy, popup/inline error message, and audit behavior. Support **multiple chained validations**, including early exit and deterministic order. Distinguish a non-blocking warning from an authoritative blocking validation; do not allow UI warnings to override server policy.

**Essential semantics:** Clicking Submit does **not** mean the workflow is already started or the user task is completed. Portal first invokes a **server-side validation endpoint**, which authenticates the actor, validates schema and policy, runs approved API checks, and only on success proceeds to Camunda start/complete. On failure, return a structured error, show popup or field-level error, preserve form input, and **do not** start/complete anything.

Example error response (illustrative contract, not existing API):

```json
{
  "ok": false,
  "code": "INSUFFICIENT_BALANCE",
  "message": "Only 3 days of leave remain; 5 days were requested.",
  "fieldErrors": {"requested_days": "Exceeds available balance"},
  "blocking": true
}
```

### 5.5 Pre-submit concurrency and consistency

A balance/eligibility check may become stale between validation and Camunda submission. For scarce resources (leave balance, inventory, budget, seats), require an **authoritative reservation/atomic validation** or compensating workflow and final check. Prefer a backend orchestrated `validate-and-reserve` API with idempotency key where supported. Define release/expiry if Camunda start fails. Do not claim cross-system atomicity unless the APIs support it. Prevent double-click and duplicate submissions with idempotency keys, in-flight UI state and backend deduplication.

### 5.6 Schema and runtime compatibility

- Inspect installed `form-js` version and available built-in conditional/repeating features before extending.
- Define **one versioned canonical form schema** plus a controlled extension namespace for custom components, styling, API sources and action rules.
- Preserve existing Camunda form resource bindings and deployed form references. If custom metadata is not understood by Camunda's native form schema, store it in a published registry keyed by deployment/form/version, and render via the Portal's extended form renderer. Avoid silently embedding unsupported properties that Camunda strips/rejects.
- Both Studio Preview and Portal runtime must use the same component registry and expression semantics.
- Submitted values map to Camunda variables with explicit type handling, including JSON arrays/objects for tables; verify Camunda 7 REST variable serialization support.
- File upload: authorized attachment service, scanning, size/type limits, durable references rather than uncontrolled raw blobs in process variables.

### 5.7 Example generic form configuration (conceptual, NOT existing schema)

```json
{
  "formKey": "leave-start",
  "schemaVersion": 1,
  "fields": [
    {"key": "leave_type", "type": "select", "dataSource": {
      "kind": "connector", "connectorRef": "masterdb.leave-types@v3",
      "itemsPath": "$.leave_types", "labelPath": "name", "valuePath": "id",
      "trigger": "onLoad"
    }},
    {"key": "medical_details", "type": "section",
      "visibleWhen": {"eq": [{"var": "leave_type"}, "SICK"]}},
    {"key": "handover", "type": "editableTable",
      "visibleWhen": {"eq": [{"var": "leave_type"}, "EARNED"]},
      "columns": [{"key": "task", "type": "text"}, {"key": "backup_emp", "type": "employeeLookup"}]}
  ],
  "beforeSubmit": [{
    "kind": "connectorValidation", "connectorRef": "hrms.check-leave-balance@v2",
    "inputs": {"employeeId": "$identity.employeeId", "leaveType": "$form.leave_type"},
    "passWhen": {"eq": [{"var": "response.allowed"}, true]},
    "onFail": {"block": true, "display": "popup", "messagePath": "$.message"}
  }]
}
```

**Implementation note:** Treat this as a desired logical contract; map into current form-js/Camunda structures or design an explicit adapter. Do not blindly paste this JSON into form-js.

### 5.8 Optional HTML-to-editable-form editor (clarify product scope)

Earlier discussions proposed an editor with **HTML source → Convert → editable visual form → live preview**, **not** merely uploading/rendering arbitrary HTML. The user later explicitly prioritized building forms **without HTML**. Therefore:

- **Required now:** Complete visual designer; no HTML dependency.
- **Optional later, only if product owner confirms:** A source-code editor and converter that parses a **supported subset** of HTML form controls/layout into the canonical editable form schema. Show conversion diagnostics and unsupported constructs; retain editability.
- Arbitrary CSS/JS cannot be guaranteed to convert exactly. Never execute arbitrary HTML scripts in Portal. Do not block the core delivery on this optional feature.

## 6. Generic advanced connector framework

### 6.1 Studio authoring

- Reusable connection definitions with named credentials, base URL, authentication scheme, headers, query params, request body, response type, timeouts, retry policy and environments (dev/test/prod).
- Configurable HTTP methods and common content types, including JSON; optional multipart/file support when needed.
- Response mappings: nested JSON extraction via JSONPath-like paths, JSON arrays, fallback/default values, type conversion, missing-path handling and schema validation.
- Controlled transformation expressions: filtering, mapping, joining, sorting, aggregation, date calculations and conditional output.
- Multi-step API pipeline: API A → extract field → API B → combine results → return process/form values. Define dependencies, error branches and bounded execution.
- Test console with sample payloads, redacted responses and dry-run/mock mode.
- No arbitrary Python or JavaScript execution by default. If scripts are indispensable, use a sandbox with resource/time limits, restricted network/filesystem, approvals and auditing. Prefer declarative transformations.

### 6.2 Execution and storage

- Publish **immutable versioned connector configurations**. Workers and form runtime resolve the same approved connector versions through a restricted registry API (or existing secure store).
- Store secrets in a secret manager or protected encrypted storage; never in BPMN XML, form schema, logs or browser responses.
- Restrict outbound destinations (allowlist / SSRF protection), validate TLS, scope credentials and enforce tenant/role access.
- Support OAuth/token refresh, retries with exponential backoff, circuit breaking, rate limits, pagination and observability.
- Separate read-only form-data connectors from side-effecting actions. Disallow arbitrary side-effecting API calls on each keystroke.
- Idempotency for write operations and Camunda external task retries; use dead-letter/incident handling on terminal failures.

### 6.3 External task worker linkage

A BPMN service task may use `camunda:type="external"` and a shared topic such as `wf.connector`. The worker subscribes by polling Camunda `fetchAndLock`; the task's published connector reference and mapped inputs tell it **which** API to execute. One generic worker implementation can execute many distinct workflows. Multiple worker replicas can share the topic with lock management and idempotent operations. Worker deployment location does not determine which Portal initiated the workflow.

## 7. Email: SMTP and HTTP API modes

- Studio Email Task configuration: choose **SMTP** or **Email API** (using an approved HTTP connector).
- Common template editor: To/CC/BCC, subject, plain text/HTML body, variables, attachments, sender identity, reply-to, localization where needed.
- SMTP adapter uses existing configuration; HTTP adapter maps template into company email API request/response.
- Worker executes the selected adapter. Handle auth, provider errors, retry, idempotency, duplicate prevention and audit. Never send duplicate email just because a worker retries.
- Preserve current SMTP workflows and migrate configurations without breaking old deployments.

## 8. Groups, identity, task routing and visibility

- Studio task properties: assignment type = explicit employee, expression, candidate group(s), candidate users, or resolver API.
- Searchable group picker populated from company directory/Master DB; display group name, ID and **authorized member preview** when selected. Handle pagination, stale membership and privacy/permission constraints.
- Identity employee ID must match Camunda assignee/candidate identity mapping; document canonical ID (e.g., `emp_code`) and enforce consistency.
- Portal: **My Tasks**, **Group Tasks / Available Tasks**, **Claimed Tasks**, and admin-scoped views with appropriate permissions. Claim/unclaim controls, visibility filtering and race handling.
- Clarify semantics: candidate group task is available to eligible members, typically claimed by one person; approval by *all* members requires multi-instance BPMN or a dedicated approval pattern.
- Camunda's native identity store may not contain company group memberships; implement an explicit identity/group resolution strategy rather than assuming Camunda knows SSO groups.

## 9. Delegation, reassignment, escalation and task lifecycle

- Studio User Task policy editor: `allowDelegation`, permitted delegate scope/groups, `allowReassignment`, delegation expiry, fallback/escalation, required owner review after delegate resolves, audit requirements.
- Portal: Delegate, Reassign, Claim, Unclaim, Resolve Delegation, Return to Owner where appropriate; show current assignee, original owner, delegation state and history.
- Camunda 7 supports delegation and assignment primitives; **delegation is not the same as reassignment**. Delegation with resolution may return control to the owner; direct delegate completion requires a deliberately defined policy/alternative path.
- Enforce actor permissions **in Portal backend**; do not trust browser-supplied user IDs or group memberships. Support absence/out-of-office and timer-based escalation where policy requires.
- Audit who delegated to whom, when, why, what was changed, and who finally completed the task.
- Protect against completing a task while delegated/pending in an invalid state; handle simultaneous claims and updates.

## 10. Studio and Portal changes by subsystem

### Studio frontend

- Independent Start Event and flexible BPMN sequencing.
- Rich visual form palette, drag/drop, conditional sections, repeating tables, API data sources, style controls, responsive preview.
- Generic action/validation editor for every start form and user-task form.
- Advanced HTTP connector editor, JSON mapping/transformation/pipeline UI and test console.
- SMTP/API email selector and template editor.
- Group picker/member preview and assignment/delegation policies.
- Validation diagnostics, published-version explorer and migration compatibility warnings.

### Studio backend / persistence

- Canonical schema validation and compilation; versioned published registry for forms, connectors, rules, task policies and layout metadata.
- Permissioned connector test/execution, secret references, immutable published snapshots, migration scripts and audit.
- BPMN/form deployment and metadata binding; dependency validation before publish.
- Stable runtime API contracts (not authoring endpoints) for Portal and workers.

### Portal frontend

- Shared renderer for built-in and custom form components, responsive styling, dynamic conditions, editable/data tables and attachment handling.
- Runtime form-data loading, field-change dependency management, pre-submit validation popup/inline errors, loading/retry states and preservation of input on failure.
- Group task views, claim/delegate/reassign/resolve UI, request/task status and audit visibility as authorized.
- Never create workflow-specific React pages for ordinary new workflows.

### Portal backend

- Real SSO/JWT or trusted identity integration (replace dev auth for production); strict identity/group checks.
- Start-form and user-task **validate-then-submit** endpoints; use authenticated identity, not a caller-supplied `initiator`.
- Safe connector-runtime invocation; only approved published actions; enforce permissions, request validation, idempotency and rate limits.
- Camunda start/complete/delegate/reassign/claim/unclaim APIs, audit logs and stable error codes.

### Shared integration runtime / workers

- Continue existing generic Camunda external task polling, configuration resolution and completion/failure.
- Add or extend HTTP transformation/pipeline support and email API adapter.
- Expose **separate** secure request/response form-data and validation execution path (not external-task polling).
- Operational logging, tracing, retry policy, credential rotation, monitoring and idempotency.

### Camunda 7

- No Camunda source modifications expected. Use supported BPMN, deployment, process definition, external task, user task, assignment/delegation and history REST APIs.
- Verify exact API behavior, authentication, variable serialization, form binding and deployment version semantics in the installed Camunda version.

## 11. Submission transaction contracts and failure semantics

### 11.1 Start form

1. Portal loads published form and allowed connectors; backend determines authenticated employee.
2. On load/change, authorized runtime fetches field options/data; Portal updates UI.
3. Employee clicks Submit. Disable duplicate action and generate idempotency key.
4. Backend validates schema/conditional fields, executes ordered pre-submit rules and API checks.
5. If invalid/API unavailable under fail-closed policy: return structured error; **do not start Camunda instance**; show popup or inline errors.
6. If valid: optionally reserve scarce resource, then start process via Camunda using canonical variable types and authenticated initiator.
7. Record correlation/request ID, response and audit; handle Camunda failure with retry/deduplication and reservation release/compensation.

### 11.2 User Task form

1. Verify task exists, is active, and authenticated actor is authorized (assignee, candidate claimant or valid delegate).
2. Load deployment/version-specific task form and data.
3. Before Submit/Approve/Reject, validate schema and execute task-specific rules on backend.
4. On failure: return errors; **do not complete task**.
5. On success: complete Camunda task once, with correct decision and typed variables; handle concurrent completion and idempotency.

### 11.3 After submit

- Distinguish **pre-submit blocking rules** from **post-submit BPMN service tasks**. A post-submit API failure cannot retroactively guarantee that no process instance was started; use compensating actions, incidents, or explicit wait states as needed.
- Non-critical notifications can be asynchronous. Critical side effects must have reliable retries and idempotency.

## 12. Example end-to-end workflows

### 12.1 Leave request

- Portal start form fetches leave types from Master DB; employee selects leave type; corresponding medical/earned/casual section appears; earned leave may show editable handover table.
- On Submit, backend checks current balance and date/policy rules via approved API. If 5 days requested but 3 available, show popup and **do not create instance**.
- On success, start Camunda instance; system tasks may fetch manager/HR; manager task assigned via group/employee resolver; optional delegation; HR approval; final leave update and email API/SMTP notification.
- Concurrent requests require authoritative reservation/final check; approvals and side effects must be idempotent.

### 12.2 Hiring

- JR creation form with API-backed role/panel choices and conditional sections; pre-submit duplicate JR/policy check.
- Part head → Group head → TA head approvals; recruiter uploads candidate profiles; worker calls profile extraction API; screening panel; telephonic round; conditional interview rounds based on score; recruiter offer; applicant acceptance/rejection.
- Dynamic tables for candidates/interview rounds; group assignment and delegation; nested API response mappings.

### 12.3 Laptop request

- API-backed device catalog; eligibility check **before start**; manager approval; IT inventory lookup; reservation/allocation; notification via email API; error/compensation if stock changes.

### 12.4 Travel/expense/IT ticket

- Travel: budget check; expense: policy limit check; IT ticket: duplicate ticket check. All use the **same** reusable before-submit action engine with different configured connectors and messages.

## 13. Published configuration and API contract requirements

Design explicit, documented contracts rather than ad hoc implicit coupling:

- `PublishedWorkflow`: key, version, Camunda deployment/process definition references, start form ref, status, allowed starters.
- `PublishedForm`: schema, layout/theme metadata, conditional rules, API data-source refs, action/validation refs, compatibility version.
- `PublishedConnector`: immutable ID/version, operation, URL allowlist classification, auth secret reference, input/output schemas, mappings, timeout/retry/idempotency policies.
- `TaskPolicy`: assignee/candidate groups, delegation/reassignment rules, permissions and escalation.
- `ExecutionRequest`: actor context (server derived), workflow/form/task version, field values, connector/action refs, correlation and idempotency key.
- `ExecutionResult`: mapped data or typed blocking/non-blocking errors, sanitized messages and trace ID.

Define schemas (JSON Schema/OpenAPI/Pydantic/TypeScript types), versioning and backward compatibility. Studio publishing should fail on missing connector refs, unsupported components, invalid expressions, unavailable form bindings, or unresolved required assignment configuration.

## 14. Security, compliance and operational requirements

- SSO for employees and admins; admin-only authoring/publishing, runtime role checks and least privilege.
- Strict separation of Studio authoring APIs, published runtime APIs and worker execution credentials.
- Connector outbound allowlist, SSRF protection, TLS verification, scoped secrets and redacted logs; never let a form field supply arbitrary API host/credentials.
- Form expressions must be sandboxed/declarative; no `eval`, arbitrary JS, unrestricted Python or untrusted HTML execution.
- Uploaded files scanned and access controlled; audit PII and data retention policies; limit sensitive data in process variables/history.
- API timeouts, retries, rate limiting, cancellation, backpressure, monitoring, incident recovery, health checks and trace IDs.
- Idempotent submit/complete and external API side effects; safe failure when validation service is down.
- Deployment environments and config/secrets separation; no production credentials in code, Git or UI schema.
- Consider Camunda 7 lifecycle/support constraints in long-term production planning; do not assume an engine migration is in scope.

## 15. Implementation plan — incremental, not a rewrite

### Phase 0 — Repository audit and architecture decisions (mandatory)

1. Enumerate Studio/Portal/worker repositories, Docker Compose topology, dependencies and installed form-js/Camunda versions.
2. Trace current BPMN deploy → Portal form retrieval → submit → worker execution, with one existing workflow.
3. Identify current form schema, extension points, connector registry/storage, auth and group mapping, worker topics and email adapters.
4. Produce **gap matrix**: requirement / already exists / partial / missing / exact files and endpoints / risks / proposed change.
5. Obtain real Master DB/email API contracts, authentication and environment constraints; mock missing services for tests.
6. Confirm optional HTML-to-editable-form converter scope; do not implement it by default.

### Phase 1 — BPMN start flexibility + canonical form contract

- Remove forced first User Task; support Start Event form vs User Task form; maintain old workflows.
- Define canonical form schema, custom component registry, deployment/version bindings and compatibility tests.

### Phase 2 — Visual form builder

- Add sections, conditional visibility, responsive layout, editable/repeating tables and data tables.
- Ensure Studio preview and Portal renderer behave identically.
- Add schema validation, typed submissions and test fixtures.

### Phase 3 — Runtime API data sources + universal validation

- Secure form-data connector runtime, API-backed dropdowns, dependencies, on-load/change actions.
- Before-submit rules for **start and every user task**, blocking popup/field errors, server-side enforcement, idempotency and concurrency controls.
- Test leave, hiring, inventory and travel scenarios to prove genericity.

### Phase 4 — Advanced connectors + email API

- Nested JSON mappings, transformation rules, multi-step API pipelines, safe execution and diagnostics.
- SMTP/API email adapters with template mapping and idempotency.

### Phase 5 — Groups and delegation

- Group/member directory lookup, candidate group UI, assignment resolution, Portal task claiming, delegation/reassignment/resolution, permission checks and audit.

### Phase 6 — Production hardening + optional enhancements

- Security review, migration, performance/load tests, operational monitoring, docs, deployment rollback and training.
- Only with explicit approval: HTML-to-editable-form conversion editor.

**Do not estimate effort as a fixed commitment without codebase inspection, API access and acceptance scope.** Deliver in small reviewable PRs/migrations with tests.

## 16. Testing matrix and acceptance criteria

### BPMN and compatibility

- [ ] New workflow can begin with system task, user task or valid gateway; start form optional.
- [ ] Existing deployed workflows/forms still run unchanged.
- [ ] Studio and Portal connect to the same Camunda engine; worker processes Portal-started instances.
- [ ] One generic worker handles API service tasks across multiple workflow definitions.

### Forms

- [ ] Admin creates form entirely visually, without HTML/code.
- [ ] Admin builds conditional leave-type sections, editable table with add/remove rows and API-backed data table.
- [ ] Field changes trigger dependent dropdown API and ignore stale responses.
- [ ] Dynamic validation/requiredness works in preview and Portal and is enforced by backend.
- [ ] Hidden field values are handled according to explicit policy.
- [ ] Form version changes do not break in-flight workflow instances.

### Universal submission blocking

- [ ] Leave insufficient balance → popup/inline error; **zero new Camunda instances**.
- [ ] Laptop ineligible → blocked start; hiring duplicate JR → blocked start; travel budget exceeded → blocked start.
- [ ] Manager/HR task validation fails → **task remains active and uncompleted**.
- [ ] Validation API outage uses configured fail-closed policy; no accidental approval/start.
- [ ] Double-click/retry cannot create duplicate instances or complete tasks twice.
- [ ] Scarce-resource concurrency scenario is addressed with authoritative reservation/final check or documented compensation.

### Connectors and email

- [ ] Nested JSON extraction, array mapping, conditional transform and chained API pipeline work with mocks.
- [ ] Invalid mapping or unsupported auth produces actionable Studio error.
- [ ] API credentials never reach Portal/browser or logs.
- [ ] SMTP and HTTP Email API tasks both work; retry does not send duplicate email.

### Identity, groups and delegation

- [ ] Studio can select a group and preview permitted members from directory.
- [ ] Group members see eligible tasks; only authorized user can claim/complete.
- [ ] Delegation, resolution, reassignment, return-to-owner and escalation follow configured policy.
- [ ] Unauthorized user cannot delegate, claim or complete via direct API call.
- [ ] Audit history records all task transfers and decisions.

### Nonfunctional

- [ ] Docker Compose and production deployment docs updated.
- [ ] Database migrations include rollback/compatibility strategy.
- [ ] API contracts/OpenAPI, schema examples and extension guide documented.
- [ ] End-to-end integration tests and smoke test scripts runnable locally with mock APIs.
- [ ] Metrics, traces, errors and worker incidents observable.

## 17. Required deliverables from implementing LLM

1. **Initial audit report** with exact current code paths, existing capabilities and missing pieces; no speculative file names.
2. **Design proposal** with data model, schemas, API endpoints, sequence diagrams and compatibility strategy; flag any required product decisions.
3. **Implementation plan** broken into small, independently testable steps and dependencies.
4. **Code changes** in Studio, Portal, worker and database migrations as needed; preserve existing architecture and features.
5. **Automated tests** (unit, contract, integration, end-to-end), including negative and concurrency scenarios.
6. **Example workflow fixtures**: leave, hiring, laptop request, travel validation, group delegation.
7. **Documentation**: admin guide for visual designer, connector setup, validation rules, group delegation, deployment and troubleshooting.
8. **Evidence of completion**: test output, screenshots or recordings of Studio/Portal flows, list of changed files, known limitations, and instructions to reproduce.

## 18. Explicit instructions to the coding agent

- **Do not begin by rewriting the entire project.** First inspect the real repositories and produce the Phase 0 gap matrix.
- **Do not hardcode leave logic.** Every trigger, condition, API call, popup, table and submission rule must be reusable across workflow types.
- **Do not assume Camunda external tasks can serve pre-start UI requests.** Implement distinct interactive form-data/validation execution.
- **Do not treat client-side validation as authoritative.** Validate in backend before Camunda start/complete.
- **Do not assume arbitrary form-js schema extensions are automatically supported by Camunda.** Verify or use a versioned metadata registry/adapter.
- **Do not expose credentials or permit unrestricted user-defined code/HTML.** Use declarative, constrained configuration.
- **Do not conflate candidate group assignment with all-member approval; do not conflate delegation with reassignment.**
- **Do not modify production Master DB directly** without approved API contract and authorization; use mock services in development.
- **Do not silently change old process/form versions.** Provide safe migrations, compatibility and rollback.
- Ask targeted questions only for genuinely missing external contracts, permissions or irreversible business semantics; otherwise proceed using explicit documented assumptions.
- After each phase, report what is implemented, what remains, exact tests performed and any unresolved risk.

## 19. Product decisions requiring confirmation before final implementation

- Should the optional HTML-to-editable-form converter be included later? **Default: deferred; visual builder is mandatory.**
- What is the authoritative company employee/group API and employee ID claim? **Unknown.**
- Which APIs support reservation/atomic validation (leave balance, inventory, budget)? **Unknown.**
- What is the company email API authentication, payload and attachment contract? **Unknown.**
- Which Camunda 7 and form-js versions and custom extension hooks are installed? **Inspect.**
- Should delegated tasks require owner review, or can delegates complete them directly? **Per-task configurable policy, default to explicit Camunda delegation semantics.**
- Which custom table widgets/layout controls must be in the first release? **Prioritize conditional sections, editable/repeating tables and API data tables.**

---

**Definition of success:** An authorized administrator can design and publish a new enterprise workflow with a flexible BPMN start, fully visual conditional forms, editable tables, API-driven dropdowns, nested API mappings, generic pre-submit blocking validations, group assignment/delegation and SMTP/API email—then an employee can run it from Portal—**without editing or rebuilding application code for that workflow**, using the platform's supported primitives. Existing workflows remain functional, security boundaries are preserved, and all runtime actions are versioned, auditable and tested.
