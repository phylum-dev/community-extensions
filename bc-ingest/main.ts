import { PhylumApi, Package } from 'phylum';
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

    console.warn(`No supported ecosystems for '${language}'`);
}

/**
 * The SBOM is storing paths as package names for npm. This function attempts to extract the package name by splitting
 * on the slash, and grabbing the last item from the path string.
 */
function toNpmPackage(path: string): string {
    return path.split("/").pop()!;
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
function parseGrootDeep(json: string): Set<Package> {
    const parsed = json as GrootDeepJson;

    const identifiedPackages = new Set<Package>();

    for(const language in parsed) {
        const ecosystem = languageToEcosystem(language);

        for(const packageName in parsed[language]) {
            const pkgs  = parsed[language][packageName];

            // Note: For some reason, this is an array of packages?
            pkgs.map(pkg => {
                if(ecosystem === "npm") {
                    pkg.name = toNpmPackage(pkg.name);
                }

                identifiedPackages.add({ "ecosystem": ecosystem, "name": pkg.name, "version": pkg.version });
            });
        }
    }

    return identifiedPackages;
}

/**
 * TODO: Parse "Baby Groot" structure.
 */
function parseBabyGroot(json: string) {
}

function usage() {
  console.log(
    "phylum bc-ingest <sbom-filename>",
  );
}

const args = parseArgs(Deno.args, {
  alias: { filename: ["f"] },
  string: ["filename"],
  unknown: (arg) => {
    console.error(`Unknown argument: ${arg}`);
    usage();
    Deno.exit(1);
  },
});

let data = await getJson(args.filename);
let identifiedPackages = parseGrootDeep(data);

console.log(`\nFound ${identifiedPackages.length} packages in ${args.filename}`);
console.log(identifiedPackages);
