import { useState, useEffect } from 'react';
import { Settings, Clock, CheckCircle, XCircle, AlertTriangle, Plus, Trash2, Eye, ChevronDown, History, Users } from 'lucide-react';
import { useAppStore } from '@/stores/appStore';
import { useProjects, useApprovals } from '@/hooks';
import PageHeader from '@/components/PageHeader';
import Badge from '@/components/Badge';
import Modal from '@/components/Modal';
import { envLabel } from '@/utils/format';
import type { ApprovalConfig, ApprovalRequest, Approver, User } from '../../shared/types';

const DEFAULT_ENVS = ['development', 'testing', 'production'];

type TabType = 'configs' | 'pending' | 'history';

export default function Approvals() {
  const { selectedProjectId, setSelectedProjectId, selectedEnv, setSelectedEnv } = useAppStore();
  const { projects } = useProjects();
  const {
    getApprovalConfigs,
    createApprovalConfig,
    deleteApprovalConfig,
    getApprovalRequests,
    getPendingRequests,
    getApprovalHistory,
    approveRequest,
    rejectRequest,
    getUsers,
    loading,
  } = useApprovals();

  const [activeTab, setActiveTab] = useState<TabType>('configs');
  const [approvalConfigs, setApprovalConfigs] = useState<ApprovalConfig[]>([]);
  const [pendingRequests, setPendingRequests] = useState<ApprovalRequest[]>([]);
  const [history, setHistory] = useState<ApprovalRequest[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);

  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<ApprovalRequest | null>(null);
  const [configPattern, setConfigPattern] = useState('');
  const [configEnv, setConfigEnv] = useState('production');
  const [selectedApprovers, setSelectedApprovers] = useState<string[]>([]);
  const [requireAllApprovers, setRequireAllApprovers] = useState(false);

  const [rejectReason, setRejectReason] = useState('');
  const [approveComment, setApproveComment] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);

  const currentProject = projects.find((p) => p.id === selectedProjectId);
  const projectEnvs = currentProject?.environments.map((e) => e.name) || [];
  const allEnvs = [...new Set([...DEFAULT_ENVS, ...projectEnvs])];

  const currentUser = users.find((u) => u.role === 'approver') || users[0];

  useEffect(() => {
    if (projects.length > 0 && !selectedProjectId) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId, setSelectedProjectId]);

  useEffect(() => {
    loadData();
  }, [selectedProjectId, activeTab, selectedEnv]);

  useEffect(() => {
    getUsers().then(setUsers);
  }, [getUsers]);

  const loadData = async () => {
    if (!selectedProjectId) return;

    if (activeTab === 'configs') {
      const configs = await getApprovalConfigs(selectedProjectId);
      setApprovalConfigs(configs);
    } else if (activeTab === 'pending') {
      if (currentUser) {
        const requests = await getPendingRequests(currentUser.id);
        setPendingRequests(requests);
      }
    } else if (activeTab === 'history') {
      const historyData = await getApprovalHistory(selectedProjectId, selectedEnv);
      setHistory(historyData);
    }
  };

  const handleCreateConfig = async () => {
    if (!selectedProjectId || !configPattern || selectedApprovers.length === 0) return;

    const approvers: Approver[] = selectedApprovers.map((id) => {
      const user = users.find((u) => u.id === id);
      return { id, name: user?.name || id, type: 'user' as const };
    });

    const result = await createApprovalConfig(
      selectedProjectId,
      configEnv,
      configPattern,
      approvers,
      requireAllApprovers
    );

    if (result) {
      setShowConfigModal(false);
      setConfigPattern('');
      setSelectedApprovers([]);
      setRequireAllApprovers(false);
      loadData();
    }
  };

  const handleDeleteConfig = async (id: string) => {
    if (!confirm('确定删除此审批配置吗？')) return;
    const result = await deleteApprovalConfig(id);
    if (result) {
      loadData();
    }
  };

  const handleApprove = async () => {
    if (!selectedRequest || !currentUser) return;
    const result = await approveRequest(
      selectedRequest.id,
      currentUser.id,
      currentUser.name,
      approveComment
    );
    if (result) {
      setShowRequestModal(false);
      setSelectedRequest(null);
      setApproveComment('');
      loadData();
    }
  };

  const handleReject = async () => {
    if (!selectedRequest || !currentUser || !rejectReason) return;
    const result = await rejectRequest(
      selectedRequest.id,
      currentUser.id,
      currentUser.name,
      rejectReason
    );
    if (result) {
      setShowRejectModal(false);
      setShowRequestModal(false);
      setSelectedRequest(null);
      setRejectReason('');
      loadData();
    }
  };

  const openRequestDetail = (request: ApprovalRequest) => {
    setSelectedRequest(request);
    setShowRequestModal(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="warning">待审批</Badge>;
      case 'approved':
        return <Badge variant="success">已通过</Badge>;
      case 'rejected':
        return <Badge variant="danger">已拒绝</Badge>;
      case 'emergency':
        return <Badge variant="danger">紧急修改</Badge>;
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  };

  const getOperationLabel = (operation: string) => {
    switch (operation) {
      case 'create':
        return '新增';
      case 'update':
        return '更新';
      case 'delete':
        return '删除';
      default:
        return operation;
    }
  };

  return (
    <div className="animate-slide-in">
      <PageHeader title="审批管理" subtitle="管理配置审批流程、处理待审批请求" />

      <div className="flex items-center gap-4 mb-6">
        <div className="relative">
          <button
            onClick={() => setShowProjectDropdown(!showProjectDropdown)}
            className="flex items-center gap-2 px-4 py-2 bg-[#1E293B] border border-[#334155] rounded-lg text-sm text-[#F1F5F9] hover:border-emerald-500/30 transition-colors min-w-[200px] justify-between"
          >
            <span>{currentProject?.name || '选择项目'}</span>
            <ChevronDown className="w-4 h-4 text-[#64748B]" />
          </button>
          {showProjectDropdown && (
            <div className="absolute top-full left-0 mt-1 w-full bg-[#1E293B] border border-[#334155] rounded-lg shadow-xl z-20 overflow-hidden">
              {projects.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    setSelectedProjectId(p.id);
                    setShowProjectDropdown(false);
                  }}
                  className={`w-full text-left px-4 py-2 text-sm hover:bg-[#334155] transition-colors ${p.id === selectedProjectId ? 'text-emerald-400' : 'text-[#94A3B8]'}`}
                >
                  {p.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {activeTab === 'history' && (
          <div className="flex items-center gap-1 bg-[#1E293B] border border-[#334155] rounded-lg p-1">
            {allEnvs.map((env) => (
              <button
                key={env}
                onClick={() => setSelectedEnv(env)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  selectedEnv === env
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'text-[#64748B] hover:text-[#94A3B8]'
                }`}
              >
                {envLabel(env)}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 mb-6 bg-[#1E293B] border border-[#334155] rounded-lg p-1 w-fit">
        <button
          onClick={() => setActiveTab('configs')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'configs'
              ? 'bg-emerald-500/20 text-emerald-400'
              : 'text-[#64748B] hover:text-[#94A3B8]'
          }`}
        >
          <Settings className="w-4 h-4" /> 审批配置
        </button>
        <button
          onClick={() => setActiveTab('pending')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'pending'
              ? 'bg-emerald-500/20 text-emerald-400'
              : 'text-[#64748B] hover:text-[#94A3B8]'
          }`}
        >
          <Clock className="w-4 h-4" /> 待审批
          {pendingRequests.length > 0 && (
            <span className="px-1.5 py-0.5 text-xs bg-rose-500/20 text-rose-400 rounded-full">
              {pendingRequests.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'history'
              ? 'bg-emerald-500/20 text-emerald-400'
              : 'text-[#64748B] hover:text-[#94A3B8]'
          }`}
        >
          <History className="w-4 h-4" /> 审批历史
        </button>
      </div>

      {!selectedProjectId ? (
        <div className="text-center py-16 text-[#64748B]">
          <Settings className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>请先选择一个项目</p>
        </div>
      ) : (
        <>
          {activeTab === 'configs' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-medium text-[#94A3B8]">审批配置列表</h3>
                <button
                  onClick={() => setShowConfigModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-emerald-500/15 text-emerald-400 rounded-lg hover:bg-emerald-500/25 transition-colors"
                >
                  <Plus className="w-4 h-4" /> 添加配置
                </button>
              </div>

              {loading && approvalConfigs.length === 0 ? (
                <div className="text-center py-12 text-[#64748B] text-sm bg-[#1E293B] border border-[#334155] rounded-xl">
                  加载中...
                </div>
              ) : approvalConfigs.length === 0 ? (
                <div className="text-center py-12 text-[#64748B] text-sm bg-[#1E293B] border border-[#334155] rounded-xl">
                  <Settings className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>暂无审批配置</p>
                </div>
              ) : (
                <div className="bg-[#1E293B] border border-[#334155] rounded-xl overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-[#334155]">
                        <th className="text-left text-xs font-medium text-[#64748B] px-4 py-3">配置键模式</th>
                        <th className="text-left text-xs font-medium text-[#64748B] px-4 py-3">环境</th>
                        <th className="text-left text-xs font-medium text-[#64748B] px-4 py-3">审批人</th>
                        <th className="text-left text-xs font-medium text-[#64748B] px-4 py-3">审批规则</th>
                        <th className="text-right text-xs font-medium text-[#64748B] px-4 py-3">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {approvalConfigs.map((config) => (
                        <tr key={config.id} className="border-b border-[#334155]/50 hover:bg-[#0F172A]/50 transition-colors">
                          <td className="px-4 py-3">
                            <span className="font-mono text-sm text-emerald-400">{config.configKeyPattern}</span>
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant="default">{envLabel(config.environment)}</Badge>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              <Users className="w-3.5 h-3.5 text-[#64748B]" />
                              <span className="text-sm text-[#94A3B8]">
                                {config.approvers.map((a) => a.name).join(', ')}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-sm text-[#94A3B8]">
                              {config.requireAllApprovers ? '需全部审批人通过' : '任一审批人通过即可'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => handleDeleteConfig(config.id)}
                                className="p-1.5 text-[#64748B] hover:text-rose-400 rounded transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'pending' && (
            <div>
              <h3 className="text-sm font-medium text-[#94A3B8] mb-4">待我审批的请求</h3>

              {loading && pendingRequests.length === 0 ? (
                <div className="text-center py-12 text-[#64748B] text-sm bg-[#1E293B] border border-[#334155] rounded-xl">
                  加载中...
                </div>
              ) : pendingRequests.length === 0 ? (
                <div className="text-center py-12 text-[#64748B] text-sm bg-[#1E293B] border border-[#334155] rounded-xl">
                  <CheckCircle className="w-8 h-8 mx-auto mb-2 opacity-50 text-emerald-400" />
                  <p>暂无待审批请求</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingRequests.map((request) => (
                    <div
                      key={request.id}
                      className="bg-[#1E293B] border border-[#334155] rounded-xl p-4 hover:border-emerald-500/30 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="warning">{getOperationLabel(request.operation)}</Badge>
                            <span className="font-mono text-sm text-emerald-400">{request.configKey}</span>
                            <Badge variant="default">{envLabel(request.environment)}</Badge>
                          </div>
                          {request.newValue && (
                            <p className="text-sm text-[#94A3B8] mb-2">
                              新值: <span className="font-mono">{request.newValue.value}</span>
                            </p>
                          )}
                          <p className="text-xs text-[#64748B]">
                            提交人: {request.submittedBy} · {new Date(request.submittedAt).toLocaleString()}
                          </p>
                        </div>
                        <button
                          onClick={() => openRequestDetail(request)}
                          className="flex items-center gap-1 px-3 py-1.5 text-sm bg-emerald-500/15 text-emerald-400 rounded-lg hover:bg-emerald-500/25 transition-colors"
                        >
                          <Eye className="w-4 h-4" /> 查看
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'history' && (
            <div>
              <h3 className="text-sm font-medium text-[#94A3B8] mb-4">审批历史记录</h3>

              {loading && history.length === 0 ? (
                <div className="text-center py-12 text-[#64748B] text-sm bg-[#1E293B] border border-[#334155] rounded-xl">
                  加载中...
                </div>
              ) : history.length === 0 ? (
                <div className="text-center py-12 text-[#64748B] text-sm bg-[#1E293B] border border-[#334155] rounded-xl">
                  <History className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>暂无审批历史</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {history.map((record) => (
                    <div
                      key={record.id}
                      className="bg-[#1E293B] border border-[#334155] rounded-xl p-4"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            {getStatusBadge(record.status)}
                            <Badge variant="default">{getOperationLabel(record.operation)}</Badge>
                            <span className="font-mono text-sm text-emerald-400">{record.configKey}</span>
                            <Badge variant="default">{envLabel(record.environment)}</Badge>
                          </div>
                          {record.emergencyReason && (
                            <div className="flex items-center gap-1 mb-2 text-amber-400">
                              <AlertTriangle className="w-4 h-4" />
                              <span className="text-sm">紧急修改: {record.emergencyReason}</span>
                            </div>
                          )}
                          {record.rejectReason && (
                            <p className="text-sm text-rose-400 mb-2">拒绝理由: {record.rejectReason}</p>
                          )}
                          <p className="text-xs text-[#64748B]">
                            提交人: {record.submittedBy} · {new Date(record.submittedAt).toLocaleString()}
                          </p>
                          {record.approvals.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-[#334155]/50">
                              {record.approvals.map((approval, idx) => (
                                <div key={idx} className="text-xs text-[#64748B]">
                                  {approval.approverName} {approval.action === 'approved' ? '批准' : '拒绝'} ·{' '}
                                  {new Date(approval.timestamp).toLocaleString()}
                                  {approval.comment && ` · ${approval.comment}`}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => openRequestDetail(record)}
                          className="p-1.5 text-[#64748B] hover:text-emerald-400 rounded transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      <Modal open={showConfigModal} onClose={() => setShowConfigModal(false)} title="添加审批配置">
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-[#64748B] mb-1">环境</label>
            <select
              value={configEnv}
              onChange={(e) => setConfigEnv(e.target.value)}
              className="w-full px-3 py-2 bg-[#0F172A] border border-[#334155] rounded-lg text-sm text-[#F1F5F9] focus:outline-none focus:border-emerald-500/50"
            >
              {allEnvs.map((env) => (
                <option key={env} value={env}>
                  {envLabel(env)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-[#64748B] mb-1">配置键模式</label>
            <input
              value={configPattern}
              onChange={(e) => setConfigPattern(e.target.value)}
              className="w-full px-3 py-2 bg-[#0F172A] border border-[#334155] rounded-lg text-sm text-[#F1F5F9] font-mono focus:outline-none focus:border-emerald-500/50"
              placeholder="例如: DB_* 或 *PASSWORD* 或具体键名"
            />
            <p className="text-xs text-[#64748B] mt-1">支持通配符 *，例如 DB_* 匹配所有以 DB_ 开头的键</p>
          </div>
          <div>
            <label className="block text-xs text-[#64748B] mb-2">选择审批人</label>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {users
                .filter((u) => u.role === 'approver' || u.role === 'admin')
                .map((user) => (
                  <label key={user.id} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedApprovers.includes(user.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedApprovers([...selectedApprovers, user.id]);
                        } else {
                          setSelectedApprovers(selectedApprovers.filter((id) => id !== user.id));
                        }
                      }}
                      className="rounded border-[#334155] bg-[#0F172A] text-emerald-500 focus:ring-emerald-500/50"
                    />
                    <span className="text-sm text-[#94A3B8]">
                      {user.name} ({user.role})
                    </span>
                  </label>
                ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={requireAllApprovers}
              onChange={(e) => setRequireAllApprovers(e.target.checked)}
              className="rounded border-[#334155] bg-[#0F172A] text-emerald-500 focus:ring-emerald-500/50"
            />
            <label className="text-sm text-[#94A3B8]">需要所有审批人通过</label>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setShowConfigModal(false)}
              className="px-4 py-2 text-sm text-[#64748B] hover:text-[#F1F5F9] transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleCreateConfig}
              className="px-4 py-2 text-sm bg-emerald-500/15 text-emerald-400 rounded-lg hover:bg-emerald-500/25 transition-colors"
            >
              创建
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        open={showRequestModal}
        onClose={() => {
          setShowRequestModal(false);
          setSelectedRequest(null);
        }}
        title="审批详情"
      >
        {selectedRequest && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              {getStatusBadge(selectedRequest.status)}
              <Badge variant="default">{getOperationLabel(selectedRequest.operation)}</Badge>
              <Badge variant="default">{envLabel(selectedRequest.environment)}</Badge>
            </div>

            <div>
              <label className="block text-xs text-[#64748B] mb-1">配置键</label>
              <p className="font-mono text-sm text-emerald-400">{selectedRequest.configKey}</p>
            </div>

            {selectedRequest.oldValue && (
              <div>
                <label className="block text-xs text-[#64748B] mb-1">原值</label>
                <p className="font-mono text-sm text-[#94A3B8] bg-[#0F172A] p-2 rounded">
                  {selectedRequest.oldValue.value}
                </p>
              </div>
            )}

            {selectedRequest.newValue && (
              <div>
                <label className="block text-xs text-[#64748B] mb-1">新值</label>
                <p className="font-mono text-sm text-emerald-400 bg-[#0F172A] p-2 rounded">
                  {selectedRequest.newValue.value}
                </p>
              </div>
            )}

            {selectedRequest.newValue?.description && (
              <div>
                <label className="block text-xs text-[#64748B] mb-1">描述</label>
                <p className="text-sm text-[#94A3B8]">{selectedRequest.newValue.description}</p>
              </div>
            )}

            <div>
              <label className="block text-xs text-[#64748B] mb-1">提交信息</label>
              <p className="text-sm text-[#94A3B8]">
                提交人: {selectedRequest.submittedBy} · {new Date(selectedRequest.submittedAt).toLocaleString()}
              </p>
            </div>

            {selectedRequest.rejectReason && (
              <div className="bg-rose-500/10 border border-rose-500/30 rounded-lg p-3">
                <label className="block text-xs text-rose-400 mb-1">拒绝理由</label>
                <p className="text-sm text-rose-300">{selectedRequest.rejectReason}</p>
              </div>
            )}

            {selectedRequest.emergencyReason && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
                <label className="block text-xs text-amber-400 mb-1">紧急修改原因</label>
                <p className="text-sm text-amber-300">{selectedRequest.emergencyReason}</p>
                <p className="text-xs text-amber-400/70 mt-1">责任人: {selectedRequest.emergencyUser}</p>
              </div>
            )}

            {selectedRequest.approvals.length > 0 && (
              <div>
                <label className="block text-xs text-[#64748B] mb-2">审批记录</label>
                <div className="space-y-2">
                  {selectedRequest.approvals.map((approval, idx) => (
                    <div
                      key={idx}
                      className="bg-[#0F172A] border border-[#334155] rounded-lg p-3"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        {approval.action === 'approved' ? (
                          <CheckCircle className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <XCircle className="w-4 h-4 text-rose-400" />
                        )}
                        <span className="text-sm text-[#94A3B8]">
                          {approval.approverName} {approval.action === 'approved' ? '批准' : '拒绝'}
                        </span>
                        <span className="text-xs text-[#64748B]">
                          {new Date(approval.timestamp).toLocaleString()}
                        </span>
                      </div>
                      {approval.comment && (
                        <p className="text-xs text-[#64748B]">备注: {approval.comment}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedRequest.status === 'pending' && currentUser && (
              <div className="pt-4 border-t border-[#334155]">
                <div>
                  <label className="block text-xs text-[#64748B] mb-1">审批意见（可选）</label>
                  <textarea
                    value={approveComment}
                    onChange={(e) => setApproveComment(e.target.value)}
                    className="w-full px-3 py-2 bg-[#0F172A] border border-[#334155] rounded-lg text-sm text-[#F1F5F9] focus:outline-none focus:border-emerald-500/50 resize-none"
                    rows={2}
                    placeholder="输入审批意见..."
                  />
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <button
                    onClick={() => setShowRejectModal(true)}
                    className="px-4 py-2 text-sm bg-rose-500/15 text-rose-400 rounded-lg hover:bg-rose-500/25 transition-colors"
                  >
                    <XCircle className="w-4 h-4 inline mr-1" /> 拒绝
                  </button>
                  <button
                    onClick={handleApprove}
                    className="px-4 py-2 text-sm bg-emerald-500/15 text-emerald-400 rounded-lg hover:bg-emerald-500/25 transition-colors"
                  >
                    <CheckCircle className="w-4 h-4 inline mr-1" /> 通过
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal open={showRejectModal} onClose={() => setShowRejectModal(false)} title="拒绝审批">
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-[#64748B] mb-1">拒绝理由 *</label>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="w-full px-3 py-2 bg-[#0F172A] border border-[#334155] rounded-lg text-sm text-[#F1F5F9] focus:outline-none focus:border-rose-500/50 resize-none"
              rows={3}
              placeholder="请输入拒绝理由..."
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setShowRejectModal(false)}
              className="px-4 py-2 text-sm text-[#64748B] hover:text-[#F1F5F9] transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleReject}
              disabled={!rejectReason.trim()}
              className="px-4 py-2 text-sm bg-rose-500/15 text-rose-400 rounded-lg hover:bg-rose-500/25 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              确认拒绝
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
