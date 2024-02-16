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

        if(!response.ok) {
            console.error(`Failed to fetch project data, received HTTP error: ${response.status}`);
        } else {
            const data = await response.json();
            return data;
        }
    } catch (error) {
        console.error("There was an issue fetching the project data:", error);
    }
}

/** 
 * Iterate through the API and fetch all known projects. 
 */
async function fetchProjects(cursor?: string, hasMore?: bool = true, perPage: int = 100): Promise<any> {
    if(!hasMore) {
        return [];
    }

    const base = `/projects?paginate.limit=${perPage}`;
    const projectsUrl = cursor ? `${base}&paginate.cursor=${cursor}` : base; 
    const response = await PhylumApi.fetch("v0/", projectsUrl, {});

    if (!response.ok) {
        throw new Error(`Failed to fetch projects, HTTP error: ${response.status}`);
    }

    const ret =  await response.json(); 
    const nextCursor = ret.values[ret.values.length - 1].id;

    return ret.values.concat(fetchProjects(nextCursor, ret.has_more));
}

// Parse CLI args
const args = parse(Deno.args);

// Collect the list of projects
const projects = await fetchProjects(); 
console.log(`Found ${projects.length} projects in your account`);

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
for(let i = 0; i < projects.length; i++) {
    completed++;

    let proj = projects[i];
    let projectId = proj.id;
    let groupName = proj.group_name;

    let data = await fetchProjectData(projectId, groupName); 

    await bars.render([
       {
         completed: completed,
         total: projects.length,
         text: "file1",
         complete: "*",
         incomplete: ".",
       },
     ]); 

    allProjects[projectId] = data;
}

console.log("Writing project data to disk");
Deno.writeTextFileSync("all-projects.json", JSON.stringify(allProjects));
