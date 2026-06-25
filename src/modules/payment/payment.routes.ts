import { Router } from 'express';
import { validateRequest } from '../../middlewares/validation.middleware.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { createOrderSchema, verifyPaymentSchema } from './payment.validation.js';
import paymentController from './payment.controller.js';
import express from 'express';

const router = Router();

// Private routes (require authentication)
router.post('/create-order', authenticate, validateRequest(createOrderSchema), paymentController.createOrder);
router.post('/verify', authenticate, validateRequest(verifyPaymentSchema), paymentController.verifyPayment);

// Public webhook route (needs raw body if you want to use express.raw for strict signature verification, but express.json works too depending on setup)
router.post('/webhook', express.json(), paymentController.webhook);

export default router;
