import { Autumn } from "autumn-js";

const autumn = new Autumn();

async function analyzeUpgrades() {
  console.log("Fetching customers from Autumn...\n");

  const { data, error } = await autumn.customers.list();

  if (error) {
    console.error("Error fetching customers:", error);
    return;
  }

  console.log("Full response structure:");
  console.log(JSON.stringify(data, null, 2));

  console.log("\n\n--- Analysis ---\n");

  if (!data?.list) {
    console.log("No customer list found in response");
    return;
  }

  const totalCustomers = data.list.length;
  let upgradedCount = 0;
  const upgradedCustomers: Array<{
    id: string;
    email: string | null;
    name: string | null;
  }> = [];

  // Check each customer for inbound_default_test product
  for (const customer of data.list) {
    const hasDefaultTest = customer.products?.some(
      (product: { id: string }) => product.id === "inbound_default_test"
    );

    if (hasDefaultTest) {
      upgradedCount++;
      upgradedCustomers.push({
        id: customer.id as string,
        email: customer.email,
        name: customer.name,
      });
    }
  }

  console.log(`Total customers: ${totalCustomers}`);
  console.log(
    `Upgraded to inbound_default_test: ${upgradedCount}/${totalCustomers}`
  );
  console.log(
    `Upgrade rate: ${((upgradedCount / totalCustomers) * 100).toFixed(2)}%`
  );

  if (upgradedCustomers.length > 0) {
    console.log("\nUpgraded customers:");
    console.table(upgradedCustomers);
  }
}

analyzeUpgrades();
