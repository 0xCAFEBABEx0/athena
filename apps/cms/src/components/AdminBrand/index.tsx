import type React from 'react'
import '@/admin-ui/index.css'

// admin.components.graphics: Logo on the login page, Icon at the top of the
// sidebar. Both are public Payload APIs in 3.x and 4.x. Importing the admin
// stylesheet here loads daisyUI on every admin page.

/** The site's ❯_ prompt mark, drawn so it scales to any box Payload gives it. */
const Mark: React.FC<{ className?: string }> = ({ className }) => (
  <svg aria-hidden="true" className={className} viewBox="0 0 24 24">
    <rect fill="var(--whoa-ink)" height="24" rx="6" width="24" />
    <path d="M7 8l4 4-4 4" fill="none" stroke="var(--whoa-on-ink)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    <path d="M13 16h4.5" fill="none" stroke="var(--whoa-on-ink)" strokeLinecap="round" strokeWidth="2" />
  </svg>
)

export const Logo: React.FC = () => (
  <div className="whoa-ui tw:flex tw:items-center tw:gap-3">
    <Mark className="tw:size-10" />
    <span className="tw:text-2xl tw:font-semibold tw:tracking-tight">whoa.me</span>
    <span className="tw:badge tw:badge-sm tw:badge-outline tw:opacity-70">cms</span>
  </div>
)

export const Icon: React.FC = () => <Mark className="whoa-ui tw:block tw:size-full" />
