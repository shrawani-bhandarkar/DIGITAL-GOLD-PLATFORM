import { Router } from "express";
import { requireAdmin, type AuthenticatedRequest } from "./middleware";

const router = Router();

router.get("/profile", requireAdmin, (request, response) => {
  const admin = (request as AuthenticatedRequest).admin;
  response.json({
    user: {
      id: admin.id,
      email: admin.email,
      name: admin.name,
      roleId: admin.roleId,
    },
  });
});

export default router;
