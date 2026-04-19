/**
 * @file
 *
 * Thin wrapper für fetch() mit Credential-Handling und
 * einheitlichem Error-Parsing. Cookies werden automatisch mitgesendet.
 */

import {
  type FieldValidationError,
  isFieldValidationErrorResponse,
} from "@einfachvermieter/shared";

const deriveErrorMessage = (
  details: unknown,
  fieldErrors: FieldValidationError[] | undefined,
  response: Response,
): string => {
  if (fieldErrors) {
    return (
      fieldErrors.find((error) => error.path.length === 0)?.message ??
      "Validierung fehlgeschlagen"
    );
  }

  if (typeof details === "object" && details !== null && "message" in details) {
    return String((details as { message: unknown }).message);
  }

  return response.statusText;
};

export class ApiError extends Error {
  readonly status: number;
  readonly details?: unknown;
  readonly fieldErrors?: FieldValidationError[];

  constructor(
    status: number,
    message: string,
    details?: unknown,
    fieldErrors?: FieldValidationError[],
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
    this.fieldErrors = fieldErrors;
  }
}

/**
 * Wirft eine `ApiError` mit geparstem Body + Feldfehlern, falls die Antwort
 * nicht ok ist.
 */
const throwIfNotOk = async (response: Response): Promise<void> => {
  if (response.ok) {
    return;
  }

  let details: unknown;

  try {
    details = await response.json();
  } catch {
    details = await response.text();
  }

  const fieldErrors = isFieldValidationErrorResponse(details)
    ? details.errors
    : undefined;

  const message = deriveErrorMessage(details, fieldErrors, response);

  throw new ApiError(response.status, message, details, fieldErrors);
};

/**
 * Parst den JSON-Body. 204 und leerer Body (z. B. Express' `res.send(null)`,
 * worauf `response.json()` werfen würde) werden einheitlich als `undefined`/`null`
 * behandelt.
 */
const parseJsonBody = async <T>(response: Response): Promise<T> => {
  if (response.status === 204) {
    return undefined as T;
  }

  const raw = await response.text();
  if (raw.length === 0) {
    return null as T;
  }

  return JSON.parse(raw) as T;
};

const request = async <T>(
  method: string,
  path: string,
  body?: unknown,
  query?: Record<string, string | undefined>,
): Promise<T> => {
  const url = new URL(`/api${path}`, window.location.origin);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== "") {
        url.searchParams.set(key, value);
      }
    }
  }

  const response = await fetch(url.toString(), {
    method,
    credentials: "include",
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });

  await throwIfNotOk(response);
  return parseJsonBody<T>(response);
};

const postFormData = async <T>(
  path: string,
  formData: FormData,
): Promise<T> => {
  const url = new URL(`/api${path}`, window.location.origin);
  const response = await fetch(url.toString(), {
    method: "POST",
    credentials: "include",
    body: formData,
  });

  await throwIfNotOk(response);
  return parseJsonBody<T>(response);
};

const postFormDataBlob = async (
  path: string,
  formData: FormData,
): Promise<Blob> => {
  const url = new URL(`/api${path}`, window.location.origin);
  const response = await fetch(url.toString(), {
    method: "POST",
    credentials: "include",
    body: formData,
  });

  await throwIfNotOk(response);
  return response.blob();
};

export const api = {
  get: <T>(path: string, query?: Record<string, string | undefined>) =>
    request<T>("GET", path, undefined, query),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
  postFormData: <T>(path: string, formData: FormData) =>
    postFormData<T>(path, formData),
  postFormDataBlob: (path: string, formData: FormData) =>
    postFormDataBlob(path, formData),
  put: <T>(path: string, body?: unknown) => request<T>("PUT", path, body),
  patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, body),
  delete: <T>(path: string) => request<T>("DELETE", path),
};
