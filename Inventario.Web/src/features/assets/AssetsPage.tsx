import { Card, Title, Text } from "@mantine/core";

export function AssetsPage() {
  return (
    <Card withBorder radius="md" p="lg">
      <Title order={3}>Activos</Title>
      <Text c="dimmed">Aquí irá el inventario (SystemAssets).</Text>
    </Card>
  );
}
