import * as React from 'react'
import { toast } from 'sonner'
import { ShieldAlert } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

let hasShownCredentialStorageToast = false

interface CredentialStorageWarningProps {
  scopeLabel: string
}

export function CredentialStorageWarning({ scopeLabel }: CredentialStorageWarningProps): React.ReactElement | null {
  const [encryptionAvailable, setEncryptionAvailable] = React.useState<boolean | null>(null)

  React.useEffect(() => {
    let cancelled = false

    window.electronAPI.getRuntimeStatus()
      .then((status) => {
        if (cancelled) return
        setEncryptionAvailable(status?.credentialStorage.available ?? true)
      })
      .catch(() => {
        if (cancelled) return
        setEncryptionAvailable(true)
      })

    return () => {
      cancelled = true
    }
  }, [])

  React.useEffect(() => {
    if (encryptionAvailable !== false || hasShownCredentialStorageToast) {
      return
    }

    hasShownCredentialStorageToast = true
    toast.warning('系统密钥环不可用', {
      id: 'credential-storage-warning',
      description: `${scopeLabel}中的敏感凭证将以明文形式保存在本地配置文件中。`,
      duration: 8000,
    })
  }, [encryptionAvailable, scopeLabel])

  if (encryptionAvailable !== false) {
    return null
  }

  return (
    <Alert className="border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200">
      <ShieldAlert className="h-4 w-4 text-amber-600 dark:text-amber-300" />
      <AlertTitle>本机系统级加密不可用</AlertTitle>
      <AlertDescription>
        {scopeLabel}中的敏感凭证当前会以明文形式保存在本地配置文件中。建议检查系统钥匙串、Secret Service
        或相关桌面环境配置后再继续保存正式凭证。
      </AlertDescription>
    </Alert>
  )
}
