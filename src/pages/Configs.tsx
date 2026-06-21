import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Lock, Download, Upload, FolderPlus, ChevronDown, AlertTriangle, CheckSquare } from 'lucide-react';
import { useAppStore } from '@/stores/appStore';
import { useProjects, useConfigs, useApprovals } from '@/hooks';
import PageHeader from '@/components/PageHeader';
import Badge from '@/components/Badge';
import Modal from '@/components/Modal';
import { maskValue, envLabel } from '@/utils/format';
import type { ConfigItem, ApprovalConfig, User } from '../../shared/types';

const DEFAULT_ENVS = ['development', 'testing', 'production'];

function EditApprovalCheck({
  configKey,
  checkApprovalRequirement,
}: {
  configKey: string;
  checkApprovalRequirement: (key: string) => Promise<{
    requiresApproval: boolean;
    approvalConfig: ApprovalConfig | null;
  }>;
}) {
  const [approvalCheck, setApprovalCheck] = useState<{
    requiresApproval: boolean;
    approvalConfig: ApprovalConfig | null;
  } | null>(null);

  useEffect(() => {
    checkApprovalRequirement(configKey).then(setApprovalCheck);
  }, [configKey, checkApprovalRequirement]);

  if (!approvalCheck?.requiresApproval) return null;

  return (
    <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
      <div className="flex items-center gap-2 text-amber-400">
        <AlertTriangle className="w-4 h-4" />
        <span className="text-sm font-medium">此配置项需要审批</span>
      </div>
      <p className="text-xs text-amber-300/70 mt-1">
        审批人: {approvalCheck.approvalConfig?.approvers.map((a) => a.name).join(', ')}
      </p>
    </div>
  );
}

function ConfigRow({
  config,
  onEdit,
  onDelete,
  checkApprovalRequirement,
}: {
  config: ConfigItem;
  onEdit: (config: ConfigItem) => void;
  onDelete: (key: string) => void;
  checkApprovalRequirement: (key: string) => Promise<{
    requiresApproval: boolean;
    approvalConfig: ApprovalConfig | null;
  }>;
}) {
  const [requiresApproval, setRequiresApproval] = useState(false);

  useEffect(() => {
    checkApprovalRequirement(config.key).then((result) => {
      setRequiresApproval(result.requiresApproval);
    });
  }, [config.key, checkApprovalRequirement]);

  return (
    <tr className="border-b border-[#334155]/50 hover:bg-[#0F172A]/50 transition-colors">
      <td className="px-4 py-3">
        <span className="font-mono text-sm text-emerald-400">{config.key}</span>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm text-[#94A3B8]">
            {config.encrypted ? maskValue(config.value) : (config.value.length > 40 ? config.value.slice(0, 40) + '...' : config.value)}
          </span>
          {config.encrypted && <Lock className="w-3.5 h-3.5 text-amber-400" />}
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-[#64748B]">{config.description || '-'}</td>
      <td className="px-4 py-3">
        {config.encrypted ? (
          <Badge variant="warning">已加密</Badge>
        ) : (
          <Badge variant="success">明文</Badge>
        )}
      </td>
      <td className="px-4 py-3">
        {requiresApproval ? (
          <Badge variant="warning">需审批</Badge>
        ) : (
          <Badge variant="default">无需审批</Badge>
        )}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-1">
          <button onClick={() => onEdit(config)} className="p-1.5 text-[#64748B] hover:text-emerald-400 rounded transition-colors">
            <Pencil className="w-4 h-4" />
          </button>
          <button onClick={() => onDelete(config.key)} className="p-1.5 text-[#64748B] hover:text-rose-400 rounded transition-colors">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}

export default function Configs() {
  const { selectedProjectId, setSelectedProjectId, selectedEnv, setSelectedEnv } = useAppStore();
  const { projects, createProject } = useProjects();
  const { configs, addConfig, updateConfig, deleteConfig, loading, checkApprovalRequirement } = useConfigs({
    projectId: selectedProjectId,
    envName: selectedEnv,
  });
  const { getUsers, checkApprovalRequirement: checkApproval } = useApprovals();

  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [showEnvModal, setShowEnvModal] = useState(false);
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);
  const [editingConfig, setEditingConfig] = useState<ConfigItem | null>(null);
  const [pendingAction, setPendingAction] = useState<{
    type: 'add' | 'edit' | 'delete';
    key: string;
    data?: any;
  } | null>(null);
  const [emergencyReason, setEmergencyReason] = useState('');
  const [formKey, setFormKey] = useState('');
  const [formValue, setFormValue] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formEncrypted, setFormEncrypted] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [projectDesc, setProjectDesc] = useState('');
  const [envName, setEnvName] = useState('');
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);
  const [approvalConfigs, setApprovalConfigs] = useState<ApprovalConfig[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [currentApprovalCheck, setCurrentApprovalCheck] = useState<{
    requiresApproval: boolean;
    approvalConfig: ApprovalConfig | null;
  } | null>(null);

  const currentProject = projects.find((p) => p.id === selectedProjectId);
  const currentUser = users.find((u) => u.role === 'admin' || u.role === 'emergency') || users[0];

  useEffect(() => {
    if (projects.length > 0 && !selectedProjectId) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId, setSelectedProjectId]);

  useEffect(() => {
    getUsers().then(setUsers);
  }, [getUsers]);

  useEffect(() => {
    if (formKey && selectedProjectId && selectedEnv) {
      checkApprovalRequirement(formKey).then(setCurrentApprovalCheck);
    } else {
      setCurrentApprovalCheck(null);
    }
  }, [formKey, selectedProjectId, selectedEnv, checkApprovalRequirement]);

  const resetForm = () => {
    setFormKey('');
    setFormValue('');
    setFormDesc('');
    setFormEncrypted(false);
  };

  const handleAddConfig = async () => {
    if (!selectedProjectId || !formKey) return;

    const approvalCheck = await checkApprovalRequirement(formKey);

    if (approvalCheck.requiresApproval) {
      setPendingAction({
        type: 'add',
        key: formKey,
        data: {
          key: formKey,
          value: formValue,
          description: formDesc,
          encrypted: formEncrypted,
        },
      });
      setShowAddModal(false);
      setShowEmergencyModal(true);
      return;
    }

    const result = await addConfig(formKey, formValue, formDesc, formEncrypted);
    if (result.success) {
      setShowAddModal(false);
      resetForm();
    }
  };

  const executeWithEmergency = async (useEmergency: boolean) => {
    if (!pendingAction || !selectedProjectId) return;

    if (useEmergency && !emergencyReason.trim()) {
      alert('请输入紧急修改原因');
      return;
    }

    let result;
    if (pendingAction.type === 'add') {
      result = await addConfig(
        pendingAction.data.key,
        pendingAction.data.value,
        pendingAction.data.description,
        pendingAction.data.encrypted,
        useEmergency,
        emergencyReason,
        currentUser?.name || 'admin'
      );
    } else if (pendingAction.type === 'edit' && editingConfig) {
      result = await updateConfig(
        editingConfig.key,
        pendingAction.data,
        useEmergency,
        emergencyReason,
        currentUser?.name || 'admin'
      );
    } else if (pendingAction.type === 'delete') {
      result = await deleteConfig(
        pendingAction.key,
        useEmergency,
        emergencyReason,
        currentUser?.name || 'admin'
      );
    }

    if (result?.success) {
      if (result.requiresApproval && !useEmergency) {
        alert('配置变更已提交审批，请等待审批人审核');
      } else if (result.emergency) {
        alert('紧急修改已生效，已记录紧急修改原因和责任人');
      }
      setShowEmergencyModal(false);
      setPendingAction(null);
      setEmergencyReason('');
      resetForm();
      setEditingConfig(null);
    } else {
      alert(result?.message || '操作失败');
    }
  };

  const handleEditConfig = async () => {
    if (!selectedProjectId || !editingConfig) return;
    const body: Partial<ConfigItem> = {};
    if (formValue !== undefined && formValue !== '') body.value = formValue;
    if (formDesc !== undefined) body.description = formDesc;
    body.encrypted = formEncrypted;

    const approvalCheck = await checkApprovalRequirement(editingConfig.key);

    if (approvalCheck.requiresApproval) {
      setPendingAction({
        type: 'edit',
        key: editingConfig.key,
        data: body,
      });
      setShowEditModal(false);
      setShowEmergencyModal(true);
      return;
    }

    const result = await updateConfig(editingConfig.key, body);
    if (result.success) {
      setShowEditModal(false);
      setEditingConfig(null);
      resetForm();
    }
  };

  const handleDeleteConfig = async (key: string) => {
    if (!confirm(`确定删除配置项 "${key}" 吗？`)) return;

    const approvalCheck = await checkApprovalRequirement(key);

    if (approvalCheck.requiresApproval) {
      setPendingAction({
        type: 'delete',
        key,
      });
      setShowEmergencyModal(true);
      return;
    }

    const result = await deleteConfig(key);
    if (result?.success) {
      // 已删除
    }
  };

  const handleCreateProject = async () => {
    if (!projectName) return;
    const project = await createProject(projectName, projectDesc);
    if (project) {
      setShowProjectModal(false);
      setProjectName('');
      setProjectDesc('');
      setSelectedProjectId(project.id);
    }
  };

  const handleAddEnv = async () => {
    if (!selectedProjectId || !envName) return;
    const result = await addConfig('_init', '', 'Environment initializer', false);
    if (result) {
      setShowEnvModal(false);
      setEnvName('');
      setSelectedEnv(envName);
    }
  };

  const handleExport = () => {
    const data = JSON.stringify(configs, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentProject?.name || 'config'}_${selectedEnv}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file || !selectedProjectId) return;
      const text = await file.text();
      try {
        const items = JSON.parse(text);
        if (Array.isArray(items)) {
          for (const item of items) {
            await addConfig(item.key, item.value || '', item.description || '', false);
          }
        }
      } catch {
        alert('导入失败：无效的JSON文件');
      }
    };
    input.click();
  };

  const openEditModal = (config: ConfigItem) => {
    setEditingConfig(config);
    setFormValue(config.encrypted ? '' : config.value);
    setFormDesc(config.description);
    setFormEncrypted(config.encrypted);
    setShowEditModal(true);
  };

  const projectEnvs = currentProject?.environments.map((e) => e.name) || [];
  const allEnvs = [...new Set([...DEFAULT_ENVS, ...projectEnvs])];

  return (
    <div className="animate-slide-in">
      <PageHeader title="配置管理" subtitle="按项目和环境管理配置项" actions={
        <div className="flex items-center gap-2">
          <button onClick={handleExport} className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-[#94A3B8] border border-[#334155] rounded-lg hover:bg-[#334155] transition-colors">
            <Download className="w-4 h-4" /> 导出
          </button>
          <button onClick={handleImport} className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-[#94A3B8] border border-[#334155] rounded-lg hover:bg-[#334155] transition-colors">
            <Upload className="w-4 h-4" /> 导入
          </button>
          <button onClick={() => setShowProjectModal(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-[#94A3B8] border border-[#334155] rounded-lg hover:bg-[#334155] transition-colors">
            <FolderPlus className="w-4 h-4" /> 新建项目
          </button>
          <button onClick={() => setShowAddModal(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-emerald-500/15 text-emerald-400 rounded-lg hover:bg-emerald-500/25 transition-colors">
            <Plus className="w-4 h-4" /> 添加配置
          </button>
        </div>
      } />

      <div className="flex items-center gap-4 mb-6">
        <div className="relative">
          <button onClick={() => setShowProjectDropdown(!showProjectDropdown)} className="flex items-center gap-2 px-4 py-2 bg-[#1E293B] border border-[#334155] rounded-lg text-sm text-[#F1F5F9] hover:border-emerald-500/30 transition-colors min-w-[200px] justify-between">
            <span>{currentProject?.name || '选择项目'}</span>
            <ChevronDown className="w-4 h-4 text-[#64748B]" />
          </button>
          {showProjectDropdown && (
            <div className="absolute top-full left-0 mt-1 w-full bg-[#1E293B] border border-[#334155] rounded-lg shadow-xl z-20 overflow-hidden">
              {projects.map((p) => (
                <button key={p.id} onClick={() => { setSelectedProjectId(p.id); setShowProjectDropdown(false); }} className={`w-full text-left px-4 py-2 text-sm hover:bg-[#334155] transition-colors ${p.id === selectedProjectId ? 'text-emerald-400' : 'text-[#94A3B8]'}`}>
                  {p.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 bg-[#1E293B] border border-[#334155] rounded-lg p-1">
          {allEnvs.map((env) => (
            <button key={env} onClick={() => setSelectedEnv(env)} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              selectedEnv === env
                ? 'bg-emerald-500/20 text-emerald-400'
                : 'text-[#64748B] hover:text-[#94A3B8]'
            }`}>
              {envLabel(env)}
            </button>
          ))}
          <button onClick={() => setShowEnvModal(true)} className="px-2 py-1.5 text-xs text-[#64748B] hover:text-emerald-400 transition-colors">
            <Plus className="w-3 h-3" />
          </button>
        </div>
      </div>

      {!selectedProjectId ? (
        <div className="text-center py-16 text-[#64748B]">
          <FolderPlus className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>请先创建或选择一个项目</p>
        </div>
      ) : (
        <div className="bg-[#1E293B] border border-[#334155] rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#334155]">
                <th className="text-left text-xs font-medium text-[#64748B] px-4 py-3">键名</th>
                <th className="text-left text-xs font-medium text-[#64748B] px-4 py-3">值</th>
                <th className="text-left text-xs font-medium text-[#64748B] px-4 py-3">描述</th>
                <th className="text-left text-xs font-medium text-[#64748B] px-4 py-3">加密</th>
                <th className="text-left text-xs font-medium text-[#64748B] px-4 py-3">审批</th>
                <th className="text-right text-xs font-medium text-[#64748B] px-4 py-3">操作</th>
              </tr>
            </thead>
            <tbody>
              {loading && configs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-[#64748B] text-sm">加载中...</td>
                </tr>
              ) : configs.length === 0 || (configs.length === 1 && configs[0].key === '_init') ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-[#64748B] text-sm">此环境下暂无配置项</td>
                </tr>
              ) : (
                configs
                  .filter((c) => c.key !== '_init')
                  .map((config) => (
                  <ConfigRow
                    key={config.key}
                    config={config}
                    onEdit={openEditModal}
                    onDelete={handleDeleteConfig}
                    checkApprovalRequirement={checkApprovalRequirement}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={showAddModal} onClose={() => { setShowAddModal(false); resetForm(); }} title="添加配置项">
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-[#64748B] mb-1">键名</label>
            <input value={formKey} onChange={(e) => setFormKey(e.target.value)} className="w-full px-3 py-2 bg-[#0F172A] border border-[#334155] rounded-lg text-sm text-[#F1F5F9] font-mono focus:outline-none focus:border-emerald-500/50" placeholder="例如: DB_HOST" />
          </div>
          {currentApprovalCheck?.requiresApproval && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
              <div className="flex items-center gap-2 text-amber-400">
                <AlertTriangle className="w-4 h-4" />
                <span className="text-sm font-medium">此配置项需要审批</span>
              </div>
              <p className="text-xs text-amber-300/70 mt-1">
                审批人: {currentApprovalCheck.approvalConfig?.approvers.map((a) => a.name).join(', ')}
              </p>
            </div>
          )}
          <div>
            <label className="block text-xs text-[#64748B] mb-1">值</label>
            <input value={formValue} onChange={(e) => setFormValue(e.target.value)} className="w-full px-3 py-2 bg-[#0F172A] border border-[#334155] rounded-lg text-sm text-[#F1F5F9] font-mono focus:outline-none focus:border-emerald-500/50" placeholder="配置值" />
          </div>
          <div>
            <label className="block text-xs text-[#64748B] mb-1">描述</label>
            <input value={formDesc} onChange={(e) => setFormDesc(e.target.value)} className="w-full px-3 py-2 bg-[#0F172A] border border-[#334155] rounded-lg text-sm text-[#F1F5F9] focus:outline-none focus:border-emerald-500/50" placeholder="配置项描述" />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" checked={formEncrypted} onChange={(e) => setFormEncrypted(e.target.checked)} className="rounded border-[#334155] bg-[#0F172A] text-emerald-500 focus:ring-emerald-500/50" />
            <label className="text-sm text-[#94A3B8]">加密存储此值</label>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => { setShowAddModal(false); resetForm(); }} className="px-4 py-2 text-sm text-[#64748B] hover:text-[#F1F5F9] transition-colors">取消</button>
            <button onClick={handleAddConfig} className="px-4 py-2 text-sm bg-emerald-500/15 text-emerald-400 rounded-lg hover:bg-emerald-500/25 transition-colors">
              {currentApprovalCheck?.requiresApproval ? '提交审批' : '添加'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={showEditModal} onClose={() => { setShowEditModal(false); setEditingConfig(null); resetForm(); }} title={`编辑: ${editingConfig?.key}`}>
        <div className="space-y-4">
          {editingConfig && (
            <EditApprovalCheck
              configKey={editingConfig.key}
              checkApprovalRequirement={checkApprovalRequirement}
            />
          )}
          <div>
            <label className="block text-xs text-[#64748B] mb-1">值 {editingConfig?.encrypted && '(留空保持原值)'}</label>
            <input value={formValue} onChange={(e) => setFormValue(e.target.value)} className="w-full px-3 py-2 bg-[#0F172A] border border-[#334155] rounded-lg text-sm text-[#F1F5F9] font-mono focus:outline-none focus:border-emerald-500/50" placeholder="配置值" />
          </div>
          <div>
            <label className="block text-xs text-[#64748B] mb-1">描述</label>
            <input value={formDesc} onChange={(e) => setFormDesc(e.target.value)} className="w-full px-3 py-2 bg-[#0F172A] border border-[#334155] rounded-lg text-sm text-[#F1F5F9] focus:outline-none focus:border-emerald-500/50" placeholder="配置项描述" />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" checked={formEncrypted} onChange={(e) => setFormEncrypted(e.target.checked)} className="rounded border-[#334155] bg-[#0F172A] text-emerald-500 focus:ring-emerald-500/50" />
            <label className="text-sm text-[#94A3B8]">加密存储此值</label>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => { setShowEditModal(false); setEditingConfig(null); resetForm(); }} className="px-4 py-2 text-sm text-[#64748B] hover:text-[#F1F5F9] transition-colors">取消</button>
            <button onClick={handleEditConfig} className="px-4 py-2 text-sm bg-emerald-500/15 text-emerald-400 rounded-lg hover:bg-emerald-500/25 transition-colors">
              保存
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={showEmergencyModal} onClose={() => { setShowEmergencyModal(false); setPendingAction(null); setEmergencyReason(''); }} title="配置变更审批">
        <div className="space-y-4">
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
            <div className="flex items-center gap-2 text-amber-400 mb-2">
              <AlertTriangle className="w-5 h-5" />
              <span className="font-medium">此配置变更需要审批</span>
            </div>
            <p className="text-sm text-amber-300/80">
              您正在修改的配置项需要经过审批才能生效。您可以选择提交审批等待审核，或者使用紧急通道直接生效（需要紧急修改权限）。
            </p>
          </div>

          <div>
            <label className="block text-xs text-[#64748B] mb-1">操作类型</label>
            <p className="text-sm text-[#94A3B8]">
              {pendingAction?.type === 'add' ? '新增配置' : pendingAction?.type === 'edit' ? '更新配置' : '删除配置'}: {pendingAction?.key}
            </p>
          </div>

          <div>
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={emergencyReason.length > 0}
                onChange={(e) => {
                  if (!e.target.checked) setEmergencyReason('');
                }}
                className="mt-1 rounded border-[#334155] bg-[#0F172A] text-amber-500 focus:ring-amber-500/50"
              />
              <span className="text-sm text-[#94A3B8]">
                使用紧急通道（绕过审批直接生效）
              </span>
            </label>
          </div>

          {emergencyReason !== undefined && (
            <div>
              <label className="block text-xs text-[#64748B] mb-1">紧急修改原因 *</label>
              <textarea
                value={emergencyReason}
                onChange={(e) => setEmergencyReason(e.target.value)}
                className="w-full px-3 py-2 bg-[#0F172A] border border-[#334155] rounded-lg text-sm text-[#F1F5F9] focus:outline-none focus:border-amber-500/50 resize-none"
                rows={3}
                placeholder="请详细说明紧急修改的原因..."
              />
              <p className="text-xs text-[#64748B] mt-1">
                紧急修改将记录原因和责任人（{currentUser?.name || 'admin'}）
              </p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => { setShowEmergencyModal(false); setPendingAction(null); setEmergencyReason(''); }}
              className="px-4 py-2 text-sm text-[#64748B] hover:text-[#F1F5F9] transition-colors"
            >
              取消
            </button>
            <button
              onClick={() => executeWithEmergency(false)}
              className="px-4 py-2 text-sm bg-emerald-500/15 text-emerald-400 rounded-lg hover:bg-emerald-500/25 transition-colors"
            >
              <CheckSquare className="w-4 h-4 inline mr-1" /> 提交审批
            </button>
            {currentUser && (currentUser.role === 'admin' || currentUser.role === 'emergency') && (
              <button
                onClick={() => executeWithEmergency(true)}
                disabled={!emergencyReason.trim()}
                className="px-4 py-2 text-sm bg-amber-500/15 text-amber-400 rounded-lg hover:bg-amber-500/25 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <AlertTriangle className="w-4 h-4 inline mr-1" /> 紧急生效
              </button>
            )}
          </div>
        </div>
      </Modal>

      <Modal open={showProjectModal} onClose={() => setShowProjectModal(false)} title="新建项目">
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-[#64748B] mb-1">项目名称</label>
            <input value={projectName} onChange={(e) => setProjectName(e.target.value)} className="w-full px-3 py-2 bg-[#0F172A] border border-[#334155] rounded-lg text-sm text-[#F1F5F9] focus:outline-none focus:border-emerald-500/50" placeholder="例如: 用户服务" />
          </div>
          <div>
            <label className="block text-xs text-[#64748B] mb-1">描述</label>
            <input value={projectDesc} onChange={(e) => setProjectDesc(e.target.value)} className="w-full px-3 py-2 bg-[#0F172A] border border-[#334155] rounded-lg text-sm text-[#F1F5F9] focus:outline-none focus:border-emerald-500/50" placeholder="项目描述" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setShowProjectModal(false)} className="px-4 py-2 text-sm text-[#64748B] hover:text-[#F1F5F9] transition-colors">取消</button>
            <button onClick={handleCreateProject} className="px-4 py-2 text-sm bg-emerald-500/15 text-emerald-400 rounded-lg hover:bg-emerald-500/25 transition-colors">创建</button>
          </div>
        </div>
      </Modal>

      <Modal open={showEnvModal} onClose={() => setShowEnvModal(false)} title="添加环境">
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-[#64748B] mb-1">环境名称</label>
            <input value={envName} onChange={(e) => setEnvName(e.target.value)} className="w-full px-3 py-2 bg-[#0F172A] border border-[#334155] rounded-lg text-sm text-[#F1F5F9] focus:outline-none focus:border-emerald-500/50" placeholder="例如: staging" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setShowEnvModal(false)} className="px-4 py-2 text-sm text-[#64748B] hover:text-[#F1F5F9] transition-colors">取消</button>
            <button onClick={handleAddEnv} className="px-4 py-2 text-sm bg-emerald-500/15 text-emerald-400 rounded-lg hover:bg-emerald-500/25 transition-colors">添加</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
