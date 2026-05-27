const BEARER_PREFIX = "Bearer ";

export const parseBearerToken = (authorizationHeader: string | null): string | null => {
  if (!authorizationHeader) return null;
  if (!authorizationHeader.startsWith(BEARER_PREFIX)) return null;
  const token = authorizationHeader.slice(BEARER_PREFIX.length).trim();
  return token.length > 0 ? token : null;
};

export const constantTimeEqual = (left: string, right: string): boolean => {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let idx = 0; idx < left.length; idx += 1) {
    mismatch |= left.charCodeAt(idx) ^ right.charCodeAt(idx);
  }
  return mismatch === 0;
};

export const isAuthorizedAdmin = (request: Request, expectedToken?: string): boolean => {
  const configured = expectedToken?.trim();
  if (!configured) return false;
  const provided = parseBearerToken(request.headers.get("authorization"));
  if (!provided) return false;
  return constantTimeEqual(provided, configured);
};
