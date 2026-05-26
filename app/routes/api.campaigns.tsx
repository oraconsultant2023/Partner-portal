import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export async function loader({ request }: any) {
  // 1. Securely authenticate via App Proxy
  const { admin } = await authenticate.public.appProxy(request);

  if (!admin) {
    return json({ error: "Unauthorized: Must use App Proxy" }, { status: 401 });
  }

  try {
    // 2. Extract parameters from the URL (sent by your Liquid dashboard)
    const url = new URL(request.url);
    const email = url.searchParams.get("email");
    const category = url.searchParams.get("category");

    // 3. Query the Campaigns
    const response = await admin.graphql(`
      query {
        metaobjects(type: "partner_campaign", first: 50) {
          edges {
            node {
              id
              handle
              fields {
                key
                value
              }
            }
          }
        }
      }
    `);

    const result: any = await response.json();

    if (result.errors) {
      console.error("GraphQL Errors:", result.errors);
      return json({ error: "GraphQL Query Failed", details: result.errors }, { status: 500 });
    }

    // 4. Map the Data
    const campaigns = result.data.metaobjects.edges.map((edge: any) => {
      const fields: any = {};
      edge.node.fields.forEach((field: any) => {
        fields[field.key] = field.value;
      });

      return {
        id: edge.node.id,
        handle: edge.node.handle,
        campaign_name: fields.campaign_name || "",
        campaign_type: fields.campaign_type || "",
        target_category: fields.target_category || "",
        partner_email: fields.partner_email || "",
        campaign_summary: fields.campaign_summary || "",
        budget: fields.budget || "",
        requirements: fields.requirements || "",
        placements: fields.placements || "",
        status: fields.status || "",
        start_date: fields.start_date || "",
        end_date: fields.end_date || ""
      };
    })
    // 5. Filter the Campaigns so brands only see what they are allowed to see
    .filter((campaign: any) => {
      if (campaign.campaign_type === "global") return true;
      if (campaign.campaign_type === "private" && campaign.partner_email === email) return true;
      if (campaign.campaign_type === "category" && campaign.target_category === category) return true;
      return false;
    });

    return json(campaigns);

  } catch (error: any) {
    console.log("CAMPAIGN ERROR:", error);
    return json({ success: false, error: error.message }, { status: 500 });
  }
}