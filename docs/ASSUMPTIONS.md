# Integration assumptions and known limitations

- The portal uses the Studio's existing design tokens from `frontend/src/theme/tokens.ts` and preserves Figtree, white cards, blue accent and rounded controls.
- Camunda 7 REST API is reachable by the portal backend; no Camunda container is bundled.
- Deployed BPMN includes process definition key equal to workflow key, deployed Camunda Forms, and candidate starter groups in BPMN XML.
- Camunda form schema response may be a JSON object, a `form` JSON string, or JSON string. Verify actual `/deployed-start-form` and `/deployed-form` responses on your server.
- History variable queries, multi-value filters, group task filters, and task claim behavior require validation against the actual Camunda 7.22 server.
- The existing bot sets `initiator`, `wf_title`, `wf_status` conventions as documented in the supplied specification. Portal stamps initiator; bots own other reserved values.
- `My requests` currently returns the number of results on a page as `total`; true total count and robust pagination require a separate count query.
- The Withdraw action is displayed for running requests owned by the initiator, but the UI cannot establish BPMN message subscription support ahead of time; unsupported workflows may fail at runtime.
- The current attachment implementation supports owner-only download. Specified task participant access and form-js upload-slot replacement are not yet implemented.
- No fake Camunda service, browser E2E suite, or CI workflow is included in this initial implementation. Tests and live Camunda verification remain necessary before production use.
- No network access to the company Camunda server was available during this build. Live end-to-end behavior is unverified.
- Real authentication depends on a JWT issuer or trusted gateway; never enable dev mode in production.
- Static frontend build depends on npm packages being available during `npm ci`.
