export const CABINET_MODELS = ["LX", "TX", "CX", "FX"] as const;
export type CabinetModel = (typeof CABINET_MODELS)[number];

export type CabinetOption = {
  id: number;
  serial_number: string;
  name: string;
  location: string;
  country: string;
  model: CabinetModel | null;
};
