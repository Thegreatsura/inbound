import {
	Body,
	Container,
	Head,
	Html,
	Link,
	Preview,
	Tailwind,
	Text,
} from "@react-email/components";

interface FreePlanSunsetNoticeEmailProps {
	userFirstname?: string;
	currentDomain?: string;
	deletionDate?: string;
}

export const FreePlanSunsetNoticeEmail = ({
	userFirstname = "there",
	currentDomain,
	deletionDate = "January 15, 2025",
}: FreePlanSunsetNoticeEmailProps) => (
	<Html>
		<Head />
		<Preview>
			Your free plan has been downgraded — upgrade to restore access
		</Preview>
		<Tailwind>
			<Body className="font-sans">
				<Container style={{ maxWidth: "480px" }}>
					<Text className="text-base font-semibold leading-7">
						Important: Your plan has changed
					</Text>

					<Text className="text-base leading-7">
						Hi {userFirstname}, we've{" "}
						<Link
							href="https://inbound.new/blog/inbound-is-retiring-the-free-plan?utm_source=email&utm_medium=transactional&utm_campaign=free_plan_sunset_notice"
							className="text-violet-600 underline"
						>
							sunset the free plan
						</Link>{" "}
						and your account has been downgraded to{" "}
						<strong>10 emails per month</strong> (sent & received).
					</Text>

					<Text className="text-base leading-7">
						If you don't upgrade, your account will be deleted on {deletionDate}
						.
					</Text>

					<Text className="text-base leading-7">
						Upgrade for just <strong>$4/month</strong> to restore full access.
					</Text>

					<Text className="mt-6 text-sm font-semibold leading-6">
						What you get for $4/month:
					</Text>
					<Text className="m-0 text-sm leading-6">
						- 5,000 emails sent & received per month
					</Text>
					<Text className="m-0 text-sm leading-6">
						- 7 days of email retention
					</Text>
					<Text className="m-0 text-sm leading-6">
						- 1 custom domain included
					</Text>
					<Text className="m-0 text-sm leading-6">
						- Email support from our team
					</Text>

					{currentDomain && (
						<Text className="mt-4 text-sm text-neutral-600">
							Your domain: {currentDomain}
						</Text>
					)}

					<Text className="mt-4 text-sm leading-6 text-neutral-600">
						Need more domains? Add them for $3.50/domain/month.
					</Text>

					<Text className="my-6">
						<Link
							href="https://inbound.new/settings/billing?utm_source=email&utm_medium=transactional&utm_campaign=free_plan_sunset_notice"
							className="text-violet-600 underline"
						>
							Upgrade My Account — $4/month
						</Link>
					</Text>

					<Text className="text-base leading-7">
						Questions? Reply to this email or contact{" "}
						<Link
							href="mailto:support@inbound.new"
							className="text-violet-600 underline"
						>
							support
						</Link>
						.
					</Text>

					<Text className="mt-8 text-sm text-neutral-500">— inbound</Text>

					<Text className="mt-6 text-xs text-neutral-400">
						<Link
							href="https://inbound.new/unsubscribe"
							className="text-neutral-400 underline"
						>
							Unsubscribe
						</Link>{" "}
						from these emails
					</Text>
				</Container>
			</Body>
		</Tailwind>
	</Html>
);

export default FreePlanSunsetNoticeEmail;
