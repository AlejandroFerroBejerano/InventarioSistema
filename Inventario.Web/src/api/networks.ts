import { http } from "./http";

export type NetworkDto = {
  id: number;
  name: string;
  cidr: string;
  isActive: boolean;
  createdAt: string;
};

export type NetworkDeletePreviewDto = {
  networkId: number;
  networkName: string;
  networkCidr: string;
  scanRunsToDelete: number;
  hostResultsToDelete: number;
};

export async function getNetworks(abonadoMm: string) {
  const res = await http.get<NetworkDto[]>("/api/networks", { params: { abonadoMm } });
  return res.data;
}

export async function createNetwork(abonadoMm: string, name: string, cidr: string, isActive = true) {
  const res = await http.post<NetworkDto>("/api/networks", { abonadoMm, name, cidr, isActive });
  return res.data;
}

export async function getNetworkDeletePreview(id: number) {
  const res = await http.get<NetworkDeletePreviewDto>(`/api/networks/${id}/delete-preview`);
  return res.data;
}

export async function deleteNetwork(id: number, confirmation: string) {
  await http.delete(`/api/networks/${id}`, {
    data: { confirmation },
  });
}
