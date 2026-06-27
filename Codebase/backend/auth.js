import jwt from "jsonwebtoken";

// Secret and lifetime come from the environment (see .env / .env.example).
// The fallback only exists so the server still boots in dev if .env is missing.
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "1d";

// Create a signed token for a logged-in user.
// "sub" (subject) is the standard JWT claim for the user id.
export function signToken(user) {
  return jwt.sign(
    { sub: user.idUsers ?? user.id, username: user.username },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

// Express middleware: require a valid "Authorization: Bearer <token>" header.
// On success it attaches { id, username } to req.user and calls next().
export function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ error: "Missing or malformed token" });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = { id: payload.sub, username: payload.username };
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}
