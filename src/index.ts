import express from "express";
import cors from "cors";
import { identify } from "./service";
import { IdentifyRequest } from "./types";

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get("/", (_req, res) => {
    res.json({
        message: "Bitespeed Identity Reconciliation Service",
        status: "running",
        endpoint: "POST /identify",
    });
});

// Identity reconciliation endpoint
app.post("/identify", (req, res) => {
    try {
        const { email, phoneNumber } = req.body as IdentifyRequest;

        // Normalize inputs
        const normalizedEmail =
            email && typeof email === "string" && email.trim() !== ""
                ? email.trim()
                : null;
        const normalizedPhone =
            phoneNumber !== null && phoneNumber !== undefined && String(phoneNumber).trim() !== ""
                ? String(phoneNumber).trim()
                : null;

        // Validate that at least one field is provided
        if (!normalizedEmail && !normalizedPhone) {
            return res.status(400).json({
                error: "At least one of email or phoneNumber must be provided",
            });
        }

        const result = identify(normalizedEmail, normalizedPhone);
        return res.status(200).json(result);
    } catch (error: any) {
        console.error("Error in /identify:", error);
        return res.status(500).json({
            error: "Internal server error",
            message: error.message,
        });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Server is running on http://localhost:${PORT}`);
    console.log(`📍 POST /identify endpoint is ready`);
});

export default app;
