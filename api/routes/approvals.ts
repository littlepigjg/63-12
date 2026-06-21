import { Router } from 'express';
import { approvalService } from '../services/ApprovalService.js';
import type { Approver } from '../../shared/types.js';

const router = Router();

router.get('/configs', async (req, res) => {
  try {
    const { projectId } = req.query;
    const configs = await approvalService.getApprovalConfigs(
      projectId ? String(projectId) : undefined
    );
    res.json({ success: true, data: configs });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch approval configs' });
  }
});

router.get('/configs/:id', async (req, res) => {
  try {
    const config = await approvalService.getApprovalConfigById(req.params.id);
    if (!config) {
      res.status(404).json({ success: false, error: 'Approval config not found' });
      return;
    }
    res.json({ success: true, data: config });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch approval config' });
  }
});

router.post('/configs', async (req, res) => {
  try {
    const { projectId, environment, configKeyPattern, approvers, requireAllApprovers } = req.body;
    if (!projectId || !environment || !configKeyPattern || !approvers) {
      res.status(400).json({
        success: false,
        error: 'projectId, environment, configKeyPattern, and approvers are required',
      });
      return;
    }
    const config = await approvalService.createApprovalConfig(
      projectId,
      environment,
      configKeyPattern,
      approvers as Approver[],
      requireAllApprovers || false
    );
    res.status(201).json({ success: true, data: config });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to create approval config' });
  }
});

router.put('/configs/:id', async (req, res) => {
  try {
    const config = await approvalService.updateApprovalConfig(req.params.id, req.body);
    if (!config) {
      res.status(404).json({ success: false, error: 'Approval config not found' });
      return;
    }
    res.json({ success: true, data: config });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to update approval config' });
  }
});

router.delete('/configs/:id', async (req, res) => {
  try {
    const deleted = await approvalService.deleteApprovalConfig(req.params.id);
    if (!deleted) {
      res.status(404).json({ success: false, error: 'Approval config not found' });
      return;
    }
    res.json({ success: true });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to delete approval config' });
  }
});

router.get('/requests', async (req, res) => {
  try {
    const { projectId, environment, configKey, status, submittedBy } = req.query;
    const requests = await approvalService.getApprovalRequests({
      projectId: projectId ? String(projectId) : undefined,
      environment: environment ? String(environment) : undefined,
      configKey: configKey ? String(configKey) : undefined,
      status: status ? String(status) : undefined,
      submittedBy: submittedBy ? String(submittedBy) : undefined,
    });
    res.json({ success: true, data: requests });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch approval requests' });
  }
});

router.get('/requests/:id', async (req, res) => {
  try {
    const request = await approvalService.getApprovalRequestById(req.params.id);
    if (!request) {
      res.status(404).json({ success: false, error: 'Approval request not found' });
      return;
    }
    res.json({ success: true, data: request });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch approval request' });
  }
});

router.post('/requests/:id/approve', async (req, res) => {
  try {
    const { approverId, approverName, comment } = req.body;
    if (!approverId || !approverName) {
      res.status(400).json({ success: false, error: 'approverId and approverName are required' });
      return;
    }
    const result = await approvalService.approveRequest(
      req.params.id,
      approverId,
      approverName,
      comment
    );
    if (!result) {
      res.status(404).json({ success: false, error: 'Approval request not found or not pending' });
      return;
    }
    res.json({ success: true, data: result });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to approve request' });
  }
});

router.post('/requests/:id/reject', async (req, res) => {
  try {
    const { approverId, approverName, reason, comment } = req.body;
    if (!approverId || !approverName || !reason) {
      res
        .status(400)
        .json({ success: false, error: 'approverId, approverName, and reason are required' });
      return;
    }
    const result = await approvalService.rejectRequest(
      req.params.id,
      approverId,
      approverName,
      reason,
      comment
    );
    if (!result) {
      res.status(404).json({ success: false, error: 'Approval request not found or not pending' });
      return;
    }
    res.json({ success: true, data: result });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to reject request' });
  }
});

router.get('/pending/:approverId', async (req, res) => {
  try {
    const requests = await approvalService.getPendingRequestsForApprover(req.params.approverId);
    res.json({ success: true, data: requests });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch pending requests' });
  }
});

router.get('/history/:projectId', async (req, res) => {
  try {
    const { environment, configKey } = req.query;
    const history = await approvalService.getApprovalHistory(
      req.params.projectId,
      environment ? String(environment) : undefined,
      configKey ? String(configKey) : undefined
    );
    res.json({ success: true, data: history });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch approval history' });
  }
});

router.get('/check/:projectId/:environment/:configKey', async (req, res) => {
  try {
    const requiresApproval = await approvalService.requiresApproval(
      req.params.projectId,
      req.params.environment,
      req.params.configKey
    );
    const config = await approvalService.getApprovalConfigForConfig(
      req.params.projectId,
      req.params.environment,
      req.params.configKey
    );
    res.json({ success: true, data: { requiresApproval, approvalConfig: config } });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to check approval requirement' });
  }
});

router.get('/users', async (req, res) => {
  try {
    const users = await approvalService.getUsers();
    res.json({ success: true, data: users });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch users' });
  }
});

export default router;
