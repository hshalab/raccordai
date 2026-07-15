import { useQuery } from '@tanstack/react-query'
import { Coins, RefreshCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@renderer/components/ui/Button'
import { invoke } from '@renderer/lib/ipc'

/**
 * kie.ai account balance, shown in the title bar next to the page actions.
 * Refetched on every generation settle (event:creditsChanged → ['kie','credits']
 * invalidation in main.tsx) + manual refresh button. Hidden while the key is
 * missing or the query fails.
 */
export function HeaderCredits(): React.JSX.Element | null {
  const { t } = useTranslation()
  const credits = useQuery({
    queryKey: ['kie', 'credits'],
    queryFn: () => invoke('kie:credits'),
    staleTime: 30_000,
    retry: false
  })

  if (!credits.data) return null
  return (
    <div className="no-drag flex items-center gap-0.5">
      <span
        className="flex items-center gap-1.5 px-1 text-sm text-neutral-400"
        title={t('credits.title')}
      >
        <Coins className="h-3.5 w-3.5" />
        <span className="text-neutral-200">{credits.data.credits.toLocaleString()}</span>
        {t('credits.label')}
      </span>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => void credits.refetch()}
        disabled={credits.isFetching}
        title={t('credits.refresh')}
      >
        <RefreshCw className={`h-3.5 w-3.5 ${credits.isFetching ? 'animate-spin' : ''}`} />
      </Button>
    </div>
  )
}
