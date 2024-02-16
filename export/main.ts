import { PhylumApi } from 'phylum';
import { parse } from "https://deno.land/std@0.156.0/flags/mod.ts";
import { MultiProgressBar } from "https://deno.land/x/progress@v1.4.4/mod.ts";


/**
 * Fetch the project data from the Phylum API.
 */
async function fetchProjectData(projectId: string, group?: string): Promise<any> {
    try {
        const url = group ? `groups/${group}/projects/${projectId}` : `data/projects/${projectId}`;
        const response = await PhylumApi.fetch("v0/", url, {});

        if (!response.ok) {
            console.error(`\nFailed to fetch project data, received HTTP error: ${response.status}`);
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
async function fetchProjects(cursor?: string): Promise<any> {
    const base = `/projects?paginate.limit=100`;
    const projectsUrl = cursor ? `${base}&paginate.cursor=${cursor}` : base;
    const response = await PhylumApi.fetch("v0/", projectsUrl, {});

    if (!response.ok) {
        throw new Error(`Failed to fetch projects, HTTP error: ${response.status}`);
    }

    const ret = await response.json();
    const nextCursor = ret.values[ret.values.length - 1].id;

    if (ret.has_more) {
        return ret.values.concat(fetchProjects(nextCursor));
    }
    return ret.values;
}

// Parse CLI args
const args = parse(Deno.args);

// Collect the list of projects
console.log("Fetching projects list");
const projects = await fetchProjects();
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
for (let i = 0; i < projects.length; i++) {
    let proj = projects[i];
    let projectId = proj.id;
    let groupName = proj.group_name;

    let data = await fetchProjectData(projectId, groupName);
    completed++;

    if(!data) {
        continue;
    }

    await bars.render([
       {
         completed: completed,
         total: projects.length,
         text: data.name ? data.name : "",
         complete: "*",
         incomplete: ".",
       },
     ]); 

    allProjects[projectId] = data;
}

console.log("\nWriting project data to disk");
Deno.writeTextFileSync("all-projects.json", JSON.stringify(allProjects));
console.log("\nWrote project data to all-projects.json");
