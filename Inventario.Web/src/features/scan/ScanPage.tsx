import { Card, Title, Text } from "@mantine/core";

export function ScanPage() {
  return (
    <Card withBorder radius="md" p="lg">
      <Title order={3}>Escaneo</Title>
      <Text c="dimmed">Aquí irá el formulario de scan + resultados.</Text>
    </Card>
  );
}
