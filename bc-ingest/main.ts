import { PhylumApi, PackageWithOrigin } from 'phylum';
import { GrootDeepJson, Ecosystem } from './types.ts';
import { parseArgs } from "https://deno.land/std@0.211.0/cli/parse_args.ts";
import { readFile } from "deno/fs/mod.ts";

/**
 * Phylum expects ecosystems, not languages. This function converts the given language into the expected ecosystem.
 * If no ecosystem exists, a warning is printed to the screen.
 */
function languageToEcosystem(language: string): Ecosystem {
    language = language.toLowerCase();
    
    if(["typescript", "javascript"].includes(language)) {
        return Ecosystem.Npm;
    }

    else if(language === "python") {
        return Ecosystem.Pypi;
    }

    else if(language == "ruby") {
        return Ecosystem.RubyGems;
    }

    else if(language == "java") {
        return Ecosystem.Maven;
    }

    else if(language == "go") {
        return Ecosystem.Go;
    }

    console.warn(`Phylum does not currently support analysis of '${language}' packages`);
    return Ecosystem.Unsupported;
}

/**
 * The SBOM is storing paths as package names for npm. This function attempts to extract the package name by splitting
 * on the slash, and grabbing the last item from the path string.
 */
function toNpmPackage(path: string): string {
    if(path.includes('node_modules')) {
        path = path.substr(path.lastIndexOf('node_modules'), path.length);
    }

    return path.replace('node_modules/', '');
}

/**
 *
 */
function is_semver(version: string): boolean {
    const invalidChars = ['^', '<', '=', '>', '~', '*'];
    
    for(let c of invalidChars) {
        if(version.includes(c)) {
            return true;
        }
    }

    return false;
}

/** 
 *
 */
function is_invalid_version(version:string): boolean {
    if(version === "" || typeof version !== "string" || version === null || is_semver(version)) {
        return true;
    }

    return false;
}

/**
 * Reads the provided JSON SBOM file.
 */
async function getJson(filePath: string) {
    return JSON.parse(await Deno.readTextFile(filePath));
}

/**
 * Attempts to parse the provided JSON SBOM as a "GrootDeep" format. Returns the identified packages as a set, 
 * suitable for submission into Phylum.
 */
function parseGrootDeep(json: string, origin: string): Array<PackageWithOrigin> {
    const parsed = json as GrootDeepJson;
    const identifiedPackages = new Set<PackageckageWithOrigin>();

    for(const language in parsed) {
        const ecosystem = languageToEcosystem(language);

        if(ecosystem === Ecosystem.Unsupported) {
            continue;
        }

        for(const packageName in parsed[language]) {
            const pkgs  = parsed[language][packageName];

            // Note: For some reason, this is an array of packages?
            pkgs.map(pkg => {
                if(ecosystem === "npm") {
                    pkg.name = toNpmPackage(pkg.name);
                }

                // Not all of the packages have string versions, some seem to have objects. If we
                // encounter a version object, grab the underlying `version` key.
                if(pkg.version && typeof pkg.version === "object") {
                    pkg.version = pkg.version.version;
                }

                // Some of the packages in the SBOM don't have a valid name and
                // version (e.g., empty package name). We shouldn't try and process
                // these.
                if(pkg.name === "" || pkg.name === null || is_invalid_version(pkg.version)) {
                   console.warn(`Invalid package found: name='${pkg.name}', version='${pkg.version}'`);
                } else {
                    identifiedPackages.add({
                        "type": ecosystem,
                        "name": pkg.name.toLowerCase(),
                        "version": pkg.version,
                        "origin": origin
                    });
                }
            });
        }
    }

    return Array.from(identifiedPackages.values());
}

/**
 * TODO: Parse "Baby Groot" structure.
 */
function parseBabyGroot(json: string) {
}

function usage() {
  console.log(
    "phylum bc-ingest [--file SBOM_PATH] [--group GROUP_NAME] [--project PROJECT_NAME] [--label PROJECT_LABEL]",
  );
}

const args = parseArgs(Deno.args, {
  alias: { filename: ["f"], group: ["g"], project: ["p"], label: ["l"] },
  string: ["filename", "group", "project", "label" ],
  default: { "group": null },
  unknown: (arg) => {
    console.error(`Unknown argument: ${arg}`);
    usage();
    Deno.exit(1);
  },
});

let error = false;

if(!args.filename) {
   console.error("\nERROR: No SBOM file specified, try `--filename SBOM_PATH`\n");
   error = true;
}

if(!args.project) {
    console.error("\nERROR: No project specified, try `--project PROJECT_NAME`\n");
    error = true;
}

if(error) {
    usage();
    Deno.exit();
}

let data = await getJson(args.filename);
let identifiedPackages = parseGrootDeep(data, args.filename);

if(identifiedPackages.length === 0) {
    console.log("No packages found in the SBOM");
} else {
    console.log(`\nFound ${identifiedPackages.length} packages in '${args.filename}'`);
    console.log(`Submitting packages to Phylum under the '${args.project}' project`);

    // Attempt to create the provided project. If the project already exists, the project ID will be
    // returned.
    const createRes = await PhylumApi.createProject(args.project, args.group);
    const projectId = createRes.id as string;
    if (createRes.status == "Created") {
        console.log(`Created phylum project '${args.project}'`);
    }

    const job_id = await PhylumApi.analyze(
        identifiedPackages,
        args.project,
        args.group,
        args.label,
    );

    console.log(`Submitted packages to Phylum for analysis under job ID = '${job_id}'`);
}
