/* eslint-disable @next/next/no-img-element */

export function Logo() {
  return (
    <span className="flex items-center">
      <img
        src="/brand/logo-horizontal-light-notag.png"
        alt="SocietyLedger"
        width={113}
        height={28}
        className="h-7 w-auto dark:hidden"
      />
      <img
        src="/brand/logo-horizontal-dark-notag.png"
        alt="SocietyLedger"
        width={113}
        height={28}
        className="hidden h-7 w-auto dark:block"
      />
    </span>
  );
}
