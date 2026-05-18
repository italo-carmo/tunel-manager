import * as React from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  SessionExpiredError,
  SessionParseFailedError,
} from "@/errors/login.ts";
import { AppError, UnknownHttpError } from "@/errors";
import ErrorContext from "@/contexts/Error.tsx";
import { Session, sessionSchema } from "@/schemas/session.ts";
import { validate } from "@/schemas";
import { AuthResponse, authResponseSchema } from "@/schemas/api/auth.ts";
import { pingResponseSchema } from "@/schemas/api/ping.ts";

const sessionStorageKey = "ligolo-session";

interface IAuthContext {
  session: Session | null;
  authLoaded: boolean;
  logOut: () => void;
  login: (apiUrl: string, username: string, password: string) => Promise<void>;
}

const defaultAuthContext: IAuthContext = {
  session: null,
  authLoaded: false,
  logOut: () => undefined,
  login: async () => undefined,
};

export const AuthContext = createContext<IAuthContext>(defaultAuthContext);

async function readJsonResponse(
  response: Response,
): Promise<Record<string, unknown>> {
  const text = await response.text();
  const body = text ? JSON.parse(text) : {};

  if (!response.ok || body.error) {
    throw UnknownHttpError.fromResponse({
      ...body,
      status: response.status,
      error: body.error ?? response.statusText ?? `HTTP ${response.status}`,
    });
  }

  return body;
}

const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<IAuthContext["session"]>(null);
  const { setError } = useContext(ErrorContext);
  const [authLoaded, setAuthLoaded] = useState<boolean>(false);
  const [sessionLoaded, setSessionLoaded] = useState<boolean>(false);

  const logOut = useCallback(() => {
    localStorage.removeItem(sessionStorageKey);
    setSession(null);
  }, []);

  useEffect(() => {
    const storedSession = localStorage.getItem(sessionStorageKey) ?? null;
    if (!storedSession) return;
    try {
      const sessionData = JSON.parse(storedSession);
      const session: Session = validate(sessionData, sessionSchema);

      setSession(session);
    } catch (error) {
      setError(new SessionParseFailedError("Unable to parse session data"));
      localStorage.removeItem(sessionStorageKey);
      console.error(error);
    }
    setSessionLoaded(true);
  }, [setError]);

  useEffect(() => {
    if (sessionLoaded) return;
    if (localStorage.getItem(sessionStorageKey)) return;
    setSessionLoaded(true);
  }, [sessionLoaded]);

  useEffect(() => {
    (async () => {
      if (!sessionLoaded) return;
      if (!session) return setAuthLoaded(true);

      try {
        const { message } = validate(
          await readJsonResponse(
            await fetch(`${session.apiUrl}/api/v1/ping`, {
              headers: {
                "Content-Type": "application/json",
                Authorization: session.authToken,
              },
            }),
          ),
          pingResponseSchema,
        );
        if (message === "pong") return setAuthLoaded(true);

        throw new SessionExpiredError();
      } catch (error) {
        logOut();

        setError(
          error instanceof AppError
            ? error
            : new SessionParseFailedError("Unable to parse session data"),
        );
        setAuthLoaded(true);
      }
    })();
  }, [logOut, session, sessionLoaded, setError]);

  const login = useCallback(
    async (apiUrl: string, username: string, password: string) => {
      try {
        const response: AuthResponse = validate(
          await readJsonResponse(
            await fetch(`${apiUrl}/api/auth`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ username, password }),
            }),
          ),
          authResponseSchema,
        );

        const newSession = {
          apiUrl,
          authToken: response.token,
        };

        setSession(newSession);
        localStorage.setItem(sessionStorageKey, JSON.stringify(newSession));
      } catch (error) {
        if (error instanceof AppError) setError(new SessionExpiredError());

        throw UnknownHttpError.fromError(error);
      }
    },
    [setError],
  );

  return (
    <AuthContext.Provider value={{ session, login, logOut, authLoaded }}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;
