import type { Inbound } from "inboundemail";
import type { InboundConfig } from "./config/inbound-config";
import type { ParsedArgv } from "./lib/argv";

export type GlobalOptions = {
	apiKey?: string;
	baseUrl: string;
	asJson: boolean;
	debug: boolean;
	configPath?: string;
	mailbox?: string;
	addresses: string[];
	domains: string[];
	mergeFilters: boolean;
};

export type CliContext = {
	parsed: ParsedArgv;
	globals: GlobalOptions;
	config: InboundConfig;
	configPath: string | null;
	sdk?: Inbound;
};
