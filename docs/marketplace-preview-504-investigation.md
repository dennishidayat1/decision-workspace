# Marketplace preview HTTP 504 investigation

Investigation resumed on 2026-11-12. Production root cause remains unconfirmed.

This is a chronological investigation record. Earlier code observations describe the implementation at that time; the final section records the locally implemented fix and current diagnostics.

## State inherited from the interrupted session

- HEAD: `e27e3f2` (`feat: add option comparison and marketplace image recovery`).
- At entry: 46 modified tracked files, plus untracked native projects and client tests/guards. Existing changes were preserved.
- Existing client changes concern Capacitor/native support, authentication/account isolation, pending edits, comparison, and image recovery lifecycle handling.
- The only existing tracked server changes are CORS origin configuration in `Program.cs` and `appsettings.json`.
- No saved investigation notes, production logs, failing marketplace URL, or preview-specific uncommitted fix were found. Repository state alone cannot establish what the previous session investigated.
- Committed code already provides optional image-import timeout fallback, image recovery tests, a 10-second Marketplace HttpClient timeout, and disabled HTTP/3 support. These are pre-existing, not changes made during this investigation.

## Confirmed from current code and offline tests

- Client production configuration targets `https://decision-workspace-api.onrender.com/api`. The deployed revision/configuration has not been verified.
- `POST /api/marketplace-links/preview` is authenticated. Its controller explicitly returns HTTP 504 for an `OperationCanceledException` when the caller token has not been cancelled. Its response message is `Marketplace took too long to respond. Please try again.`
- URL resolution makes GET requests with `ResponseHeadersRead`, following up to five redirects and checking supported marketplace URLs at every hop. Even a direct product URL is requested during resolution.
- The HTML phase makes a separate GET to the resolved URL with `ResponseContentRead`. Each send has the configured 10-second HttpClient timeout; there is no overall metadata deadline. These phases and redirects can accumulate time.
- Both resolution and HTML-fetch timeout exceptions produce the same application 504. Existing controller warning logs do not identify the phase or include the timeout exception.
- Upstream non-success HTTP statuses return null from the metadata service and become controller HTTP 400; an upstream HTTP 504 response alone does not trigger the controller's 504 exception handler.
- Optional image import has its own 20-second overall deadline and a 10-second download deadline. Its timeout returns null, allowing preview to use the marketplace image URL. The new controller regression checks confirm this produces HTTP 200 after successful metadata retrieval.
- The client preview call has no explicit RxJS timeout.

## Unconfirmed explanations

- A marketplace request exceeding the configured timeout, marketplace blocking/rate limiting, network/DNS/TLS behavior from the production host, or a hosting gateway timeout are possibilities, not established causes.
- Duplicate product requests add work, but have not been demonstrated to cause the reported production failure.
- Local mocked tests do not reproduce production network conditions or prove which revision is deployed.

## Changes and validation in this investigation

- Added `PreviewTests.cs` and registered it in the existing backend regression runner. Checks cover resolution timeout -> 504, HTML-fetch timeout -> 504, and optional image timeout -> successful preview with source image fallback. All HTTP is mocked; no production API, marketplace, database, or storage requests are made.
- Existing baseline regression runner passed before changes (18 top-level checks).
- Expanded runner passed (19 top-level checks, including three new preview scenarios and nested existing recovery checks).
- API Release build passed with zero warnings/errors using `--no-restore`.
- No application behavior, timeout limits, production data, commits, pushes, or deployments changed. Frontend was not changed or rebuilt during this investigation.

## Evidence needed next

1. Exact failing marketplace URL, approximate timestamp/timezone, duration, response headers, and response body. The application JSON message above distinguishes its known timeout response from many gateway responses, but should be correlated with logs.
2. Matching Render request/application logs, including Marketplace HttpClient request logs and the `Marketplace preview timed out` warning, to identify whether resolution or HTML fetching failed. Existing logs may omit sufficient exception detail.
3. Deployed revision and effective configuration. If metadata requests time out, compare the exact URL/redirect chain from the production host before choosing a fix. Do not increase timeout limits without evidence.

No root-cause fix is justified yet. Production evidence was requested from the user.

## Follow-up: supplied Tokopedia short link

### New evidence

- User supplied `https://tk.tokopedia.com/ZSpuKfdyw/` and reported a local preview HTTP 200 in 5.36 seconds, successful metadata extraction, successful Supabase image persistence, and HTTP 200 image retrieval. This is user-observed evidence, not a new local reproduction performed by this investigation.
- The original production failure has not recurred and its body, timing, timestamp, and logs remain unavailable. Local success demonstrates that this URL can work; it does not establish production reliability or rule out an intermittent marketplace failure.
- Read-only production health probe at **2026-11-12 13:13:53 Asia/Jakarta**: HTTP 200, `{"status":"ok"}`, total 0.348486 seconds, first byte 0.348445 seconds, `Rndr-Id: d37ff005-16b4-4a61`, `x-render-origin-server: Kestrel`, `cf-cache-status: DYNAMIC`. This checks ingress and basic application responsiveness at one instant, not authentication, marketplace egress, image storage, or the original incident. Its Cloudflare `SIN` edge identifier does not establish the Render application's region.
- A single GET of the public short link, with `DecisionWorkspace/1.0` User-Agent and without following redirects, returned HTTP 302 in 0.285960 seconds at **2026-11-12 13:13:51 Asia/Jakarta**. Location was a supported `https://www.tokopedia.com/trondheim-original/trondheim-celana-denim-pria-loose-jeans-luz-bioblitz-1731457026907866405` URL with share tracking parameters. This probe originated from the investigation machine, not Render; it does not test Render-to-Tokopedia connectivity.
- `git ls-remote` confirmed GitHub `main` and remote HEAD are both `e27e3f230abac8fd0f3f1aef3c30db327b053e81`, matching local HEAD. This read did not fetch or change local refs. It does **not** confirm Render deployed that commit. The public health response contains no commit or build identity.

### Local versus production configuration

| Concern | Local source/configuration | Intended Render configuration | What remains unknown |
| --- | --- | --- | --- |
| Environment | Launch profiles set `Development`, HTTP port 5207 | Dockerfile sets `Production`, binds port 10000; application honors `PORT` | Actual Render environment overrides/build settings |
| Runtime | API targets .NET 10; local development runs on Windows | Dockerfile uses Linux `aspnet:10.0` runtime and `sdk:10.0` build images | Running local API binary and deployed binary/runtime patch identities; floating image tags do not pin an exact patch |
| Marketplace client | Hard-coded 10-second timeout, `DecisionWorkspace/1.0`, manual redirects | Same registration, with no Development/Production branch | Whether deployed code matches this registration; machine proxy/DNS/TLS/network differences |
| Timeout overrides | No `IConfiguration` lookup for marketplace timeout | A hypothetical `Marketplace__Timeout` variable is not consumed by this code | A different deployed implementation could behave differently |
| Logging | Both appsettings files specify default Information and Microsoft.AspNetCore Warning | Same checked-in levels; HttpClient factory supplies outbound request logging | Effective Render logging overrides and retained incident logs |
| HTTP/3 | Project explicitly disables outbound HTTP/3; existing Release runtimeconfig contains `false` | Same project setting is intended to publish into the image | Actual deployed runtimeconfig; inbound Cloudflare `alt-svc: h3` is unrelated to outbound client configuration |
| Supabase | Client dev/prod files and base API appsettings name the same project | API accepts configuration overrides for URL/key | Effective Render URL and key validity; local success proves only local configuration |
| Credentials/config providers | Development can load user secrets | Production normally uses environment variables or secret files | Effective private settings; no secret values were retrieved or printed |
| CORS | Existing uncommitted server diff only adds web/native origin allowlists | Git-based deploy does not contain those uncommitted edits | Effective deployed allowlist; no evidence connects CORS changes to a server HTTP 504 |

There is no environment-specific marketplace timeout, retry policy, or ASP.NET request-timeout middleware in the checked-in code. The older marketplace-import commit `8a72831` also configured the 10-second timeout; comparing it with HEAD shows the significant preview addition is optional image persistence, not a timeout change. A stale deployment remains unverified, not a demonstrated explanation.

### Timeout interpretation for this URL

With the observed one-hop redirect, the current service normally sends three metadata GETs: short-link headers, final product headers during resolution, then the final product HTML again. Each send has a separate 10-second timeout. Resolution only waits for headers; the HTML send buffers content. There is no single 10-second budget for the full preview, so the 5.36-second local result is compatible with this configuration without predicting production timings.

If the application 504 message is captured next time, it points to metadata timeout handling in the matching revision. It does not distinguish the short link, final headers, or HTML body. Optional image-import failures are handled separately. A gateway-generated 504, or a failure before the controller during authentication, needs ingress/application log correlation instead. Current preview handling does not query the decision database, so a slow decision query is not supported as an explanation for its explicit 504 path.

### Render-specific possibilities and evidence limits

- Render documents [Free-service idle spin-down after 15 minutes and roughly one-minute spin-up](https://render.com/docs/free). This applies only if the service uses Free compute. The plan and incident startup events are unknown; the fast health probe shows responsiveness now, not at the incident.
- Render documents [shared outbound IP ranges by region](https://render.com/docs/outbound-ip-addresses). Marketplace treatment of a datacenter IP, regional routing, DNS, or TLS could differ from the local machine. No Render-origin request trace currently confirms blocking or latency.
- Render documents [HTTP responses up to 100 minutes](https://render.com/docs/render-vs-heroku-comparison). There is no evidence here for imposing an assumed 30-second Render limit. This does not exclude edge/infrastructure errors; the missing failure response and logs prevent classification.
- Resource pressure, restarts, and deploy transitions need incident-time CPU/memory charts and instance events. A single healthy response cannot confirm or exclude these explanations.

### Next evidence to collect without changing production behavior

1. Read the **live successful deploy** SHA, branch, runtime/build configuration, region, and instance plan from Render. Its [Deploys page identifies the current live deploy](https://render.com/docs/deploys); `RENDER_GIT_COMMIT` is also a [documented runtime variable](https://render.com/docs/environment-variables) for Git-backed services. Do not equate the latest GitHub commit or latest attempted build with the live revision.
2. Review non-secret effective environment/logging settings. Environment variables can override appsettings; compare `ASPNETCORE_ENVIRONMENT`, `DOTNET_ENVIRONMENT`, relevant `Logging__LogLevel__...` entries, Supabase project host, and proxy-variable presence without disclosing key or proxy credential values.
3. On a future user-observed preview failure, record the full response body, status, `Content-Type`, `Rndr-Id`, `CF-Ray`, elapsed time, and timestamp/timezone. Correlate `Marketplace preview timed out`, `System.Net.Http.HttpClient.Marketplace`, optional image-import warnings, and deploy/startup/instance events in the same interval. Outbound completion logs can refer to received headers, so they alone do not prove the HTML body finished buffering.
4. Render's [logging documentation](https://render.com/docs/logging) describes `Rndr-Id` correlation and runtime log search; platform HTTP request logs require Pro workspace or higher. App logs can still be inspected when platform request logs are unavailable. The current controller does not explicitly include `Rndr-Id` in its messages, so correlation may require timestamps and adjacent request logs.
5. If a recurrence identifies a slow metadata request, compare that exact URL/redirect phase from the Render host with the local trace using read-only GETs. Do not use the authenticated preview endpoint merely as a connectivity probe: successful preview persists a new image. Free services do not offer shell access, so the available diagnostic method depends on the confirmed plan. Any proposed diagnostic deployment requires separate approval.

### Follow-up changes and validation

Only this investigation document was updated in the follow-up. Existing application and test changes remain intact. No new behavior, timeout changes, builds, or regression tests were necessary for this documentation-only update; the prior 19-group backend test pass and clean Release build remain the last validation results. No authenticated preview request, image upload, production-data mutation, commit, push, or deploy was performed. Root cause remains unresolved pending live deployment/settings evidence or a captured production recurrence.

## Follow-up: production console error captured

The user subsequently supplied an Angular `HttpErrorResponse` for the production preview endpoint with `status: 504`, `statusText: "Unknown Error"`, `responseType: "cors"`, and `redirected: false`. This supplies a production failure capture, but not its timestamp, duration, response body, or expanded headers. It does not establish whether this is a fresh recurrence or the original failure, nor independently identify the submitted marketplace URL. The response `error` property is collapsed in the provided console output.

The `responseType: "cors"` field alone does not diagnose a CORS failure, and `statusText: "Unknown Error"` does not identify the component returning the response. The captured HTTP status still cannot distinguish the application's metadata timeout response from a gateway-generated 504. Requested the Network panel response body, timing, timestamp, and `Content-Type`, `Rndr-Id`, and `CF-Ray` response headers, or the expanded console object's `error` property if the Network entry is unavailable. The live Render SHA, plan, region, and effective configuration are still unknown. No application changes are justified by this capture alone.

## Confirmed application timeout and local fix

### Production failure evidence supplied by user

- Response body: `{"message":"Marketplace took too long to respond. Please try again."}`.
- Duration: **13.70 seconds**.
- Origin server: **Kestrel**.
- Render request ID: **ad4245ed-8bb3-4d0b**.
- Timestamp: **2026-11-12 06:14:01 GMT**, equivalent to **2026-11-12 13:14:01 Asia/Jakarta**.
- Same supplied Tokopedia short link succeeds locally in **5.36 seconds**.

This identifies the application's metadata-timeout response rather than an unexplained gateway response. The original stage is still unknown: the old implementation could time out waiting for short-link headers, final-page headers during resolution, or headers/body on the second final-page GET. These were GET requests, **not HEAD requests**. Headers-only completion describes what the caller reads, not the HTTP method.

The 13.70-second end-to-end duration does not identify the stage, because prior metadata sends can complete before a subsequent send exhausts its 10-second budget. If the supplied timestamp marks response completion, the request began at approximately 13:13:47.3 Jakarta time and overlaps the successful 13:13:53 health probe. That timing is an inference and supports basic responsiveness during the interval; it does not prove which marketplace request stalled.

No private Render logs or deployment metadata are available through the current tools. Live SHA, region, plan, and effective environment remain unverified. The failure's confirmed layer is application metadata fetching; the specific stage and production network cause remain unresolved.

### Implemented locally

- Replaced separate resolution and HTML-fetch calls with `MarketplaceLinkService.GetPageAsync`, returning the final URI and HTML from the same successful GET. For this one-hop short link, metadata sends decrease from **three to two**; a direct product URL uses **one**. Redirect bodies are not downloaded.
- Kept HTTPS, supported-host, user-info, relative-redirect, and maximum-five-redirect checks. No new retry policy or abstraction layer was introduced.
- Kept the existing **10-second per-request timeout**. Because `ResponseHeadersRead` stops HttpClient's own timeout coverage at headers, a linked deadline with the same client timeout now explicitly covers headers plus final HTML body under one budget per hop. The budget is not restarted for the body. There is still no new overall-preview timeout.
- Added structured service logs for completed headers, completed HTML body, and timeout. Fields: `Stage` (`response_headers` or `html_body`), `Host`, zero-based `Hop`, `ElapsedMs`, and `RequestId`; completed headers also include `StatusCode`. Timeout logs retain the exception. Request ID uses inbound `Rndr-Id`, falling back to ASP.NET's trace identifier. The templates use host rather than full URL/query.
- Header timeouts on `tk.tokopedia.com`, hop 0, identify short-link resolution. Header timeouts on `www.tokopedia.com`, hop 1 for the observed redirect, identify final-page response headers. `html_body` identifies final-page body reading. Body elapsed time is measured from receipt of headers; the deadline still covers headers and body together.
- Preserved caller cancellation by allowing it to propagate instead of being mapped to the broad HTTP 500 handler. Upstream timeout still maps to the existing HTTP 504 body.
- Updated the image-recovery consumer to use the same combined fetch, removing its duplicate GET as a necessary adjustment to the shared service API. Its ownership checks, image persistence, concurrency handling, and failure semantics are otherwise unchanged and remain covered by its existing tests.
- Optional image persistence/fallback and the configured timeout value in `Program.cs` were not changed. Existing CORS and client/native edits were preserved.
- Consolidating resolution/read failures keeps HTTP 400 but uses the existing `Unable to read marketplace product page.` message for both; upstream non-success statuses are still not converted into the exception-based HTTP 504 response.

This fixes the confirmed duplicate-request inefficiency and preserves body timeout protection while making future timeouts diagnosable. It is **not proof** that the removed second GET caused the historical production failure, or that Render preview now succeeds. A production verification would require separately approved deployment and a controlled request that may create a storage image.

### Validation

- Expanded mocked preview checks pass: short-link and final-page header timeout classification; direct URL fetched once; one-hop short link fetched exactly twice; redirect body ignored; metadata and canonical URL preserved; stalled HTML body deadline; stage/host/hop/elapsed/request-ID/exception logging; caller cancellation propagation; unsupported/HTTP/user-info redirect rejection; relative redirects; bounded redirect loops; missing redirect location; upstream status rejection; network HTTP 502; and optional image-timeout fallback.
- Existing image/recovery/database-command regression runner passes all **19 top-level groups**, including nested preview/recovery checks. All HTTP and SQL execution are mocked/intercepted; these tests do not contact production or write Supabase data.
- API Release build succeeds with **zero warnings and zero errors**.
- Initial Debug validation hit an executable lock from the running local API. It was left running and validation used Release. An initial stalled-body test double did not implement HTTP content buffering; that test fixture was corrected to stall cancellable serialization, then the full suite passed. A prior failed test process briefly held a Release test assembly lock; only that investigation-owned session was stopped.
- `git diff --check -- server` passes. No frontend changes or frontend rebuild were needed for this server-only change.
- No commit, push, deploy, authenticated production preview request, or production-data modification was performed.
