import { z } from "zod";

export const templateIdSchema = z.string().uuid();
