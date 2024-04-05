import { PhylumApi } from 'phylum';

/**
 * Helper function for fetching a policy from Phylum.
 */
async function fetchPolicyRequest(url: string): Promise<string> {
    const response = await PhylumApi.fetch("v0/", url, {});
    
    if(!response.ok) {
        console.error(`\nFailed to get the policy for project`);
    } else {
        const data = await response.json();
        return data.preferences.policy;
    }

    return "";
}

/**
 * Fetches the current Phylum default policy.
 */
async function fetchDefaultPolicy(): Promise<string> {
    return await fetchPolicyRequest("data/jobs/policy/default");
}

/**
 * Fetches a group policy for the specified group.
 */
async function fetchGroupPolicy(group: string): Promise<string> {
    return await fetchPolicyRequest(`preferences/group/${group}`);
}

/**
 * Fetches the current policy from the specified project.
 */
async function fetchProjectPolicy(projectId: string): Promise<string> {
    return await fetchPolicyRequest(`preferences/project/${projectId}`);
}

/**
 * General function for fetching policy for a given project. Will first try to fetch a group
 * policy, then will fall back to the project policy. If no policy is specified, the Phylum
 * default policy is used.
 */
export async function fetchPolicy(projectId: string, group?: string): Promise<string> {
    let policy = "";

    if(group) {
        policy = await fetchGroupPolicy(group);
    }

    if(!policy) {
        policy = await fetchProjectPolicy(projectId);
    }

    return policy ? policy : await fetchDefaultPolicy();
}

/**
 * Given a job ID and a policy, evaluate the job against the policy.
 */
export async function evaluatePolicy(jobId: string, policy: string): Promise<any> {
    const data = JSON.stringify({"ignoredPackages":[], "policy": policy});

    let resp = await PhylumApi.fetch(
        "v0/",
        `data/jobs/${jobId}/policy/evaluate/raw`,
        { method: "POST", body: data }
    );

    return await resp.json();
}
