export type PodId = "pod1" | "pod2" | "pod3" | "pod4";

export interface Pod {
  id: PodId;
  name: string;
  members: string[];
}

export interface ClientProject {
  id: string;
  clientName: string;
  assignedPod: PodId;
  monthlyTargetExternal: number;
  weeklyTargetExternal: number;
  monthlyTargetInternal: number;
  targetsAchieved: number;
}

export type HealthStatus = "red" | "amber" | "green";
