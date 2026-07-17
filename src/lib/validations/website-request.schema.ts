import { z } from "zod";
import { WEBSITE_REQUEST_STATUSES } from "@/lib/constants";

export const websiteRequestStatusUpdateSchema = z.object({
  status: z.enum([
    WEBSITE_REQUEST_STATUSES.new,
    WEBSITE_REQUEST_STATUSES.contacted,
    WEBSITE_REQUEST_STATUSES.confirmed,
    WEBSITE_REQUEST_STATUSES.cancelled,
  ]),
});

export type WebsiteRequestStatusUpdateInput = z.infer<typeof websiteRequestStatusUpdateSchema>;
