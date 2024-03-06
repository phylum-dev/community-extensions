import { PhylumApi } from 'phylum';
import { parse } from "https://deno.land/std@0.156.0/flags/mod.ts";
import { delay } from 'https://deno.land/x/delay@v0.2.0/mod.ts';
import { MultiProgressBar } from "https://deno.land/x/progress@v1.4.4/mod.ts";
import { pLimit } from "https://deno.land/x/p_limit@v1.0.0/mod.ts";

function usage() {
    console.log("phylum export [--group phylum_group]");
}

/**
 * Fetch the project data from the Phylum API.
 */
async function fetchProjectData(projectId: string, group?: string): Promise<any> {
    if(!projectId) {
        return {};
    }

    try {
        const url = group ? `groups/${group}/projects/${projectId}` : `data/projects/${projectId}`;
        const response = await PhylumApi.fetch("v0/", url, {});

        if(!response.ok) {
            console.error(`\nFailed to fetch project data, received HTTP error: ${response.status}`);
            console.log("Project ID:", projectId, "Group:", group);
            console.log(await response.text());
        } else {
            const data = await response.json();
            return data;
        }
    } catch (error) {
        console.error("\nThere was an issue fetching the project data:", error);
    }
}

/**
 * Fetch all known projects accessible to the current account.
 */
async function fetchProjects(group?: string, cursor?: string): Promise<any> {
    let base = '/projects';
    
    base = `${base}?paginate.limit=100`;
    
    if(group) {
        base = `${base}&filter.group=${group}`
    }

    const projectsUrl = cursor ? `${base}&paginate.cursor=${cursor}` : base;
    const response = await PhylumApi.fetch("v0/", projectsUrl, {});

    if (!response.ok) {
        throw new Error(`Failed to fetch projects, HTTP error: ${response.status}`);
    }

    const ret = await response.json();
    const nextCursor = ret.values[ret.values.length - 1].id;

    if (ret.has_more) {
        return ret.values.concat(await fetchProjects(group, nextCursor));
    }

    return ret.values;
}

// Parse CLI args
const args = parse(Deno.args, {
    alias: { group: ["g"], batch: ["b"] },
    string: ["group"],
    boolean: ["batch"],
    negatable: ["batch"],
    default: { "batch": true },
    unknown: (arg) => {
        console.error(`Unknown argument: ${arg}`);
        usage();
        Deno.exit(1);
    }
});

// Collect the list of projects
if(args.group) {
    console.log(`Fetching projects for group ${args.group}`);
} else {
    console.log(`Fetching all projects`);
}
const projects = await fetchProjects(args.group); 
console.log(`Found ${projects.length} projects in your account\n`);

const bars = new MultiProgressBar({
    title: "Downloading project data",
    clear: true,
    complete: "=",
    incomplete: "-",
    display: "[:bar] :text :percent :time :completed/:total",
});

let completed = 0;
let allProjects = {};

// Iterate through projects and fetch project data
const limit = pLimit(7);
const input = [];

for(const proj of projects) {
    input.push(limit(async () => {
        const data = await fetchProjectData(proj.id, proj.group_name)
        completed++;

        bars.render([
           {
             completed: completed,
             total: projects.length,
             text: data.name ? data.name.padEnd(50, ' ') : "",
             complete: "*",
             incomplete: ".",
           },
         ]); 

        allProjects[proj.id] = data;
        await delay(3);
    }));
}

/**
 * Write the provided data to disk.
 */
function writeBatch(name, data) {
    const filename = `project_data/${name}.json`;
    console.log(`  ${filename}`);
    Deno.writeTextFileSync(filename, JSON.stringify(data));
}

(async () => {
    await Promise.all(input);
    try {
        await Deno.mkdir("project_data");
    } catch(e) {
        console.debug("`project_data` already exists");
    }

    console.log("\n\nWriting project data to `project_data/`");

    for(const projectId in allProjects) {
        const projectData = allProjects[projectId];
        writeBatch(projectId, projectData);
    }
})();
