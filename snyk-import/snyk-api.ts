// deno-lint-ignore-file no-explicit-any

import { API } from "./const.ts";

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

export async function getOrgs(token: string): Promise<Org[]> {
  const orgs = await getSingle(
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

export async function getProjects(token: string, org: Org): Promise<Project[]> {
  const projects: Project[] = [];
  let next: string | null =
    `/rest/orgs/${org.id}/projects?version=2023-09-14&limit=10`;

  try {
    while (next) {
      const cur = await getSingle(token, next);
      const curProjects = cur.data.map((proj: any) => ({
        org: org,
        id: proj.id,
        name: proj.attributes.name,
      }));
      projects.push(...curProjects);
      next = cur.next;
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

export async function getProjectDependencies(
  token: string,
  project: Project,
): Promise<string[]> {
  return await fetch(
    `${API}/rest/orgs/${project.org.id}/projects/${project.id}/sbom?version=2023-09-14&format=cyclonedx1.4%2Bjson`,
    {
      headers: {
        Authorization: `Token ${token}`,
      },
    },
  ).then(checkApiResponse).then(async (res) => {
    const resp = await res.json();
    return resp.components.map((d: any) => {
      return d.purl;
    });
  });
}

async function getSingle(
  token: string,
  path: string,
): Promise<{ next: string | null; data: any }> {
  return await fetch(
    `${API}${path}`,
    {
      headers: {
        Authorization: `Token ${token}`,
      },
    },
  ).then(checkApiResponse).then(async (res) => {
    const resp = await res.json();
    const next = resp.links?.next ?? null;
    const data = resp.data;
    return { next, data };
  });
}

async function checkApiResponse(res: Response): Promise<Response> {
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    let msg: string;
    try {
      msg = JSON.parse(body).errors[0].detail;
    } catch (_err) {
      msg = `HTTP ${res.status} received. Body: ${body}`;
    }
    const err = new Error(msg);
    err.name = "API Error";

    throw err;
  }
  return res;
}
