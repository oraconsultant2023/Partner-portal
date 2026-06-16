import { json, type ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export async function action({ request }: ActionFunctionArgs) {
  // Only allow POST requests
  if (request.method !== "POST") {
    return json({ success: false, error: "Method not allowed" }, { status: 405 });
  }

  const { admin } = await authenticate.public.appProxy(request);
  if (!admin) return json({ success: false, error: "Unauthorized access" }, { status: 401 });

  try {
    const data = await request.json();

    if (!data.campaignId) {
      return json({ success: false, error: "Campaign ID is missing." }, { status: 400 });
    }

    const mutation = `
      mutation UpdateCampaignInvoice($id: ID!, $metaobject: MetaobjectUpdateInput!) {
        metaobjectUpdate(id: $id, metaobject: $metaobject) {
          userErrors { field message }
        }
      }
    `;

    // Ensure it's a valid Shopify GID
    const formattedId = data.campaignId.includes('gid://') 
      ? data.campaignId 
      : `gid://shopify/Metaobject/${data.campaignId}`;

    const variables = {
      id: formattedId,
      metaobject: {
        fields: [
          // Passing 'null' clears the file reference from the metaobject
          { key: "invoice_pdf", value: null } 
        ]
      }
    };

    const response = await admin.graphql(mutation, { variables });
    const result = await response.json();

    if (result.data?.metaobjectUpdate?.userErrors?.length > 0) {
      return json({ success: false, error: result.data.metaobjectUpdate.userErrors[0].message });
    }

    return json({ success: true });
  } catch (error: any) {
    console.error("Delete Invoice Error:", error);
    return json({ success: false, error: error.message }, { status: 500 });
  }
}