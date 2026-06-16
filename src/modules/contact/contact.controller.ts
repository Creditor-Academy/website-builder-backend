import type { Request, Response } from 'express';
import contactDao from './contact.dao.js';

class ContactController {

    /**
     * POST /contact/submit
     * Public - submit a contact form for a website
     */
    submitContactForm = async (req: Request, res: Response) => {
        try {
            const { websiteId, name, email, subject, message } = req.body;

            const submission = await contactDao.createContactSubmission({
                websiteId,
                name,
                email,
                subject,
                message,
            });

            res.status(201).json({
                success: true,
                message: 'Contact form submitted successfully',
                data: submission
            });
        } catch (error) {
            console.error('[ContactController] submitContactForm:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to submit contact form'
            });
        }
    };

    /**
     * GET /contact/submissions
     * Auth required - get all contact submissions for the logged-in user
     */
    getContactSubmissions = async (req: Request, res: Response) => {
        try {
            const userId = req.context?.user?.id;
            if (!userId) {
                return res.status(401).json({
                    success: false,
                    message: 'Unauthorized'
                });
            }
            const { websiteId, status, limit, offset } = req.query;

            const options: any = {};
            if (websiteId) options.websiteId = websiteId as string;
            if (status) options.status = status as string;
            if (limit) options.limit = Number(limit);
            if (offset) options.offset = Number(offset);

            const submissions = await contactDao.getContactSubmissionsByOwnerId(userId, options);

            res.status(200).json({
                success: true,
                data: submissions
            });
        } catch (error) {
            console.error('[ContactController] getContactSubmissions:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch contact submissions'
            });
        }
    };

    /**
     * GET /contact/submissions/:id
     * Auth required - get a single contact submission
     */
    getContactSubmissionById = async (req: Request, res: Response) => {
        try {
            const userId = req.context?.user?.id;
            if (!userId) {
                return res.status(401).json({
                    success: false,
                    message: 'Unauthorized'
                });
            }
            const { id } = req.params;
            
            if (!id) {
                return res.status(400).json({
                    success: false,
                    message: 'Contact submission ID is required'
                });
            }

            const submission = await contactDao.getContactSubmissionById(id as string, userId);

            if (!submission) {
                return res.status(404).json({
                    success: false,
                    message: 'Contact submission not found'
                });
            }

            res.status(200).json({
                success: true,
                data: submission
            });
        } catch (error) {
            console.error('[ContactController] getContactSubmissionById:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch contact submission'
            });
        }
    };

    /**
     * PATCH /contact/submissions/:id
     * Auth required - update contact submission status
     */
    updateContactSubmission = async (req: Request, res: Response) => {
        try {
            const userId = req.context?.user?.id;
            if (!userId) {
                return res.status(401).json({
                    success: false,
                    message: 'Unauthorized'
                });
            }
            const { id } = req.params;
            const { status } = req.body;

            if (!id) {
                return res.status(400).json({
                    success: false,
                    message: 'Contact submission ID is required'
                });
            }

            const existing = await contactDao.getContactSubmissionById(id as string, userId);
            if (!existing) {
                return res.status(404).json({
                    success: false,
                    message: 'Contact submission not found'
                });
            }

            const updated = await contactDao.updateContactSubmissionStatus(id as string, status);

            res.status(200).json({
                success: true,
                message: 'Contact submission updated successfully',
                data: updated
            });
        } catch (error) {
            console.error('[ContactController] updateContactSubmission:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to update contact submission'
            });
        }
    };

    /**
     * DELETE /contact/submissions/:id
     * Auth required - delete a contact submission
     */
    deleteContactSubmission = async (req: Request, res: Response) => {
        try {
            const userId = req.context?.user?.id;
            if (!userId) {
                return res.status(401).json({
                    success: false,
                    message: 'Unauthorized'
                });
            }
            const { id } = req.params;

            if (!id) {
                return res.status(400).json({
                    success: false,
                    message: 'Contact submission ID is required'
                });
            }

            const existing = await contactDao.getContactSubmissionById(id as string, userId);
            if (!existing) {
                return res.status(404).json({
                    success: false,
                    message: 'Contact submission not found'
                });
            }

            await contactDao.deleteContactSubmission(id as string);

            res.status(200).json({
                success: true,
                message: 'Contact submission deleted successfully'
            });
        } catch (error) {
            console.error('[ContactController] deleteContactSubmission:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to delete contact submission'
            });
        }
    };

    /**
     * GET /contact/stats
     * Auth required - get contact submission stats for the user
     */
    getContactStats = async (req: Request, res: Response) => {
        try {
            const userId = req.context?.user?.id;
            if (!userId) {
                return res.status(401).json({
                    success: false,
                    message: 'Unauthorized'
                });
            }

            const websiteId = typeof req.query.websiteId === 'string' ? req.query.websiteId : undefined;
            const stats = await contactDao.getContactSubmissionStats(userId, websiteId);

            res.status(200).json({
                success: true,
                data: stats
            });
        } catch (error) {
            console.error('[ContactController] getContactStats:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch contact stats'
            });
        }
    };
}

export default new ContactController();
