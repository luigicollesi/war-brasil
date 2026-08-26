export type Region = "norte" | "nordeste" | "centro-oeste" | "sudeste" | "sul";

export type CardSymbol = "leaf" | "gold" | "water";

export const REGION_REINFORCEMENT_BONUSES: Record<Region, number> = {
  norte: 3,
  nordeste: 2,
  "centro-oeste": 2,
  sudeste: 3,
  sul: 2,
};

export const TERRITORY_METADATA: Record<number, { name: string; region: Region }> = {
  1: { name: "Amazonas Ocidental", region: "norte" },
  2: { name: "Amazonas Oriental", region: "norte" },
  3: { name: "Acre", region: "norte" },
  4: { name: "Rondônia", region: "norte" },
  5: { name: "Roraima", region: "norte" },
  6: { name: "Pará Oeste", region: "norte" },
  7: { name: "Mato Grosso Norte-Leste", region: "centro-oeste" },
  8: { name: "Mato Grosso Centro-Sul", region: "centro-oeste" },
  9: { name: "Pará Sudeste", region: "norte" },
  10: { name: "Amapá", region: "norte" },
  11: { name: "Pará Atlântico", region: "norte" },
  12: { name: "Maranhão", region: "nordeste" },
  13: { name: "Tocantins", region: "norte" },
  14: { name: "Piauí", region: "nordeste" },
  15: { name: "Ceará Norte", region: "nordeste" },
  16: { name: "Ceará Sul", region: "nordeste" },
  17: { name: "Bahia Centro-Norte", region: "nordeste" },
  18: { name: "Goiás", region: "centro-oeste" },
  19: { name: "Mato Grosso do Sul", region: "centro-oeste" },
  20: { name: "São Paulo Oeste", region: "sudeste" },
  21: { name: "São Paulo Central", region: "sudeste" },
  22: { name: "Rio de Janeiro", region: "sudeste" },
  23: { name: "Bahia Oeste-Sul", region: "nordeste" },
  24: { name: "Paraná Oeste", region: "sul" },
  25: { name: "Santa Catarina Leste", region: "sul" },
  26: { name: "Rio Grande do Sul Oeste", region: "sul" },
  27: { name: "Rio Grande do Sul Leste", region: "sul" },
  28: { name: "São Paulo Leste", region: "sudeste" },
  29: { name: "Espírito Santo", region: "sudeste" },
  30: { name: "Sergipe", region: "nordeste" },
  31: { name: "Alagoas", region: "nordeste" },
  32: { name: "Pernambuco Leste", region: "nordeste" },
  33: { name: "Paraíba", region: "nordeste" },
  34: { name: "Rio Grande do Norte", region: "nordeste" },
  35: { name: "Minas Centro-Sul", region: "sudeste" },
  36: { name: "Minas Norte-Leste", region: "sudeste" },
  37: { name: "Minas Oeste", region: "sudeste" },
  38: { name: "Pernambuco Oeste", region: "nordeste" },
  39: { name: "Bahia Leste", region: "nordeste" },
  40: { name: "Distrito Federal", region: "centro-oeste" },
  41: { name: "Paraná Leste", region: "sul" },
  42: { name: "Santa Catarina Oeste", region: "sul" },
};

export const CARD_LAYOUT = {
  map: { left: "-45%", top: "-25%", width: "200%", height: "200%" },
  name: { left: "12%", top: "67.5%", width: "76%" },
  symbol: { left: "39%", top: "80%", size: "22%" },
} as const;
