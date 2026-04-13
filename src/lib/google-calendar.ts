import { google } from "googleapis";

export function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/calendar/callback`
  );
}

export function getAuthUrl(userId: string) {
  const client = getOAuth2Client();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    hd: "thyleads.com",
    scope: [
      "https://www.googleapis.com/auth/calendar.readonly",
      "https://www.googleapis.com/auth/calendar.events.readonly",
    ],
    state: userId,
  });
}

export async function getCalendarEvents(refreshToken: string, timeMin?: string, timeMax?: string) {
  const client = getOAuth2Client();
  client.setCredentials({ refresh_token: refreshToken });

  const calendar = google.calendar({ version: "v3", auth: client });

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfWeek = new Date(startOfDay.getTime() + 7 * 24 * 60 * 60 * 1000);

  const res = await calendar.events.list({
    calendarId: "primary",
    timeMin: timeMin || startOfDay.toISOString(),
    timeMax: timeMax || endOfWeek.toISOString(),
    maxResults: 50,
    singleEvents: true,
    orderBy: "startTime",
  });

  return (res.data.items || []).map((event) => ({
    id: event.id,
    summary: event.summary || "No Title",
    description: event.description || "",
    start: event.start?.dateTime || event.start?.date || "",
    end: event.end?.dateTime || event.end?.date || "",
    location: event.location || "",
    meetLink: event.hangoutLink || event.conferenceData?.entryPoints?.find((e) => e.entryPointType === "video")?.uri || "",
    htmlLink: event.htmlLink || "",
    status: event.status || "",
    organizer: event.organizer?.email || "",
    attendees: (event.attendees || []).map((a) => ({
      email: a.email || "",
      name: a.displayName || "",
      responseStatus: a.responseStatus || "",
    })),
  }));
}
