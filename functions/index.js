const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));

const SUMUP_SECRET_KEY = defineSecret("SUMUP_SECRET_KEY");

exports.createSumupCheckout = onRequest(
    {
        secrets: [SUMUP_SECRET_KEY],
        cors: true, // Allow all origins (our PWA)
        region: "europe-west1",
    },
    async (req, res) => {
        // Only allow POST
        if (req.method !== "POST") {
            return res.status(405).json({ error: "Method not allowed" });
        }

        const { amount, planValue, userId } = req.body;

        if (!amount || !planValue) {
            return res.status(400).json({ error: "Missing amount or planValue" });
        }

        const payload = {
            checkout_reference: `FIT_${userId || "GUEST"}_${Date.now()}`,
            amount: parseFloat(amount),
            currency: "EUR",
            pay_to_email: "antonilafuentem@gmail.com",
            merchant_code: "MDUFC67Y",
            description: `Fit Data Ultra: ${planValue}`,
        };

        try {
            const response = await fetch("https://api.sumup.com/v0.1/checkouts", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${SUMUP_SECRET_KEY.value()}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
            });

            const data = await response.json();

            if (data.id) {
                return res.status(200).json({ checkoutId: data.id });
            } else {
                console.error("SumUp API Error:", data);
                return res.status(502).json({ error: data.message || "SumUp error" });
            }
        } catch (err) {
            console.error("Network error calling SumUp:", err);
            return res.status(500).json({ error: "Internal server error" });
        }
    }
);
