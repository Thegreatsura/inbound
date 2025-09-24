import {
	feature,
	product,
	featureItem,
	pricedFeatureItem,
	priceItem,
} from "atmn";

// Features
export const simpleAiFeatures = feature({
	id: "simple_ai_features",
	name: "Simple AI Features",
	type: "boolean",
});

export const inboundTriggers = feature({
	id: "inbound_triggers",
	name: "Emails Received ",
	type: "single_use",
});

export const emailRetention = feature({
	id: "email_retention",
	name: "Email Retention",
	type: "continuous_use",
});

export const vipByok = feature({
	id: "vip-byok",
	name: "vip-byok",
	type: "boolean",
});

export const emailsSent = feature({
	id: "emails_sent",
	name: "Emails Sent",
	type: "single_use",
});

export const emailSupport = feature({
	id: "email_support",
	name: "Email Support",
	type: "boolean",
});

export const advancedAiFeatures = feature({
	id: "advanced_ai_features",
	name: "Advanced AI Features",
	type: "boolean",
});

export const domains = feature({
	id: "domains",
	name: "Domains",
	type: "continuous_use",
});

export const slackSupport = feature({
	id: "slack_support",
	name: "Slack Support",
	type: "boolean",
});

// Products
export const freeTier = product({
	id: "free_tier",
	name: "inbound free",
	items: [
		featureItem({
			feature_id: domains.id,
			included_usage: 2,
		}),

		featureItem({
			feature_id: emailRetention.id,
			included_usage: 7,
		}),

		featureItem({
			feature_id: emailSupport.id,
			included_usage: undefined,
		}),

		featureItem({
			feature_id: inboundTriggers.id,
			included_usage: 5000,
			interval: "month",
			reset_usage_when_enabled: false,
		}),

		featureItem({
			feature_id: emailsSent.id,
			included_usage: 5000,
			interval: "month",
		}),
	],
});

export const pro = product({
	id: "pro",
	name: "inbound pro",
	items: [
		priceItem({
			price: 15,
			interval: "month",
		}),

		featureItem({
			feature_id: domains.id,
			included_usage: 50,
		}),

		featureItem({
			feature_id: emailRetention.id,
			included_usage: 15,
		}),

		featureItem({
			feature_id: emailSupport.id,
			included_usage: undefined,
		}),

		featureItem({
			feature_id: inboundTriggers.id,
			included_usage: 50000,
			interval: "month",
		}),

		featureItem({
			feature_id: emailsSent.id,
			included_usage: 50000,
			interval: "month",
		}),

		featureItem({
			feature_id: simpleAiFeatures.id,
			included_usage: undefined,
		}),
	],
	free_trial: {
		duration: "day",
		length: 3,
		unique_fingerprint: true,
		card_required: true,
	},
});

export const growth = product({
	id: "growth",
	name: "inbound growth",
	items: [
		priceItem({
			price: 39,
			interval: "month",
		}),

		featureItem({
			feature_id: advancedAiFeatures.id,
			included_usage: undefined,
		}),

		featureItem({
			feature_id: domains.id,
			included_usage: 200,
		}),

		featureItem({
			feature_id: emailRetention.id,
			included_usage: 30,
		}),

		featureItem({
			feature_id: inboundTriggers.id,
			included_usage: 100000,
			interval: "month",
			reset_usage_when_enabled: false,
		}),

		featureItem({
			feature_id: emailsSent.id,
			included_usage: 100000,
			interval: "month",
		}),

		featureItem({
			feature_id: slackSupport.id,
			included_usage: undefined,
		}),
	],
	free_trial: {
		duration: "day",
		length: 3,
		unique_fingerprint: true,
		card_required: true,
	},
});

export const scale = product({
	id: "scale",
	name: "inbound scale",
	items: [
		priceItem({
			price: 79,
			interval: "month",
		}),

		featureItem({
			feature_id: advancedAiFeatures.id,
			included_usage: undefined,
		}),

		featureItem({
			feature_id: domains.id,
			included_usage: "inf",
		}),

		featureItem({
			feature_id: emailRetention.id,
			included_usage: 45,
		}),

		featureItem({
			feature_id: inboundTriggers.id,
			included_usage: 200000,
			interval: "month",
		}),

		featureItem({
			feature_id: emailsSent.id,
			included_usage: 200000,
			interval: "month",
		}),

		featureItem({
			feature_id: slackSupport.id,
			included_usage: undefined,
		}),
	],
	free_trial: {
		duration: "day",
		length: 3,
		unique_fingerprint: true,
		card_required: true,
	},
});

export const product50kEmailBlocks = product({
	id: "50k_email_blocks",
	name: "+50k email blocks",
	items: [
		priceItem({
			price: 15,
			interval: "month",
		}),

		featureItem({
			feature_id: inboundTriggers.id,
			included_usage: 50000,
			interval: "month",
		}),

		featureItem({
			feature_id: emailsSent.id,
			included_usage: 50000,
			interval: "month",
		}),
	],
});
