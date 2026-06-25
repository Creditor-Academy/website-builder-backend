import crypto from 'crypto';
import { razorpay, isRazorpayConfigured } from '../../config/razorpay.js';
import { InternalServerError, BadRequestError } from '../../utils/error.utils.js';
import type { CreateOrderInput, VerifyPaymentInput } from './payment.validation.js';
import prisma from '../../config/prisma.js';

class PaymentService {
  /**
   * Create a new Razorpay Order
   */
  async createOrder(userId: string, data: CreateOrderInput) {
    if (!isRazorpayConfigured()) {
      throw new InternalServerError('Payment gateway is not configured');
    }

    try {
      const options = {
        amount: data.amount,
        currency: data.currency,
        receipt: `receipt_${userId}_${Date.now()}`,
        notes: {
          userId,
          planId: data.planId,
        },
      };

      const order = await razorpay.orders.create(options);
      
      // Optionally store order details in DB with PENDING status
      
      return order;
    } catch (error: any) {
      throw new InternalServerError(`Failed to create Razorpay order: ${error.message}`);
    }
  }

  /**
   * Verify the payment signature from frontend
   */
  async verifyPayment(userId: string, data: VerifyPaymentInput) {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = data;

    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret) throw new InternalServerError('Razorpay secret not configured');

    const generatedSignature = crypto
      .createHmac('sha256', secret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (generatedSignature !== razorpay_signature) {
      throw new BadRequestError('Invalid payment signature');
    }

    // Payment is verified!
    // Update the user's subscription in DB here

    return { success: true, message: 'Payment verified successfully' };
  }

  /**
   * Process incoming Webhook from Razorpay
   */
  async handleWebhook(body: any, signature: string) {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) throw new InternalServerError('Webhook secret not configured');

    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(body))
      .digest('hex');

    if (expectedSignature !== signature) {
      throw new BadRequestError('Invalid webhook signature');
    }

    const event = body.event;
    
    switch (event) {
      case 'payment.captured':
        // Handle successful payment
        // const payment = body.payload.payment.entity;
        break;
      case 'payment.failed':
        // Handle failed payment
        break;
      // Add other events like subscription.active etc.
    }

    return { received: true };
  }
}

export default new PaymentService();
