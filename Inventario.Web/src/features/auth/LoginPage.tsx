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
import { useI18n } from "../../app/i18n/AppI18nContext";
import { useAuth } from "../../auth/AuthContext";

const defaultFrom = "/scan";

export function LoginPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const { login, verifyMfa, isAuthenticated } = useAuth();
  const from =
    (location.state as { from?: { pathname: string } } | undefined)?.from?.pathname ??
    defaultFrom;

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
        setMessage(
          response.message || t("Se requiere codigo MFA para continuar", "MFA code is required to continue")
        );
        notifications.show({
          title: t("MFA requerido", "MFA required"),
          message:
            response.message ||
            t("Introduce el codigo de autenticacion.", "Enter your authentication code."),
          color: "blue",
        });
        return;
      }

      if (!response.requiresMfa && response.accessToken) {
        notifications.show({
          title: t("Sesion iniciada", "Signed in"),
          message: t("Bienvenido", "Welcome"),
        });
        navigate(from, { replace: true });
      }
    } catch (error: any) {
      notifications.show({
        title: t("No se pudo iniciar sesion", "Could not sign in"),
        message: error?.message ?? t("Credenciales invalidas.", "Invalid credentials."),
        color: "red",
      });
    } finally {
      setBusy(false);
    }
  }

  async function submitMfa() {
    if (!mfaToken) {
      notifications.show({
        title: t("Sin sesion pendiente", "No pending session"),
        message: t(
          "Vuelve a iniciar sesion con usuario y contrasena.",
          "Sign in again with your username and password."
        ),
        color: "red",
      });
      return;
    }

    setBusy(true);
    try {
      await verifyMfa(mfaToken, mfaCode, useRecoveryCode);
      notifications.show({
        title: t("Sesion iniciada", "Signed in"),
        message: t("Bienvenido", "Welcome"),
      });
      navigate(from, { replace: true });
    } catch (error: any) {
      notifications.show({
        title: t("No se pudo verificar MFA", "Could not verify MFA"),
        message: error?.message ?? t("Codigo invalido o expirado.", "Invalid or expired code."),
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
              <Title order={3}>{t("Inicio de sesion", "Sign in")}</Title>
              <Text size="sm" c="dimmed">
                {t("Plataforma Inventario de Activos", "Asset Inventory Platform")}
              </Text>
              <TextInput
                label="Email"
                value={email}
                onChange={(event) => setEmail(event.currentTarget.value)}
                autoComplete="username"
              />
              <PasswordInput
                label={t("Contrasena", "Password")}
                value={password}
                onChange={(event) => setPassword(event.currentTarget.value)}
                autoComplete="current-password"
              />
              <Button loading={busy} onClick={submitCredentials}>
                {t("Entrar", "Sign in")}
              </Button>
            </>
          ) : (
            <>
              <Title order={3}>{t("Verificacion MFA", "MFA verification")}</Title>
              <Text size="sm" c="dimmed">
                {message}
              </Text>
              <TextInput
                label={t("Codigo", "Code")}
                value={mfaCode}
                onChange={(event) => setMfaCode(event.currentTarget.value)}
                autoComplete="one-time-code"
                placeholder={useRecoveryCode ? "XXXXXX" : "123456"}
              />
              <Checkbox
                label={t("Usar codigo de recuperacion", "Use recovery code")}
                checked={useRecoveryCode}
                onChange={(event) => setUseRecoveryCode(event.currentTarget.checked)}
              />
              <Button loading={busy} onClick={submitMfa}>
                {t("Verificar y entrar", "Verify and sign in")}
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
                {t("Volver", "Back")}
              </Button>
            </>
          )}
        </Stack>
      </Card>
    </div>
  );
}
