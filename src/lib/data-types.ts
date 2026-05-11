export interface ClientProject {
  id: string;
  clientId: string;
  clientName: string;
  assignedPod: string;
  monthlyTargetExternal: number;
  weeklyTargetExternal: number;
  monthlyTargetInternal: number;
  targetsAchieved: number;
  meetingCompleted: number;
  meetingBooked: number;
  websiteUrl?: string;
  logoUrl?: string;
  assignedMembers?: string[];
  smartleadCampaignIds?: string[];
}
