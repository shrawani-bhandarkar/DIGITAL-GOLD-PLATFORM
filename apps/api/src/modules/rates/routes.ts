import { Router } from "express";
import { getCurrentMetalPrices } from "../metal-prices/data";

const router = Router();

router.get("/rates", async (_request, response) => {
  try {
    response.json({
      rates: (await getCurrentMetalPrices()).map((rate) => ({
        metalId: rate.metalId,
        metal: rate.metalType,
        purity: rate.purity,
        ratePerGram: rate.ratePerGram,
        effectiveDate: rate.effectiveDate,
        updatedAt: rate.updatedAt,
      })),
    });
  } catch (error) {
    console.error("Market rates lookup failed:", error);
    response.status(500).json({ message: "Could not load current metal rates." });
  }
});

export default router;
