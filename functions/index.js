const functions = require("firebase-functions");
const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));

exports.createSumupCheckout = functions
    .region("europe-west1")
    .https.onRequest(async (req, res) => {
        // Allow CORS for our PWA
        res.set('Access-Control-Allow-Origin', '*');
        res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.set('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
            return res.status(204).send('');
        }

        if (req.method !== "POST") {
            return res.status(405).json({ error: "Method not allowed" });
        }

        const { amount, planValue, userId } = req.body;

        if (!amount || !planValue) {
            return res.status(400).json({ error: "Missing amount or planValue" });
        }

        // Read the key from Firebase Functions config (set via firebase functions:config:set)
        const sumupKey = functions.config().sumup.key;

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
                    Authorization: `Bearer ${sumupKey}`,
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
    });
