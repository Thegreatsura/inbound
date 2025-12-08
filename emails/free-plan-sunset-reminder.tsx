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

interface FreePlanSunsetReminderEmailProps {
	userFirstname?: string;
	currentDomain?: string;
	deletionDate?: string;
	daysRemaining?: number;
}

export const FreePlanSunsetReminderEmail = ({
	userFirstname = "there",
	currentDomain,
	deletionDate = "January 15, 2025",
	daysRemaining = 14,
}: FreePlanSunsetReminderEmailProps) => (
	<Html>
		<Head />
		<Preview>{`Your account will be deleted in ${daysRemaining} days`}</Preview>
		<Tailwind>
			<Body
				className="bg-white font-sans text-neutral-800"
				style={{ margin: "32px" }}
			>
				<Container
					style={{ maxWidth: "480px", margin: "0", padding: "0 16px" }}
				>
					<Text className="text-base font-semibold leading-7">
						{daysRemaining} days until your account is deleted
					</Text>

					<Text className="text-base leading-7">
						Hi {userFirstname}, since we{" "}
						<Link
							href="https://inbound.new/blog/inbound-is-retiring-the-free-plan?utm_source=email&utm_medium=transactional&utm_campaign=free_plan_sunset_reminder"
							className="text-violet-600 underline"
						>
							retired the free plan
						</Link>
						, your account is limited to <strong>10 emails per month</strong>{" "}
						and will be permanently deleted on {deletionDate}.
					</Text>

					<Text className="text-base leading-7">
						Upgrade now to keep your account, your domain, and your email
						workflows.
					</Text>

					{currentDomain && (
						<Text className="mt-4 text-sm text-neutral-600">
							Domain at risk: {currentDomain}
						</Text>
					)}

					<Text className="mt-6 text-base leading-7">
						For just <strong>$4/month</strong>, you get:
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
						- Email support when you need it
					</Text>

					<Text className="mt-4 text-sm leading-6 text-neutral-600">
						Need additional domains? Just $3.50/domain/month.
					</Text>

					<Text className="my-6">
						<Link
							href="https://inbound.new/settings/billing?utm_source=email&utm_medium=transactional&utm_campaign=free_plan_sunset_reminder"
							className="text-violet-600 underline"
						>
							Upgrade Now — Keep Your Account →
						</Link>
					</Text>

					<Text className="text-base leading-7">
						Don't lose everything. Upgrade today.
					</Text>

					<Text className="mt-8 text-sm text-neutral-500">— inbound</Text>
				</Container>
			</Body>
		</Tailwind>
	</Html>
);

export default FreePlanSunsetReminderEmail;
