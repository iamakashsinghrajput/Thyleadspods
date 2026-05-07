import type { ClientProject } from "./data-types";

export const clientLogos: Record<string, string> = {
  thyleads: "/clients/thyleads.png",
  clevertapin: "/clients/clevertap.png",
  bluedove: "/clients/bluedove.png",
  evality: "/clients/evality.png",
  onecap: "/clients/onecap.png",
  mynd: "/clients/mynd.png",
  actyv: "/clients/actyv.png",
  zigtal: "/clients/zigtal.png",
  vwo: "/clients/vwo.png",
  pazo: "/clients/pazo.png",
  venwiz: "/clients/venwiz.png",
  infeedo: "/clients/infeedo.png",
};

export function extractDomain(input: string): string {
  if (!input) return "";
  const cleaned = input.trim().replace(/^https?:\/\//i, "").replace(/^www\./i, "");
  const slashIdx = cleaned.indexOf("/");
  return (slashIdx > 0 ? cleaned.slice(0, slashIdx) : cleaned).toLowerCase();
}

export function logoFromWebsite(websiteUrl: string): string {
  const domain = extractDomain(websiteUrl);
  return domain ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64` : "";
}

export function staticLogoForName(clientName: string): string | null {
  const key = (clientName || "").toLowerCase().replace(/[^a-z]/g, "");
  return clientLogos[key] || null;
}

export function resolveProjectLogo(project: Pick<ClientProject, "clientName" | "websiteUrl" | "logoUrl">): string {
  if (project.logoUrl) return project.logoUrl;
  if (project.websiteUrl) return logoFromWebsite(project.websiteUrl);
  const staticHit = staticLogoForName(project.clientName);
  if (staticHit) return staticHit;
  return "";
}
