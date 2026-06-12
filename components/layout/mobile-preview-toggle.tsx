'use client'

import { Suspense, useEffect, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { MonitorSmartphone, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const phoneProfiles = [
  { label: 'iPhone 14', width: 390, height: 844 },
  { label: 'iPhone SE', width: 375, height: 667 },
]

export function MobilePreviewToggle() {
  if (process.env.NODE_ENV !== 'development') return null

  return (
    <Suspense fallback={null}>
      <MobilePreviewToggleInner />
    </Suspense>
  )
}

function MobilePreviewToggleInner() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [open, setOpen] = useState(false)
  const [activeProfile, setActiveProfile] = useState(phoneProfiles[0])
  const [scale, setScale] = useState(1)

  useEffect(() => {
    const updateScale = () => {
      const maxHeight = window.innerHeight - 170
      const maxWidth = window.innerWidth - 96
      setScale(Math.min(1, maxHeight / activeProfile.height, maxWidth / activeProfile.width))
    }

    updateScale()
    window.addEventListener('resize', updateScale)

    return () => window.removeEventListener('resize', updateScale)
  }, [activeProfile])

  const search = searchParams.toString()
  const previewUrl = `${pathname}${search ? `?${search}` : ''}`

  return (
    <div className="fixed bottom-5 right-5 z-[70] hidden lg:block">
      {open && (
        <div className="mb-3 rounded-[28px] border border-border bg-card p-3 shadow-2xl">
          <div className="mb-3 flex items-start justify-between gap-3 px-1">
            <div>
              <p className="text-sm font-semibold text-foreground">手机预览</p>
              <p className="text-xs text-muted-foreground">
                {activeProfile.label} · {activeProfile.width} x {activeProfile.height}
              </p>
              <div className="mt-2 flex gap-1.5">
                {phoneProfiles.map(profile => (
                  <button
                    key={profile.label}
                    type="button"
                    onClick={() => setActiveProfile(profile)}
                    className={cn(
                      'rounded-md border px-2 py-1 text-xs font-medium transition-colors',
                      activeProfile.label === profile.label
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border text-muted-foreground hover:bg-secondary hover:text-foreground',
                    )}
                  >
                    {profile.label}
                  </button>
                ))}
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div
            className="relative overflow-hidden rounded-[22px] border border-border bg-background"
            style={{
              width: activeProfile.width * scale,
              height: activeProfile.height * scale,
            }}
          >
            <div
              style={{
                width: activeProfile.width,
                height: activeProfile.height,
                transform: `scale(${scale})`,
                transformOrigin: 'top left',
              }}
            >
              <iframe
                title="移动端预览"
                src={previewUrl}
                className="h-full w-full border-0"
              />
            </div>
          </div>
        </div>
      )}

      <Button
        type="button"
        onClick={() => setOpen(current => !current)}
        className="h-11 rounded-full px-4 shadow-lg"
      >
        <MonitorSmartphone className="mr-2 h-4 w-4" />
        手机预览
      </Button>
    </div>
  )
}
