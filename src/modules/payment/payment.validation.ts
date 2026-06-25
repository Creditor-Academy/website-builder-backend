import { z } from 'zod';

export const createOrderSchema = z.object({
  planId: z.string().min(1, "Plan ID is required"),
  amount: z.number().min(100, "Amount must be greater than 100 paise"), // Amount in paise
  currency: z.string().default('INR'),
});

export const verifyPaymentSchema = z.object({
  razorpay_order_id: z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type VerifyPaymentInput = z.infer<typeof verifyPaymentSchema>;
