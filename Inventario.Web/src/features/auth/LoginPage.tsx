import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import {
  Button,
  Card,
  Checkbox,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useAuth } from "../../auth/AuthContext";

const defaultFrom = "/scan";

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, verifyMfa, isAuthenticated } = useAuth();
  const from = (location.state as { from?: { pathname: string } } | undefined)?.from?.pathname ?? defaultFrom;

  const [email, setEmail] = useState("admin@inventario.local");
  const [password, setPassword] = useState("ChangeMe!12345");
  const [mfaCode, setMfaCode] = useState("");
  const [mfaToken, setMfaToken] = useState("");
  const [useRecoveryCode, setUseRecoveryCode] = useState(false);
  const [step, setStep] = useState<"credentials" | "mfa">("credentials");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  if (isAuthenticated) {
    return <Navigate to={from} replace />;
  }

  async function submitCredentials() {
    setBusy(true);
    try {
      const response = await login(email.trim(), password);
      if (response.requiresMfa && response.mfaChallengeToken) {
        setMfaToken(response.mfaChallengeToken);
        setStep("mfa");
        setMessage(response.message || "Se requiere codigo MFA para continuar");
        notifications.show({
          title: "MFA requerido",
          message: response.message || "Introduce el código de autenticación.",
          color: "blue",
        });
        return;
      }

      if (!response.requiresMfa && response.accessToken) {
        notifications.show({
          title: "Sesión iniciada",
          message: "Bienvenido",
        });
        navigate(from, { replace: true });
      }
    } catch (error: any) {
      notifications.show({
        title: "No se pudo iniciar sesión",
        message: error?.message ?? "Credenciales inválidas.",
        color: "red",
      });
    } finally {
      setBusy(false);
    }
  }

  async function submitMfa() {
    if (!mfaToken) {
      notifications.show({
        title: "Sin sesión pendiente",
        message: "Vuelve a iniciar sesión con usuario y contraseña.",
        color: "red",
      });
      return;
    }

    setBusy(true);
    try {
      await verifyMfa(mfaToken, mfaCode, useRecoveryCode);
      notifications.show({
        title: "Sesión iniciada",
        message: "Bienvenido",
      });
      navigate(from, { replace: true });
    } catch (error: any) {
      notifications.show({
        title: "No se pudo verificar MFA",
        message: error?.message ?? "Código inválido o expirado.",
        color: "red",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 16,
      }}
    >
      <Card shadow="sm" p="xl" radius="md" withBorder style={{ width: 360 }}>
        <Stack gap="md">
          {step === "credentials" ? (
            <>
              <Title order={3}>Inicio de sesión</Title>
              <Text size="sm" c="dimmed">
                Plataforma Inventario de Activos
              </Text>
              <TextInput
                label="Email"
                value={email}
                onChange={(event) => setEmail(event.currentTarget.value)}
                autoComplete="username"
              />
              <PasswordInput
                label="Password"
                value={password}
                onChange={(event) => setPassword(event.currentTarget.value)}
                autoComplete="current-password"
              />
              <Button loading={busy} onClick={submitCredentials}>
                Entrar
              </Button>
            </>
          ) : (
            <>
              <Title order={3}>Verificación MFA</Title>
              <Text size="sm" c="dimmed">
                {message}
              </Text>
              <TextInput
                label="Código"
                value={mfaCode}
                onChange={(event) => setMfaCode(event.currentTarget.value)}
                autoComplete="one-time-code"
                placeholder={useRecoveryCode ? "XXXXXX" : "123456"}
              />
              <Checkbox
                label="Usar código de recuperación"
                checked={useRecoveryCode}
                onChange={(event) => setUseRecoveryCode(event.currentTarget.checked)}
              />
              <Button loading={busy} onClick={submitMfa}>
                Verificar y entrar
              </Button>
              <Button
                variant="subtle"
                onClick={() => {
                  setStep("credentials");
                  setMfaCode("");
                  setMfaToken("");
                  setMessage("");
                }}
              >
                Volver
              </Button>
            </>
          )}
        </Stack>
      </Card>
    </div>
  );
}
