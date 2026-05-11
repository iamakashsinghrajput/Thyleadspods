import { NextResponse } from "next/server";
import { runValidationSeed } from "@/lib/outbound/validation-seed";

export async function GET() {
  const run = runValidationSeed();
  return NextResponse.json({ run });
}
