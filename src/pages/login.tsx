import * as React from "react";
import { useCallback, useContext, useState } from "react";
import { Minus } from "lucide-react";
import { Logo } from "@/assets/icons/logo.tsx";
import { ThemeSwitch } from "@/components/theme-switch.tsx";
import { AuthContext } from "@/contexts/Auth.tsx";
import ErrorContext from "@/contexts/Error.tsx";
import ciber from "../assets/ciber.png";
import { InvalidApiUrlError } from "@/errors/login.ts";
import {
  Alert,
  Button,
  Card,
  CircularProgress,
  Form,
  Input,
} from "@heroui/react";
import { useNavigate } from "react-router-dom";

const savedApiUrlKey = "ligolo-saved-api-url";
const defaultApiUrl: string | undefined =
  localStorage.getItem(savedApiUrlKey) ||
  import.meta.env["VITE_DEFAULT_API_URL"];

export default function LoginPage() {
  const [apiUrl, setApiUrl] = useState(defaultApiUrl);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const { login } = useContext(AuthContext);
  const [loading, setLoading] = useState(false);

  const { setError } = useContext(ErrorContext);

  const navigate = useNavigate();

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!apiUrl) throw new InvalidApiUrlError();

      setLoading(true);
      try {
        await login(apiUrl.replace(/\/+$/, ""), username, password);
        localStorage.setItem(savedApiUrlKey, apiUrl.replace(/\/+$/, ""));
        navigate("/agents");
      } catch (error) {
        setError(error);
      }

      setLoading(false);
    },
    [login, apiUrl, username, password, setError],
  );

  return (
    <div style={{backgroundColor: '#000'}} className="h-[100vh] flex items-center">
      <div className="absolute top-0 right-0 p-4">
        <ThemeSwitch />
      </div>
      <div className="flex flex-col w-full justify-center">
        <div className="inline-flex  text-default-foreground items-center gap-1 justify-center mb-2 select-none">
              <img style={{ marginLeft: 10 }} src={ciber} alt="Ciber" className="h-12 object-contain" />
          <p style={{color: '#fff'}} className="font-bold font-[500] text-xl tracking-wider flex items-center gap-[1px] opacity-90 hover:opacity-100 cursor-pointer">
            Ligolo-ng Tunnel Manager
          </p>
        </div>
        <div className="w-[600px] mx-auto my-4 flex items-center justify-center px-2">
          <Alert variant="flat" title="Faça o login para continuar" />
        </div>
        <Card style={{backgroundColor: '#000', opacity: 0.8}} className="w-[600px] flex m-auto p-6">
          <Form validationBehavior="native" onSubmit={handleSubmit}>
            <Input
              size="sm"
              placeholder="API URL"
              labelPlacement="outside"
              isRequired
              value={apiUrl}
              onValueChange={setApiUrl}
              name="api_url"
            />
            <Input
              size="sm"
              placeholder="Usuário"
              name="username"
              labelPlacement="outside"
              isRequired
              value={username}
              onValueChange={setUsername}
            />
            <Input
              size="sm"
              labelPlacement="outside"
              isRequired
              placeholder="Senha"
              value={password}
              type="password"
              onValueChange={setPassword}
            />
            <Button
              className="mt-2 w-full gap-0 text-opacity-50"
              style={{backgroundColor: '#ffcc29', color: '#000'}}
              size="sm"
              type="submit"
              disabled={loading}
            >
              {loading ? (
                <>
                  <CircularProgress className="scale-50" color="default" />
                  Fazendo login
                </>
              ) : (
                "Entrar"
              )}
            </Button>
          </Form>
        </Card>
      </div>
    </div>
  );
}
