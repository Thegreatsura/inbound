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

interface FreePlanSunsetFinalEmailProps {
	userFirstname?: string;
	currentDomain?: string;
	deletionDate?: string;
}

export const FreePlanSunsetFinalEmail = ({
	userFirstname = "there",
	currentDomain,
	deletionDate = "tomorrow",
}: FreePlanSunsetFinalEmailProps) => (
	<Html>
		<Head />
		<Preview>Final notice: Your account will be deleted {deletionDate}</Preview>
		<Tailwind>
			<Body
				className="bg-white font-sans text-neutral-800"
				style={{ margin: "32px" }}
			>
				<Container
					style={{ maxWidth: "480px", margin: "0", padding: "0 16px" }}
				>
					<Text className="text-base font-semibold leading-7">
						Final notice: Your account will be deleted {deletionDate}
					</Text>

					<Text className="text-base leading-7">
						Hi {userFirstname}, this is your last chance to save your account.
					</Text>

					<Text className="text-base leading-7">
						Since we{" "}
						<Link
							href="https://inbound.new/blog/inbound-is-retiring-the-free-plan?utm_source=email&utm_medium=transactional&utm_campaign=free_plan_sunset_final"
							className="text-violet-600 underline"
						>
							retired the free plan
						</Link>
						, your account is being deleted {deletionDate}. Once deleted,{" "}
						<strong>
							your domain, emails, and all data will be permanently lost
						</strong>
						.
					</Text>

					{currentDomain && (
						<Text className="mt-4 text-sm text-neutral-600">
							Domain being deleted: {currentDomain}
						</Text>
					)}

					<Text className="mt-6 text-base leading-7">
						<strong>$4/month</strong> — that's all it takes to keep everything.
					</Text>

					<Text className="m-0 text-sm leading-6">- 5,000 emails/month</Text>
					<Text className="m-0 text-sm leading-6">- 7 days retention</Text>
					<Text className="m-0 text-sm leading-6">- 1 domain included</Text>
					<Text className="m-0 text-sm leading-6">- Email support</Text>

					<Text className="mt-4 text-sm leading-6 text-neutral-600">
						Additional domains: $3.50/domain/month
					</Text>

					<Text className="my-6">
						<Link
							href="https://inbound.new/settings/billing?utm_source=email&utm_medium=transactional&utm_campaign=free_plan_sunset_final"
							className="text-violet-600 underline"
						>
							Save My Account — $4/month →
						</Link>
					</Text>

					<Text className="text-base leading-7">
						This is your final reminder. Act now or lose access forever.
					</Text>

					<Text className="mt-8 text-sm text-neutral-500">— inbound</Text>
				</Container>
			</Body>
		</Tailwind>
	</Html>
);

export default FreePlanSunsetFinalEmail;
