import React, { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & {
  secondaryfill?: string
  strokewidth?: number
  title?: string
}

function SidebarToggleIcon({ fill = 'currentColor', title = 'sidebar toggle', width = 20, height = 20, ...props }: IconProps) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width={width} height={height}>
      <title>{title}</title>
      <path
        opacity="0.45"
        fillRule="evenodd"
        clipRule="evenodd"
        d="M8.55499 4C6.9934 4 5.49576 4.62034 4.39155 5.72456C3.28733 6.82877 2.66699 8.32641 2.66699 9.888V21.6653C2.66682 22.4387 2.81899 23.2045 3.11481 23.919C3.41063 24.6335 3.84431 25.2827 4.39108 25.8296C4.93784 26.3765 5.58699 26.8104 6.30144 27.1063C7.0159 27.4023 7.78166 27.5547 8.55499 27.5547H23.4457C24.2191 27.5547 24.985 27.4023 25.6995 27.1062C26.4141 26.8101 27.0633 26.3762 27.61 25.8292C28.1568 25.2821 28.5905 24.6327 28.8862 23.9181C29.182 23.2034 29.334 22.4374 29.3337 21.664V9.888C29.3337 8.32641 28.7133 6.82877 27.6091 5.72456C26.5049 4.62034 25.0073 4 23.4457 4H8.55499ZM12.859 6.356V25.1987H23.4457C24.3828 25.1987 25.2815 24.8264 25.9441 24.1638C26.6067 23.5012 26.979 22.6024 26.979 21.6653V9.888C26.979 8.9509 26.6067 8.05219 25.9441 7.38956C25.2815 6.72693 24.3828 6.35467 23.4457 6.35467H12.859V6.356Z"
        fill={fill}
      />
    </svg>
  )
}

export default SidebarToggleIcon
