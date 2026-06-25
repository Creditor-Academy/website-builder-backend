import type { Request, Response, NextFunction } from 'express';
import paymentService from './payment.service.js';

class PaymentController {
  createOrder = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const order = await paymentService.createOrder(req.context.user.id, req.validated.body);
      res.status(200).json(order);
    } catch (error) {
      next(error);
    }
  };

  verifyPayment = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await paymentService.verifyPayment(req.context.user.id, req.validated.body);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  webhook = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const signature = req.headers['x-razorpay-signature'] as string;
      const result = await paymentService.handleWebhook(req.body, signature);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };
}

export default new PaymentController();
