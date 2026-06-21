import { Router } from 'express';
import { configService } from '../services/ConfigService.js';
import { approvalService } from '../services/ApprovalService.js';
import type { ConfigItem, ApprovalRequest } from '../../shared/types.js';

const router = Router();

router.get('/:projectId/envs/:envName', async (req, res) => {
  try {
    const configs = await configService.getEnvironmentConfigs(req.params.projectId, req.params.envName);
    if (!configs) {
      res.status(404).json({ success: false, error: 'Environment not found' });
      return;
    }
    res.json({ success: true, data: configs });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch configs' });
  }
});

router.post('/:projectId/envs/:envName', async (req, res) => {
  try {
    const { key, value, description, encrypted, useEmergency, emergencyReason, submittedBy } = req.body;
    if (!key || value === undefined) {
      res.status(400).json({ success: false, error: 'Key and value are required' });
      return;
    }

    const existingConfigs = await configService.getEnvironmentConfigs(req.params.projectId, req.params.envName);
    if (existingConfigs && existingConfigs.some((c) => c.key === key)) {
      res.status(409).json({ success: false, error: 'Config key already exists' });
      return;
    }

    const result = await approvalService.processConfigChangeWithApproval(
      req.params.projectId,
      req.params.envName,
      key,
      'create',
      undefined,
      { value, description, encrypted },
      submittedBy || 'admin',
      useEmergency || false,
      emergencyReason
    );

    if (!result.success) {
      res.status(400).json({ success: false, error: result.error || 'Failed to process config change' });
      return;
    }

    if (result.requiresApproval && !useEmergency) {
      res.status(202).json({
        success: true,
        data: result.data as ApprovalRequest,
        requiresApproval: true,
        message: 'Config change submitted for approval',
      });
    } else {
      res.status(201).json({
        success: true,
        data: result.data as ConfigItem,
        requiresApproval: false,
        emergency: useEmergency,
      });
    }
  } catch {
    res.status(500).json({ success: false, error: 'Failed to add config' });
  }
});

router.put('/:projectId/envs/:envName/:key', async (req, res) => {
  try {
    const { value, description, encrypted, useEmergency, emergencyReason, submittedBy } = req.body;

    const existingConfigs = await configService.getEnvironmentConfigs(req.params.projectId, req.params.envName);
    const oldValue = existingConfigs?.find((c) => c.key === req.params.key);
    if (!oldValue) {
      res.status(404).json({ success: false, error: 'Config not found' });
      return;
    }

    const newValueInput: Partial<ConfigItem> = {};
    if (value !== undefined && value !== '') newValueInput.value = value;
    if (description !== undefined) newValueInput.description = description;
    if (encrypted !== undefined) newValueInput.encrypted = encrypted;

    if (Object.keys(newValueInput).length === 0) {
      res.status(400).json({ success: false, error: 'No valid updates provided' });
      return;
    }

    const result = await approvalService.processConfigChangeWithApproval(
      req.params.projectId,
      req.params.envName,
      req.params.key,
      'update',
      oldValue,
      newValueInput,
      submittedBy || 'admin',
      useEmergency || false,
      emergencyReason
    );

    if (!result.success) {
      res.status(400).json({ success: false, error: result.error || 'Failed to process config change' });
      return;
    }

    if (result.requiresApproval && !useEmergency) {
      res.status(202).json({
        success: true,
        data: result.data as ApprovalRequest,
        requiresApproval: true,
        message: 'Config change submitted for approval',
      });
    } else {
      res.json({
        success: true,
        data: result.data as ConfigItem,
        requiresApproval: false,
        emergency: useEmergency,
      });
    }
  } catch {
    res.status(500).json({ success: false, error: 'Failed to update config' });
  }
});

router.delete('/:projectId/envs/:envName/:key', async (req, res) => {
  try {
    const { useEmergency, emergencyReason, submittedBy } = req.body;

    const existingConfigs = await configService.getEnvironmentConfigs(req.params.projectId, req.params.envName);
    const oldValue = existingConfigs?.find((c) => c.key === req.params.key);
    if (!oldValue) {
      res.status(404).json({ success: false, error: 'Config not found' });
      return;
    }

    const result = await approvalService.processConfigChangeWithApproval(
      req.params.projectId,
      req.params.envName,
      req.params.key,
      'delete',
      oldValue,
      undefined,
      submittedBy || 'admin',
      useEmergency || false,
      emergencyReason
    );

    if (!result.success) {
      res.status(400).json({ success: false, error: result.error || 'Failed to process config change' });
      return;
    }

    if (result.requiresApproval && !useEmergency) {
      res.status(202).json({
        success: true,
        data: result.data as ApprovalRequest,
        requiresApproval: true,
        message: 'Config deletion submitted for approval',
      });
    } else {
      res.json({
        success: true,
        requiresApproval: false,
        emergency: useEmergency,
      });
    }
  } catch {
    res.status(500).json({ success: false, error: 'Failed to delete config' });
  }
});

export default router;
