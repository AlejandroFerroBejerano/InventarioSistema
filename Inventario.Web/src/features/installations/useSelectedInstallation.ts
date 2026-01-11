import { useEffect, useState } from "react";

const KEY = "inventario.selectedAbonadoMm";

export function useSelectedInstallation() {
  const [selectedAbonadoMm, setSelectedAbonadoMm] = useState<string | null>(() => {
    const v = localStorage.getItem(KEY);
    return v && v.trim().length > 0 ? v : null;
  });

  useEffect(() => {
    if (selectedAbonadoMm && selectedAbonadoMm.trim().length > 0) {
      localStorage.setItem(KEY, selectedAbonadoMm);
    } else {
      localStorage.removeItem(KEY);
    }
  }, [selectedAbonadoMm]);

  return { selectedAbonadoMm, setSelectedAbonadoMm };
}
