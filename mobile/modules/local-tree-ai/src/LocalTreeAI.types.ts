export type ModelStatus = { installed: boolean; modelName: string; modelPath?: string | null };
export type LocalAnalysis = {
  available: boolean;
  treeDetected: boolean;
  rejectionReason?: string | null;
  estimatedTreeSpecies?: string | null;
  visualDamageSummary?: string | null;
  urgencyLevel?: string | null;
  rawResponse?: string;
};
