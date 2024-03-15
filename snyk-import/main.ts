// deno-lint-ignore-file no-explicit-any

import { ApiVersion, PhylumApi } from "phylum";
import { parseArgs } from "https://deno.land/std@0.211.0/cli/parse_args.ts";
import {
  getOrgs,
  getProjectDependencies,
  getProjects,
  Project,
} from "./snyk-api.ts";
import { setToken, snykToken } from "./token.ts";
import { checkPhylumResponse } from "./lib.ts";
import { inParallel } from "./jobs.ts";

function usage() {
  console.log(
    "phylum snyk-import [--token SNYK_TOKEN] [--no-save-token] [--group phylum_group]",
  );
}

const args = parseArgs(Deno.args, {
  alias: { token: ["t"], group: ["g"] },
  string: ["token", "group"],
  boolean: ["save-token"],
  negatable: ["save-token"],
  default: { "save-token": true },
  unknown: (arg) => {
    console.error(`Unknown argument: ${arg}`);
    usage();
    Deno.exit(1);
  },
});

let tokenArg = args.token ?? Deno.env.get("SNYK_TOKEN");
if (tokenArg && args["save-token"]) {
  setToken(tokenArg);
}

if (!tokenArg) {
  tokenArg = await snykToken();
}

const token = tokenArg;

const orgs = await getOrgs(token);
const projects = (await inParallel(orgs, (org) => getProjects(token, org)))
  .flat();

inParallel(projects, async (project) => {
  try {
    await importProject(project);
  } catch (err) {
    console.warn(
      `Failed to import project '${project.name}': ${err}`,
    );
  }
});

/// Import the given Snyk project to Phylum.
async function importProject(project: Project) {
  const dependencies = await getProjectDependencies(token, project);
  if (dependencies.length === 0) {
    console.warn(
      `Skipping project '${project.name}'. No dependencies found.`,
    );
    return;
  }

  const createRes = await PhylumApi.createProject(project.name, args.group);
  const projectId = createRes.id as string;
  if (createRes.status == "Created") {
    console.log(`Created phylum project '${project.name}'`);
  }

  // Using PhylumApi.analyze() would be preferred, but that function doesn't support PURLs yet.
  // Ref: https://github.com/phylum-dev/cli/issues/1336
  const job_id = await PhylumApi.fetch(ApiVersion.V0, "/data/jobs/", {
    method: "POST",
    body: JSON.stringify({
      packages: dependencies,
      project: projectId,
      label: project.id,
    }),
  }).then(checkPhylumResponse).then(async (res: any) => {
    const resp = await res.json();
    return resp.job_id;
  });

  console.log(`Imported project '${project.name}' in job with ID ${job_id}`);
}
