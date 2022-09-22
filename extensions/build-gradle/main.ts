import { PhylumApi } from "phylum";
import { red, green, yellow, blue } from 'https://deno.land/std@0.150.0/fmt/colors.ts';
import * as path from "https://deno.land/std@0.57.0/path/mod.ts";
import { parse } from "https://deno.land/std@0.156.0/flags/mod.ts";

function logSuccess(msg: string) { console.log(`${green("[*]")} ${msg}`); }
function logError(msg: string) { console.error(`${red("[!]")} ${msg}`); }
function logWarning(msg: string) { console.warn(`${yellow("[-]")} ${msg}`); }

/**
 *  Parses a string representing a package version tuple. The format of this
 *  string is `<name>:<version>`. Anything after the last `:` is treated as
 *  the version.
 */
function parsePackagTuple(s: string) {
    let parts = s.split(":");

    if(parts.length < 2) {
        logError(`Invalid package string \`${s}\``);
        return;
    }

    let version = parts.pop();
    let name = parts.join(':');
    return { "name": name, "version": version };
}

/**
 *  Given a `gradle-dependencies.txt` file generated by `gradle`, attempts to
 *  parse dependencies from the file.
 */
function parseGradleFile(data: string) {
    const testRuntimeClasspath = parseOutTestRuntimeClasspathSection(data);

    // If the line starts with a + or a | take everything on that line from the
    // first alpha character to the first whitespace character.
    const dependencies: string[] = testRuntimeClasspath
    .filter(line => line.length > 0) //ignore empty lines
    .filter(line => line[0] == '+' || line[0] == '|') //the line starts like a dependency line
    .filter(line => line.indexOf("+--- project :") < 0) //ignore lines that reference sibling projects
    .map(line => {
        //Normalize the lines, no more nesting
        const normalized = line.match(/^[[+-\\|\s]*(.*)$/);
        //Should go from |         |    \--- commons-logging:commons-logging:1.0.3 -> 1.1.1 to just commons-logging:commons-logging:1.0.3 -> 1.1.1
        if (normalized) {
            return normalized[1]
        }
        else {
            return ""
        }
    })
    .filter(line => line.length > 0) //ignore empty lines (failed the regex for some reason)
    .map(line => {
        //At this point we have a few cases of what the line could look like
        //(A dependency, with possible omission indicator) org.apache.hadoop:hadoop-core:1.0.2 (*)
        //(A constrained dependency) xmlenc:xmlenc:{strictly 0.52} -> 0.52 (c)
        //(A version resolved depenendecy) commons-logging:commons-logging:1.1 -> 1.1.1
        let parsed = line.match(/^([\.\w\-]+):([\.\w\-]+):{?(?:strictly)?\s?([\\.\w\-]+)}?\s?-?>?\s?([\{}\.\w\-]*)\s?[\w\*\(\)]*\s?$/);
        if (parsed) {
            const groupId = parsed[1];
            const artifactId = parsed[2];
            const originalVersion = parsed[3];
            const possibleReplacementVersion = parsed[4];

            const name = groupId + ":" + artifactId;
            const version = possibleReplacementVersion ? possibleReplacementVersion : originalVersion;
            return name + ":" + version
        }
        return "";
    })
    .filter(line => line.length > 0) //ignore empty lines (failed the regex for some reason);
    return [...new Set(dependencies)].map((x) => parsePackagTuple(x));
}

function parseOutTestRuntimeClasspathSection(gradleDependencies: string) {    
    const lines = gradleDependencies.split(/\r?\n/);
    //testRuntimeClasspath represents all dependencies including testing one    
    const sectionStart = lines.findIndex(x => x.startsWith("testRuntimeClasspath"));

    if (sectionStart < 0) {
        return [];
    }

    const beginningOfTestRuntimeClasspath = lines.slice(sectionStart, lines.length)

    //Find the end of the section
    const sectionEnd = beginningOfTestRuntimeClasspath.findIndex(x => x.length == 0);
    if (sectionEnd < 0) {
        return [];
    }
    
    return beginningOfTestRuntimeClasspath.slice(0, sectionEnd + 1);
}

/**
 *  Get a list of subprojects in Gradle.
 */
async function getGradleProjects() {
    let gradleResp = await invokeGradle(["projects"]);

    if(!gradleResp) {
        return;
    }

    // Convert the Uint8 array to ascii
    let ret = new TextDecoder().decode(gradleResp);

    // TODO: Check for failure?

    ret = ret.split(/\r?\n/)
              .map(line => line.match(/^[\+\\-]{2,}\sProject\s'(:.*)'/))
              .filter(line => line && line.length > 0)
              .map(line => line[1]);

    logSuccess(`Found ${ret.length} additional subprojects`);
    return ret;
}

/**
 *  Runs the `gradle` binary to produce the `gradle-dependencies.txt` file. This
 *  should do the dependency resolution for this machine.
 *
 *  We perform a rudimentary check to make sure there wasn't an outright build
 *  failure.
 *
 *  If a `subproject` is provided, attempts to resolve the dependencies for the
 *  specified subproject.
 */
async function generateGradleDeps(subproject: string) {
    let cmd = "dependencies";

    if(subproject) {
        cmd = subproject + ":dependencies";
    }

    let gradleResp = await invokeGradle(["-q", cmd]);

    if (!gradleResp) {
        return;
    }

    // Convert the Uint8 array to ascii
    const ret = new TextDecoder().decode(gradleResp);

    if(ret.indexOf("BUILD FAILED") > 0) {
        return;
    }

    return ret;
}

async function invokeGradle(cmd) {
    //Try our directory
    try {
        return await Deno.run({
            cmd: ["./gradlew"].concat(cmd),
            stdout: "piped"
        }).output();
    } catch(e) {
        //doNothing()
    }

    //Try single parent directory
    try {
        return await Deno.run({
            cmd: ["../gradlew"].concat(cmd),
            stdout: "piped"
        }).output();
    } catch(e) {
        //doNothing()
    }

    //Lastly try using gradle directly
    try {
        return await Deno.run({
            cmd: ["gradle"].concat(cmd),
            stdout: "piped"
        }).output();
    } catch(e) {
        //doNothing()
    }

    logError("ERROR: It doesn't look like you have `gradle` installed or " +
             "gradle wrapper in the current or parent directories");
}

/**
 *  Parse a `build.gradle` file and returned the identified dependencies. 
 */
async function getBuildGradleDeps(subproject: string) {
    const gradleDeps = await generateGradleDeps(subproject);

    if(!gradleDeps) {
        logError("ERROR: Failed to parse dependencies. Check your " +
                      "`build.gradle` file."); 
        return;
    }

    // Parse the dependencies from this file.
    let foundDeps = parseGradleFile(gradleDeps); 

    return foundDeps;
}

/**
 *  Submit the provided dependencies to Phylum for analysis.
 */
async function submit(pkgs: object[], project: string, group: string) {
    if(!pkgs.length) {
        return;
    }

    logSuccess("Submitting to Phylum for analysis...");
        
    if(!project) {
        logSuccess("Please specify a project with --project <projectName>");
    }

    if(group && !project) {
        logError("ERROR: You cannot specify a group without a project.");
        return;
    }

    if(project) {
        logSuccess(`\t --> Project: ${project}`)
    }

    if(group) {
        logSuccess(`\t --> Group: ${group}`)
    }

    if(!group && !project) {
        logError("ERROR: You must specify a project (and optionally a group).");
        return;
    }

    if(pkgs.length) {
        const jobId = await PhylumApi.analyze("maven", pkgs, project, group);
        logSuccess(`Job submitted for analysis with job ID: ${jobId}`);
    } else {
        logSuccess("No packages to submit");
    }
}

/**
 *  The extension API does not currently provide facilities for creating a project.
 *  Shim out to the Phylum CLI to handle this (inception!).
 */
async function attemptCreateProject(projectName: string, group?: string) {
    projectName = projectName.replace(/[ &;:]/, "");
    let cmd = ["phylum", "projects", "create", projectName];

    if(group) {
        group = group.replace(/[ &;:]/, "");
        cmd = cmd.concat(["--group", group]);
    }

    // Attempts to create the project.
    let resp = await Deno.run({
        cmd: cmd,
        stdout: "piped",
        stderr: "piped",
    }).output();

    // Attempt to determine if the project was created.
    const ret = new TextDecoder().decode(resp);
    if(ret.indexOf("already exists") || ret.indexOf("Successfully created")) {
        return true;
    }

    return false;
}

/**
 *
 */
async function getSubprojectDependencies(rootProject?: string) {
    if(!rootProject) {
        logError("You must specify a root project for subprojects");
        return;
    }

    let projects = await getGradleProjects();

    let ret = {};

    for(let proj in projects) {
        let subproj = projects[proj]; 
        const projName = `${rootProject}/${subproj.replace(":","")}`;
        ret[projName] = await getBuildGradleDeps(subproj)
    };

    return ret;
}

// Parse CLI args.
const args = parse(Deno.args);
let group = args["group"];
let project = args["project"];

// If no project name is specified, take the root directory name.
if(!project) {
    let ret = await Deno.run({
            cmd: ["pwd"],
            stdout: "piped"
    }).output();

    ret = new TextDecoder().decode(ret).replace(/(\r\n|\n|\r)/gm, "");
    project = path.basename(ret);
    logWarning(`No project name specified, using the root directory: ${project}`);

    // Attempt to create the project if it doesn't exist.
    let projectExists = await attemptCreateProject(project, group);

    if(!projectExists) {
        console.log("Project did not exist, so we created it");
    }
} 

logSuccess(`Parsing dependencies from 'build.gradle'`);
logWarning(`${yellow("[!] WARNING:")} You should consider locking your ` +
           "dependencies and using `phylum analyze` instead.");
logWarning("");
logWarning("    See: https://docs.gradle.org/current/userguide/dependency_locking.html");
logWarning("");

let rootDeps = await getBuildGradleDeps();

if(rootDeps) {
    logSuccess(`Submitting ${rootDeps.length} packages to the root project`);
    submit(rootDeps, project, group);

    // Get all subproject dependencies.
    logSuccess(`Searching for subprojects, this might take a second...`);
    let subprojects = await getSubprojectDependencies(project);

    for(let proj in subprojects) {
        logSuccess(`Scanning for packages in subproject: ${proj}`);
        let deps = subprojects[proj];
        logSuccess(`\tSubmitting ${deps.length} packages to subproject ${proj}`);

        // Attempt to create the project if it doesn't exist.
        let projectExists = await attemptCreateProject(proj, group);

        // Submit packages to the sub project
        submit(deps, proj, group);
    }
}
