import { ReactNode } from "react";
import {
  AppShell,
  Badge,
  Burger,
  Group,
  NavLink,
  Tabs,
  Text,
  Title,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconActivity, IconKey, IconNetwork } from "@tabler/icons-react";
import { useLocation, useNavigate } from "react-router-dom";

type Props = { children: ReactNode };

export function AppShellLayout({ children }: Props) {
  const [opened, { toggle }] = useDisclosure();
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + "/");

  const activeTopTab = isActive("/scan")
    ? "/scan"
    : isActive("/assets")
      ? "/assets"
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

          {/* Horizontal primary navigation (desktop). */}
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
              <Tabs.Tab value="/installations" leftSection={<IconKey size={16} />}>
                Credenciales
              </Tabs.Tab>
            </Tabs.List>
          </Tabs>

          <Text c="dimmed" size="sm" visibleFrom="sm">
            Panel de red · Inventario
          </Text>
        </Group>
      </AppShell.Header>

      {/* Vertical secondary navigation (always available; collapses on mobile). */}
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
          label="Credenciales"
          leftSection={<IconKey size={18} />}
          active={isActive("/installations")}
          onClick={() => navigate("/installations")}
        />
      </AppShell.Navbar>

      <AppShell.Main>{children}</AppShell.Main>
    </AppShell>
  );
}
