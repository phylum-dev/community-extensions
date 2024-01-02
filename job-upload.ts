#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read

const PHYLUM_API_BASE = "https://api.staging.phylum.io/api";
const PHYLUM_API_KEY = Deno.env.get("PHYLUM_API_KEY");

const LABEL = "jupload";

if (Deno.args.length != 2) {
  throw new Error("usage: ./job-upload.ts <project-id> <lockfile>");
}
if (PHYLUM_API_KEY === "") throw new Error("API key required");

const project = Deno.args[0];
const path = Deno.args[1];
const contents = Deno.readTextFileSync(path);

fetch(`${PHYLUM_API_BASE}/v0/data/jobs/upload`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${PHYLUM_API_KEY}`,
  },
  body: JSON.stringify({
    project,
    label: LABEL,
    dependency_files: [{
      contents,
      path,
    }],
  }),
}).then((resp) => {
  console.log(resp);
  return resp.text();
}).then(console.log);
