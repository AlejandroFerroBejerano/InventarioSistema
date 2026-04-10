import { useMemo, useState } from "react";
import {
  Button,
  Group,
  Modal,
  Select,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { useI18n } from "../../../app/i18n/AppI18nContext";

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
  label,
  placeholder,
}: Props) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [abonadoMm, setAbonadoMm] = useState("");
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resolvedLabel = label ?? t("Instalacion", "Installation");
  const resolvedPlaceholder =
    placeholder ?? t("Selecciona una instalacion...", "Select an installation...");

  const data = useMemo(
    () =>
      installations.map((installation) => ({
        value: installation.abonadoMm,
        label: `${installation.abonadoMm} - ${installation.name}`,
      })),
    [installations]
  );

  async function handleCreate() {
    if (!onCreate) return;

    setError(null);

    if (!abonadoMm.trim() || !name.trim()) {
      setError(t("AbonadoMm y nombre son obligatorios", "AbonadoMm and name are required"));
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
      setError(t("No se pudo crear la instalacion", "Could not create the installation"));
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
          label={resolvedLabel}
          placeholder={resolvedPlaceholder}
          data={data}
          value={value}
          onChange={onChange}
          disabled={loading}
        />

        <Button variant="light" onClick={() => setOpen(true)} disabled={!onCreate}>
          {t("Nueva", "New")}
        </Button>
      </Group>

      <Modal
        opened={open}
        onClose={() => setOpen(false)}
        title={t("Nueva instalacion", "New installation")}
      >
        <Stack>
          <TextInput
            label="AbonadoMm"
            value={abonadoMm}
            onChange={(event) => setAbonadoMm(event.currentTarget.value)}
          />
          <TextInput
            label={t("Nombre", "Name")}
            value={name}
            onChange={(event) => setName(event.currentTarget.value)}
          />

          {error ? <Text c="red">{error}</Text> : null}

          <Group justify="flex-end">
            <Button variant="default" onClick={() => setOpen(false)}>
              {t("Cancelar", "Cancel")}
            </Button>
            <Button loading={creating} onClick={handleCreate} disabled={!onCreate}>
              {t("Crear", "Create")}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
