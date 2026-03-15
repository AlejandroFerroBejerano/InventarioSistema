import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { Button, Card, PasswordInput, Stack, TextInput, Text, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useAuth } from "../../auth/AuthContext";

const defaultFrom = "/scan";

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated } = useAuth();
  const from = (location.state as { from?: { pathname: string } } | undefined)?.from?.pathname ?? defaultFrom;

  const [email, setEmail] = useState("admin@inventario.local");
  const [password, setPassword] = useState("ChangeMe!12345");
  const [busy, setBusy] = useState(false);

  if (isAuthenticated) {
    return <Navigate to={from} replace />;
  }

  async function submit() {
    setBusy(true);
    try {
      await login(email.trim(), password);
      notifications.show({
        title: "Sesión iniciada",
        message: "Bienvenido",
      });
      navigate(from, { replace: true });
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
          <Button loading={busy} onClick={submit}>
            Entrar
          </Button>
        </Stack>
      </Card>
    </div>
  );
}
