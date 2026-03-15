import { ReactNode } from "react";
import {
  AppShell,
  Badge,
  Burger,
  Button,
  Divider,
  Group,
  Menu,
  NavLink,
  Tabs,
  Text,
  Title,
  useMantineColorScheme,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
  IconActivity,
  IconCheck,
  IconDeviceDesktop,
  IconRobot,
  IconKey,
  IconMoon,
  IconNetwork,
  IconPalette,
  IconShieldLock,
  IconSparkles,
  IconSun,
  IconLogout,
  IconUserCircle,
  IconUsers,
} from "@tabler/icons-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAppTheme, type AppStylePreset } from "../app/theme/AppThemeContext";
import { useAuth } from "../auth/AuthContext";

type Props = { children: ReactNode };

const styleOptions: { value: AppStylePreset; label: string; icon: ReactNode }[] = [
  {
    value: "tech-corporate",
    label: "Tech Corporativo",
    icon: <IconPalette size={15} />,
  },
  {
    value: "soc-professional",
    label: "Profesional SOC",
    icon: <IconShieldLock size={15} />,
  },
  {
    value: "premium-enterprise",
    label: "Premium Enterprise",
    icon: <IconSparkles size={15} />,
  },
];

export function AppShellLayout({ children }: Props) {
  const [opened, { toggle }] = useDisclosure();
  const { colorScheme, setColorScheme } = useMantineColorScheme();
  const { stylePreset, setStylePreset } = useAppTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, hasAnyRole, logout } = useAuth();
  const canManageUsers = hasAnyRole(["GlobalAdmin", "TechnicalAdmin"]);
  const canViewAudit = hasAnyRole(["GlobalAdmin", "Auditor"]);

  function onLogout() {
    logout().finally(() => navigate("/login", { replace: true }));
  }

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + "/");

  const activeTopTab = isActive("/scan")
    ? "/scan"
    : isActive("/assets")
      ? "/assets"
      : isActive("/agents")
        ? "/agents"
      : isActive("/users")
        ? "/users"
      : isActive("/sessions")
        ? "/sessions"
      : isActive("/audit")
        ? "/audit"
      : "/installations";

  return (
    <AppShell
      header={{ height: 64 }}
      navbar={{ width: 280, breakpoint: "sm", collapsed: { mobile: !opened } }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between" wrap="nowrap">
          <Group wrap="nowrap" gap="sm">
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
            <Group gap={8} wrap="nowrap">
              <Title order={4} style={{ letterSpacing: -0.2 }}>
                Inventario Activos
              </Title>
              <Badge variant="light" visibleFrom="sm">
                Beta
              </Badge>
            </Group>
          </Group>

          <Tabs
            value={activeTopTab}
            onChange={(v) => v && navigate(v)}
            visibleFrom="sm"
            variant="pills"
            radius="xl"
          >
            <Tabs.List>
              <Tabs.Tab value="/scan" leftSection={<IconActivity size={16} />}>
                Escaneo
              </Tabs.Tab>
              <Tabs.Tab value="/assets" leftSection={<IconNetwork size={16} />}>
                Activos
              </Tabs.Tab>
              <Tabs.Tab value="/agents" leftSection={<IconRobot size={16} />}>
                Agentes
              </Tabs.Tab>
              {canManageUsers ? (
                <Tabs.Tab value="/users" leftSection={<IconUsers size={16} />}>
                  Usuarios
                </Tabs.Tab>
              ) : null}
              <Tabs.Tab value="/installations" leftSection={<IconKey size={16} />}>
                Credenciales
              </Tabs.Tab>
              <Tabs.Tab value="/sessions" leftSection={<IconActivity size={16} />}>
                Sesiones
              </Tabs.Tab>
              {canViewAudit ? (
                <Tabs.Tab value="/audit" leftSection={<IconShieldLock size={16} />}>
                  Auditoria
                </Tabs.Tab>
              ) : null}
            </Tabs.List>
          </Tabs>

          <Menu position="bottom-end" shadow="md" width={220} withArrow>
            <Menu.Target>
              <Button variant="light" leftSection={<IconUserCircle size={16} />} size="sm">
                {user?.displayName || user?.email || "Cuenta"}
              </Button>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Label>{user?.displayName || user?.email}</Menu.Label>
              <Menu.Item leftSection={<IconLogout size={16} />} onClick={onLogout}>
                Cerrar sesion
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>

          <Menu position="bottom-end" shadow="md" width={280} withArrow>
            <Menu.Target>
              <Button variant="subtle" leftSection={<IconPalette size={16} />} size="sm">
                Tema
              </Button>
            </Menu.Target>

            <Menu.Dropdown>
              <Menu.Label>Modo de color</Menu.Label>
              <Menu.Item
                leftSection={<IconSun size={16} />}
                rightSection={colorScheme === "light" ? <IconCheck size={14} /> : null}
                onClick={() => setColorScheme("light")}
              >
                Claro
              </Menu.Item>
              <Menu.Item
                leftSection={<IconMoon size={16} />}
                rightSection={colorScheme === "dark" ? <IconCheck size={14} /> : null}
                onClick={() => setColorScheme("dark")}
              >
                Oscuro
              </Menu.Item>
              <Menu.Item
                leftSection={<IconDeviceDesktop size={16} />}
                rightSection={colorScheme === "auto" ? <IconCheck size={14} /> : null}
                onClick={() => setColorScheme("auto")}
              >
                Auto (sistema)
              </Menu.Item>

              <Divider my="xs" />

              <Menu.Label>Estilo visual</Menu.Label>
              {styleOptions.map((option) => (
                <Menu.Item
                  key={option.value}
                  leftSection={option.icon}
                  rightSection={stylePreset === option.value ? <IconCheck size={14} /> : null}
                  onClick={() => setStylePreset(option.value)}
                >
                  {option.label}
                </Menu.Item>
              ))}

              <Divider my="xs" />
              <Text px="sm" py={4} c="dimmed" size="xs">
                El modo y estilo quedan guardados para futuras sesiones.
              </Text>
            </Menu.Dropdown>
          </Menu>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="sm">
        <NavLink
          label="Escaneo"
          leftSection={<IconActivity size={18} />}
          active={isActive("/scan")}
          onClick={() => navigate("/scan")}
        />
        <NavLink
          label="Activos"
          leftSection={<IconNetwork size={18} />}
          active={isActive("/assets")}
          onClick={() => navigate("/assets")}
        />
        <NavLink
          label="Agentes"
          leftSection={<IconRobot size={18} />}
          active={isActive("/agents")}
          onClick={() => navigate("/agents")}
        />
        {canManageUsers ? (
          <NavLink
            label="Usuarios"
            leftSection={<IconUsers size={18} />}
            active={isActive("/users")}
            onClick={() => navigate("/users")}
          />
        ) : null}

        <NavLink
          label="Credenciales"
          leftSection={<IconKey size={18} />}
          active={isActive("/installations")}
          onClick={() => navigate("/installations")}
        />
        <NavLink
          label="Sesiones"
          leftSection={<IconActivity size={18} />}
          active={isActive("/sessions")}
          onClick={() => navigate("/sessions")}
        />
        {canViewAudit ? (
          <NavLink
            label="Auditoria"
            leftSection={<IconShieldLock size={18} />}
            active={isActive("/audit")}
            onClick={() => navigate("/audit")}
          />
        ) : null}
      </AppShell.Navbar>

      <AppShell.Main>{children}</AppShell.Main>
    </AppShell>
  );
}
