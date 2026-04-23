"use client";

import { useAuth } from "@/lib/auth-context";
import Signature from "@/components/signature";

export default function SignaturesPage() {
  const { user } = useAuth();
  if (!user) return null;
  return <Signature />;
}
