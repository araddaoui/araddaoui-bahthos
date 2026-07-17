import React, { useState } from "react";
import { 
  BookOpen, 
  MessageSquare, 
  Sparkles, 
  History, 
  Settings, 
  HelpCircle,
  FileText,
  Plus,
  FolderOpen,
  ChevronDown,
  Trash2,
  FolderGit2
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { ActiveTab, Project } from "../types";

interface SidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  activeSourcesCount: number;
  projects: Project[];
  currentProjectId: string;
  onSwitchProject: (id: string) => void;
  onCreateProject: (name: string) => void;
  onDeleteProject: (id: string) => void;
}

export default function Sidebar({ 
  activeTab, 
  setActiveTab, 
  activeSourcesCount,
  projects,
  currentProjectId,
  onSwitchProject,
  onCreateProject,
  onDeleteProject
}: SidebarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);

  const activeProject = projects.find(p => p.id === currentProjectId) || projects[0] || { id: "default", name: "المشروع التجريبي الأول" };

  const navItems = [
    {
      id: "home" as ActiveTab,
      label: "بحث OS والدردشة",
      icon: MessageSquare,
      badge: null,
    },
    {
      id: "sources" as ActiveTab,
      label: "المصادر والمستندات",
      icon: FileText,
      badge: activeSourcesCount > 0 ? activeSourcesCount : null,
    },
    {
      id: "editor" as ActiveTab,
      label: "محرر التوليف",
      icon: Sparkles,
      badge: null,
    },
    {
      id: "history" as ActiveTab,
      label: "سجل التوليفات",
      icon: History,
      badge: null,
    },
    {
      id: "settings" as ActiveTab,
      label: "الإعدادات",
      icon: Settings,
      badge: null,
    },
  ];

  return (
    <div className="w-20 md:w-64 bg-[#f4f3ee] border-l border-[#e2e2dd] h-full flex flex-col justify-between p-4" id="bahthos-sidebar">
      <div className="flex flex-col gap-5">
        {/* Logo and Brand */}
        <div className="flex items-center gap-3 px-2 py-3 border-b border-[#e2e2dd] justify-center md:justify-start">
          <div className="bg-[#094d4e] text-[#fafaf8] p-2 rounded-lg flex items-center justify-center shadow-sm">
            <BookOpen className="w-6 h-6" />
          </div>
          <div className="hidden md:flex flex-col select-none">
            <span className="font-extrabold text-[25px] text-[#094d4e] tracking-tight leading-none">بحث OS</span>
            <span className="text-xs font-semibold text-gray-500 tracking-wide mt-1">bahthOS</span>
            <span className="text-[9px] text-gray-400 font-medium mt-1">مساعد البحث المنهجي</span>
          </div>
        </div>

        {/* Project Selector */}
        <div className="relative px-2" id="sidebar-project-selector-container">
          {/* Desktop Selector */}
          <div className="hidden md:flex flex-col gap-1.5">
            <span className="text-[10px] font-bold text-gray-400 tracking-wider uppercase select-none">المشروع البحثي الحالي</span>
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="w-full flex items-center justify-between px-3 py-2.5 bg-[#eae9e2] hover:bg-[#dfded7] text-gray-800 rounded-xl border border-[#e2e2dd] transition-all duration-200 text-xs font-semibold shadow-sm group"
              id="sidebar-project-dropdown-trigger"
            >
              <div className="flex items-center gap-2 overflow-hidden">
                <FolderOpen className="w-4 h-4 text-[#094d4e] flex-shrink-0" />
                <span className="truncate text-right">{activeProject.name}</span>
              </div>
              <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
            </button>
          </div>

          {/* Mobile Selector Icon */}
          <div className="flex md:hidden justify-center py-2 border-b border-[#e2e2dd]">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="p-3 bg-[#eae9e2] hover:bg-[#dfded7] text-[#094d4e] rounded-xl border border-[#e2e2dd] transition-all"
              title="إدارة المشاريع"
            >
              <FolderOpen className="w-5 h-5" />
            </button>
          </div>

          {/* Dropdown Overlay / Menu */}
          <AnimatePresence>
            {isOpen && (
              <>
                {/* Backdrop to close dropdown */}
                <div className="fixed inset-0 z-30" onClick={() => { setIsOpen(false); setShowCreateForm(false); }} />
                
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 left-0 mt-2 bg-[#fafaf8] border border-[#e2e2dd] rounded-2xl shadow-xl z-40 p-3 overflow-hidden flex flex-col gap-2.5 max-h-80 w-64"
                  id="sidebar-project-dropdown-menu"
                >
                  <div className="flex items-center justify-between pb-2 border-b border-[#e2e2dd] text-xs font-bold text-gray-500">
                    <span>قائمة مشاريعك</span>
                    <button
                      onClick={() => setShowCreateForm(!showCreateForm)}
                      className="p-1 text-[#094d4e] hover:bg-[#eae9e2] rounded-md transition-colors flex items-center gap-1"
                      title="مشروع جديد"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span className="text-[10px]">جديد</span>
                    </button>
                  </div>

                  {/* Create New Project Form */}
                  <AnimatePresence>
                    {showCreateForm && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden flex flex-col gap-1.5 pb-2 border-b border-[#e2e2dd] px-1"
                      >
                        <input
                          type="text"
                          placeholder="اسم المشروع الجديد..."
                          value={newProjectName}
                          onChange={(e) => setNewProjectName(e.target.value)}
                          className="w-full text-xs px-2.5 py-2 border border-[#e2e2dd] bg-[#f4f3ee] rounded-lg text-gray-800 placeholder-gray-400 focus:outline-none focus:border-[#094d4e]"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              if (newProjectName.trim()) {
                                onCreateProject(newProjectName);
                                setNewProjectName("");
                                setShowCreateForm(false);
                                setIsOpen(false);
                              }
                            }
                          }}
                          autoFocus
                        />
                        <div className="flex gap-1 justify-end">
                          <button
                            onClick={() => {
                              setShowCreateForm(false);
                              setNewProjectName("");
                            }}
                            className="px-2 py-1 text-[10px] text-gray-500 hover:bg-[#eae9e2] rounded transition-colors"
                          >
                            إلغاء
                          </button>
                          <button
                            onClick={() => {
                              if (newProjectName.trim()) {
                                onCreateProject(newProjectName);
                                setNewProjectName("");
                                setShowCreateForm(false);
                                setIsOpen(false);
                              }
                            }}
                            className="px-2 py-1 text-[10px] bg-[#094d4e] text-[#fafaf8] rounded hover:bg-opacity-90 transition-colors"
                          >
                            إنشاء
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Projects List */}
                  <div className="flex-1 overflow-y-auto space-y-1 pr-1 custom-scrollbar max-h-48">
                    {projects.map((proj) => {
                      const isSelected = proj.id === currentProjectId;
                      return (
                        <div
                          key={proj.id}
                          className={`flex items-center justify-between p-2 rounded-xl text-xs transition-all duration-150 ${
                            isSelected
                              ? "bg-[#094d4e] text-[#fafaf8] font-semibold"
                              : "text-gray-700 hover:bg-[#eae9e2]"
                          }`}
                        >
                          <button
                            onClick={() => {
                              onSwitchProject(proj.id);
                              setIsOpen(false);
                            }}
                            className="flex-1 text-right truncate flex items-center gap-2 py-0.5"
                          >
                            <FolderGit2 className={`w-3.5 h-3.5 flex-shrink-0 ${isSelected ? "text-teal-300" : "text-[#094d4e]"}`} />
                            <span className="truncate">{proj.name}</span>
                          </button>

                          {projects.length > 1 && (
                            <button
                              onClick={() => {
                                if (confirm(`هل أنت متأكد من رغبتك في حذف مشروع "${proj.name}"؟ سيتم حذف جميع المصادر والدردشات الخاصة به.`)) {
                                  onDeleteProject(proj.id);
                                }
                              }}
                              className={`p-1 rounded-md transition-colors ${
                                isSelected
                                  ? "text-teal-300 hover:bg-[#073c3d]"
                                  : "text-gray-400 hover:text-red-500 hover:bg-red-50"
                              }`}
                              title="حذف المشروع"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        {/* Navigation Links */}
        <nav className="flex flex-col gap-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`group relative flex items-center gap-3.5 px-3 py-3 rounded-lg text-sm font-medium transition-all duration-200 justify-center md:justify-start ${
                  isActive
                    ? "bg-[#094d4e] text-[#fafaf8] shadow-sm font-semibold"
                    : "text-gray-600 hover:bg-[#eae9e2] hover:text-[#1f1f1f]"
                }`}
                id={`sidebar-nav-${item.id}`}
                title={item.label}
              >
                <div className="relative">
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  {item.badge !== null && (
                    <span className={`absolute -top-1.5 -left-1.5 w-4 h-4 text-[9px] font-bold rounded-full flex items-center justify-center ${
                      isActive ? "bg-[#fafaf8] text-[#094d4e]" : "bg-[#094d4e] text-white"
                    }`}>
                      {item.badge}
                    </span>
                  )}
                </div>
                
                <span className="hidden md:inline whitespace-nowrap">{item.label}</span>

                {/* Left indicators */}
                {isActive && (
                  <motion.div
                    layoutId="active-indicator"
                    className="absolute right-0 top-1.5 bottom-1.5 w-1 bg-[#094d4e] rounded-l-md md:hidden"
                  />
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* User / Footer status */}
      <div className="pt-4 border-t border-[#e2e2dd] flex flex-col items-center md:items-start gap-2 px-2">
        <div className="hidden md:flex items-center gap-2.5 text-xs text-gray-600 font-semibold">
          <div className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse"></div>
          <span>المصادر متصلة بالكامل</span>
        </div>
        <div className="text-[10px] text-gray-500 font-mono hidden md:block">
          bahthOS v1.0.0
        </div>
      </div>
    </div>
  );
}
