import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Project from "@/lib/models/project";
import ClientDetail from "@/lib/models/client-detail";
import ClientMetric from "@/lib/models/client-metric";
import { defaultProjects } from "@/lib/default-data";
import { clientDetails } from "@/lib/client-data";
import { clientMetrics } from "@/lib/metrics-data";

export async function POST() {
  await connectDB();

  const projectCount = await Project.estimatedDocumentCount();
  const detailCount = await ClientDetail.estimatedDocumentCount();
  const metricCount = await ClientMetric.estimatedDocumentCount();

  if (projectCount === 0) {
    await Project.insertMany(defaultProjects);
  }

  if (detailCount === 0) {
    const detailDocs = Object.entries(clientDetails).flatMap(([projectId, list]) =>
      list.map((d) => ({ projectId, ...d }))
    );
    if (detailDocs.length) await ClientDetail.insertMany(detailDocs, { ordered: false });
  }

  if (metricCount === 0) {
    const metricDocs = Object.entries(clientMetrics).flatMap(([projectId, list]) =>
      list.map((m) => ({ projectId, ...m }))
    );
    if (metricDocs.length) await ClientMetric.insertMany(metricDocs, { ordered: false });
  }

  return NextResponse.json({
    ok: true,
    seeded: {
      projects: projectCount === 0,
      details: detailCount === 0,
      metrics: metricCount === 0,
    },
  });
}
