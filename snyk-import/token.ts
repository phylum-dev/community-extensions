import { SNYK_API_URI } from "./lib.ts";

const SNYK_TOKEN = "SNYK_TOKEN";

const STORAGE = {
  getItem: (key: string): string | null => {
    try {
      return localStorage.getItem(key);
    } catch (_err) {
      return null;
    }
  },
  setItem: (key: string, value: string) => {
    try {
      localStorage.setItem(key, value);
    } catch (_err) {
      console.warn("Local storage not available. Cannot save token");
    }
  },
};

export async function snykToken(): Promise<string> {
  let token = STORAGE.getItem(SNYK_TOKEN);
  if (!token) {
    token = await newSnykToken();
    setToken(token);
  }
  return token;
}

export function setToken(token: string) {
  STORAGE.setItem(SNYK_TOKEN, token);
}

async function newSnykToken(): Promise<string> {
  const tokenId = crypto.randomUUID();
  const loginUrl = `https://app.snyk.io/login?token=${tokenId}`;

  console.log(
    `To authenticate, open this URL in a browser:

  ${loginUrl}

Return to this console when you are done.
Alternately, use the --token command-line argument to set the token`,
  );

  const start = Date.now();
  const timeout = 30000;
  let ok = false;
  let api;
  while (!ok && Date.now() - start < timeout) {
    const resp = await fetch(`${SNYK_API_URI}/v1/verify/callback`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ token: tokenId }),
    }).then((res: Response) => {
      if (!res.ok) throw Error("Failed to fetch token", { cause: res });
      return res.json();
    });

    ({ ok, api } = resp);

    if (!ok) await new Promise((r) => setTimeout(r, 500));
  }

  if (!api) throw new Error("Timeout while waiting for authentication");
  return api;
}
