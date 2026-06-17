import type { Request, Response, NextFunction } from 'express';
import { FormsService } from './forms.service.js';

export class FormsController {
  private formsService: FormsService;

  constructor() {
    this.formsService = new FormsService();
  }

  submitForm = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const forwarded = req.headers['x-forwarded-for'];
      const clientIp = typeof forwarded === 'string' ? forwarded.split(',')[0]?.trim() : undefined;
      const ua = typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'].substring(0, 512) : undefined;

      const submission = await this.formsService.submitForm(req.validated.body, clientIp, ua);
      res.status(201).json({ message: 'Form submitted successfully', id: submission.id });
    } catch (error) {
      next(error);
    }
  };

  getUserSubmissions = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.context.user.id;
      const websiteId = req.validated.query.websiteId as string | undefined;
      
      const page = Math.max(1, parseInt(req.validated.query.page as string) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.validated.query.limit as string) || 50));
      
      let isRead: boolean | undefined = undefined;
      if (req.validated.query.is_read === 'true') isRead = true;
      if (req.validated.query.is_read === 'false') isRead = false;

      let isSpam: boolean | undefined = undefined;
      if (req.validated.query.is_spam === 'true') isSpam = true;
      if (req.validated.query.is_spam === 'false') isSpam = false;

      const result = await this.formsService.getUserSubmissions(userId, page, limit, isRead, isSpam, websiteId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  getUserStats = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.context.user.id;
      const websiteId = req.query.websiteId as string | undefined;

      const stats = await this.formsService.getUserStats(userId, websiteId);
      res.json({ data: stats });
    } catch (error) {
      next(error);
    }
  };

  markAsRead = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.context.user.id;
      const submissionId = req.validated.params.id;
      
      await this.formsService.markAsRead(userId, submissionId);
      res.json({ message: 'Marked as read' });
    } catch (error) {
      next(error);
    }
  };

  deleteSubmission = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.context.user.id;
      const submissionId = req.validated.params.id;
      
      await this.formsService.deleteSubmission(userId, submissionId);
      res.json({ message: 'Submission deleted' });
    } catch (error) {
      next(error);
    }
  };
}
