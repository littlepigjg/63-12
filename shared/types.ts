export interface ConfigItem {
  key: string;
  value: string;
  description: string;
  encrypted: boolean;
  iv?: string;
  tag?: string;
  updatedAt: string;
  updatedBy: string;
}

export interface Environment {
  name: string;
  configs: ConfigItem[];
}

export interface Project {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  environments: Environment[];
}

export interface LogEntry {
  id: string;
  timestamp: string;
  type: 'pull' | 'change' | 'encrypt' | 'decrypt' | 'client_register' | 'notify';
  clientIp: string;
  clientName: string;
  project: string;
  environment: string;
  detail: string;
}

export interface ClientInfo {
  id: string;
  name: string;
  ip: string;
  token: string;
  lastHeartbeat: string;
  online: boolean;
}

export interface ConfigData {
  encryptionKey: string;
  projects: Project[];
}

export interface LogsData {
  logs: LogEntry[];
}

export interface ClientsData {
  clients: ClientInfo[];
}

export interface PullResponse {
  configs: Record<string, string>;
  version: string;
  pulledAt: string;
}

export type LogType = LogEntry['type'];

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'emergency';

export type ApprovalOperation = 'create' | 'update' | 'delete';

export interface Approver {
  id: string;
  name: string;
  type: 'user' | 'group';
}

export interface ApprovalConfig {
  id: string;
  projectId: string;
  environment: string;
  configKeyPattern: string;
  approvers: Approver[];
  requireAllApprovers: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface ApprovalRequest {
  id: string;
  projectId: string;
  environment: string;
  configKey: string;
  operation: ApprovalOperation;
  oldValue?: ConfigItem;
  newValue?: ConfigItem;
  status: ApprovalStatus;
  submittedBy: string;
  submittedAt: string;
  approvals: ApprovalAction[];
  rejectReason?: string;
  emergencyReason?: string;
  emergencyUser?: string;
}

export interface ApprovalAction {
  approverId: string;
  approverName: string;
  action: 'approved' | 'rejected';
  comment?: string;
  timestamp: string;
}

export interface ApprovalConfigData {
  approvalConfigs: ApprovalConfig[];
  approvalRequests: ApprovalRequest[];
}

export interface User {
  id: string;
  name: string;
  role: 'admin' | 'developer' | 'approver' | 'emergency';
  email?: string;
}
