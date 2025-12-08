import { Autumn, Customer } from "autumn-js";

const autumn = new Autumn({
  secretKey: process.env.AUTUMN_PROD_SECRET_KEY!,
});

async function analyzeUpgrades() {
  console.log("Fetching customers from Autumn...\n");

  const limit = 100;
  let offset = 0;
  let page = 1;
  let allCustomers: Customer[] = [];

  // Paginate through all customers
  while (true) {
    console.log(`Fetching page ${page} (offset: ${offset})...`);

    const { data, error } = await autumn.customers.list({
      limit,
      offset,
    });

    if (error) {
      console.error("Error fetching customers:", error);
      return;
    }

    if (!data?.list) {
      console.log("No customer list found in response");
      break;
    }

    allCustomers = allCustomers.concat(data.list);
    console.log(`  → Got ${data.list.length} customers (total so far: ${allCustomers.length})`);

    // If we got fewer than we asked for, we've reached the end
    if (data.list.length < limit) {
      console.log("\n✅ All pages fetched!\n");
      break;
    }

    offset += limit;
    page++;
  }

  console.log("\n--- Analysis ---\n");

  const totalCustomers = allCustomers.length;
  let upgradedCount = 0;
  const upgradedCustomers: Array<{
    id: string | null;
    email: string | null;
    name: string | null;
  }> = [];

  // Check each customer for inbound_default_test product
  for (const customer of allCustomers) {
    const hasDefaultTest = customer.products?.some(
      (product) => product.id === "inbound_default_test"
    );

    if (hasDefaultTest) {
      upgradedCount++;
      upgradedCustomers.push({
        id: customer.id,
        email: customer.email,
        name: customer.name,
      });
    }
  }

  console.log(`Total customers fetched: ${totalCustomers}`);
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
