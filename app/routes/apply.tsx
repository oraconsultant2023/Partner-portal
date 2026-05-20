import { json } from "@remix-run/node";
import shopify from "../shopify.server";

export async function action({ request }: any) {
  try {
    // 1. Securely authenticate the request. 
    // This automatically verifies it came from Shopify and grabs the correct store session!
    const { admin } = await shopify.authenticate.public.appProxy(request);

    if (!admin) {
      return json({ success: false, error: "Unauthorized App Proxy Request" }, { status: 401 });
    }

    const body = await request.json();
    console.log("FORM DATA RECEIVED:", body);

    // 2. Use the built-in admin.graphql client (no need to manually pass access tokens)
    const response = await admin.graphql(
      `#graphql
        mutation CreateBrandApplication($metaobject: MetaobjectCreateInput!) {
          metaobjectCreate(metaobject: $metaobject) {
            metaobject {
              id
              handle
            }
            userErrors {
              field
              message
            }
          }
        }
      `,
      {
        variables: {
          metaobject: {
            type: "brand_application",
            fields: [
              { key: "brand_name", value: String(body.brand_name || "") },
              { key: "website", value: String(body.website || "") },
              { key: "contact_name", value: String(body.contact_name || "") },
              { key: "email", value: String(body.email || "") },
              { key: "category", value: String(body.category || "") },
              { key: "on_shopify", value: JSON.stringify(body.on_shopify === true) },
              { key: "affiliate_program", value: JSON.stringify(body.affiliate_program === true) },
              { key: "affiliate_link", value: String(body.affiliate_link || "") },
              { key: "placements", value: JSON.stringify(body.placements || []) },
              { key: "status", value: "New" },
              { key: "submitted_at", value: new Date().toISOString() },
              { key: "application_id", value: `APP-${Date.now()}` }
            ],
          },
        },
      }
    );

    const result = await response.json();
    console.log("SHOPIFY API RESULT:", JSON.stringify(result, null, 2));

    return json({ success: true, result });

  } catch (error: any) {
    console.log("SERVER ERROR:", error);
    return json({ success: false, error: error.message }, { status: 500 });
  }
}