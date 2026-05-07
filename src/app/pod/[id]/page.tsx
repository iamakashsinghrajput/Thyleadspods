"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { usePods } from "@/lib/pod-context";
import PodDashboard from "@/components/pod-dashboard";

export default function PodViewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { user } = useAuth();
  const { podMap } = usePods();

  if (!user) return null;

  const pod = podMap[id];
  if (!pod) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <p className="text-slate-500">Member workspace not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-full">
      {(user.role === "admin" || user.role === "superadmin") && (
        <div className="px-8 pt-6">
          <button onClick={() => router.push("/")} className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-indigo-600 transition-colors">
            <ArrowLeft size={14} />
            Back to dashboard
          </button>
        </div>
      )}
      <PodDashboard podId={id} userName={pod.members[0] || pod.name} />
    </div>
  );
}
