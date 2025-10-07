import React, {SVGProps} from 'react';

type IconProps = SVGProps<SVGSVGElement> & {
	secondaryfill?: string;
	strokewidth?: number;
	title?: string;
}

function Key2({fill = 'currentColor', secondaryfill, title = 'api keys', ...props}: IconProps) {
	secondaryfill = secondaryfill || fill;

	return (
		<svg height="18" width="18" {...props} viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
		<title>{title}</title>
		<path fillRule="evenodd" clipRule="evenodd" d="M2 12C2 9.7909 3.79077 8 6 8C8.20923 8 10 9.7909 10 12C10 14.2091 8.20923 16 6 16C3.79077 16 2 14.2091 2 12Z" fill={secondaryfill} opacity=".4"/>
		<path d="M15.7801 3.28033C16.073 2.98744 16.073 2.51256 15.7801 2.21967C15.4873 1.92678 15.0124 1.92678 14.7195 2.21967L8.24805 8.69111C8.66473 8.97478 9.02505 9.33509 9.30871 9.75178L11.9998 7.06066L13.4695 8.53033C13.7624 8.82322 14.2372 8.82322 14.5301 8.53033C14.823 8.23743 14.823 7.76256 14.5301 7.46967L13.0605 6L13.9998 5.06065L15.4695 6.53033C15.7624 6.82322 16.2373 6.82322 16.5302 6.53033C16.823 6.23744 16.823 5.76256 16.5302 5.46967L15.0605 3.99999L15.7801 3.28033Z" fill={fill}/>
	</svg>
	);
};

export default Key2;