import { asyncRouter } from "../lib/async-router";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";
import { loginSchema } from "../lib/validation";
import { signToken } from "../lib/auth";

export const authRouter = asyncRouter();

// A fixed, valid bcrypt hash (cost 10) that no real password matches — used to keep the
// login timing constant when the email is unknown. Not a secret.
const DUMMY_HASH = "$2a$10$fb6ui.FsbQrz582sesV61usbBkOKNHoUeehdLpxBrdFJwVz4K0Ore";

authRouter.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Email and password required" });
  }
  const { email, password } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email } });
  // Always run a bcrypt comparison, even for an unknown email, so the response time
  // doesn't reveal whether an address is a real admin account (user-enumeration via
  // timing). DUMMY_HASH is a valid bcrypt hash of a random string that nothing matches.
  const hash = user?.passwordHash ?? DUMMY_HASH;
  const ok = await bcrypt.compare(password, hash);
  if (!user || !ok) {
    return res.status(401).json({ error: "Wrong email or password" });
  }
  const token = signToken(user);
  res.json({ token, user: { email: user.email, role: user.role } });
});
