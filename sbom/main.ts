import { PhylumApi } from 'phylum';
import { parse } from "https://deno.land/std@0.156.0/flags/mod.ts";

const spdxVersion = "SPDX-2.2";
const spdxId = "SPDXRef-DOCUMENT";
const creator = "Tool: github.com/phylum-dev/cli";
const dataLicense = "CC0-1.0"

interface Dependency {
    name: string;
    version: string;
}

interface Package {
    name: string;
    version: string;
    license: string;
    type: string;
    dependencies: Dependency[];
}

/**
 * Build the homepage URL for the provided package.
 */
function getHomepage(pkg: Package) {
    switch(pkg.type) {
        case 'npm':
            return `https://www.npmjs.com/package/${pkg.name}/v/${pkg.version}`;
        case 'pypi':
            return `https://pypi.org/project/${pkg.version}/${pkg.version}/`;
        case 'rubygems':
            return `https://rubygems.org/gems/${pkg.name}/versions/${pkg.version}`;
        case 'maven':
            return ``; // TODO: How do we handle this? Maven central? What about others?
        case 'nuget':
            return `https://www.nuget.org/packages/${pkg.name}/${pkg.version}`;
        default:
            return 'NOASSERTION';
    }
}

/**
 *  Generates the document header for the produced SBOM.
 */
async function generateDocumentHeader(docNamespace: string) {
    // TODO: need to capture
    //  * DocumentNamespace (Not sure???)
    //  * LicenseListVersion (Not sure???)
    const docName = `${docNamespace}-SBOM`;
    const today = new Date().toISOString();
    const creatorComment = `SBOM Document for the ${docNamespace} project from Phylum, Inc.`;
    return `##Document Header\n` + 
           `SPDXVersion: ${spdxVersion}\n` +
           `DataLicense: ${dataLicense}\n` +
           `SPDXID: SPDXRef-Document\n` +
           `DocumentName: ${docName}\n` +
           `DocumentNamespace: ${docNamespace}\n` + 
           `Creator: ${creator}\n` +
           `Created: ${today}\n` +
           `CreatorComment: <text>${creatorComment}</text>\n\n`;
}

/**
 *  Creates a package block for the provided package JSON.
 */
function createPackageBlock(pkg: Package) {
    return `##### Package: ${pkg.name}\n\n` +
           `PackageName: ${pkg.name}\n` +
           `SPDXID: SPDXRef-${pkg.name}-${pkg.version}\n` +
           `PackageVersion: ${pkg.version}\n` +
           `PackageDownloadLocation: NOASSERTION\n` + // TODO: Get this!
           `FilesAnalyzed: true\n` +
           `PackageHomePage: ${getHomepage(pkg)}\n` +
           `PackageLicenseConcluded: NOASSERTION\n` + // TODO: Get this!
           `PackageLicenseDeclared: ${pkg.license}\n` +
           `PackageCopyrightText: NOASSERTION\n` +
           `ExternalRef: PACKAGE-MANAGER ${pkg.type} ${pkg.name}@${pkg.version}\n\n`
}

/**
 *  Creates a relationship entry for the provided package JSON.
 */
function createRelationship(pkg: string, ver: string, dep: Dependency) {
    return `Relationship: SPDXRef-${dep.name}-${dep.version} PREREQUISITE_FOR SPDXRef-${pkg}-${ver}\n`;
}

/**
 *  Given a Phylum job JSON, generates the SBOM document and drops
 *  it to disk.
 */
async function toSBOM(data: string) {
    let projectName = data["project_name"];
    let sbom = await generateDocumentHeader(projectName);
    let refs = "";

    // Construct the packages section of our SBOM
    data["packages"].forEach((p) => {
        let pkg: Package = p;
        sbom += createPackageBlock(pkg);

        let pkgName: keyof typeof obj;

        // Create the package relationships of our SBOM
        for (pkgName in pkg.dependencies) {
            let version = pkg.dependencies[pkgName];
            let dep = { name: pkgName, version: version };
            refs += createRelationship(pkg.name, pkg.version, dep);
        }
    });

    return sbom + `##### Relationships\n\n${refs}`; 
}

// Parse CLI args.
const args = parse(Deno.args);
let group = args["group"];
let project = args["project"];
let file = args["_"].pop();

if(!file) {
    console.error("[!] You must specify a lockfile");
} else {
    // Parse the provided lock file
    var pkgJson = await PhylumApi.parseLockfile(file);
    var pkgs = pkgJson["packages"];
    var type = pkgJson["package_type"];

    const jobId = await PhylumApi.analyze(type, pkgs, project, group);
    const data = await PhylumApi.getJobStatus(jobId);
    console.log(await toSBOM(data));
}
