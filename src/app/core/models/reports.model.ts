export type HeatmapPoint = [number, number, number];

export interface ChartBarDataset {
  label: string;
  data: number[];
}

export interface ChartBars {
  labels: string[];
  datasets: ChartBarDataset[];
}

export interface ChartDonut {
  labels: string[];
  data: number[];
}

export interface ChartTrend {
  labels: string[];
  data: number[];
}
