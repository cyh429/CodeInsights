/**
 * Onboarding 视图组件
 *
 * 首次启动时显示的全屏欢迎界面。
 *
 * 流程：
 *  Step 1：欢迎 + 教程入口
 *  Step 2：Windows 环境检测（仅 Windows，其他平台自动跳过）
 */

import { useMemo, useState } from 'react'
import { useAtomValue } from 'jotai'
import { AlertTriangle, Bot, ChevronLeft, ChevronRight, GitBranch, GraduationCap, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { ScrollArea } from '@/components/ui/scroll-area'
import { TutorialViewer } from '@/components/tutorial/TutorialViewer'
import { EnvironmentCheckPanel } from '@/components/environment/EnvironmentCheckPanel'
import { isShellEnvironmentOkAtom } from '@/atoms/environment'

interface OnboardingViewProps {
  /** 完成回调（进入主界面） */
  onComplete: () => void
}

function detectIsWindows(): boolean {
  const platform =
    typeof navigator !== 'undefined' &&
    (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform
  if (typeof platform === 'string' && platform.toLowerCase().includes('win')) {
    return true
  }
  return typeof navigator !== 'undefined' && /win/i.test(navigator.platform || '')
}

export function OnboardingView({ onComplete }: OnboardingViewProps) {
  const [showTutorial, setShowTutorial] = useState(false)
  const [step, setStep] = useState<'welcome' | 'environment'>('welcome')
  const isWindows = useMemo(() => detectIsWindows(), [])
  const shellOk = useAtomValue(isShellEnvironmentOkAtom)

  const handleFinish = async () => {
    await window.electronAPI.updateSettings({
      onboardingCompleted: true,
    })
    onComplete()
  }

  const handleNextFromWelcome = () => {
    if (isWindows) {
      setStep('environment')
    } else {
      // 非 Windows：直接完成
      handleFinish()
    }
  }

  return (
    <div className="flex h-screen flex-col items-center justify-center overflow-y-auto bg-background p-6">
      {step === 'welcome' && (
        <div className="flex w-full max-w-3xl flex-col items-center gap-6 py-8">
          {isWindows && !shellOk && (
            <div className="flex w-full items-start gap-3 rounded-card border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300" role="status">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <div>
                <p className="font-medium">需要先检查命令环境</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Windows 上需要 Git Bash 或 WSL。下一步会给出检测结果和修复入口。
                </p>
              </div>
            </div>
          )}

          <div className="text-center">
            <h1 className="text-3xl font-semibold tracking-tight">欢迎使用 CodeInsights</h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              完成基础环境和模型渠道配置后，直接从 Pipeline 或 Agent 开始工作。
            </p>
          </div>

          <div className="grid w-full gap-3 md:grid-cols-3">
            {[
              { icon: Settings, title: '配置渠道', desc: '添加至少一个可用模型渠道。' },
              { icon: GitBranch, title: '开始 Pipeline', desc: '用结构化工作流推进贡献任务。' },
              { icon: Bot, title: '打开 Agent', desc: '在工作区内读取文件并执行任务。' },
            ].map((item) => (
              <div key={item.title} className="rounded-card border border-border-subtle bg-surface-card p-4 shadow-sm">
                <item.icon className="mb-3 size-5 text-primary" aria-hidden="true" />
                <h2 className="text-sm font-semibold text-foreground">{item.title}</h2>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>

          <div className="w-full">
            <button
              type="button"
              onClick={() => setShowTutorial(true)}
              className="flex w-full items-center gap-4 rounded-card border border-border-subtle bg-surface-card p-4 text-left shadow-sm transition-colors hover:bg-surface-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <div className="flex size-10 flex-shrink-0 items-center justify-center rounded-control bg-primary/10">
                <GraduationCap size={20} className="text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-foreground">查看使用教程</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  需要时再了解完整功能；不看教程也可以直接开始。
                </p>
              </div>
            </button>
          </div>

          <div className="flex gap-3">
            <Button onClick={handleNextFromWelcome}>
              {isWindows ? (
                <>
                  下一步：环境检测
                  <ChevronRight className="ml-1 h-4 w-4" />
                </>
              ) : (
                '开始使用'
              )}
            </Button>
          </div>
        </div>
      )}

      {step === 'environment' && isWindows && (
        <div className="w-full max-w-2xl">
          <div className="mb-6 text-center">
            <h2 className="text-2xl font-semibold mb-2">先检查一下环境</h2>
            <p className="text-sm text-muted-foreground">
              CodeInsights 在 Windows 上需要 Git Bash 或 WSL 才能执行命令
            </p>
          </div>

          <div className="rounded-card border border-border-subtle bg-surface-card p-5 mb-6 shadow-sm">
            <EnvironmentCheckPanel autoDetectOnMount />
          </div>

          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setStep('welcome')}
              className="text-muted-foreground"
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              上一步
            </Button>
            <div className="flex gap-3">
              <Button
                onClick={handleFinish}
                variant={shellOk ? 'default' : 'outline'}
              >
                {shellOk ? '开始使用' : '稍后处理（进入主界面）'}
              </Button>
            </div>
          </div>
        </div>
      )}

      <Sheet open={showTutorial} onOpenChange={setShowTutorial}>
        <SheetContent side="right" className="w-[min(560px,100vw)] sm:max-w-[560px] p-0">
          <SheetHeader className="px-6 pt-6 pb-4 border-b">
            <SheetTitle className="flex items-center gap-2">
              <GraduationCap size={18} className="text-primary" />
              CodeInsights 使用教程
            </SheetTitle>
          </SheetHeader>
          <ScrollArea className="h-[calc(100vh-80px)]">
            <div className="px-6 py-4">
              <TutorialViewer />
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </div>
  )
}
