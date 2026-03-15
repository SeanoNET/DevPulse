interface ToggleProps {
  checked: boolean
  onChange: () => void
}

export function Toggle({ checked, onChange }: ToggleProps) {
  return (
    <button
      onClick={onChange}
      role="switch"
      aria-checked={checked}
      className={`
        relative inline-flex items-center shrink-0
        w-9 h-5 rounded-full transition-colors cursor-pointer
        ${checked ? 'bg-[var(--color-severity-success)]' : 'bg-muted'}
      `}
    >
      <span
        className={`
          inline-block w-3.5 h-3.5 rounded-full bg-white shadow-sm transition-transform
          ${checked ? 'translate-x-[18px]' : 'translate-x-[3px]'}
        `}
      />
    </button>
  )
}
