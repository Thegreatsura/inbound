import React, {SVGProps} from 'react';

type IconProps = SVGProps<SVGSVGElement> & {
	secondaryfill?: string;
	strokewidth?: number;
	title?: string;
}

function Leave3({fill = 'currentColor', secondaryfill, title = 'badge 13', ...props}: IconProps) {
	secondaryfill = secondaryfill || fill;

	return (
		<svg height="32" width="32" {...props} viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
	<title>{title}</title>
	<g fill={fill}>
		<path d="M18,16a1,1,0,0,0-1,1v6H12V8a1,1,0,0,0-.486-.858L4.61,3H17V9a1,1,0,0,0,2,0V2a1,1,0,0,0-1-1H1A1,1,0,0,0,0,2V24a1,1,0,0,0,.486.857l10,6A1,1,0,0,0,12,30V25h6a1,1,0,0,0,1-1V17A1,1,0,0,0,18,16Z" fill={fill}/>
		<path d="M24.651,6.241A1,1,0,0,0,23,7v5H15a1,1,0,0,0,0,2h8v5a1,1,0,0,0,1.651.759l7-6a1,1,0,0,0,0-1.518Z" fill={secondaryfill}/>
	</g>
</svg>
	);
};

export default Leave3;