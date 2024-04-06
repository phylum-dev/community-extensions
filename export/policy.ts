import { PhylumApi } from 'phylum';

/**
 * Given a job ID and a policy, evaluate the job against the policy.
 */
export async function evaluatePolicy(jobId: string, policy: string): Promise<any> {
    const data = JSON.stringify({"ignoredPackages":[], "policy": {}});

    let resp = await PhylumApi.fetch(
        `v0`,
        `/data/jobs/${jobId}/policy/evaluate/raw`,
        { 
            method: "POST",
            headers: {
                "Content-Type": "", // Required to get this endpoint working correctly
            }
        }
    );

    return await resp.json();
}
