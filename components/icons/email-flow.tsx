import React, { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & {
  title?: string
}

// Email Flow icon based on provided SVG. Uses currentColor for theming.
export default function EmailFlow({ title = 'Email Flow', ...props }: IconProps) {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 18 18"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden={title ? undefined : true}
      {...props}
    >
      {title ? <title>{title}</title> : null}
      <path
        opacity="0.4"
        d="M15.2129 2.41818L8.71292 1.05002C8.04402 0.907416 7.3613 1.07589 6.832 1.50509C6.3037 1.93429 6 2.57098 6 3.25168V10.6858C6 11.7439 6.75201 12.6702 7.78711 12.8879L14.2871 14.2556C14.4424 14.2883 14.5986 14.3044 14.7539 14.3044C15.2646 14.3044 15.7617 14.1301 16.168 13.8015C16.6963 13.3723 17 12.7351 17 12.0539V4.61972C17 3.56162 16.248 2.63598 15.2129 2.41818Z"
        fill="currentColor"
      />
      <path
        d="M10.2129 5.11325L3.71292 3.74508C3.04402 3.60248 2.3613 3.77096 1.832 4.20016C1.3037 4.62936 1 5.26605 1 5.94675V13.3808C1 14.4389 1.75201 15.3653 2.78711 15.583L9.28711 16.9507C9.44241 16.9834 9.59861 16.9995 9.75391 16.9995C10.2646 16.9995 10.7617 16.8251 11.168 16.4965C11.6963 16.0673 12 15.4302 12 14.749V7.31491C12 6.25681 11.248 5.33105 10.2129 5.11325Z"
        fill="currentColor"
      />
    </svg>
  )
}


