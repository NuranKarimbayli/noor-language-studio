import {
  BarChart3,
  BookOpen,
  Brain,
  Languages,
  NotebookPen,
  PanelLeftClose,
  PanelLeftOpen,
  X,
  type LucideIcon,
} from 'lucide-react';
import { WorkspaceView } from '../types';

interface SidebarProps {
  view: WorkspaceView;
  onViewChange: (view: WorkspaceView) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  languageName: string;
  onOpenLanguages: () => void;
  dueCount: number;
  /** Mobile overlay drawer mode */
  mobile?: boolean;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

const NAV_ITEMS: Array<{
  id: WorkspaceView;
  label: string;
  icon: LucideIcon;
}> = [
  { id: 'words', label: 'Words', icon: BookOpen },
  { id: 'quiz', label: 'Quiz', icon: Brain },
  { id: 'stats', label: 'Statistics', icon: BarChart3 },
  { id: 'notes', label: 'Notes', icon: NotebookPen },
];

export function Sidebar({
  view,
  onViewChange,
  collapsed,
  onToggleCollapse,
  languageName,
  onOpenLanguages,
  dueCount,
  mobile = false,
  mobileOpen = false,
  onCloseMobile,
}: SidebarProps) {
  const navigate = (v: WorkspaceView) => {
    onViewChange(v);
    onCloseMobile?.();
  };

  const content = (
    <div className="flex flex-col h-full">
      {/* Brand + language context */}
      <div className={`px-3 pt-4 pb-3 border-b border-slate-200 dark:border-[#2E2A25] ${collapsed && !mobile ? 'px-2' : ''}`}>
        <div className={`flex items-center gap-2.5 ${collapsed && !mobile ? 'justify-center' : ''}`}>
          <img
            src="/icon.png"
            alt=""
            className="w-8 h-8 rounded-lg object-cover shrink-0"
          />
          {(!collapsed || mobile) && (
            <div className="min-w-0">
              <div className="font-display text-sm font-semibold text-[#1C1917] dark:text-[#F5F2EC] truncate leading-tight">
                Noor Studio
              </div>
              <button
                type="button"
                onClick={() => {
                  onOpenLanguages();
                  onCloseMobile?.();
                }}
                title="Switch language"
                className="text-[11px] text-[#78716C] dark:text-[#A8A29E] hover:text-[#B45309] dark:hover:text-[#F59E0B] truncate block max-w-full transition-colors"
              >
                {languageName} · Languages
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-2 py-3 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
          const active = view === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => navigate(id)}
              title={collapsed && !mobile ? label : undefined}
              aria-label={label}
              aria-current={active ? 'page' : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                collapsed && !mobile ? 'justify-center px-0' : ''
              } ${
                active
                  ? 'bg-[#B45309]/10 dark:bg-[#D97706]/15 text-[#B45309] dark:text-[#F59E0B]'
                  : 'text-[#57534E] dark:text-[#A8A29E] hover:bg-[#F3EFE8] dark:hover:bg-[#25221E] hover:text-[#1C1917] dark:hover:text-[#F5F2EC]'
              }`}
            >
              <span className="relative shrink-0">
                <Icon className="w-[18px] h-[18px]" />
                {id === 'quiz' && dueCount > 0 && (
                  <span className="absolute -top-1 -right-1.5 min-w-[14px] h-[14px] px-0.5 rounded-full bg-amber-500 text-white text-[9px] font-bold leading-[14px] text-center tabular-nums">
                    {dueCount > 9 ? '9+' : dueCount}
                  </span>
                )}
              </span>
              {(!collapsed || mobile) && <span className="truncate">{label}</span>}
            </button>
          );
        })}
      </nav>

      {/* Footer: languages + collapse (desktop) / close (mobile) */}
      <div className="px-2 py-3 border-t border-slate-200 dark:border-[#2E2A25] space-y-1">
        <button
          type="button"
          onClick={() => {
            onOpenLanguages();
            onCloseMobile?.();
          }}
          title={collapsed && !mobile ? 'Languages' : undefined}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-[#57534E] dark:text-[#A8A29E] hover:bg-[#F3EFE8] dark:hover:bg-[#25221E] hover:text-[#1C1917] dark:hover:text-[#F5F2EC] transition-colors ${
            collapsed && !mobile ? 'justify-center px-0' : ''
          }`}
        >
          <Languages className="w-[18px] h-[18px] shrink-0" />
          {(!collapsed || mobile) && <span>Languages</span>}
        </button>
        {mobile ? (
          <button
            type="button"
            onClick={onCloseMobile}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-[#57534E] dark:text-[#A8A29E] hover:bg-[#F3EFE8] dark:hover:bg-[#25221E] transition-colors"
          >
            <X className="w-[18px] h-[18px] shrink-0" />
            <span>Close</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-[#78716C] dark:text-[#A8A29E] hover:bg-[#F3EFE8] dark:hover:bg-[#25221E] hover:text-[#1C1917] dark:hover:text-[#F5F2EC] transition-colors ${
              collapsed ? 'justify-center px-0' : ''
            }`}
          >
            {collapsed ? (
              <PanelLeftOpen className="w-[18px] h-[18px] shrink-0" />
            ) : (
              <>
                <PanelLeftClose className="w-[18px] h-[18px] shrink-0" />
                <span>Collapse</span>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );

  if (mobile) {
    if (!mobileOpen) return null;
    return (
      <>
        <div
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px] lg:hidden"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
        <aside className="fixed inset-y-0 left-0 z-50 w-64 bg-[#FAF8F5] dark:bg-[#171513] border-r border-slate-200 dark:border-[#2E2A25] shadow-xl lg:hidden flex flex-col">
          {content}
        </aside>
      </>
    );
  }

  return (
    <aside
      className={`hidden lg:flex flex-col shrink-0 bg-[#FAF8F5] dark:bg-[#171513] border-r border-slate-200 dark:border-[#2E2A25] transition-[width] duration-200 ease-out overflow-hidden ${
        collapsed ? 'w-[68px]' : 'w-60'
      }`}
    >
      {content}
    </aside>
  );
}
