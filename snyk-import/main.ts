//import { PhylumApi } from 'phylum';
import { parseArgs } from "https://deno.land/std@0.211.0/cli/parse_args.ts";
import { getOrgs, getProjects } from "./snyk-api.ts";
import { setToken, snykToken } from "./token.ts";

function usage() {
  console.log("phylum snyk-import --token SNYK_TOKEN");
}

const args = parseArgs(Deno.args, {
  alias: { token: ["t"] },
  string: ["token"],
  boolean: ["save-token"],
  negatable: ["save-token"],
  default: { "save-token": true },
  unknown: (arg) => {
    console.error(`Unknown argument: ${arg}`);
    usage();
    Deno.exit(1);
  },
});

let tokenArg = args.token;
if (tokenArg && args["save-token"]) {
  setToken(tokenArg);
}

if (!tokenArg) {
  tokenArg = await snykToken();
}

const token = tokenArg;

const orgs = await getOrgs(token);
const projects = (await Promise.all(orgs.map((org) => getProjects(token, org))))
  .flat();
console.log(projects);
