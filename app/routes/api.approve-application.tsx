import { json } from "@remix-run/node";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://gimmethegoodstuff.org",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-admin-secret",
};

// 1. THIS CATCHES THE BROWSER's PREFLIGHT (OPTIONS)
export async function loader({ request }: any) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  return json({ error: "Method not allowed" }, { status: 405, headers: corsHeaders });
}

// 2. THIS CATCHES THE ACTUAL FORM SUBMISSION (POST)
export async function action({ request }: any) {
  // Catch OPTIONS here as well, just as a safety net
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // SECRET CHECK
  const key = request.headers.get("x-admin-secret");
  if (key !== process.env.ADMIN_API_SECRET) {
    return json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
  }

  try {
    const body = await request.json();
    const { id, email, contact_name, brand_name } = body;

    // UPDATE METAOBJECT (Manual Fetch)
    const updateResponse = await fetch(
      `https://${process.env.SHOPIFY_STORE_DOMAIN}/admin/api/2026-04/graphql.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": process.env.SHOPIFY_ADMIN_TOKEN!,
        },
        body: JSON.stringify({
          query: `
            mutation updateMetaobject($id: ID!, $metaobject: MetaobjectUpdateInput!) {
              metaobjectUpdate(id: $id, metaobject: $metaobject) {
                userErrors { field message }
              }
            }
          `,
          variables: {
            id,
            metaobject: {
              fields: [{ key: "status", value: "approved" }]
            }
          }
        })
      }
    );

    const updateResult = await updateResponse.json();

    // CREATE CUSTOMER (Manual Fetch)
    const customerResponse = await fetch(
      `https://${process.env.SHOPIFY_STORE_DOMAIN}/admin/api/2026-04/graphql.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": process.env.SHOPIFY_ADMIN_TOKEN!,
        },
        body: JSON.stringify({
          query: `
            mutation customerCreate($input: CustomerInput!) {
              customerCreate(input: $input) {
                userErrors { field message }
              }
            }
          `,
          variables: {
            input: {
              firstName: contact_name || brand_name,
              lastName: "Partner",
              email,
              tags: ["partner"]
            }
          }
        })
      }
    );

    const customerResult = await customerResponse.json();

    // CHECK ERRORS
    const updateErrors = updateResult?.data?.metaobjectUpdate?.userErrors || [];
    const customerErrors = customerResult?.data?.customerCreate?.userErrors || [];

    if (updateErrors.length || customerErrors.length) {
      console.log("GraphQL Errors:", { updateErrors, customerErrors });
      return json(
        { success: false, updateErrors, customerErrors },
        { status: 400, headers: corsHeaders }
      );
    }

    // SUCCESS
    return json(
      { success: true, message: "Application approved" },
      { headers: corsHeaders }
    );

  } catch (error: any) {
    console.log("APPROVE ERROR:", error);
    return json(
      { success: false, error: error.message },
      { status: 500, headers: corsHeaders }
    );
  }
}