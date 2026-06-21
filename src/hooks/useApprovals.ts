import { useState, useCallback } from 'react';
import { api } from '@/utils/api';
import type { ApprovalConfig, ApprovalRequest, User, Approver } from '../../shared/types';

export function useApprovals() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getApprovalConfigs = useCallback(async (projectId?: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<ApprovalConfig[]>(
        `/approvals/configs${projectId ? `?projectId=${projectId}` : ''}`
      );
      return res.success && res.data ? res.data : [];
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch approval configs');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const createApprovalConfig = useCallback(
    async (
      projectId: string,
      environment: string,
      configKeyPattern: string,
      approvers: Approver[],
      requireAllApprovers: boolean = false
    ) => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.post<ApprovalConfig>('/approvals/configs', {
          projectId,
          environment,
          configKeyPattern,
          approvers,
          requireAllApprovers,
        });
        return res.success && res.data ? res.data : null;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create approval config');
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const updateApprovalConfig = useCallback(async (id: string, updates: Partial<ApprovalConfig>) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.put<ApprovalConfig>(`/approvals/configs/${id}`, updates);
      return res.success && res.data ? res.data : null;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update approval config');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteApprovalConfig = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.delete(`/approvals/configs/${id}`);
      return res.success;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete approval config');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const getApprovalRequests = useCallback(
    async (filters?: {
      projectId?: string;
      environment?: string;
      configKey?: string;
      status?: string;
      submittedBy?: string;
    }) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (filters?.projectId) params.set('projectId', filters.projectId);
        if (filters?.environment) params.set('environment', filters.environment);
        if (filters?.configKey) params.set('configKey', filters.configKey);
        if (filters?.status) params.set('status', filters.status);
        if (filters?.submittedBy) params.set('submittedBy', filters.submittedBy);
        const res = await api.get<ApprovalRequest[]>(
          `/approvals/requests${params.toString() ? `?${params.toString()}` : ''}`
        );
        return res.success && res.data ? res.data : [];
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch approval requests');
        return [];
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const getApprovalRequestById = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<ApprovalRequest>(`/approvals/requests/${id}`);
      return res.success && res.data ? res.data : null;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch approval request');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const approveRequest = useCallback(
    async (requestId: string, approverId: string, approverName: string, comment?: string) => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.post<ApprovalRequest>(`/approvals/requests/${requestId}/approve`, {
          approverId,
          approverName,
          comment,
        });
        return res.success && res.data ? res.data : null;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to approve request');
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const rejectRequest = useCallback(
    async (requestId: string, approverId: string, approverName: string, reason: string, comment?: string) => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.post<ApprovalRequest>(`/approvals/requests/${requestId}/reject`, {
          approverId,
          approverName,
          reason,
          comment,
        });
        return res.success && res.data ? res.data : null;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to reject request');
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const getPendingRequests = useCallback(async (approverId: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<ApprovalRequest[]>(`/approvals/pending/${approverId}`);
      return res.success && res.data ? res.data : [];
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch pending requests');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const getApprovalHistory = useCallback(
    async (projectId: string, environment?: string, configKey?: string) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (environment) params.set('environment', environment);
        if (configKey) params.set('configKey', configKey);
        const res = await api.get<ApprovalRequest[]>(
          `/approvals/history/${projectId}${params.toString() ? `?${params.toString()}` : ''}`
        );
        return res.success && res.data ? res.data : [];
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch approval history');
        return [];
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const checkApprovalRequirement = useCallback(
    async (projectId: string, environment: string, configKey: string) => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.get<{ requiresApproval: boolean; approvalConfig: ApprovalConfig | null }>(
          `/approvals/check/${projectId}/${environment}/${configKey}`
        );
        return res.success && res.data ? res.data : { requiresApproval: false, approvalConfig: null };
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to check approval requirement');
        return { requiresApproval: false, approvalConfig: null };
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const getUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<User[]>('/approvals/users');
      return res.success && res.data ? res.data : [];
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch users');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    getApprovalConfigs,
    createApprovalConfig,
    updateApprovalConfig,
    deleteApprovalConfig,
    getApprovalRequests,
    getApprovalRequestById,
    approveRequest,
    rejectRequest,
    getPendingRequests,
    getApprovalHistory,
    checkApprovalRequirement,
    getUsers,
  };
}
