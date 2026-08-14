export function BrandMark({ className = "size-8" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      className={className}
      aria-hidden="true"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="1" y="1" width="38" height="38" rx="11" fill="#163F3A" />
      <path d="M13 10V30" stroke="#F7F5EE" strokeWidth="3.4" strokeLinecap="round" />
      <path d="M14 20L27 10" stroke="#F7F5EE" strokeWidth="3.4" strokeLinecap="round" />
      <path d="M14 20L28 30" stroke="#F7F5EE" strokeWidth="3.4" strokeLinecap="round" />
      <circle cx="13" cy="10" r="2.4" fill="#F5B544" />
      <circle cx="27" cy="10" r="2.4" fill="#F5B544" />
      <circle cx="28" cy="30" r="2.4" fill="#F5B544" />
      <circle cx="14" cy="20" r="2.7" fill="#F06C51" />
    </svg>
  );
}
