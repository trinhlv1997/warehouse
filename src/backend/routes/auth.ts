import { Hono } from "hono";
import { deleteCookie, setCookie } from "hono/cookie";
import { changePasswordSchema, loginSchema } from "../../shared/schemas";
import { AppError } from "../domain/errors";
import { SESSION_COOKIE, clientIp, csrfMiddleware, parseBody, requireAuth, type AppEnv } from "../middleware";
import { ok } from "./helpers";

export const authRoutes = new Hono<AppEnv>()
  .post("/login", csrfMiddleware, async (c) => {
    const input = await parseBody(c, loginSchema);
    const { container } = c.var;
    const result = await container.auth.login(input.email, input.password, clientIp(c), c.req.header("user-agent") ?? null);
    setCookie(c, SESSION_COOKIE, result.token, {
      httpOnly: true,
      secure: container.config.secureCookies,
      sameSite: "Lax",
      path: "/",
      maxAge: container.config.sessionTtlHours * 3600,
    });
    return ok(c, { user: result.user, csrfToken: result.csrfToken });
  })
  .post("/logout", requireAuth, csrfMiddleware, async (c) => {
    await c.var.container.auth.logout(c.var.sessionId!, c.var.user!, clientIp(c));
    deleteCookie(c, SESSION_COOKIE, { path: "/" });
    return ok(c, { success: true });
  })
  .get("/me", async (c) => {
    if (!c.var.user) throw new AppError("UNAUTHORIZED", "Not signed in");
    return ok(c, { user: c.var.user, csrfToken: c.var.csrfToken });
  })
  .post("/change-password", requireAuth, csrfMiddleware, async (c) => {
    const input = await parseBody(c, changePasswordSchema);
    await c.var.container.auth.changePassword(c.var.user!, input.currentPassword, input.newPassword, clientIp(c));
    deleteCookie(c, SESSION_COOKIE, { path: "/" });
    return ok(c, { success: true });
  });
