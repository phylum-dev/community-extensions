import { PhylumApi } from 'phylum';
import { parse } from "https://deno.land/std@0.156.0/flags/mod.ts";

type Dependency = {
    purl: string;
    registry: string;
    name: string;
    version: string;
    issues: Issue[];
};

type Issue = {
    title: string;
    tag: string;
    domain: string;
    severity: string;
    description: string;
};

type InputJson = {
    dependencies: Dependency[];
};

type Project = {
    name: string;
    id: string;
    updated_at: string;
    created_at: string;
    ecosystems: string[];
    group_name: string;
};

const accessToken = await PhylumApi.getAccessToken();

/**
 * Given a Phylum JSON response, convert it into a valid SARIF JSON.
 */
const convertToSarif = (input: InputJson) => {
    const sarif: any = {
        "$schema": "https://docs.oasis-open.org/sarif/sarif/v2.1.0/errata01/os/schemas/sarif-schema-2.1.0.json",
        "version": "2.1.0",
        "runs": [
            {
                "tool": {
                    "driver": {
                        "name": "Phylum",
                        "version": "1.0.0",
                        "informationUri": "https://phylum.io",
                        "rules": [] // This will be populated later
                    }
                },
                "results": [] // This will be populated later
            }
        ]
    };

    // Used to map our severity from Phylum to valid Sarif
    const validLevels = {
        "critical": "error",
        "high": "warning",
        "medium": "note",
        "low": "none",
    };

    const ruleIds: string[] = [];

    for (const dep of input.dependencies) {
        for (const rej of dep.issues) {
            const ruleId = rej.tag;

            // Add rule to the tool's rules if not already added
            if (!ruleIds.includes(ruleId)) {
                ruleIds.push(ruleId);
                sarif.runs[0].tool.driver.rules.push({
                    "id": ruleId,
                    "name": rej.title,
                    "shortDescription": {
                        "text": rej.description
                    },
                    "defaultConfiguration": {
                        "level": validLevels[rej.impact]
                    }
                });
            }

            // Add result
            sarif.runs[0].results.push({
                "ruleId": ruleId,
                "message": {
                    "text": rej.title
                },
                "locations": [
                    {
                        "physicalLocation": {
                            "artifactLocation": {
                                "uri": dep.purl
                            }
                        }
                    }
                ]
            });
        }
    }

    return sarif;
};

/** 
 * Fetch the project ID for the provided project name;
 */
async function fetchProjectNames(group?: string): Promise<any> {
    const url = group ? `groups/${group}/projects`: `data/projects`;
    const headers = {
        "accept": "application/json"
    };

    const response = await PhylumApi.fetch("v0/", url, {});

    if (!response.ok) {
        throw new Error(`Failed to fetch projects, HTTP error: ${response.status}`);
    }

    return await response.json(); 
}

/**
 * Fetch the project data from the Phylum API.
 */
async function fetchProjectData(project: string, group?: string): Promise<any> {
    try {
        // Get a list of projects, and pull the project ID for the matching project name.
        const projects = await fetchProjectNames(group);
        const matchingProject = projects.find((obj: Project) => obj.name.toLowerCase() == project.toLowerCase());

        if(!matchingProject) {
            console.error(`Failed to find a matching project for '${project}'. If this is a group project, specify the group name with --group <name>.`);
        } else {
            const projectId = matchingProject.id;

            const url = group ? `groups/${group}/projects/${projectId}` : `data/projects/${project}`;
            const headers = {
                "Authentication": `Bearer ${accessToken}`,
                "accept": "application/json"
            };

            const response = await PhylumApi.fetch("v0/", url, headers);

            if(!response.ok) {
                console.error(`Failed to fetch project data, received HTTP error: ${response.status}`);
            } else {
                const data = await response.json();
                return data;
            }
        }
    } catch (error) {
        console.error("There was an issue fetching the project data:", error);
    }
}

// Parse CLI args
const args = parse(Deno.args);
let project = args["project"];
let group = args["group"];

if(!project) {
    console.error("You must specify a project name with `--project <name>` (with an optional `--group <name>`)");
} else {
    const data = await fetchProjectData(project, group); 

    if(data) {
        const sarifOutput = convertToSarif(data);
        console.log(JSON.stringify(sarifOutput, null, 2));
} else { 
    console.log("No project found. If the project is part of a group, specficy with `--group <name>`")
    }
}
