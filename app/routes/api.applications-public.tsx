import { json } from "@remix-run/node";

// 1. Handle the browser's CORS Preflight (OPTIONS request)
export const action = async ({ request }: any) => {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "x-admin-secret, Content-Type",
      },
    });
  }
  return json({ error: "Method not allowed" }, { status: 405 });
};

// 2. Your main loader for the GET request
export async function loader({ request }: any) {
  
  // Define standard CORS headers to attach to our responses
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "x-admin-secret, Content-Type",
  };

  // SECRET CHECK
  const key = request.headers.get("x-admin-secret");

  if (key !== process.env.ADMIN_API_SECRET) {
    return json(
      { error: "Unauthorized" },
      { status: 401, headers: corsHeaders } // Attach CORS here so the browser can read the rejection
    );
  }

  // SHOPIFY AUTH
  const response = await fetch(
    `https://${process.env.SHOPIFY_STORE_DOMAIN}/admin/api/2026-04/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": process.env.SHOPIFY_ADMIN_TOKEN!,
      },
      body: JSON.stringify({
        query: `
          query {
            metaobjects(
              type: "brand_application",
              first: 50
            ) {
              edges {
                node {
                  id
                  handle
                  capabilities {
                    publishable {
                      status
                    }
                  }
                  fields {
                    key
                    value
                  }
                }
              }
            }
          }
        `
      })
    }
  );

  const result = await response.json();

  const applications = result.data.metaobjects.edges.map((edge: any) => {
    const fields: any = {};

    edge.node.fields.forEach((field: any) => {
      fields[field.key] = field.value;
    });

    return {
      id: edge.node.id,
      brand_name: fields.brand_name || "",
      email: fields.email || "",
      category: fields.category || "",
      publish_status: edge.node.capabilities?.publishable?.status || "ACTIVE"
    };
  });

  // 3. Return the data WITH the CORS headers attached
  return json(applications, { headers: corsHeaders });
}