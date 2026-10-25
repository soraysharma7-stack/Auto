import { Badge } from "@/components/ui/badge";

export function StatusBadge({ status }: { status: string }) {
  const variant = ["completed", "verified", "active"].includes(status)
    ? "success"
    : ["failed", "unavailable", "cancelled", "revoked", "rejected", "expired"].includes(status)
      ? "warning"
      : ["running", "queued", "waiting_approval", "pending", "rate_limited"].includes(status)
        ? "brand"
        : "neutral";
  return <Badge variant={variant}>{status.replaceAll("_", " ")}</Badge>;
}
