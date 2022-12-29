// deno-lint-ignore-file no-explicit-any
import { parse } from "https://deno.land/std@0.170.0/flags/mod.ts";

import { ApiVersion, PhylumApi } from "phylum";

const USAGE = `
phylum multilock [OPTIONS] <LOCKFILE>...

Arguments:
  <LOCKFILE>...  The package lockfile(s) to submit.

Options:
  -l, --label <label>           Specify a label to use for analysis
  -p, --project <project_name>  Specify a project to use for analysis
  -g, --group <group_name>      Specify a group to use for analysis
  -h, --help                    Print help information
`.trim();

const args = parse(
  Deno.args,
  {
    unknown: (_a, k?) => {
      if (k) {
        console.error(`ERROR: Unexpected argument: ${k}`);
        console.log(USAGE);
        Deno.exit(-1);
      }
    },
    boolean: ["help"],
    string: ["_", "label", "project", "group"],
    alias: {
      "l": "label",
      "p": "project",
      "g": "group",
      "h": "help",
    },
  } as const,
);

if(args.help) {
  console.log(USAGE);
  Deno.exit(0);
}

if (!args._.length) {
  console.error("ERROR: No lockfile provided");
  console.log(USAGE);
  Deno.exit(-1);
}

type Package = { name: string; version: string; type: string };
const packages = await Promise.all(
  args._.map((lockfile) =>
    PhylumApi.parseLockfile(lockfile as string).then((l: any) =>
      l.packages.map((p: any) => ({ ...p, type: l.package_type })) as Package[]
    )
  ),
).then((pkg_lists) => pkg_lists.flat());

if (!packages.length) {
  console.error("ERROR: No packages could be parsed from provided lockfiles");
  Deno.exit(-1);
}

const package_type = packages[0].type;
const label = args.label ?? "uncategorized";
let project: string;
let group_name: string | null;

if (args.project) {
  const project_info: any = await PhylumApi.getProjects(args.group)
    .then((projects: any) => projects.find((p: any) => p.name == args.project));

  if (!project_info) {
    console.error(`ERROR: Could not find project: ${args.project}`);
    Deno.exit(-1);
  }

  group_name = args.group ?? null;
  project = project_info.id;
} else {
  const project_info = PhylumApi.getCurrentProject() as any;
  if (!project_info) {
    console.error("ERROR: No .phylum_project found. Please use --project");
    Deno.exit(-1);
  }
  project = project_info.id;
  group_name = project_info.group_name ?? null;
}

const body = {
  type: package_type,
  packages,
  is_user: true,
  label,
  project,
  group_name,
};

const res = await PhylumApi.fetch(ApiVersion.V0, "/data/jobs", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify(body),
});

if (!res.ok) {
  console.error(`HTTP ${res.status} - ${res.statusText}`);
  console.error(`${await res.text()}`);
  Deno.exit(-1);
}

const job_id = await res.json().then((j) => j.job_id);

console.log(`✅ Successfully submitted job: ${job_id}`);

let host = await PhylumApi.apiBaseUrl().then((u) => u.host);
if (host.includes("staging")) {
  host = "app.staging.phylum.io";
} else {
  host = "app.phylum.io";
}

const groupQuery = group_name ? `&group=${group_name}` : "";

console.log();
console.log(
  `See results at: https://${host}/projects/${project}?label=${label}${groupQuery}`,
);
