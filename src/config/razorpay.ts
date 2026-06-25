import Razorpay from 'razorpay';
import pino from 'pino';

const logger = pino({ name: 'razorpay-config' });

export const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'dummy_key',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'dummy_secret',
});

export const isRazorpayConfigured = () => {
    const configured = Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
    if (!configured) {
        logger.warn('Razorpay keys are missing in .env. Payments will not work.');
    }
    return configured;
};
