import { JsonRepository } from './JsonRepository.js';
import type { ApprovalConfigData, ApprovalConfig, ApprovalRequest, User } from '../../shared/types.js';

export class ApprovalRepository {
  private repo: JsonRepository<ApprovalConfigData & { users: User[] }>;

  constructor() {
    this.repo = new JsonRepository<ApprovalConfigData & { users: User[] }>('approval.json', {
      approvalConfigs: [],
      approvalRequests: [],
      users: [],
    });
  }

  async getData(): Promise<ApprovalConfigData & { users: User[] }> {
    return this.repo.read();
  }

  async saveData(data: ApprovalConfigData & { users: User[] }): Promise<void> {
    await this.repo.write(data);
  }

  async getApprovalConfigs(): Promise<ApprovalConfig[]> {
    const data = await this.getData();
    return data.approvalConfigs;
  }

  async getApprovalConfigsByProject(projectId: string): Promise<ApprovalConfig[]> {
    const data = await this.getData();
    return data.approvalConfigs.filter((c) => c.projectId === projectId);
  }

  async getApprovalConfigById(id: string): Promise<ApprovalConfig | undefined> {
    const data = await this.getData();
    return data.approvalConfigs.find((c) => c.id === id);
  }

  async createApprovalConfig(config: ApprovalConfig): Promise<ApprovalConfig> {
    const data = await this.getData();
    data.approvalConfigs.push(config);
    await this.saveData(data);
    return config;
  }

  async updateApprovalConfig(id: string, updates: Partial<ApprovalConfig>): Promise<ApprovalConfig | null> {
    const data = await this.getData();
    const idx = data.approvalConfigs.findIndex((c) => c.id === id);
    if (idx === -1) return null;
    data.approvalConfigs[idx] = { ...data.approvalConfigs[idx], ...updates, updatedAt: new Date().toISOString() };
    await this.saveData(data);
    return data.approvalConfigs[idx];
  }

  async deleteApprovalConfig(id: string): Promise<boolean> {
    const data = await this.getData();
    const idx = data.approvalConfigs.findIndex((c) => c.id === id);
    if (idx === -1) return false;
    data.approvalConfigs.splice(idx, 1);
    await this.saveData(data);
    return true;
  }

  async getApprovalRequests(filters?: {
    projectId?: string;
    environment?: string;
    configKey?: string;
    status?: string;
    submittedBy?: string;
  }): Promise<ApprovalRequest[]> {
    const data = await this.getData();
    let requests = [...data.approvalRequests];

    if (filters) {
      if (filters.projectId) {
        requests = requests.filter((r) => r.projectId === filters.projectId);
      }
      if (filters.environment) {
        requests = requests.filter((r) => r.environment === filters.environment);
      }
      if (filters.configKey) {
        requests = requests.filter((r) => r.configKey === filters.configKey);
      }
      if (filters.status) {
        requests = requests.filter((r) => r.status === filters.status);
      }
      if (filters.submittedBy) {
        requests = requests.filter((r) => r.submittedBy === filters.submittedBy);
      }
    }

    return requests.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
  }

  async getApprovalRequestById(id: string): Promise<ApprovalRequest | undefined> {
    const data = await this.getData();
    return data.approvalRequests.find((r) => r.id === id);
  }

  async createApprovalRequest(request: ApprovalRequest): Promise<ApprovalRequest> {
    const data = await this.getData();
    data.approvalRequests.push(request);
    await this.saveData(data);
    return request;
  }

  async updateApprovalRequest(id: string, updates: Partial<ApprovalRequest>): Promise<ApprovalRequest | null> {
    const data = await this.getData();
    const idx = data.approvalRequests.findIndex((r) => r.id === id);
    if (idx === -1) return null;
    data.approvalRequests[idx] = { ...data.approvalRequests[idx], ...updates };
    await this.saveData(data);
    return data.approvalRequests[idx];
  }

  async getUsers(): Promise<User[]> {
    const data = await this.getData();
    return data.users;
  }

  async getUserById(id: string): Promise<User | undefined> {
    const data = await this.getData();
    return data.users.find((u) => u.id === id);
  }

  async getUserByName(name: string): Promise<User | undefined> {
    const data = await this.getData();
    return data.users.find((u) => u.name === name);
  }

  async getPendingRequestsForApprover(approverId: string): Promise<ApprovalRequest[]> {
    const data = await this.getData();
    return data.approvalRequests.filter((r) => {
      if (r.status !== 'pending') return false;
      const config = data.approvalConfigs.find(
        (c) => c.projectId === r.projectId && c.environment === r.environment && this.matchPattern(r.configKey, c.configKeyPattern)
      );
      if (!config) return false;
      return config.approvers.some((a) => a.id === approverId) && !r.approvals.some((a) => a.approverId === approverId);
    }).sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
  }

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
}

export const approvalRepository = new ApprovalRepository();
