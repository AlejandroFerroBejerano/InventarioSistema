import { useMemo, useState } from "react";
import {
  Button,
  Group,
  Modal,
  Select,
  Stack,
  TextInput,
  Text,
} from "@mantine/core";

export type InstallationListItem = {
  id: number;
  abonadoMm: string;
  name: string;
};

type Props = {
  installations: InstallationListItem[];
  value: string | null;
  onChange: (abonadoMm: string | null) => void;
  loading?: boolean;
  onCreate?: (input: {
    abonadoMm: string;
    name: string;
  }) => Promise<InstallationListItem>;
  label?: string;
  placeholder?: string;
};

export function InstallationPicker({
  installations,
  value,
  onChange,
  loading,
  onCreate,
  label = "Instalación",
  placeholder = "Selecciona una instalación…",
}: Props) {
  const [open, setOpen] = useState(false);
  const [abonadoMm, setAbonadoMm] = useState("");
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const data = useMemo(
    () =>
      installations.map((i) => ({
        value: i.abonadoMm,
        label: `${i.abonadoMm} — ${i.name}`,
      })),
    [installations]
  );

  async function handleCreate() {
    if (!onCreate) return;

    setError(null);

    if (!abonadoMm.trim() || !name.trim()) {
      setError("AbonadoMm y nombre son obligatorios");
      return;
    }

    try {
      setCreating(true);
      const created = await onCreate({
        abonadoMm: abonadoMm.trim(),
        name: name.trim(),
      });
      onChange(created.abonadoMm);
      setOpen(false);
      setAbonadoMm("");
      setName("");
    } catch {
      setError("No se pudo crear la instalación");
    } finally {
      setCreating(false);
    }
  }

  return (
    <Stack gap="xs">
      <Group justify="space-between" align="flex-end">
        <Select
          searchable
          clearable
          label={label}
          placeholder={placeholder}
          data={data}
          value={value}
          onChange={onChange}
          disabled={loading}
        />

        <Button variant="light" onClick={() => setOpen(true)} disabled={!onCreate}>
            Nueva
        </Button>
      </Group>

      <Modal opened={open} onClose={() => setOpen(false)} title="Nueva instalación">
        <Stack>
          <TextInput
            label="AbonadoMm"
            value={abonadoMm}
            onChange={(e) => setAbonadoMm(e.currentTarget.value)}
          />
          <TextInput
            label="Nombre"
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
          />

          {error && <Text c="red">{error}</Text>}

          <Group justify="flex-end">
            <Button variant="default" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button loading={creating} onClick={handleCreate} disabled={!onCreate}>
              Crear
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
