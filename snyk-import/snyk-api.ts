// deno-lint-ignore-file no-explicit-any

import { checkSnykResponse, SNYK_API_URI } from "./lib.ts";

type Org = {
  id: string;
  name: string;
  slug: string;
};

export type Project = {
  org: Org;
  id: string;
  name: string;
};

/// Find all Snyk orgs that can be viewed by this token.
export async function getOrgs(token: string): Promise<Org[]> {
  const orgs = await getPage(
    token,
    `/rest/orgs?version=2023-09-14&limit=100`,
  );

  if (orgs.next) {
    throw new Error("More than 100 orgs is not supported");
  }

  return orgs.data.map((org: any) => ({
    id: org.id,
    name: org.attributes.name,
    slug: org.attributes.slug,
  }));
}

/// Retrieve all Snyk projects in the given Snyk org.
export async function getProjects(token: string, org: Org): Promise<Project[]> {
  const projects: Project[] = [];
  let uri: string | null =
    `/rest/orgs/${org.id}/projects?version=2023-09-14&limit=10`;

  try {
    while (uri) {
      const page = await getPage(token, uri);
      const curProjects = page.data.map((proj: any) => ({
        org: org,
        id: proj.id,
        name: proj.attributes.name,
      }));
      projects.push(...curProjects);
      uri = page.next;
    }
  } catch (err) {
    console.warn(
      `%cCould not get projects for org "${org.name}": ${err}`,
      "color: yellow",
    );
    return [];
  }

  return projects;
}

/// Return a list of dependencies (as PURLs) for the given Snyk project.
export async function getProjectDependencies(
  token: string,
  project: Project,
): Promise<string[]> {
  return await fetch(
    `${SNYK_API_URI}/rest/orgs/${project.org.id}/projects/${project.id}/sbom?version=2023-09-14&format=cyclonedx1.4%2Bjson`,
    {
      headers: {
        Authorization: `Token ${token}`,
      },
    },
  ).then(checkSnykResponse).then(async (res) => {
    const resp = await res.json();
    return resp.components.map((d: any) => {
      return d.purl;
    });
  });
}

/// Get a single page for paginated API endpoints.
async function getPage(
  token: string,
  path: string,
): Promise<{ next: string | null; data: any }> {
  return await fetch(
    `${SNYK_API_URI}${path}`,
    {
      headers: {
        Authorization: `Token ${token}`,
      },
    },
  ).then(checkSnykResponse).then(async (res) => {
    const resp = await res.json();
    const next = resp.links?.next ?? null;
    const data = resp.data;
    return { next, data };
  });
}
