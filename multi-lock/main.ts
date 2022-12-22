import { parse } from "https://deno.land/std@0.170.0/flags/mod.ts";

import { ApiVersion, PhylumApi } from "phylum";

const args = parse(Deno.args, {
  unknown: (a, k?) => {
    if (k) throw new Error(`Unexpected argument: ${k}`);
  },
  string: ["_", "label"],
});

if (!args._.length) {
  throw new Error("No lockfile(s) provided");
}

type LockfileData = {
  package_type: string;
  packages: { name: string; version: string; type?: string }[];
};
const lockfile_data: LockfileData[] = await Promise.all(
  args._.map((lockfile) => PhylumApi.parseLockfile(lockfile as string)),
) as LockfileData[];

lockfile_data.forEach((l) =>
  l.packages.forEach((p) => {
    p.type = l.package_type;
  })
);

const package_type = lockfile_data[0].package_type;
const packages = lockfile_data.flatMap((l) => l.packages);

const project = PhylumApi.getCurrentProject() as any;
if (!project) throw new Error("No .phylum_project file found");

const body = {
  type: package_type,
  packages,
  is_user: true,
  label: args.label ?? "uncategorized",
  project: project.id,
  group_name: project.group_name,
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

console.log(`✅ Successfully submitted job: ${(await res.json()).job_id}`);
