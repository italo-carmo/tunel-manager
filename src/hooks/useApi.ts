import { useCallback, useContext, useMemo } from "react";
import useSWR, { SWRResponse } from "swr";
import { AuthContext } from "@/contexts/Auth.tsx";
import { UnknownHttpError } from "@/errors";
import { SessionExpiredError } from "@/errors/login.ts";

interface IApiOptions {
  apiUrl: string;
}

async function readJsonResponse(
  response: Response,
): Promise<Record<string, unknown>> {
  const text = await response.text();
  const jsonResp = text ? JSON.parse(text) : {};

  if (!response.ok || jsonResp.error) {
    throw UnknownHttpError.fromResponse({
      ...jsonResp,
      status: response.status,
      error: jsonResp.error ?? response.statusText ?? `HTTP ${response.status}`,
    });
  }

  return jsonResp;
}

export const useApi = (_apiUrl?: string) => {
  const { session, logOut } = useContext(AuthContext);
  const apiUrl = useMemo(() => _apiUrl || session?.apiUrl, [session, _apiUrl]);

  const handleApiError = useCallback(
    (error: unknown): never => {
      if (error instanceof UnknownHttpError && error.statusCode === 401) {
        logOut();
        throw new SessionExpiredError();
      }

      throw error;
    },
    [logOut],
  );

  const parseResponse = useCallback(
    async (response: Response): Promise<Record<string, unknown>> => {
      try {
        return await readJsonResponse(response);
      } catch (error) {
        return handleApiError(error);
      }
    },
    [handleApiError],
  );

  const swrCallback = useCallback(
    async <Data>(endpoint: string): Promise<Data> => {
      if (!session) {
        throw new Error(`[SWR:${endpoint}] Skipped because no session exists`);
      }

      const res = await fetch(endpoint, {
        headers: {
          "Content-Type": "application/json",
          Authorization: session.authToken,
        },
      });

      return (await parseResponse(res)) as Data;
    },
    [parseResponse, session],
  );

  const post = useCallback(
    async (
      endpoint: string,
      body: Record<string, unknown>,
      opt?: IApiOptions,
    ): Promise<Record<string, unknown>> => {
      const authInjection = session
        ? { Authorization: session.authToken }
        : null;

      const response = await fetch(`${opt?.apiUrl ?? apiUrl}/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authInjection },
        body: JSON.stringify(body),
      });

      return parseResponse(response);
    },
    [apiUrl, parseResponse, session],
  );

  const get = useCallback(
    async (endpoint: string, opt?: IApiOptions) => {
      // TODO implement query params
      const authInjection = session
        ? { Authorization: session.authToken }
        : null;

      const response = await fetch(`${opt?.apiUrl ?? apiUrl}/${endpoint}`, {
        headers: {
          "Content-Type": "application/json",
          ...authInjection,
        },
      });

      return parseResponse(response);
    },
    [apiUrl, parseResponse, session],
  );

  const del = useCallback(
    async (
      endpoint: string,
      body?: Record<string, unknown>,
      opt?: IApiOptions,
    ) => {
      const authInjection = session
        ? { Authorization: session.authToken }
        : null;

      const response = await fetch(`${opt?.apiUrl ?? apiUrl}/${endpoint}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          ...authInjection,
        },
        body: JSON.stringify(body),
      });

      return parseResponse(response);
    },
    [apiUrl, parseResponse, session],
  );

  const swr: <Data>(endpoint: string) => SWRResponse<Data> = useCallback(
    <Data>(endpoint: string) => {
      return useSWR<Data>(
        session ? `${session.apiUrl}/${endpoint}` : null,
        (url: string) => swrCallback<Data>(url),
        { keepPreviousData: true, refreshInterval: 2000 },
      );
    },
    [session, swrCallback],
  );

  return { post, get, swr, del };
};
