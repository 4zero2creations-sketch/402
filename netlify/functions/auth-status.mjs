import { verifySession, json } from "./_auth.js";

export default async (req) => {
  const user = await verifySession(req);
  return json({ authenticated: !!user, user });
};
