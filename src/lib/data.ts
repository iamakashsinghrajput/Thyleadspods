import { Pod, ClientProject, PodId } from "@/types";

export const pods: Pod[] = [
  { id: "pod1", name: "Pod 1", members: ["Kunal", "Rajesh"] },
  { id: "pod2", name: "Pod 2", members: ["Mansi", "Naman"] },
  { id: "pod3", name: "Pod 3", members: ["Krishna", "Mridul"] },
  { id: "pod4", name: "Pod 4", members: ["Sandeep", "Rashi"] },
];

export const podMap: Record<PodId, Pod> = Object.fromEntries(
  pods.map((p) => [p.id, p])
) as Record<PodId, Pod>;

export const initialProjects: ClientProject[] = [
  {
    id: "1",
    clientName: "CleverTap",
    assignedPod: "pod1",
    monthlyTargetExternal: 120,
    weeklyTargetExternal: 30,
    monthlyTargetInternal: 100,
    targetsAchieved: 78,
  },
  {
    id: "2",
    clientName: "Razorpay",
    assignedPod: "pod2",
    monthlyTargetExternal: 80,
    weeklyTargetExternal: 20,
    monthlyTargetInternal: 90,
    targetsAchieved: 54,
  },
  {
    id: "3",
    clientName: "Swiggy",
    assignedPod: "pod3",
    monthlyTargetExternal: 150,
    weeklyTargetExternal: 38,
    monthlyTargetInternal: 130,
    targetsAchieved: 110,
  },
  {
    id: "4",
    clientName: "Zerodha",
    assignedPod: "pod4",
    monthlyTargetExternal: 60,
    weeklyTargetExternal: 15,
    monthlyTargetInternal: 70,
    targetsAchieved: 25,
  },
  {
    id: "5",
    clientName: "PhonePe",
    assignedPod: "pod1",
    monthlyTargetExternal: 100,
    weeklyTargetExternal: 25,
    monthlyTargetInternal: 85,
    targetsAchieved: 70,
  },
  {
    id: "6",
    clientName: "Freshworks",
    assignedPod: "pod2",
    monthlyTargetExternal: 90,
    weeklyTargetExternal: 22,
    monthlyTargetInternal: 75,
    targetsAchieved: 40,
  },
  {
    id: "7",
    clientName: "Flipkart",
    assignedPod: "pod3",
    monthlyTargetExternal: 200,
    weeklyTargetExternal: 50,
    monthlyTargetInternal: 160,
    targetsAchieved: 145,
  },
  {
    id: "8",
    clientName: "Meesho",
    assignedPod: "pod4",
    monthlyTargetExternal: 70,
    weeklyTargetExternal: 18,
    monthlyTargetInternal: 60,
    targetsAchieved: 15,
  },
];
