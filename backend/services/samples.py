"""Sample PR diffs for demos when no real GitHub webhook is connected."""

SAMPLES: dict[str, dict] = {
    "refund": {
        "repo_name": "acme/payments-api",
        "pr_number": 142,
        "pr_title": "Add refund endpoint with idempotency keys",
        "pr_body": "Adds POST /payments/{id}/refund with idempotency-key support.",
        "pr_url": "https://github.com/acme/payments-api/pull/142",
        "diff": '''diff --git a/app/api/refunds.py b/app/api/refunds.py
new file mode 100644
index 0000000..1111111
--- /dev/null
+++ b/app/api/refunds.py
@@ -0,0 +1,42 @@
+from fastapi import APIRouter, HTTPException
+from pydantic import BaseModel
+
+router = APIRouter()
+_IDEMPOTENCY: dict[str, dict] = {}
+
+
+class RefundRequest(BaseModel):
+    amount: int
+    idempotency_key: str
+
+
+@router.post("/payments/{payment_id}/refund")
+def create_refund(payment_id: str, body: RefundRequest, payments: dict):
+    if body.idempotency_key in _IDEMPOTENCY:
+        return _IDEMPOTENCY[body.idempotency_key]
+
+    payment = payments.get(payment_id)
+    if not payment:
+        raise HTTPException(status_code=404, detail="payment not found")
+    if payment["status"] != "completed":
+        raise HTTPException(status_code=400, detail="payment not refundable")
+    if body.amount > payment["amount"]:
+        raise HTTPException(status_code=400, detail="amount too large")
+
+    result = {
+        "id": f"rf_{payment_id}_{body.idempotency_key}",
+        "status": "refunded",
+        "amount": body.amount,
+    }
+    _IDEMPOTENCY[body.idempotency_key] = result
+    payment["status"] = "refunded"
+    return result
''',
    },
    "auth": {
        "repo_name": "acme/auth-service",
        "pr_number": 77,
        "pr_title": "Add JWT refresh token rotation",
        "pr_body": "Rotate refresh tokens on each use and revoke the previous token.",
        "pr_url": "https://github.com/acme/auth-service/pull/77",
        "diff": '''diff --git a/src/auth/tokens.ts b/src/auth/tokens.ts
index 2222222..3333333 100644
--- a/src/auth/tokens.ts
+++ b/src/auth/tokens.ts
@@ -10,6 +10,28 @@ export function issueAccessToken(userId: string) {
   return jwt.sign({ sub: userId, type: "access" }, secret, { expiresIn: "15m" });
 }
 
+export async function rotateRefreshToken(oldToken: string, db: DB) {
+  const stored = await db.refreshTokens.findByToken(oldToken);
+  if (!stored || stored.revoked) {
+    throw new Error("invalid_refresh_token");
+  }
+  await db.refreshTokens.revoke(oldToken);
+  const next = crypto.randomUUID();
+  await db.refreshTokens.create({
+    token: next,
+    userId: stored.userId,
+    parent: oldToken,
+  });
+  return {
+    accessToken: issueAccessToken(stored.userId),
+    refreshToken: next,
+  };
+}
''',
    },
    "feature_flag": {
        "repo_name": "acme/web-app",
        "pr_number": 88,
        "pr_title": "Introduce feature flag for checkout v2",
        "pr_body": "Gate the new checkout behind checkout_v2 flag.",
        "pr_url": "https://github.com/acme/web-app/pull/88",
        "diff": '''diff --git a/src/checkout/Checkout.tsx b/src/checkout/Checkout.tsx
index 4444444..5555555 100644
--- a/src/checkout/Checkout.tsx
+++ b/src/checkout/Checkout.tsx
@@ -1,8 +1,16 @@
 import { useFlags } from "../flags";
+import { CheckoutV2 } from "./CheckoutV2";
 import { CheckoutLegacy } from "./CheckoutLegacy";
 
 export function Checkout() {
+  const flags = useFlags();
+  if (flags.checkout_v2) {
+    return <CheckoutV2 />;
+  }
   return <CheckoutLegacy />;
 }
''',
    },
}


def list_samples() -> list[dict]:
    return [
        {
            "id": key,
            "repo_name": value["repo_name"],
            "pr_number": value["pr_number"],
            "pr_title": value["pr_title"],
            "description": value["pr_body"],
        }
        for key, value in SAMPLES.items()
    ]
