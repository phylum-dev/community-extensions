/// Base URI for the Snyk API
export const SNYK_API_URI = "https://api.snyk.io";

/// Throw descriptive errors for REST API error responses.
async function checkApiResponse(
  res: Response,
  api_name: string,
  error_description: (body: string) => string,
): Promise<Response> {
  if (res.ok) {
    return res;
  }

  const body = await res.text().catch(() => "");
  let msg: string;
  try {
    msg = error_description(body);
  } catch (_err) {
    msg = `HTTP ${res.status} received. Body: ${body}`;
  }
  const err = new Error(msg);
  err.name = `${api_name} API Error`;

  throw err;
}

export const checkPhylumResponse = (res: Response) =>
  checkApiResponse(res, "Phylum", (body) => JSON.parse(body).error.description);

export const checkSnykResponse = (res: Response) =>
  checkApiResponse(res, "Snyk", (body) => JSON.parse(body).errors[0].detail);
