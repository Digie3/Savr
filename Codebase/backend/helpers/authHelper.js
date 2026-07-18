import { getAuthenticatedUser } from "../auth.js";

export async function getOptionalUserId(req) {
    try {
        const user = await getAuthenticatedUser(req);
        return user?.idUsers || null;
    } catch {
        return null;
    }
}
