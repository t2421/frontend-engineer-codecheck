# Cloudflare metadata read diagnostic

This manual workflow diagnoses the dashboard metadata reads performed by Wrangler
4.143.1 before uploading an existing Worker. It does not build or deploy a Worker,
change credentials, permissions or secrets, or invoke the upstream population API.

After this workflow is merged into `main`, run **Diagnose Cloudflare metadata** in
GitHub Actions with the `main` branch selected. It uses the existing
`CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` from the `production` environment.
Existing environment protection rules still apply. The CLI equivalent is:

```sh
gh workflow run cloudflare-metadata-diagnostic.yml --ref main
```

The script first reads service metadata to discover the default environment, as
Wrangler does, then reads bindings, routes, custom domains, subdomain status,
environment metadata and schedules for `population-viewer`. All requests are GETs
to the fixed `https://api.cloudflare.com` origin. Redirects are rejected and each
request has a ten-second timeout, including response parsing.

Each output line contains only a predefined endpoint category, HTTP status and
safe integer Cloudflare error codes. Request URLs, environment names, headers,
response bodies, configuration and exception details are never printed or saved
as artifacts. Status `0` means no HTTP response was available (or credentials
were invalid before making a request). A nonzero exit status means at least one
read failed, or the initial response could not safely identify an environment.
Later reads continue after individual failures to identify all affected APIs.

Use the failed endpoint and status to assess the smallest necessary correction.
Do not infer missing permissions from the generic Wrangler error alone. This
workflow grants no additional permissions and performs no deploy after diagnosis.
