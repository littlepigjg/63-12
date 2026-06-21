import { approvalRepository } from '../repositories/ApprovalRepository.js';
import { configRepository } from '../repositories/ConfigRepository.js';
import { logService } from './LogService.js';
import { notifyService } from './NotifyService.js';
import { encryptionService } from './EncryptionService.js';
import crypto from 'crypto';
import type {
  ApprovalConfig,
  ApprovalRequest,
  ApprovalOperation,
  ConfigItem,
  Approver,
  User,
} from '../../shared/types.js';

export class ApprovalService {
  private matchPattern(key: string, pattern: string): boolean {
    if (pattern === '*') return true;
    if (pattern.endsWith('*')) {
      return key.startsWith(pattern.slice(0, -1));
    }
    if (pattern.startsWith('*')) {
      return key.endsWith(pattern.slice(1));
    }
    return key === pattern;
  }

  async getApprovalConfigForConfig(
    projectId: string,
    environment: string,
    configKey: string
  ): Promise<ApprovalConfig | null> {
    const configs = await approvalRepository.getApprovalConfigsByProject(projectId);
    const matchingConfigs = configs.filter(
      (c) => c.environment === environment && this.matchPattern(configKey, c.configKeyPattern)
    );
    if (matchingConfigs.length === 0) return null;
    return matchingConfigs.sort((a, b) => b.configKeyPattern.length - a.configKeyPattern.length)[0];
  }

  async requiresApproval(projectId: string, environment: string, configKey: string): Promise<boolean> {
    const config = await this.getApprovalConfigForConfig(projectId, environment, configKey);
    return config !== null;
  }

  async getApprovalConfigs(projectId?: string): Promise<ApprovalConfig[]> {
    if (projectId) {
      return approvalRepository.getApprovalConfigsByProject(projectId);
    }
    return approvalRepository.getApprovalConfigs();
  }

  async getApprovalConfigById(id: string): Promise<ApprovalConfig | undefined> {
    return approvalRepository.getApprovalConfigById(id);
  }

  async createApprovalConfig(
    projectId: string,
    environment: string,
    configKeyPattern: string,
    approvers: Approver[],
    requireAllApprovers: boolean = false,
    createdBy: string = 'admin'
  ): Promise<ApprovalConfig> {
    const config: ApprovalConfig = {
      id: `appr_cfg_${crypto.randomUUID().slice(0, 8)}`,
      projectId,
      environment,
      configKeyPattern,
      approvers,
      requireAllApprovers,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy,
    };
    const result = await approvalRepository.createApprovalConfig(config);
    await logService.addLog(
      'change',
      '',
      createdBy,
      projectId,
      environment,
      `创建审批配置: ${configKeyPattern}，审批人: ${approvers.map((a) => a.name).join(', ')}`
    );
    return result;
  }

  async updateApprovalConfig(
    id: string,
    updates: Partial<ApprovalConfig>
  ): Promise<ApprovalConfig | null> {
    return approvalRepository.updateApprovalConfig(id, updates);
  }

  async deleteApprovalConfig(id: string): Promise<boolean> {
    const config = await approvalRepository.getApprovalConfigById(id);
    const result = await approvalRepository.deleteApprovalConfig(id);
    if (result && config) {
      await logService.addLog(
        'change',
        '',
        'admin',
        config.projectId,
        config.environment,
        `删除审批配置: ${config.configKeyPattern}`
      );
    }
    return result;
  }

  async submitApprovalRequest(
    projectId: string,
    environment: string,
    configKey: string,
    operation: ApprovalOperation,
    oldValue: ConfigItem | undefined,
    newValue: ConfigItem | undefined,
    submittedBy: string = 'admin'
  ): Promise<ApprovalRequest | null> {
    const approvalConfig = await this.getApprovalConfigForConfig(projectId, environment, configKey);
    if (!approvalConfig) {
      return null;
    }

    const request: ApprovalRequest = {
      id: `appr_req_${crypto.randomUUID().slice(0, 12)}`,
      projectId,
      environment,
      configKey,
      operation,
      oldValue,
      newValue,
      status: 'pending',
      submittedBy,
      submittedAt: new Date().toISOString(),
      approvals: [],
    };

    const result = await approvalRepository.createApprovalRequest(request);
    await logService.addLog(
      'change',
      '',
      submittedBy,
      projectId,
      environment,
      `提交${operation === 'create' ? '新增' : operation === 'update' ? '更新' : '删除'}配置项 ${configKey} 的审批请求`
    );
    return result;
  }

  async getApprovalRequests(filters?: {
    projectId?: string;
    environment?: string;
    configKey?: string;
    status?: string;
    submittedBy?: string;
  }): Promise<ApprovalRequest[]> {
    return approvalRepository.getApprovalRequests(filters);
  }

  async getApprovalRequestById(id: string): Promise<ApprovalRequest | undefined> {
    return approvalRepository.getApprovalRequestById(id);
  }

  private checkApprovalComplete(request: ApprovalRequest, config: ApprovalConfig): boolean {
    if (config.requireAllApprovers) {
      return config.approvers.every((approver) =>
        request.approvals.some((a) => a.approverId === approver.id && a.action === 'approved')
      );
    } else {
      return request.approvals.some((a) => a.action === 'approved');
    }
  }

  private async applyApproval(request: ApprovalRequest): Promise<void> {
    if (request.operation === 'create' && request.newValue) {
      await configRepository.addConfigItem(request.projectId, request.environment, request.newValue);
    } else if (request.operation === 'update' && request.newValue) {
      const updates: Partial<ConfigItem> = {
        value: request.newValue.value,
        description: request.newValue.description,
        encrypted: request.newValue.encrypted,
        iv: request.newValue.iv,
        tag: request.newValue.tag,
        updatedBy: request.newValue.updatedBy,
      };
      await configRepository.updateConfigItem(request.projectId, request.environment, request.configKey, updates);
    } else if (request.operation === 'delete') {
      await configRepository.deleteConfigItem(request.projectId, request.environment, request.configKey);
    }
    notifyService.notifyChange(request.projectId, request.environment, [request.configKey]);
  }

  async approveRequest(
    requestId: string,
    approverId: string,
    approverName: string,
    comment?: string
  ): Promise<ApprovalRequest | null> {
    const request = await approvalRepository.getApprovalRequestById(requestId);
    if (!request || request.status !== 'pending') {
      return null;
    }

    const approvalConfig = await this.getApprovalConfigForConfig(
      request.projectId,
      request.environment,
      request.configKey
    );
    if (!approvalConfig) {
      return null;
    }

    const isApprover = approvalConfig.approvers.some((a) => a.id === approverId);
    if (!isApprover) {
      return null;
    }

    const alreadyApproved = request.approvals.some((a) => a.approverId === approverId);
    if (alreadyApproved) {
      return request;
    }

    const updatedApprovals = [
      ...request.approvals,
      {
        approverId,
        approverName,
        action: 'approved' as const,
        comment,
        timestamp: new Date().toISOString(),
      },
    ];

    const updatedRequest = { ...request, approvals: updatedApprovals };
    const isComplete = this.checkApprovalComplete(updatedRequest, approvalConfig);

    if (isComplete) {
      updatedRequest.status = 'approved';
      await this.applyApproval(updatedRequest);
      await logService.addLog(
        'change',
        '',
        approverName,
        request.projectId,
        request.environment,
        `审批通过配置项 ${request.configKey} 的${request.operation === 'create' ? '新增' : request.operation === 'update' ? '更新' : '删除'}请求`
      );
    }

    const result = await approvalRepository.updateApprovalRequest(requestId, updatedRequest);
    return result;
  }

  async rejectRequest(
    requestId: string,
    approverId: string,
    approverName: string,
    reason: string,
    comment?: string
  ): Promise<ApprovalRequest | null> {
    const request = await approvalRepository.getApprovalRequestById(requestId);
    if (!request || request.status !== 'pending') {
      return null;
    }

    const approvalConfig = await this.getApprovalConfigForConfig(
      request.projectId,
      request.environment,
      request.configKey
    );
    if (!approvalConfig) {
      return null;
    }

    const isApprover = approvalConfig.approvers.some((a) => a.id === approverId);
    if (!isApprover) {
      return null;
    }

    const updatedApprovals = [
      ...request.approvals,
      {
        approverId,
        approverName,
        action: 'rejected' as const,
        comment: comment || reason,
        timestamp: new Date().toISOString(),
      },
    ];

    const updatedRequest = {
      ...request,
      status: 'rejected' as const,
      approvals: updatedApprovals,
      rejectReason: reason,
    };

    await logService.addLog(
      'change',
      '',
      approverName,
      request.projectId,
      request.environment,
      `审批拒绝配置项 ${request.configKey} 的${request.operation === 'create' ? '新增' : request.operation === 'update' ? '更新' : '删除'}请求，理由: ${reason}`
    );

    return approvalRepository.updateApprovalRequest(requestId, updatedRequest);
  }

  async emergencyUpdate(
    projectId: string,
    environment: string,
    configKey: string,
    operation: ApprovalOperation,
    oldValue: ConfigItem | undefined,
    newValue: ConfigItem | undefined,
    emergencyUser: string,
    emergencyReason: string
  ): Promise<ApprovalRequest | ConfigItem | boolean | null> {
    const user = await approvalRepository.getUserByName(emergencyUser);
    if (!user || (user.role !== 'admin' && user.role !== 'emergency')) {
      return null;
    }

    const request: ApprovalRequest = {
      id: `appr_req_${crypto.randomUUID().slice(0, 12)}`,
      projectId,
      environment,
      configKey,
      operation,
      oldValue,
      newValue,
      status: 'emergency',
      submittedBy: emergencyUser,
      submittedAt: new Date().toISOString(),
      approvals: [],
      emergencyReason,
      emergencyUser,
    };

    await approvalRepository.createApprovalRequest(request);

    let result: ConfigItem | boolean | null = null;
    if (operation === 'create' && newValue) {
      result = await configRepository.addConfigItem(projectId, environment, newValue);
    } else if (operation === 'update' && newValue) {
      const updates: Partial<ConfigItem> = {
        value: newValue.value,
        description: newValue.description,
        encrypted: newValue.encrypted,
        iv: newValue.iv,
        tag: newValue.tag,
        updatedBy: newValue.updatedBy,
      };
      result = await configRepository.updateConfigItem(projectId, environment, configKey, updates);
    } else if (operation === 'delete') {
      result = await configRepository.deleteConfigItem(projectId, environment, configKey);
    }

    if (result) {
      notifyService.notifyChange(projectId, environment, [configKey]);
      await logService.addLog(
        'change',
        '',
        emergencyUser,
        projectId,
        environment,
        `紧急${operation === 'create' ? '新增' : operation === 'update' ? '更新' : '删除'}配置项 ${configKey}，理由: ${emergencyReason}`
      );
    }

    return result;
  }

  async getApprovalHistory(
    projectId: string,
    environment?: string,
    configKey?: string
  ): Promise<ApprovalRequest[]> {
    const filters: { projectId: string; environment?: string; configKey?: string } = { projectId };
    if (environment) filters.environment = environment;
    if (configKey) filters.configKey = configKey;
    return approvalRepository.getApprovalRequests(filters);
  }

  async getPendingRequestsForApprover(approverId: string): Promise<ApprovalRequest[]> {
    return approvalRepository.getPendingRequestsForApprover(approverId);
  }

  async getUsers(): Promise<User[]> {
    return approvalRepository.getUsers();
  }

  async getUserById(id: string): Promise<User | undefined> {
    return approvalRepository.getUserById(id);
  }

  async getUserByName(name: string): Promise<User | undefined> {
    return approvalRepository.getUserByName(name);
  }

  async processConfigChangeWithApproval(
    projectId: string,
    environment: string,
    configKey: string,
    operation: ApprovalOperation,
    oldValue: ConfigItem | undefined,
    newValueInput: Partial<ConfigItem> | undefined,
    submittedBy: string,
    useEmergency: boolean = false,
    emergencyReason?: string
  ): Promise<{
    success: boolean;
    data?: ConfigItem | ApprovalRequest | boolean | null;
    requiresApproval?: boolean;
    error?: string;
  }> {
    const needsApproval = await this.requiresApproval(projectId, environment, configKey);

    if (!needsApproval) {
      let result: ConfigItem | boolean | null = null;
      if (operation === 'create' && newValueInput) {
        let storedValue = newValueInput.value || '';
        let iv: string | undefined;
        let tag: string | undefined;

        if (newValueInput.encrypted && newValueInput.value) {
          const encryptResult = await encryptionService.encrypt(newValueInput.value);
          storedValue = encryptResult.encrypted;
          iv = encryptResult.iv;
          tag = encryptResult.tag;
        }

        const item: ConfigItem = {
          key: configKey,
          value: storedValue,
          description: newValueInput.description || '',
          encrypted: newValueInput.encrypted || false,
          iv,
          tag,
          updatedAt: new Date().toISOString(),
          updatedBy: submittedBy,
        };
        result = await configRepository.addConfigItem(projectId, environment, item);
        if (result) {
          notifyService.notifyChange(projectId, environment, [configKey]);
          await logService.addLog('change', '', submittedBy, projectId, environment, `新增配置项: ${configKey}`);
        }
      } else if (operation === 'update' && newValueInput) {
        const updates: Partial<ConfigItem> = { ...newValueInput };
        if (newValueInput.encrypted && newValueInput.value) {
          const encryptResult = await encryptionService.encrypt(newValueInput.value);
          updates.value = encryptResult.encrypted;
          updates.iv = encryptResult.iv;
          updates.tag = encryptResult.tag;
        }
        updates.updatedAt = new Date().toISOString();
        updates.updatedBy = submittedBy;
        result = await configRepository.updateConfigItem(projectId, environment, configKey, updates);
        if (result) {
          notifyService.notifyChange(projectId, environment, [configKey]);
          await logService.addLog('change', '', submittedBy, projectId, environment, `更新配置项: ${configKey}`);
        }
      } else if (operation === 'delete') {
        result = await configRepository.deleteConfigItem(projectId, environment, configKey);
        if (result) {
          notifyService.notifyChange(projectId, environment, [configKey]);
          await logService.addLog('change', '', submittedBy, projectId, environment, `删除配置项: ${configKey}`);
        }
      }
      return { success: true, data: result, requiresApproval: false };
    }

    if (useEmergency && emergencyReason) {
      let newValue: ConfigItem | undefined;
      if (operation !== 'delete' && newValueInput) {
        let storedValue = newValueInput.value || '';
        let iv: string | undefined;
        let tag: string | undefined;

        if (newValueInput.encrypted && newValueInput.value) {
          const encryptResult = await encryptionService.encrypt(newValueInput.value);
          storedValue = encryptResult.encrypted;
          iv = encryptResult.iv;
          tag = encryptResult.tag;
        }

        newValue = {
          key: configKey,
          value: storedValue,
          description: newValueInput.description || '',
          encrypted: newValueInput.encrypted || false,
          iv,
          tag,
          updatedAt: new Date().toISOString(),
          updatedBy: submittedBy,
        };
      }

      const result = await this.emergencyUpdate(
        projectId,
        environment,
        configKey,
        operation,
        oldValue,
        newValue,
        submittedBy,
        emergencyReason
      );
      return { success: result !== null, data: result, requiresApproval: true };
    }

    let newValue: ConfigItem | undefined;
    if (operation !== 'delete' && newValueInput) {
      let storedValue = newValueInput.value || '';
      let iv: string | undefined;
      let tag: string | undefined;

      if (newValueInput.encrypted && newValueInput.value) {
        const encryptResult = await encryptionService.encrypt(newValueInput.value);
        storedValue = encryptResult.encrypted;
        iv = encryptResult.iv;
        tag = encryptResult.tag;
      }

      newValue = {
        key: configKey,
        value: storedValue,
        description: newValueInput.description || '',
        encrypted: newValueInput.encrypted || false,
        iv,
        tag,
        updatedAt: new Date().toISOString(),
        updatedBy: submittedBy,
      };
    }

    const request = await this.submitApprovalRequest(
      projectId,
      environment,
      configKey,
      operation,
      oldValue,
      newValue,
      submittedBy
    );

    return {
      success: true,
      data: request,
      requiresApproval: true,
    };
  }
}

export const approvalService = new ApprovalService();
