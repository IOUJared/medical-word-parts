type IconProps = { readonly className?: string };

export function CheckIcon({ className }: IconProps) {
  return <svg className={className} aria-hidden="true" viewBox="0 0 24 24"><path d="m5 12 4 4L19 6" /></svg>;
}

export function InfoIcon({ className }: IconProps) {
  return <svg className={className} aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7.5v.5" /></svg>;
}

export function AlertIcon({ className }: IconProps) {
  return <svg className={className} aria-hidden="true" viewBox="0 0 24 24"><path d="M8 3h8l5 5v8l-5 5H8l-5-5V8Z" /><path d="M12 7v6M12 17v.5" /></svg>;
}

export function WarningIcon({ className }: IconProps) {
  return <svg className={className} aria-hidden="true" viewBox="0 0 24 24"><path d="M12 3 2.8 20h18.4Z" /><path d="M12 9v5M12 17v.5" /></svg>;
}

export function CopyIcon({ className }: IconProps) {
  return <svg className={className} aria-hidden="true" viewBox="0 0 24 24"><rect x="8" y="8" width="11" height="11" /><path d="M16 8V5H5v11h3" /></svg>;
}
