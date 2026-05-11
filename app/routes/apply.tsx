import shopify from "../shopify.server";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function loader() {
  return new Response(
    JSON.stringify({ message: "Apply route works" }),
    { headers: corsHeaders }
  );
}

export async function action({ request }: any) {
  try {
    const body = await request.json();
    console.log("FORM DATA RECEIVED:", body);

    // Find the session for your specific test store
    const sessions = await shopify.sessionStorage.findSessionsByShop(
      "gimme-app-testing.myshopify.com"
    );

    if (!sessions.length || !sessions[0].accessToken) {
      return new Response(
        JSON.stringify({ success: false, error: "No Shopify session found" }),
        { headers: corsHeaders }
      );
    }

    const accessToken = sessions[0].accessToken;
    const shop = sessions[0].shop;

    const response = await fetch(
      `https://${shop}/admin/api/2025-01/graphql.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": accessToken,
        },
        body: JSON.stringify({
          query: `
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
        }),
      }
    );

    const result = await response.json();
    console.log("SHOPIFY API RESULT:", JSON.stringify(result, null, 2));

    return new Response(
      JSON.stringify({ success: true, result }),
      { headers: corsHeaders }
    );

  } catch (error: any) {
    console.log("SERVER ERROR:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: corsHeaders }
    );
  }
}