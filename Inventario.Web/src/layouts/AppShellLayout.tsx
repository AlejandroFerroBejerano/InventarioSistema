import { ReactNode } from "react";
import { AppShell, Burger, Group, NavLink, Title } from "@mantine/core";
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

  return (
    <AppShell
      header={{ height: 56 }}
      navbar={{ width: 260, breakpoint: "sm", collapsed: { mobile: !opened } }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group>
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
            <Title order={4}>Inventario Activos</Title>
          </Group>
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
