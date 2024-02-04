import axios from "axios";
import "@shopify/shopify-api/adapters/node";

import dotenv from "dotenv";

dotenv.config();

const headers = {
  "Content-Type": "application/json",
  "X-Shopify-Access-Token": `${process.env.ACCESS_TOKEN}`,
};

// Shopify and Pipedrive API endpoints and keys
const shopifyAPI =
  "https://my-store331.myshopify.com/admin/api/2023-10/orders/{order_id}.json";
const pipedriveAPI = "https://api.pipedrive.com/v1/";
const pipedriveKey = `${process.env.PIPE_DRIVE_API_KEY}`;

// Get the Shopify order details
async function getShopifyOrder(orderId) {
  const response = await axios.get(shopifyAPI.replace("{order_id}", orderId), {
    headers: headers,
  });
  return response.data;
}

// Find or create a person in Pipedrive
async function findOrCreatePerson(customer) {
  let response = await axios.get(
    `${pipedriveAPI}persons/search?term=${customer?.email}&api_token=${pipedriveKey}`
  );
  if (response.data.data.items.length === 0) {
    response = await axios.post(
      `${pipedriveAPI}persons?api_token=${pipedriveKey}`,
      {
        name: `${customer?.first_name} ${customer?.last_name}`,
        email: customer?.email,
        phone: customer?.phone,
      }
    );
  }
  return response.data.data;
}

// Find or create a product in Pipedrive
async function findOrCreateProduct(lineItem) {
  let response = await axios.get(
    `${pipedriveAPI}products/search?term=${lineItem?.sku}&api_token=${pipedriveKey}`
  );
  console.log("response", response.data.data.items, lineItem);

  if (response.data.data.items.length === 0) {
    const priceAray = [];
    let priceObj = {
      price: parseInt(lineItem?.price),
      currency: "USD",
    };

    priceAray.push(priceObj);
    try {
      response = await axios.post(
        `${pipedriveAPI}products?api_token=${pipedriveKey}`,
        {
          name: lineItem.name,
          code: lineItem.sku,
          prices: [...priceAray],
        }
      );
      console.log("res", response.data.data);
      return response.data.data;
    } catch (error) {
      console.error(`Error creating product: ${error}`);
    }
  }
  //   console.log("res", response.data.data.items);
  return response.data.data.items[0].item;
}

// Create a deal in Pipedrive
async function createDeal(personId) {
  try {
    const response = await axios.post(
      `${pipedriveAPI}deals?api_token=${pipedriveKey}`,
      {
        title: "Shopify Order",
        person_id: personId,
      }
    );
    return response.data.data;
  } catch (error) {
    console.error(`Error creating deal: ${error}`);
  }
}

// Attach a product to a deal in Pipedrive
async function attachProductToDeal(dealId, product) {
  //   console.log(product, "productId");

  try {
    const res = await axios.post(
      `${pipedriveAPI}deals/${dealId}/products?api_token=${pipedriveKey}`,
      {
        product_id: product?.id,
        item_price: parseInt(product?.code) || null,
        quantity: parseInt(product?.code),
      }
    );

    console.log("response attachProductToDeal", res?.data);
    console.log(
      "Product attached to deal and integration with shopify successful"
    );
  } catch (error) {
    console.error(`Error attaching product to deal: ${error}`);
  }
}

// Main function to integrate Shopify and Pipedrive
async function integrateShopifyAndPipedrive(orderId) {
  try {
    const { order } = await getShopifyOrder(orderId);

    const person = await findOrCreatePerson(order.customer);
    const deal = await createDeal(person?.id);
    for (const lineItem of order.line_items) {
      const product = await findOrCreateProduct(lineItem);
      console.log("product", product);
      await attachProductToDeal(deal.id, product);
    }
  } catch (error) {
    throw new Error("Error integrating Shopify and Pipedrive");
  }
}

// Run the integration
const orderId = 5495022911744;
integrateShopifyAndPipedrive(orderId);
