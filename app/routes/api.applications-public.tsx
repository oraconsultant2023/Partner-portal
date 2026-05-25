import { json } from "@remix-run/node";

// Define our CORS headers once to reuse them
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "x-admin-secret, Content-Type",
};

// 1. Intercept OPTIONS requests that hit the Action route
export const action = async ({ request }: any) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  return json({ error: "Method not allowed" }, { status: 405, headers: corsHeaders });
};

// 2. Main Loader
export async function loader({ request }: any) {
  
  // Intercept OPTIONS requests that hit the Loader route
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // 3. SECRET CHECK (Only runs on the actual GET request now)
  const key = request.headers.get("x-admin-secret");

  if (key !== process.env.ADMIN_API_SECRET) {
    return json(
      { error: "Unauthorized" },
      { status: 401, headers: corsHeaders } 
    );
  }

  // 4. SHOPIFY AUTH & FETCH
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

  // 5. Return data with CORS headers attached
  return json(applications, { headers: corsHeaders });
}